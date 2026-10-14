// ============================================================
// useEchoController: one Echo run, from the tap to the result
// ============================================================
//
// Owns the room's states (echo-machine.ts), the microphone and the audio
// clock (useEchoCapture.ts), Merc's call (merc-call.ts), the sequence
// engine (src/lib/sequence) and everything that answers it: the sky's
// scene (echo-scene.ts), Merc's state and voice, his lines, the chip and
// the ribbon (voice-path.ts).
//
// A run is five phrases at the singer's level, planned as it starts
// (planEchoRun) around a root: the voiceprint's, else the one the last run
// started on, else the first note the singer settles on (the "any easy
// note" pre-roll, settle-note.ts). Each phrase: Merc sings the call, the
// singer sings it back, the constellation it made shows for a moment and
// joins the top band. After the fifth, the result. The microphone opens on
// the tap and closes at the result; Again opens it again.
//
// One capture window per call and response, opened as the call is
// scheduled, so the frames' clock and the audio clock meet at one moment.
// The call is scheduled a little ahead on the audio clock, and every time
// in it is carried to the frames' clock with the output latency: the rings
// fade in on the notes' onsets as the speaker plays them, and the engine
// hears nothing before the call's end plus RESPONSE_GATE_SECONDS (Merc's
// voice through the speaker reaches the mic).
//
// The engine is ticked once per CAPTURED frame, on the frames' own clock,
// never once per screen frame: it dates each note on that clock.

import type { Accessor } from 'solid-js'
import { batch, createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves, HOP_MS } from '@/components/room-kit/merc-moves'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { createScreenAwake } from '@/components/room-kit/screen-awake'
import { levelFromRms } from '@/components/room-kit/voice-level'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_ECHO_STARS } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import { offTarget } from '@/lib/hold/hold-reading'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { settleLiveNote } from '@/lib/hold/settle-note'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { EchoPhrase } from '@/lib/sequence/phrase-bank'
import type { EchoWindow } from '@/lib/sequence/phrase-fit'
import { echoWindow, planEchoRun } from '@/lib/sequence/phrase-fit'
import type { EchoLevelId, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, ECHO_LEVELS, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { PhraseTake } from '@/lib/sequence/sequence-metrics'
import { sequenceMetrics } from '@/lib/sequence/sequence-metrics'
import { rememberedEchoRoot } from '@/stores/echo-store'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevelName } from '@/stores/exercise-level'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { preloadEchoResult } from './echo-art'
import type { PlatePoint } from './echo-geometry'
import type { EchoEvent, EchoState } from './echo-machine'
import { echoReducer, initialEchoState, isRunPhase } from './echo-machine'
import { keepEchoRun, phraseLine, resultLine } from './echo-run'
import type { LiveStage } from './echo-scene'
import { echoScene, keepSame } from './echo-scene'
import type { CallSchedule, CallVoice } from './merc-call'
import type { EchoMoment, LineFields } from './merc-lines'
import { createEchoLines } from './merc-lines'
import { MERC_CALL, preloadMercVoice } from './merc-sampler'
import { phrasePlaces } from './sky-layout'
import type { SkyScene } from './sky-scene'
import { EMPTY_SCENE } from './sky-scene'
import { CaptureError, useEchoCapture } from './useEchoCapture'
import type { VoicePoint, VoiceSample } from './voice-path'
import { voicePath } from './voice-path'

/** The constellation a phrase made shows this long before the next call. */
export const PHRASE_SHOW_MS = 1200
/** Merc's call starts this far ahead of now on the audio clock, s. */
export const CALL_LEAD_SECONDS = 0.35
/** After the singer's settled note, a breath before the first call, s. */
export const SETTLED_LEAD_SECONDS = 0.9
/** Voice over the call, off Merc's note, for this long: "wait for me", s. */
export const EARLY_SECONDS = 0.3
/** Off Merc's note means further than this from its pitch class, semitones. */
const EARLY_SEMITONES = 1.5
/** Nobody sang for this long during a run: the run stops, the mic closes. */
export const QUIET_LIMIT_SECONDS = 60
/** Merc's happy face after a landing, before he listens again, ms. */
const LOCK_FACE_MS = 450
/** Merc's voice while he sings his call (demo-audio's held level). */
const SUNG_LEVEL = 0.8

/** The chip while the singer sings the phrase back. */
export const YOUR_TURN = 'Your turn'

/** The level's id for Echo's rules (ECHO_LEVELS): one per accuracy tier. */
const ECHO_LEVEL_IDS: Readonly<Record<ExerciseLevel, EchoLevelId>> = {
  learning: 'learning',
  singer: 'singer',
  professional: 'professional',
}

const SILENT_VOICE: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 0,
  midi: 57,
}

export interface EchoSummary {
  readonly landed: number
  readonly notes: number
  /** 0 to 100, or null when nothing landed. */
  readonly accuracy: number | null
  /** Notes landed in time, at a level that judges rhythm; else null. */
  readonly inTime: number | null
  readonly improved: boolean
  /** The level the run was sung at ("Singer"). */
  readonly levelName: string
}

export interface EchoController {
  state: Accessor<EchoState>
  scene: Accessor<SkyScene>
  /** Merc's line in his bubble; '' for none. */
  line: Accessor<string>
  /** The chip at the top while the phrase is sung; null for none. */
  chip: Accessor<string | null>
  summary: Accessor<EchoSummary | null>
  mercState: Accessor<MercState>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  /** "Hear it again" is on offer now. */
  canReplay: Accessor<boolean>
  /** Start a run: from the intro, a result or a blocked mic. */
  start: () => void
  /** The mic button during a run: the run stops, nothing kept. */
  stop: () => void
  /** Merc sings the phrase again, from its call. */
  replay: () => void
  /** Where the voice's path goes: the room draws each one it is handed. */
  drawVoice: (sink: (points: readonly VoicePoint[] | null) => void) => void
}

/** The singer's own note, when the room can start its phrases there. */
function offerable(midi: number): boolean {
  return midi >= HOLD_TARGET_MIN_MIDI && midi <= HOLD_TARGET_MAX_MIDI
}

/** A frame's pitch, fractional MIDI, or null when it is not voiced. */
function pitchOf(frame: PitchFrame): number | null {
  const cents = offTarget(frame, 0)
  return cents === null ? null : cents / 100
}

/** How far the speaker is behind the audio clock, s. */
function outputLatency(ctx: AudioContext): number {
  const out = ctx.outputLatency
  if (Number.isFinite(out) && out > 0) return out
  const base = ctx.baseLatency
  return Number.isFinite(base) && base > 0 ? base : 0
}

/** The voice against a note: cents off it, folded to its octave if asked. */
function centsOff(pitch: number, target: number, fold: boolean): number {
  const off = (pitch - target) * 100
  return fold ? off - 1200 * Math.round(off / 1200) : off
}

/** One of Merc's notes in the call, on the frames' clock. */
interface CallNote {
  readonly from: number
  readonly to: number
  readonly midi: number
}

/** The call under way: its sound and its notes on the frames' clock. */
interface Call {
  readonly sound: CallSchedule
  readonly notes: readonly CallNote[]
  /** When the call has ended at the speaker, frames' clock. */
  readonly endsAt: number
}

export interface EchoControllerOptions {
  /** The voice that sings Merc's calls (merc-call.ts). */
  voice?: CallVoice
  /** Picks each run's phrases. */
  random?: () => number
}

export function useEchoController(
  options: EchoControllerOptions = {},
): EchoController {
  const capture = useEchoCapture()
  const voiceOfMerc = options.voice ?? MERC_CALL
  const random = options.random ?? Math.random
  const lines = createEchoLines()
  const voicePreset = untrack(vocalRangePreset)

  const [state, setState] = createSignal<EchoState>(initialEchoState(5))
  const [scene, setSceneSignal] = createSignal<SkyScene>(EMPTY_SCENE)
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [summary, setSummary] = createSignal<EchoSummary | null>(null)
  const [replays, setReplays] = createSignal(0)
  const level = createLevelPreset(ECHO_LEVEL_IDS, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: EchoEvent): void => {
    setState((current) => echoReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = (moment: EchoMoment, fields?: LineFields): void => {
    setLine(lines.next(moment, fields))
  }
  /** The root the next run starts on, if the room has one before it hears the singer. */
  const knownWindow = (settledMidi: number | null = rememberedEchoRoot()) =>
    echoWindow({
      voiceprints: loadLocalVoiceprints(),
      settledMidi,
      voicePreset,
    })
  const sayIntro = (): void => {
    say(knownWindow().source === 'preset' ? 'introAny' : 'intro')
  }

  // ── Timers that belong to the screen ───────────────────────
  let alive = true
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (ms: number, fn: () => void): void => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (alive) fn()
    }, ms)
    timers.add(id)
  }

  // ── Merc ───────────────────────────────────────────────────
  let voice: MercVoice = SILENT_VOICE
  const merc = createMercMoves({
    later,
    still: prefersReducedMotion,
    afterCheer: () => (isRunPhase(phase()) ? 'listen' : 'idle'),
  })
  /** His face changes back after a landing, unless something came after it. */
  let face = 0
  const lockFace = (): void => {
    face += 1
    const mine = face
    merc.mood('lock')
    later(LOCK_FACE_MS, () => {
      if (mine === face && phase() === 'response') merc.mood('listen')
    })
  }

  // ── The run ────────────────────────────────────────────────
  let audio: AudioContext | null = null
  let runLevel: EchoLevelId = untrack(level.preset)
  let phrases: EchoPhrase[] = []
  let takes: PhraseTake[] = []
  let call: Call | null = null
  let engine: SequenceState = createSequenceState(0)
  let processed = 0
  let windowStartedAt = 0
  /** The capture loop runs: a call, a response or the settle is heard. */
  let listening = false
  let loop = 0
  let lastVoiceAt = 0
  /** Voice over the call, off Merc's note, s; shown once per call. */
  let earlySeconds = 0
  let earlyShown = false
  let previousFrame: PitchFrame | null = null
  /** The voice since the last star, and that star's place. */
  let samples: VoiceSample[] = []
  let lastStar: PlatePoint | null = null
  let sink: (points: readonly VoicePoint[] | null) => void = () => undefined

  const rules = () => ECHO_LEVELS[runLevel]
  const livePhrase = (): EchoPhrase | null =>
    phrases[untrack(state).phrase] ?? null
  /** Seconds on the frames' clock: since the window opened. */
  const frameNow = (): number => (performance.now() - windowStartedAt) / 1000

  const setScene = (next: SkyScene): void => {
    setSceneSignal((previous) => keepSame(previous, next))
  }
  /** The sky with the live phrase at `stage`, and the phrases done. */
  const showRun = (stage: LiveStage | null, appearMs?: readonly number[]) => {
    const phrase = livePhrase()
    const { phrase: index, run } = untrack(state)
    setScene(
      echoScene({
        run,
        live:
          stage === null || phrase === null
            ? null
            : {
                index,
                phrase,
                stage,
                outcomes: engine.outcomes,
                listening: stage === 'response' ? engine.current : null,
                appearMs,
              },
        done: takes,
        result: false,
        celebration: false,
      }),
    )
  }

  const startLoop = (): void => {
    listening = true
    if (loop === 0) loop = requestAnimationFrame(tick)
  }
  const stopLoop = (): void => {
    listening = false
    if (loop !== 0) cancelAnimationFrame(loop)
    loop = 0
  }

  /** Open a capture window: the frames' clock starts now. */
  const openWindow = (): void => {
    capture.startWindow()
    windowStartedAt = performance.now()
    processed = 0
    previousFrame = null
  }

  /** Merc sings the live phrase's call; the response follows it. */
  const beginCall = (lead = CALL_LEAD_SECONDS): void => {
    const phrase = livePhrase()
    const ctx = audio
    if (phrase === null || ctx === null) return
    call?.sound.stop()
    openWindow()
    const a0 = ctx.currentTime
    const latency = outputLatency(ctx)
    const sound = voiceOfMerc.sing(ctx, phrase.notes, a0 + lead)
    const onFrames = (t: number): number => t - a0 + latency
    call = {
      sound,
      notes: phrase.notes.map((note, i) => ({
        from: onFrames(sound.onsets[i]),
        to: onFrames(sound.onsets[i] + note.seconds),
        midi: note.midi,
      })),
      endsAt: onFrames(sound.endAt),
    }
    engine = createSequenceState(call.endsAt + RESPONSE_GATE_SECONDS)
    samples = []
    lastStar = null
    earlySeconds = 0
    earlyShown = false
    sink(null)
    setChip(null)
    showRun(
      'call',
      call.notes.map((note) => Math.max(0, Math.round(note.from * 1000))),
    )
    merc.set('sing')
    if (untrack(state).phrase === phrases.length - 1) preloadEchoResult()
    startLoop()
  }

  /** A new phrase's call: its own allowance of "hear it again". */
  const callPhrase = (lead?: number): void => {
    const allowance = rules().hearAgain
    setReplays(
      allowance === 'anyTime'
        ? Number.POSITIVE_INFINITY
        : allowance === 'oncePerPhrase'
          ? 1
          : 0,
    )
    beginCall(lead)
  }

  /** The call has ended at the speaker: the singer's turn. */
  const toResponse = (): void => {
    dispatch({ type: 'heard' })
    setChip(YOUR_TURN)
    merc.set('listen')
    showRun('response')
  }

  /** Merc's voice from his own line, while he sings. */
  const callVoice = (): MercVoice => {
    const t = frameNow()
    const note = call?.notes.find((n) => t >= n.from && t < n.to)
    return note === undefined
      ? { ...voice, voiced: false, level: 0 }
      : {
          voiced: true,
          cents: 0,
          level: SUNG_LEVEL,
          steady: 1,
          midi: note.midi,
        }
  }

  /**
   * Singing over the call, off Merc's note: once a call, Merc asks to be
   * let finish. It is his line, so his bubble says it, not the chip.
   */
  const watchEarly = (frame: PitchFrame, pitch: number | null): void => {
    if (earlyShown || call === null || pitch === null) return
    const dt = previousFrame === null ? 0 : frame.t - previousFrame.t
    const sounding = call.notes.find((n) => frame.t >= n.from && frame.t < n.to)
    if (sounding === undefined) return
    const apart = Math.abs(centsOff(pitch, sounding.midi, true)) / 100
    if (apart <= EARLY_SEMITONES) return
    earlySeconds += dt
    if (earlySeconds < EARLY_SECONDS) return
    earlyShown = true
    say('early')
  }

  /** The singer's voice against the note listened for: Merc and the ribbon. */
  const hearVoice = (frame: PitchFrame, pitch: number): void => {
    const phrase = livePhrase()
    const note =
      phrase?.notes[Math.min(engine.current, phrase.notes.length - 1)]
    if (note === undefined) return
    const { tolCents, octaveFold } = rules()
    const cents = centsOff(pitch, note.midi, octaveFold)
    const midi = note.midi + cents / 100
    voice = {
      voiced: true,
      cents,
      level: levelFromRms(frame.rms),
      steady: 1 - Math.min(1, Math.abs(cents) / tolCents),
      midi,
    }
    if (frame.t >= engine.responseStart) {
      samples.push({ midi, filling: Math.abs(cents) <= tolCents })
    }
  }

  const onEvent = (event: SequenceEvent): void => {
    if (event.type === 'phraseEnd') {
      endPhrase()
      return
    }
    if (event.type === 'land') {
      haptics.tapLight()
      lockFace()
      const phrase = livePhrase()
      lastStar =
        phrase === null
          ? null
          : (phrasePlaces(phrase.notes.map((n) => n.midi))[event.index] ?? null)
      samples = []
    }
    showRun('response')
  }

  /** The ribbon from the last star to the note being sung. */
  const drawRibbon = (): void => {
    const phrase = livePhrase()
    if (phrase === null || engine.ended) return
    const midis = phrase.notes.map((n) => n.midi)
    const places = phrasePlaces(midis)
    const at = places[Math.min(engine.current, places.length - 1)]
    sink(voicePath(samples, lastStar, at.u, midis))
  }

  /** One captured frame through the engine, in the call or the response. */
  const hearFrame = (frame: PitchFrame): void => {
    const phrase = livePhrase()
    if (phrase === null) return
    const pitch = pitchOf(frame)
    if (pitch === null) voice = { ...voice, voiced: false, level: 0 }
    else {
      lastVoiceAt = performance.now()
      hearVoice(frame, pitch)
    }
    if (phase() === 'call') watchEarly(frame, pitch)
    previousFrame = frame
    engine = tickSequence(engine, frame, phrase, rules())
    for (const event of engine.events) onEvent(event)
  }

  /** The call and the response: every new frame, then the turn if it came. */
  const follow = (frames: readonly PitchFrame[]): void => {
    const from = processed
    processed = frames.length
    for (let i = from; i < frames.length && listening; i++) {
      hearFrame(frames[i])
    }
    if (!listening) return
    if (phase() === 'call' && call !== null && frameNow() >= call.endsAt) {
      toResponse()
    }
    if (phase() === 'response' && frames.length > from) drawRibbon()
  }

  /** No root yet: the first note the singer settles on starts the phrases. */
  const findRoot = (frames: readonly PitchFrame[]): void => {
    if (frames.length === processed) return
    processed = frames.length
    const pitch = pitchOf(frames[frames.length - 1])
    if (pitch !== null) {
      lastVoiceAt = performance.now()
      voice = { ...SILENT_VOICE, voiced: true, level: 0.6, midi: pitch }
    }
    const heard = settleLiveNote(frames)
    const midi = heard === null ? null : Math.round(heard)
    if (midi === null || !offerable(midi)) return
    plan(knownWindow(heard))
    dispatch({ type: 'settled' })
    say('found', { note: midiToNoteNameOctave(midi) })
    callPhrase(SETTLED_LEAD_SECONDS)
  }

  /** A minute with no voice during a run: it stops, and the mic closes. */
  const restIfQuiet = (): void => {
    if (performance.now() - lastVoiceAt <= QUIET_LIMIT_SECONDS * 1000) return
    dropRun('rest')
    say('rest')
  }

  function tick(): void {
    loop = 0
    if (!alive || !listening) return
    const frames = capture.peekFrames()
    if (phase() === 'settle') findRoot(frames)
    else follow(frames)
    if (listening) restIfQuiet()
    if (alive && listening && loop === 0) loop = requestAnimationFrame(tick)
  }

  /** The run's five phrases around the window's root, at the run's level. */
  const plan = (window: EchoWindow): void => {
    phrases = planEchoRun({
      level: runLevel,
      window,
      seed: Math.floor(random() * 2 ** 31),
    })
    takes = []
  }

  /** A phrase is over: its line, and the next call after a moment. */
  function endPhrase(): void {
    const phrase = livePhrase()
    if (phrase === null) return
    stopLoop()
    capture.takeFrames()
    const take: PhraseTake = { phrase, outcomes: engine.outcomes }
    sink(null)
    voice = SILENT_VOICE
    dispatch({ type: 'phrase-end' })
    setChip(null)
    showRun('done')
    const { moment, fields } = phraseLine(take, rules().tolCents)
    say(moment, fields)
    takes = [...takes, take]
    if (take.outcomes.every((outcome) => outcome.landed)) {
      haptics.success()
      merc.set(prefersReducedMotion() ? 'lock' : 'hop')
      later(HOP_MS, () => {
        if (phase() === 'between') merc.set('idle')
      })
    } else {
      merc.set('idle')
    }
    later(PHRASE_SHOW_MS, nextPhrase)
  }

  function nextPhrase(): void {
    if (phase() !== 'between') return
    dispatch({ type: 'next' })
    if (phase() === 'call') callPhrase()
    else if (phase() === 'result') finishRun()
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(): void {
    capture.release()
    const { rhythmToleranceMs } = rules()
    const metrics = sequenceMetrics(takes, rhythmToleranceMs)
    const levelName = exerciseLevelName(runLevel)
    const { improved } = keepEchoRun(runLevel, metrics, phrases[0]?.root ?? 0)
    const all = metrics.notes > 0 && metrics.landed === metrics.notes
    batch(() => {
      setSummary({
        landed: metrics.landed,
        notes: metrics.notes,
        accuracy: metrics.accuracy,
        inTime: metrics.rhythm?.inTime ?? null,
        improved,
        levelName,
      })
      setScene(
        echoScene({
          run: untrack(state).run,
          live: null,
          done: takes,
          result: true,
          celebration: improved || all,
        }),
      )
      const { moment, fields } = resultLine(metrics, improved, levelName)
      say(moment, fields)
    })
    if (improved || all) {
      haptics.success()
      merc.cheer()
    } else {
      merc.set('idle')
    }
  }

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(type: 'stop' | 'rest' | 'leave'): void {
    stopLoop()
    call?.sound.stop()
    call = null
    capture.release()
    sink(null)
    voice = SILENT_VOICE
    takes = []
    batch(() => {
      dispatch({ type })
      setChip(null)
      setScene(EMPTY_SCENE)
    })
    merc.stopCheering()
    merc.set('idle')
  }

  // ── What the singer does ───────────────────────────────────
  /** The mic opens inside the tap; the run starts once it has. */
  const openMic = (): void => {
    const { run } = untrack(state)
    const stands = (): boolean =>
      alive && phase() === 'starting' && untrack(state).run === run
    void capture
      .acquire()
      .then(() => capture.audio())
      .then(
        (ctx) => {
          if (!stands()) return
          if (ctx === null) {
            dispatch({ type: 'mic-failed', run, block: 'unavailable' })
            merc.set('idle')
            return
          }
          audio = ctx
          lastVoiceAt = performance.now()
          const window = knownWindow()
          const rooted = window.source !== 'preset'
          dispatch({ type: 'mic-ready', run, rooted })
          if (rooted) {
            plan(window)
            callPhrase()
          } else {
            openWindow()
            merc.set('listen')
            startLoop()
          }
          // The page went away while the microphone opened.
          if (document.visibilityState === 'hidden') leave()
        },
        (error: unknown) => {
          if (!stands()) return
          dispatch({
            type: 'mic-failed',
            run,
            block:
              error instanceof CaptureError ? error.failure : 'unavailable',
          })
          merc.set('idle')
        },
      )
  }

  const start = (): void => {
    const from = phase()
    if (from !== 'intro' && from !== 'result' && from !== 'blocked') return
    level.take()
    runLevel = untrack(level.preset)
    dispatch({ type: 'start' })
    batch(() => {
      setSummary(null)
      setScene(EMPTY_SCENE)
      setChip(null)
    })
    if (from === 'result') say('again')
    merc.stopCheering()
    merc.set('listen')
    openMic()
  }

  const stop = (): void => {
    if (!isRunPhase(phase())) return
    dropRun('stop')
    sayIntro()
  }

  const replay = (): void => {
    if (phase() !== 'response' || untrack(replays) <= 0) return
    setReplays((left) => left - 1)
    dispatch({ type: 'replay' })
    say('replay')
    beginCall()
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as Back drops it (owner, 11 Oct 2026: an exercise gets
   * done or not): no result, no best.
   */
  function leave(): void {
    if (!isRunPhase(phase())) return
    dropRun('leave')
    say('left')
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    // Merc's voice loads as the singer comes in, before the first call.
    if (options.voice === undefined) preloadMercVoice()
    sayIntro()
    later(1100, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
  })

  // The clock stops with the page, and a run must not go on without the
  // singer hearing it.
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') leave()
  }
  document.addEventListener('visibilitychange', onVisibility)

  // The screen stays on, and the rail out of reach, while a run is on.
  const awake = createScreenAwake()
  createEffect(() => {
    const running = isRunPhase(state().phase)
    awake.set(running)
    setExerciseFocus(running)
  })

  // The app's mic watchdog: the icon is on while the run hears the
  // singer, and a microphone that died under it stops the run.
  const unregisterIndicator = registerMicIndicator(
    EXERCISE_ECHO_STARS,
    () => isRunPhase(phase()) && phase() !== 'starting',
    stop,
  )

  onCleanup(() => {
    alive = false
    stopLoop()
    call?.sound.stop()
    for (const id of timers) clearTimeout(id)
    timers.clear()
    document.removeEventListener('visibilitychange', onVisibility)
    unregisterIndicator()
    awake.set(false)
    setExerciseFocus(false)
  })

  return {
    state,
    scene,
    line,
    chip,
    summary,
    mercState: merc.state,
    mercVoice: () => (phase() === 'call' ? callVoice() : voice),
    canReplay: () => state().phase === 'response' && replays() > 0,
    start,
    stop,
    replay,
    drawVoice: (next) => {
      sink = next
    },
  }
}
