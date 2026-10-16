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
//
// The "how it works" demo sings its takes through this same room, by
// `script` (scripted-take.ts): frames in place of the mic, Merc's call on
// the take's own clock, and nothing kept, said or felt.

import { batch, createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves, HOP_MS } from '@/components/room-kit/merc-moves'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { createScreenAwake } from '@/components/room-kit/screen-awake'
import { levelFromRms, newestLevel } from '@/components/room-kit/voice-level'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_ECHO_STARS } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { settleLiveNote } from '@/lib/hold/settle-note'
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
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { CallNote, EarlyWatch } from './early-singing'
import { centsOff, NO_EARLY, pitchOf, watchEarly } from './early-singing'
import { preloadEchoResult } from './echo-art'
import type { EchoController, EchoControllerOptions, EchoSummary, } from './echo-controller-contract'
import { CALL_LEAD_SECONDS, DEMO_PHRASE_SHOW_MS, PHRASE_SHOW_MS, QUIET_LIMIT_SECONDS, SETTLED_LEAD_SECONDS, YOUR_TURN, } from './echo-controller-contract'
import type { PlatePoint } from './echo-geometry'
import type { EchoEvent, EchoState } from './echo-machine'
import { echoReducer, initialEchoState, isRunPhase } from './echo-machine'
import { keepEchoRun, phraseLine, resultLine, showResultOf } from './echo-run'
import type { LiveStage } from './echo-scene'
import { echoScene, keepSame } from './echo-scene'
import type { Call } from './merc-call'
import { scheduleCall } from './merc-call'
import type { EchoMoment, LineFields } from './merc-lines'
import { createEchoLines } from './merc-lines'
import { MERC_CALL, preloadMercVoice } from './merc-sampler'
import type { EchoDemoMark, ScriptedEchoTake } from './scripted-take'
import { createScriptedRoom, SCRIPTED_CALL } from './scripted-take'
import { phrasePlaces } from './sky-layout'
import type { SkyScene } from './sky-scene'
import { EMPTY_SCENE } from './sky-scene'
import { CaptureError, useEchoCapture } from './useEchoCapture'
import type { VoicePoint, VoiceSample } from './voice-path'
import { voicePath } from './voice-path'

/** Merc's happy face after a landing, before he listens again, ms. */
const LOCK_FACE_MS = 450
/** Merc's voice while he sings his call (demo-audio's held level). */
const SUNG_LEVEL = 0.8

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

/** The singer's own note, when the room can start its phrases there. */
function offerable(midi: number): boolean {
  return midi >= HOLD_TARGET_MIN_MIDI && midi <= HOLD_TARGET_MAX_MIDI
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
  // The demo: on, and whether it is playing (its own say: not on its card).
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  /** The demo's take being sung; null for the singer's own run. */
  let scripted: ScriptedEchoTake | null = null
  const demoOn = (): boolean => untrack(scriptActive)
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
    afterCheer: () => (isRunPhase(phase()) && !demoOn() ? 'listen' : 'idle'),
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
  /** How loud the newest frame is, 0..1, for the mic's ring. */
  let loudness = 0
  /** Voice over the call, off Merc's note: shown once per call. */
  let early: EarlyWatch = NO_EARLY
  let previousFrame: PitchFrame | null = null
  /** The voice since the last star, and that star's place. */
  let samples: VoiceSample[] = []
  let lastStar: PlatePoint | null = null
  let sink: (points: readonly VoicePoint[] | null) => void = () => undefined

  const rules = () => ECHO_LEVELS[scripted?.level ?? runLevel]
  const livePhrase = (): EchoPhrase | null =>
    scripted?.phrase ?? phrases[untrack(state).phrase] ?? null
  /** Seconds on the frames' clock: since the window opened, or the take's. */
  const frameNow = (): number =>
    scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  /** The demo's moment, to its tooltips; the singer's run has none. */
  const mark = (moment: EchoDemoMark): void => {
    scripted?.onEvent(moment)
  }

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
    loudness = 0
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
    singCall(
      scheduleCall(voiceOfMerc, ctx, phrase.notes, lead),
      (note) => note.from * 1000,
      untrack(state).phrase === phrases.length - 1,
    )
  }

  /** A call under way: its engine, its rings as `appearMs` has them. */
  const singCall = (
    next: Call,
    appearMs: (note: CallNote) => number,
    last: boolean,
  ): void => {
    call = next
    engine = createSequenceState(next.endsAt + RESPONSE_GATE_SECONDS)
    samples = []
    lastStar = null
    early = NO_EARLY
    sink(null)
    setChip(null)
    showRun(
      'call',
      next.notes.map((note) => Math.max(0, Math.round(appearMs(note)))),
    )
    merc.set('sing')
    if (last) preloadEchoResult()
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
   * let finish (early-singing.ts). It is his line, so his bubble says it,
   * not the chip; in the demo, its tooltip does.
   */
  const noteEarly = (frame: PitchFrame, pitch: number | null): void => {
    if (call === null || early.fired) return
    early = watchEarly(early, frame, previousFrame, pitch, call.notes)
    if (!early.fired) return
    if (scripted === null) say('early')
    else mark('early')
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
      mark('phraseEnd')
      endPhrase()
      return
    }
    mark(`${event.type}:${event.index}`)
    if (event.type === 'land') {
      if (scripted === null) haptics.tapLight()
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
    if (phase() === 'call') noteEarly(frame, pitch)
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

  /**
   * The singer's loudness in the newest frame, on their turns alone: the
   * settle, and the response from its gate. Before the gate the mic still
   * hears Merc's call from the speaker, and that is silence here.
   */
  const singerLoudness = (frames: readonly PitchFrame[]): number => {
    const last = frames.length === 0 ? null : frames[frames.length - 1]
    if (last === null) return 0
    if (phase() === 'settle') return newestLevel(frames)
    if (phase() !== 'response' || last.t < engine.responseStart) return 0
    return newestLevel(frames)
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
    if (scripted !== null) follow(scripted.frames())
    else {
      const frames = capture.peekFrames()
      loudness = singerLoudness(frames)
      if (phase() === 'settle') findRoot(frames)
      else follow(frames)
      if (listening) restIfQuiet()
    }
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
    const demoTake = scripted
    stopLoop()
    if (demoTake === null) capture.takeFrames()
    const take: PhraseTake = { phrase, outcomes: engine.outcomes }
    sink(null)
    voice = SILENT_VOICE
    dispatch({ type: 'phrase-end' })
    setChip(null)
    showRun('done')
    if (demoTake === null) {
      const { moment, fields } = phraseLine(take, rules().tolCents)
      say(moment, fields)
      takes = [...takes, take]
    }
    if (take.outcomes.every((outcome) => outcome.landed)) {
      if (demoTake === null) haptics.success()
      const still = demoTake?.still === true || prefersReducedMotion()
      merc.set(still ? 'lock' : 'hop')
      later(HOP_MS, () => {
        if (phase() === 'between') merc.set('idle')
      })
    } else {
      merc.set('idle')
    }
    if (demoTake === null) {
      later(PHRASE_SHOW_MS, nextPhrase)
      return
    }
    demo.phraseEnded(demoTake, take)
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
    const metrics = sequenceMetrics(takes, rules().rhythmToleranceMs)
    const { improved } = keepEchoRun(runLevel, metrics, phrases[0]?.root ?? 0)
    const run = untrack(state).run
    const shown = showResultOf(takes, metrics, {
      level: runLevel,
      run,
      improved,
    })
    batch(() => {
      setSummary(shown.summary)
      setScene(shown.scene)
      const { levelName } = shown.summary
      const { moment, fields } = resultLine(metrics, improved, levelName)
      say(moment, fields)
    })
    if (shown.celebrate) {
      haptics.success()
      merc.cheer()
    } else {
      merc.set('idle')
    }
  }

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(type: 'stop' | 'rest' | 'leave'): void {
    capture.release()
    takes = []
    hush(() => dispatch({ type }))
    merc.set('idle')
  }

  /** No call, no loop, no voice and an empty sky, with `also` in the batch. */
  function hush(also: () => void): void {
    stopLoop()
    call?.sound.stop()
    call = null
    sink(null)
    voice = SILENT_VOICE
    merc.stopCheering()
    batch(() => {
      also()
      setChip(null)
      setScene(EMPTY_SCENE)
    })
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
    if (demoOn()) return
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
    if (!isRunPhase(phase()) || demoOn()) return
    dropRun('stop')
    sayIntro()
  }

  const replay = (): void => {
    if (phase() !== 'response' || untrack(replays) <= 0 || demoOn()) return
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
    // The demo stops itself on the way out (useExerciseDemo).
    if (!isRunPhase(phase()) || demoOn()) return
    dropRun('leave')
    say('left')
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    // Merc's voice loads as the singer comes in, before the first call.
    if (options.voice === undefined) void preloadMercVoice()
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

  // The screen stays on, and the rail out of reach, while a run is on;
  // the screen stays on while the demo plays too (its own say: not on its
  // card or its end), but the rail stays: a demo can be left at any time.
  const awake = createScreenAwake()
  createEffect(() => {
    const running = isRunPhase(state().phase) && !scriptActive()
    awake.set(scriptActive() ? demoPlaying() : running)
    setExerciseFocus(running)
  })

  // The app's mic watchdog: the icon is on while the run hears the
  // singer, and a microphone that died under it stops the run.
  const unregisterIndicator = registerMicIndicator(
    EXERCISE_ECHO_STARS,
    () => isRunPhase(phase()) && phase() !== 'starting' && !demoOn(),
    stop,
  )

  // ── The demo's way in (scripted-take.ts) ───────────────────
  const demo = createScriptedRoom(
    {
      callVoice: voiceOfMerc,
      active: scriptActive,
      setActive: setScriptActive,
      setPlaying: setDemoPlaying,
      phase,
      audio: () => capture.audio(),
      // The demo's calls are Merc's recorded voice too, once it has loaded.
      ready: () => Promise.resolve(options.voice ?? preloadMercVoice()),
      note: () => knownWindow().firstRoot,
      clear: () => {
        scripted = null
        hush(() => setSummary(null))
      },
      load: (take) => {
        scripted = take
        processed = 0
        previousFrame = null
        setReplays(0)
      },
      begin: (take) => {
        // Each ring comes in as its note is heard, on the take's clock.
        const zero = take.startsAt - performance.now()
        singCall(
          { sound: SCRIPTED_CALL, notes: take.call, endsAt: take.callEnd },
          (note) => zero + note.from * 1000,
          take.toResult,
        )
      },
      current: () => scripted,
      run: () => untrack(state).run,
      line: setLine,
      sayIntro,
      demo: (to) => dispatch({ type: 'demo', phase: to }),
      summary: setSummary,
      scene: setScene,
      merc: merc.set,
      cheer: merc.cheer,
      later,
      mark,
    },
    DEMO_PHRASE_SHOW_MS,
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
    micLevel: () => loudness,
    canReplay: () =>
      state().phase === 'response' && replays() > 0 && !scriptActive(),
    start,
    stop,
    replay,
    drawVoice: (next) => {
      sink = next
    },
    script: demo.script,
  }
}
