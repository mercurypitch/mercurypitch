// Adventure melody session — configures one durable lesson attempt and forwards fresh capture only to the game judge.

import type { BreakableDefinition, LevelDefinition, MelodyChallengeDefinition, PitchObservation, } from '../contracts'
import type { CompiledMelody } from '../core/melody-contour'
import { compileMelody, sampleMelodyAtPhase } from '../core/melody-contour'
import type { GlassSound, GlassVoiceSession } from '../host'
import type { MelodyJudgeSnapshot } from '../melody-contracts'
import type { MelodyAdventureController, MelodyAdventureOptions, MelodyAdventureSnapshot, } from './melody-adventure-contract'

export type {
  MelodyAdventureController,
  MelodyAdventureMode,
  MelodyAdventureOptions,
  MelodyAdventureSnapshot,
} from './melody-adventure-contract'
import { createMelodyAdventureEvidence } from './melody-adventure-evidence'
import { COMFORTABLE_NOTE_PREFERENCE, melodyPacePreference, readComfortableMidi, readMelodyPace, } from './melody-adventure-preferences'
import { feedbackCopy } from './melody-practice-copy'
import type { MercMelodyReferenceFactory } from './merc-melody-reference'
import { createMercMelodyReferenceFactory } from './merc-melody-reference'
import type { MicrophoneIssue } from './mic-error'
import { microphoneIssue } from './mic-error'

type MelodyBreakable = BreakableDefinition & {
  challenge: MelodyChallengeDefinition
}

function randomAttemptId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid === undefined
    ? `melody-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    : `melody-${uuid}`
}

function melodyEncounter(
  level: LevelDefinition,
  encounterId: string,
): MelodyBreakable | null {
  const candidate = level.breakables.find((item) => item.id === encounterId)
  if (
    candidate === undefined ||
    (candidate.challenge.kind !== 'melody-anchor' &&
      candidate.challenge.kind !== 'melody-contour')
  )
    return null
  return candidate as MelodyBreakable
}

function copyJudge(
  judge: MelodyJudgeSnapshot | null,
): MelodyJudgeSnapshot | null {
  return judge === null
    ? null
    : {
        ...judge,
        coveredAnchorIds: [...judge.coveredAnchorIds],
        completedPhraseIds: [...judge.completedPhraseIds],
      }
}

export function createMelodyAdventureChallenge(
  options: MelodyAdventureOptions,
): MelodyAdventureController {
  const lesson = options.level.melodyLesson
  if (lesson === undefined)
    throw new Error('A melody adventure controller requires a lesson.')
  const now = options.now ?? (() => performance.now())
  const ownsReferences = options.references === undefined
  let state: MelodyAdventureSnapshot = {
    mode: 'off',
    challengeKind: null,
    encounterId: null,
    pitch: null,
    target: null,
    message: '',
    hint: '',
    stepIndex: 0,
    stepCount: 1,
    stepCharge: 0,
    contour: null,
    judge: null,
    timelineSeconds: 0,
    comfortableMidi: null,
    rootMidi: null,
    pace: lesson.defaultPace,
    allowedPaces: [...lesson.allowedPaces],
    frozen: false,
    needsFreshAttempt: false,
  }
  let current: MelodyBreakable | null = null
  let comfortableMidi: number | null = null
  let pace = lesson.defaultPace
  let transposeSemitones = 0
  let attemptId = ''
  let contour: CompiledMelody | null = null
  let voice: GlassVoiceSession | null = null
  let sound: GlassSound | null = null
  let reference: ReturnType<MercMelodyReferenceFactory['create']> | null = null
  let stopObserving: (() => void) | null = null
  let releaseHeld = false
  let disposed = false
  let generation = 0
  let shatterTimer: ReturnType<typeof setTimeout> | undefined
  const evidence = createMelodyAdventureEvidence(lesson.allowedRange)

  const emit = (patch: Partial<MelodyAdventureSnapshot> = {}): void => {
    const judge = Object.hasOwn(patch, 'judge') ? patch.judge! : state.judge
    state = {
      ...state,
      ...patch,
      comfortableMidi,
      rootMidi: contour?.rootMidi ?? null,
      pace,
      contour,
      judge: copyJudge(judge),
      allowedPaces: [...lesson.allowedPaces],
    }
    options.onChange(state)
  }

  const references =
    options.references ??
    createMercMelodyReferenceFactory(options.host, {
      onGuideFallback: () => {
        if (state.mode === 'reference')
          emit({
            hint: 'The exact synthesized guide is playing in your saved key and pace. Your turn starts after the quiet.',
          })
      },
    })

  const lessonHasProgress = (): boolean =>
    lesson.stations.some((station) =>
      options.game
        .snapshot()
        .completedBreakableIds.includes(station.encounterId),
    )

  const tryContour = (comfortable: number): CompiledMelody | null => {
    try {
      return compileMelody(lesson.melody, {
        rootMidi: comfortable - lesson.comfortableOffsetSemitones,
        pace,
        transposeSemitones,
        allowedRange: lesson.allowedRange,
      })
    } catch {
      return null
    }
  }

  const markEvidenceBoundary = (): void => {
    const boundary = now()
    evidence.markBoundary(voice?.latest(boundary) ?? null, boundary)
  }

  const holdSilence = (): Promise<void> => {
    releaseHeld = true
    return options.beforeCapture()
  }

  const releaseSilence = (): void => {
    if (!releaseHeld) return
    releaseHeld = false
    options.onReleaseVoice()
  }

  const stopReference = (): void => {
    const active = reference
    reference = null
    active?.stop()
    active?.dispose()
  }

  const stopVoice = (): void => {
    stopObserving?.()
    stopObserving = null
    voice?.stop()
    voice = null
    evidence.reset()
  }

  const stopSound = (): void => {
    sound?.dispose()
    sound = null
  }

  const stopOwnedAudio = (): void => {
    stopReference()
    stopVoice()
    stopSound()
    releaseSilence()
  }

  const fail = (message: string, microphone?: MicrophoneIssue): void => {
    generation++
    stopOwnedAudio()
    options.game.cancelEncounter()
    options.onPauseAudio()
    if (!disposed && options.canPlay()) options.game.setPaused(false)
    if (disposed) return
    current = null
    emit({
      mode: 'off',
      challengeKind: null,
      encounterId: null,
      pitch: null,
      target: null,
      message: '',
      hint: '',
      judge: null,
      timelineSeconds: 0,
    })
    options.onError(message, microphone)
  }

  const syncProgress = (): void => {
    const active = options.game.snapshot().activeEncounter
    if (active === null || state.mode === 'off') return
    if (active.targetKind === 'melody-contour') {
      const judge = active.melodyJudge
      const copy = feedbackCopy(judge)
      emit({
        target: active.targetMidi,
        stepIndex: active.stepIndex,
        stepCount: active.stepCount,
        stepCharge: active.stepCharge,
        judge,
        timelineSeconds:
          contour === null
            ? 0
            : sampleMelodyAtPhase(contour, judge.progress).timeSeconds,
        message: copy.message,
        hint: copy.hint,
      })
      return
    }
    emit({
      target: active.targetMidi,
      stepIndex: active.stepIndex,
      stepCount: active.stepCount,
      stepCharge: active.stepCharge,
      judge: null,
      timelineSeconds: 0,
    })
  }

  const configureAttempt = (): boolean => {
    if (comfortableMidi === null) return false
    const nextContour = tryContour(comfortableMidi)
    if (nextContour === null) {
      emit({
        message: 'Choose another easy note.',
        hint: 'This key would put part of the phrase outside the supported range.',
        target: null,
      })
      return false
    }
    const result = options.game.configureMelodyAttempt({
      attemptId,
      comfortableMidi,
      pace,
      transposeSemitones,
    })
    if (!result.ok) {
      if (result.reason === 'frozen') {
        emit({
          mode: 'setup',
          frozen: true,
          needsFreshAttempt: true,
          message: 'Start fresh to change this key.',
          hint: 'Completed stations stay tied to the key and pace you learned.',
        })
      }
      return false
    }
    contour = compileMelody(lesson.melody, {
      rootMidi: result.attempt.rootMidi,
      pace: result.attempt.pace,
      transposeSemitones: result.attempt.transposeSemitones,
      allowedRange: lesson.allowedRange,
    })
    pace = result.attempt.pace
    transposeSemitones = result.attempt.transposeSemitones
    if (result.changed) options.host.saveProgress(options.game.saveProgress())
    return true
  }

  const startFinding = (): void => {
    evidence.resetCalibration()
    emit({
      mode: 'finding',
      pitch: null,
      target: null,
      message: 'Hum an easy middle note.',
      hint: 'Hold it gently and steadily. This centers the five-note phrase around your voice.',
    })
  }

  const referenceCopy = (): { message: string; hint: string } =>
    current?.challenge.kind === 'melody-contour'
      ? {
          message: 'Listen to the whole shape.',
          hint: 'Your turn begins only after the example becomes quiet.',
        }
      : {
          message: 'Listen to this note.',
          hint: 'Your turn begins when the note becomes quiet.',
        }

  const playReference = async (
    run: number,
    captured: boolean,
  ): Promise<void> => {
    if (current === null || contour === null || disposed || run !== generation)
      return
    const copy = referenceCopy()
    const wholePhraseHint =
      current.challenge.kind === 'melody-contour'
        ? references.availability(contour).kind === 'voice'
          ? 'Hear Merc sing the phrase in your saved key and pace. Your turn starts after the quiet.'
          : 'Hear the exact synthesized guide in your saved key and pace. Your turn starts after the quiet.'
        : copy.hint
    emit({
      mode: 'reference',
      pitch: null,
      judge: null,
      timelineSeconds: 0,
      message: copy.message,
      hint: wholePhraseHint,
    })
    try {
      const challenge = current.challenge
      if (challenge.kind === 'melody-anchor') {
        const anchor = contour.anchors.find(
          (candidate) => candidate.id === challenge.anchorId,
        )
        if (anchor === undefined || sound === null)
          throw new Error('The lesson note is unavailable.')
        emit({ target: anchor.midi })
        await sound.reference(anchor.midi)
      } else {
        const player = references.create(contour)
        reference = player
        await player.play((seconds) => {
          if (disposed || run !== generation || reference !== player) return
          emit({
            timelineSeconds: Math.max(
              0,
              Math.min(contour!.durationSeconds, seconds),
            ),
          })
        })
        if (reference === player) {
          player.dispose()
          reference = null
        }
      }
      if (disposed || run !== generation) return
      if (!captured) {
        stopReference()
        stopSound()
        releaseSilence()
        emit({
          mode: 'setup',
          message: 'Ready when you are.',
          hint: 'Start singing to hear it once more, then answer after the quiet.',
          timelineSeconds: 0,
        })
        return
      }
      markEvidenceBoundary()
      emit({
        mode: 'singing',
        message:
          current.challenge.kind === 'melody-contour'
            ? 'Follow the ribbon.'
            : 'Hold this note gently.',
        hint:
          current.challenge.kind === 'melody-contour'
            ? 'Follow all five notes to wake the portrait.'
            : 'A steady hum is enough. There is no need to sing loudly.',
        timelineSeconds: 0,
      })
      syncProgress()
    } catch {
      if (disposed || run !== generation) return
      fail(
        'The melody could not play. Tap Sing to try again when audio is available.',
      )
    }
  }

  const beginChallenge = async (run: number): Promise<void> => {
    if (
      current === null ||
      disposed ||
      run !== generation ||
      !configureAttempt()
    )
      return
    if (!options.canPlay()) {
      cancel()
      return
    }
    options.game.setPaused(false)
    if (!options.game.beginEncounter(current.id)) {
      fail(
        'That station is no longer ready. Step back onto its glowing circle.',
      )
      return
    }
    syncProgress()
    await playReference(run, true)
  }

  const acceptCalibration = (candidate: number): void => {
    const nextContour = tryContour(candidate)
    if (nextContour === null) {
      evidence.resetCalibration()
      emit({
        pitch: null,
        message: 'Try another easy middle note.',
        hint: 'Hold the new note gently. The whole phrase must stay inside the supported range.',
      })
      return
    }
    comfortableMidi = candidate
    contour = nextContour
    options.host.writePreference(COMFORTABLE_NOTE_PREFERENCE, String(candidate))
    evidence.resetCalibration()
    void beginChallenge(generation)
  }

  const observe = (
    observation: PitchObservation,
    observedAtMs: number,
  ): void => {
    if (disposed) return
    const accepted = evidence.accept(observation, observedAtMs)
    if (accepted === null) return
    emit({ pitch: accepted.voicedMidi })
    if (state.mode === 'finding') {
      if (accepted.voicedMidi === null) {
        evidence.resetCalibration()
        return
      }
      const candidate = evidence.calibrationCandidate(
        accepted.voicedMidi,
        observation.captureSeconds,
      )
      if (candidate !== null) acceptCalibration(candidate)
      return
    }
    if (state.mode !== 'singing') return
    const batch = options.game.feedPitch(observation, observedAtMs)
    options.onEvents(batch)
    syncProgress()
  }

  const open = (encounterId: string): void => {
    if (disposed || state.mode !== 'off' || !options.canPlay()) return
    const encounter = melodyEncounter(options.level, encounterId)
    if (encounter === null) return
    const restored = options.game.snapshot().melodyAttempt ?? null
    current = encounter
    pace =
      restored?.lessonId === lesson.id
        ? restored.pace
        : readMelodyPace(options.host, lesson)
    comfortableMidi =
      restored?.lessonId === lesson.id
        ? restored.comfortableMidi
        : readComfortableMidi(options.host, lesson.allowedRange)
    transposeSemitones =
      restored?.lessonId === lesson.id ? restored.transposeSemitones : 0
    attemptId =
      restored?.lessonId === lesson.id
        ? restored.attemptId
        : (options.createAttemptId?.() ?? randomAttemptId())
    contour = comfortableMidi === null ? null : tryContour(comfortableMidi)
    if (comfortableMidi !== null && contour === null) {
      comfortableMidi = null
      options.host.writePreference(COMFORTABLE_NOTE_PREFERENCE, '')
    }
    const frozen = lessonHasProgress()
    const anchorId =
      encounter.challenge.kind === 'melody-anchor'
        ? encounter.challenge.anchorId
        : null
    const target =
      anchorId !== null
        ? (contour?.anchors.find((anchor) => anchor.id === anchorId)?.midi ??
          null)
        : (contour?.anchors[0]?.midi ?? null)
    options.game.setPaused(true)
    emit({
      mode: 'setup',
      challengeKind: encounter.challenge.kind,
      encounterId,
      pitch: null,
      target,
      message:
        encounter.challenge.kind === 'melody-contour'
          ? 'Sing the whole Sunlit Steps phrase.'
          : 'Learn this note of Sunlit Steps.',
      hint:
        comfortableMidi === null
          ? 'First find one easy middle note, then the lesson will center every station around it.'
          : 'Choose the pace before listening. Your key stays the same along the route.',
      stepIndex: 0,
      stepCount:
        encounter.challenge.kind === 'melody-contour'
          ? lesson.melody.phrases.reduce(
              (total, phrase) => total + phrase.anchors.length,
              0,
            )
          : 1,
      stepCharge: 0,
      judge: null,
      timelineSeconds: 0,
      frozen,
      needsFreshAttempt: false,
    })
    if (frozen) void begin()
  }

  const begin = async (): Promise<void> => {
    if (
      disposed ||
      current === null ||
      state.mode !== 'setup' ||
      state.needsFreshAttempt ||
      !options.canPlay()
    )
      return
    const run = ++generation
    stopOwnedAudio()
    evidence.reset()
    options.game.setPaused(true)
    emit({
      mode: 'permission',
      pitch: null,
      judge: null,
      timelineSeconds: 0,
      message: 'Opening the mic…',
      hint: 'The museum will stay still while permission opens.',
    })
    try {
      const session = options.host.createVoice()
      voice = session
      sound = options.host.createSound(current ?? undefined)
      const quiet = sound.prepareShatter
        ? Promise.all([holdSilence(), sound.prepareShatter()]).then(
            () => undefined,
          )
        : holdSilence()
      await session.start(quiet)
      if (disposed || run !== generation || voice !== session) {
        session.stop()
        return
      }
      markEvidenceBoundary()
      stopObserving = session.subscribe(
        (observation, observedAtMs) => {
          if (!disposed && voice === session) observe(observation, observedAtMs)
        },
        () => {
          if (disposed || voice !== session) return
          fail('Audio was interrupted. Tap Sing to try again.')
        },
      )
      if (comfortableMidi === null) {
        startFinding()
        return
      }
      await beginChallenge(run)
    } catch (cause) {
      if (disposed || run !== generation) return
      const issue = microphoneIssue(cause)
      fail(issue.message, issue)
    }
  }

  const hear = async (): Promise<void> => {
    if (
      disposed ||
      current === null ||
      state.mode !== 'setup' ||
      comfortableMidi === null ||
      state.needsFreshAttempt ||
      !options.canPlay() ||
      !configureAttempt()
    )
      return
    const run = ++generation
    stopOwnedAudio()
    try {
      if (current.challenge.kind === 'melody-anchor')
        sound = options.host.createSound(current ?? undefined)
      else reference = references.create(contour!)
      const quiet = holdSilence()
      await quiet
      if (disposed || run !== generation) return
      if (current.challenge.kind === 'melody-contour') {
        const prepared = reference
        if (prepared === null) return
        // playReference creates its own player after capture; use the gesture-created
        // player for a setup audition so browser audio activation is preserved.
        emit({
          mode: 'reference',
          message: 'Listen to the whole shape.',
          hint: 'This is a listening example; the microphone is not being judged.',
          timelineSeconds: 0,
        })
        await prepared.play((seconds) => {
          if (disposed || run !== generation || reference !== prepared) return
          emit({ timelineSeconds: Math.min(contour!.durationSeconds, seconds) })
        })
        if (disposed || run !== generation || reference !== prepared) return
        prepared.dispose()
        reference = null
        releaseSilence()
        emit({
          mode: 'setup',
          message: 'Ready when you are.',
          hint: 'Start singing to hear it once more, then answer after the quiet.',
          timelineSeconds: 0,
        })
        return
      }
      await playReference(run, false)
    } catch {
      if (disposed || run !== generation) return
      fail('The melody could not play. Tap Hear example to try again.')
    }
  }

  const replay = async (): Promise<void> => {
    if (
      disposed ||
      current === null ||
      state.mode !== 'singing' ||
      voice === null ||
      sound === null
    )
      return
    const run = ++generation
    options.game.cancelEncounter()
    if (!options.game.beginEncounter(current.id)) {
      fail(
        'That station is no longer ready. Step back onto its glowing circle.',
      )
      return
    }
    await playReference(run, true)
  }

  const setPace = (next: number): void => {
    if (
      disposed ||
      state.mode !== 'setup' ||
      state.frozen ||
      !lesson.allowedPaces.includes(next)
    )
      return
    pace = next
    options.host.writePreference(melodyPacePreference(lesson.id), String(next))
    contour = comfortableMidi === null ? null : tryContour(comfortableMidi)
    emit({ timelineSeconds: 0 })
  }

  const changeKey = (): void => {
    if (disposed || current === null) return
    const frozen = lessonHasProgress()
    generation++
    stopOwnedAudio()
    options.game.cancelEncounter()
    options.game.setPaused(true)
    if (frozen) {
      emit({
        mode: 'setup',
        frozen: true,
        needsFreshAttempt: true,
        message: 'Start fresh to change this key.',
        hint: 'The five learned stations remain tied to this route attempt.',
        pitch: null,
        judge: null,
        timelineSeconds: 0,
      })
      return
    }
    comfortableMidi = null
    contour = null
    options.host.writePreference(COMFORTABLE_NOTE_PREFERENCE, '')
    emit({
      mode: 'setup',
      target: null,
      pitch: null,
      judge: null,
      timelineSeconds: 0,
      message: 'Find a new comfortable key.',
      hint: 'Start singing, then hold one easy middle note steadily.',
    })
  }

  const cancel = (): void => {
    generation++
    stopOwnedAudio()
    clearTimeout(shatterTimer)
    shatterTimer = undefined
    options.game.cancelEncounter()
    current = null
    contour = null
    if (!disposed && options.canPlay()) options.game.setPaused(false)
    emit({
      mode: 'off',
      challengeKind: null,
      encounterId: null,
      pitch: null,
      target: null,
      message: '',
      hint: '',
      stepIndex: 0,
      stepCount: 1,
      stepCharge: 0,
      judge: null,
      timelineSeconds: 0,
      frozen: false,
      needsFreshAttempt: false,
    })
  }

  const completeBreak = (): void => {
    if (state.mode === 'off') return
    generation++
    stopReference()
    stopVoice()
    releaseSilence()
    sound?.shatter()
    const finished = sound
    shatterTimer = setTimeout(() => {
      finished?.dispose()
      if (sound === finished) sound = null
    }, 3000)
    current = null
    contour = null
    emit({
      mode: 'off',
      challengeKind: null,
      encounterId: null,
      pitch: null,
      target: null,
      message: '',
      hint: '',
      judge: null,
      timelineSeconds: 0,
    })
  }

  emit()
  return {
    snapshot: () => state,
    open,
    begin,
    hear,
    replay,
    setPace,
    changeKey,
    cancel,
    completeBreak,
    dispose() {
      if (disposed) return
      disposed = true
      cancel()
      if (ownsReferences) references.dispose()
    },
  }
}
