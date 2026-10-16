// ============================================================
// useLipController: one Lip roll run, from the tap to the result
// ============================================================
//
// Owns the room's states (lip-machine.ts), the microphone and the audio
// clock (useLipCapture.ts), the room's tones (room-kit room-tones.ts), the
// take (lip-take.ts: the glide engine and everything it lights) and what
// answers it: the bay's scroll and zoom, Merc's place and state, his lines
// and the chip.
//
// A run: the mic opens on the tap; with neither a voiceprint nor a note
// kept, the singer sings an easy note first (settle-note.ts) and the waves
// are fitted to it. Then the count-in (the first root's tone, a breath
// while the bay rolls in and the camera zooms from screen 1's wave to the
// run's) and the three waves. Between waves the bay stops: a pause, then
// the next root plays where the level says so (`playsNextRoot`), then the
// next wave rolls in. After the last landing, the result:
// the run is kept and the view pulls back. Stopping, a minute with no
// voice and leaving the app all drop the run: nothing is kept.
//
// One capture window per run, opened as the count-in starts, so the
// frames' clock and the screen's meet at one moment: the path's clock is
// the window's, less the count-in. One loop a screen frame while the run
// is on: it hears the new frames (once each, on their own clock), then
// hands the bay its frame (bay-view.ts) with no signal written unless the
// chip, the line or Merc's state changed. Ng slides' controller, on the
// bay.
//
// The "how it works" demo buzzes its waves through this same room, by
// `script` (scripted-take.ts): frames in place of the mic, on the take's
// own clock, and nothing played, felt, said or kept. Its camera may stand
// still while the voice rides on (the take's `hold`).

import { batch, createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { onAppLeave } from '@/components/room-kit/app-leave'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { createRoomTones } from '@/components/room-kit/room-tones'
import { createScreenAwake } from '@/components/room-kit/screen-awake'
import { newestLevel } from '@/components/room-kit/voice-level'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { restToneDue, riddenSegmentAt, segmentAt, targetAt, } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import type { GlideTargets } from '@/lib/glide/glide-targets'
import { fitLipRoll } from '@/lib/glide/glide-targets'
import { haptics } from '@/lib/haptics'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { settleLiveNote } from '@/lib/hold/settle-note'
import type { MercVoice } from '@/lib/merc/sim'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { rememberedLipNote } from '@/stores/lip-roll-store'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { preloadLipResult } from './bay-art'
import { WAVE } from './bay-geometry'
import type { RideMoment } from './bay-ride'
import { introHum, RIDE_STATES, rideStep, rideTarget, rideXOn, } from './bay-ride'
import type { BayScroll } from './bay-scroll'
import { createBayScroll, holdCamera, INTRO_CAMERA } from './bay-scroll'
import type { BayView } from './bay-view'
import type { LipController } from './lip-controller-contract'
import { QUIET_LIMIT_SECONDS } from './lip-controller-contract'
import type { LipEvent, LipState } from './lip-machine'
import { initialLipState, isRunPhase, lipReducer } from './lip-machine'
import type { LipPlan, LipSummary, WaveHeard } from './lip-run'
import { BREATH_TONE_SEC, COUNT_IN_TONE_SEC, introLine, keepLipRun, planLipRun, resultLine, summarize, waveLine, } from './lip-run'
import type { LipTake } from './lip-take'
import { createLipTake } from './lip-take'
import type { MercSpot } from './merc-ahead'
import { mercAheadOf } from './merc-ahead'
import type { LipFields, LipMoment } from './merc-lines'
import { createLipLines } from './merc-lines'
import type { LipScript, ScriptedLipTake } from './scripted-take'
import { CaptureError, useLipCapture } from './useLipCapture'

/** Merc's happy face after a wave lights, ms. */
const LOCK_FACE_MS = 600
/** The room's own tone is not drawn as the voice for this long after it, s. */
const TONE_TAIL_SEC = 0.25
/** The path is ended by the room this long after its end, if no frame did. */
const END_GRACE_SEC = 0.5

const SILENT_VOICE: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 0,
  midi: 57,
}

/** The singer's own note, when the room can fit its waves to it. */
function offerable(midi: number): boolean {
  return midi >= HOLD_TARGET_MIN_MIDI && midi <= HOLD_TARGET_MAX_MIDI
}

/** The run in progress: its plan, scroll, take and what it has played. */
interface Live {
  readonly plan: LipPlan
  readonly preset: GlidePreset
  readonly level: GlideLevelId
  readonly scroll: BayScroll
  readonly take: LipTake
  readonly settled: number | null
  /** Breaths whose root has played, by the wave they lead into. */
  readonly played: Set<number>
  feetY: number
  lastFrameAt: number
  resultAsked: boolean
  /** The last wave whose start hushed Merc (-1 before the first). */
  hushed: number
  /** The demo's take in place of the mic, or null for the singer's run. */
  readonly scripted: ScriptedLipTake | null
}

export function useLipController(): LipController {
  const capture = useLipCapture()
  const tones = createRoomTones()
  const lines = createLipLines()
  const voicePreset = untrack(vocalRangePreset)

  const [state, setState] = createSignal<LipState>(initialLipState())
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [ridingWave, setRidingWave] = createSignal(false)
  const [summary, setSummary] = createSignal<LipSummary | null>(null)
  const [showResult, setShowResult] = createSignal(false)
  // The demo: on, and playing (the screen stays on only while it plays).
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const demoOn = (): boolean => untrack(scriptActive)
  const level = createLevelPreset<GlidePreset>(LIP_ROLL_LEVELS, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: LipEvent): void => {
    setState((current) => lipReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = (moment: LipMoment, fields?: LipFields): void => {
    setLine(lines.next(moment, fields))
  }

  /** The waves as they would be fitted now, before the singer is heard. */
  const knownFit = (
    settledMidi: number | null = rememberedLipNote(),
  ): GlideTargets =>
    fitLipRoll({
      voiceprints: loadLocalVoiceprints(),
      settledMidi,
      voicePreset,
    })
  const introPlan = (): LipPlan => planLipRun(knownFit(), untrack(level.preset))
  const [scenePlan, setScenePlan] = createSignal<LipPlan>(untrack(introPlan))
  /** His own buzz at the intro, on the first root (introHum). */
  let introVoice: MercVoice = introHum(untrack(scenePlan).roots[0])
  const sayIntro = (): void => {
    const plan = introPlan()
    setScenePlan(plan)
    introVoice = introHum(plan.roots[0])
    const { moment, fields } = introLine(plan.source === 'preset' ? null : plan)
    say(moment, fields)
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
  /** The singer's voice for him, during a run (hearMerc). */
  let voice: MercVoice = SILENT_VOICE
  const merc = createMercMoves({
    later,
    still: prefersReducedMotion,
    afterCheer: () => 'idle',
  })
  let faceUntil = 0
  let moment: RideMoment = 'intro'
  const setMoment = (next: RideMoment): void => {
    if (next === moment && untrack(merc.state) === RIDE_STATES[next]) return
    moment = next
    merc.set(RIDE_STATES[next])
  }

  // ── The run ────────────────────────────────────────────────
  let view: BayView | null = null
  let audio: AudioContext | null = null
  let live: Live | null = null
  let windowStartedAt = 0
  let processed = 0
  let loop = 0
  let lastVoiceAt = 0
  /** How loud the newest frame is, 0..1, for the mic's ring. */
  let loudness = 0
  let settling = false
  /** The level a run is sung at, pinned at its start. */
  let runLevel: GlideLevelId = untrack(exerciseLevel)

  /** Seconds on the window's clock. */
  const windowNow = (): number => (performance.now() - windowStartedAt) / 1000

  /** The mic hears nothing now: no wave ridden, no loudness. */
  const quietMic = (): void => {
    loudness = 0
    setRidingWave(false)
  }

  const openWindow = (): void => {
    capture.startWindow()
    windowStartedAt = performance.now()
    processed = 0
  }

  const startLoop = (): void => {
    if (loop === 0) loop = requestAnimationFrame(tick)
  }
  const stopLoop = (): void => {
    if (loop !== 0) cancelAnimationFrame(loop)
    loop = 0
  }

  /** The chip's wave: the count-in and a breath lead into theirs. */
  const waveOf = (run: Live, t: number): number =>
    t < 0 ? 0 : run.take.waveAt(t)

  const onWaveEnd = (run: Live, heard: WaveHeard): void => {
    if (heard.lit) {
      if (run.scripted === null) haptics.tapLight()
      faceUntil = performance.now() + LOCK_FACE_MS
    }
    if (run.scripted !== null) return
    const waves = run.plan.path.arches
    const next = waves[heard.wave + 1] as (typeof waves)[number] | undefined
    if (next === undefined) return
    const { moment: said, fields } = waveLine(
      heard,
      run.preset,
      next.rootMidi,
      waves[heard.wave].topMidi,
    )
    say(said, fields)
  }

  /** The moment for Merc, from the path's clock and the voice. */
  const rideMoment = (run: Live, t: number): RideMoment => {
    if (performance.now() < faceUntil) return 'waveLit'
    if (t < 0) return 'countIn'
    const segment = segmentAt(run.plan.path, t)
    if (
      segment === null ||
      segment.phase === 'breath' ||
      segment.phase === 'landing'
    ) {
      return 'breath'
    }
    return run.take.state.voiceMidi === null ? 'waveQuiet' : 'waveVoiced'
  }

  /** His voice for the renderer: the singer's, against the path. */
  const hearMerc = (run: Live, t: number): void => {
    const midi = run.take.state.voiceMidi
    if (midi === null) {
      voice = { ...voice, voiced: false, level: 0 }
      return
    }
    const target = targetAt(run.plan.path, t)
    const cents = target === null ? 0 : (midi - target) * 100
    voice = {
      voiced: true,
      cents,
      level: 0.6,
      steady: 1 - Math.min(1, Math.abs(cents) / run.preset.bandCents),
      midi,
    }
    lastVoiceAt = performance.now()
  }

  /** The next root's tone, after the rest's pause, where the level plays it. */
  const breathTone = (run: Live, t: number): void => {
    if (audio === null || run.scripted !== null) return
    const arch = restToneDue(run.plan.path, run.preset, t, run.played)
    if (arch === null) return
    tones.play(audio, run.plan.roots[arch], BREATH_TONE_SEC)
    run.take.mute(t + BREATH_TONE_SEC + TONE_TAIL_SEC)
  }

  /** What the singer reads, written only when it changes. */
  const showWave = (run: Live, t: number): void => {
    // The demo's tooltips and its take's pill speak for it.
    if (run.scripted !== null) return
    const wave = waveOf(run, t)
    const text = `Wave ${wave + 1} of ${run.plan.path.arches.length}`
    if (untrack(chip) !== text) setChip(text)
    // No words while the singer rides a wave: Merc speaks in the breaths.
    // He is hushed once, as each wave starts, so a line said as a wave
    // ends stays up even when the screen's clock is a hair behind the
    // frames'.
    const ridden = riddenSegmentAt(run.plan.path, t)
    const riding = ridden !== null
    if (ridden !== null && ridden.arch > run.hushed) {
      run.hushed = ridden.arch
      if (untrack(line) !== '') setLine('')
    }
    if (untrack(ridingWave) !== riding) setRidingWave(riding)
    if (wave === run.plan.path.arches.length - 1 && !run.resultAsked) {
      run.resultAsked = true
      preloadLipResult()
      view?.prepareResult()
    }
  }

  function tick(): void {
    loop = 0
    if (!alive) return
    const run = live
    if (run !== null) runFrame(run)
    else if (settling) settleFrame()
    if (alive && (live !== null || settling) && loop === 0) {
      loop = requestAnimationFrame(tick)
    }
  }

  function runFrame(run: Live): void {
    const scripted = run.scripted
    const frames = scripted === null ? capture.peekFrames() : scripted.frames()
    if (scripted === null) loudness = newestLevel(frames)
    run.take.hear(frames, run.plan.countIn)
    if (live !== run) return
    const now = scripted === null ? windowNow() : scripted.now()
    const t = now - run.plan.countIn
    if (t > run.plan.path.duration + END_GRACE_SEC) {
      run.take.finish()
      if (live !== run) return
    }
    const frameAt = performance.now()
    const dt = Math.min(0.1, (frameAt - run.lastFrameAt) / 1000)
    run.lastFrameAt = frameAt
    hearMerc(run, t)
    const wave = run.plan.path.arches[run.take.waveAt(t)]
    run.feetY = rideStep(
      run.feetY,
      rideTarget(
        run.take.state.voiceMidi,
        t < 0 ? null : targetAt(run.plan.path, t),
        wave.rootMidi,
        wave.topMidi - wave.rootMidi,
      ),
      dt,
    )
    view?.frame({
      camera: run.scroll.camera(t),
      zoom: run.scroll.zoom(t),
      strips: run.take.drain(),
      trace: run.take.trace,
      merc: { x: rideXOn(run.scroll, t), feetY: run.feetY },
      voiced: run.take.voiced(),
      // Only in the singer's turn, as the mic shows it: the engine judges
      // an arch's last instant, the mic gives it to the landing.
      contact:
        scripted === null && riddenSegmentAt(run.plan.path, t) !== null
          ? run.take.contact(t)
          : null,
    })
    breathTone(run, t)
    showWave(run, t)
    setMoment(rideMoment(run, t))
    if (scripted === null) restIfQuiet()
  }

  /** No root yet: the first easy note the singer settles on fits the waves. */
  function settleFrame(): void {
    const frames = capture.peekFrames()
    loudness = newestLevel(frames)
    if (frames.length === processed) return
    processed = frames.length
    const heard = settleLiveNote(frames)
    const last = frames[frames.length - 1]
    if (last.conf > 0.5 && last.f0 > 0) lastVoiceAt = performance.now()
    const midi = heard === null ? null : Math.round(heard)
    if (midi === null || !offerable(midi)) {
      restIfQuiet()
      return
    }
    settling = false
    const fit = knownFit(heard)
    dispatch({ type: 'settled' })
    say('found', { note: midiToNoteNameOctave(fit.roots[0]) })
    begin(fit, heard)
  }

  /** The count-in starts: the window opens, the first root sounds. */
  function begin(fit: GlideTargets, settled: number | null): void {
    const preset = untrack(level.preset)
    const plan = planLipRun(fit, preset)
    setScenePlan(plan)
    startRun(plan, preset, settled, null)
  }

  /**
   * A run on `plan` from its count-in: the singer's, its window opened and
   * its first root played, or the demo's `scripted` take, on its own clock
   * with its own sound, its camera standing where the take holds it.
   */
  function startRun(
    plan: LipPlan,
    preset: GlidePreset,
    settled: number | null,
    scripted: ScriptedLipTake | null,
  ): void {
    const follow = createBayScroll(plan.path, plan.countIn)
    const hold = scripted?.hold ?? null
    const scroll = hold === null ? follow : holdCamera(follow, hold)
    let run: Live | null = null
    const take = createLipTake({
      path: plan.path,
      preset,
      scroll,
      onWaveEnd: (heard) => {
        if (run !== null && live === run) onWaveEnd(run, heard)
      },
      onEnd: (result) => {
        if (run !== null && live === run) finishRun(run, result)
      },
      onEvent: (event) => {
        if (run !== null && live === run) scripted?.onEvent(event.type)
      },
    })
    run = {
      plan,
      preset,
      level: runLevel,
      scroll,
      take,
      settled,
      played: new Set<number>(),
      feetY: WAVE.rootY,
      lastFrameAt: performance.now(),
      resultAsked: false,
      hushed: -1,
      scripted,
    }
    live = run
    view?.reset(INTRO_CAMERA)
    // The count-in's note: the room's, or the demo's own (demo-sound.ts).
    take.mute(-plan.countIn + COUNT_IN_TONE_SEC + TONE_TAIL_SEC)
    if (scripted === null) {
      openWindow()
      if (audio !== null) tones.play(audio, plan.roots[0], COUNT_IN_TONE_SEC)
      if (settled === null) {
        say('listen', { note: midiToNoteNameOctave(plan.roots[0]) })
      }
    }
    startLoop()
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(run: Live, result: GlideResult): void {
    if (run.scripted !== null) {
      finishScripted()
      return
    }
    live = null
    stopLoop()
    tones.stop()
    capture.release()
    const kept = keepLipRun(run.level, result, run.settled)
    const shown = summarize(result, kept, exerciseLevelName(run.level))
    const { moment: said, fields } = resultLine(result, shown, run.preset)
    batch(() => {
      quietMic()
      setSummary(shown)
      setChip(null)
      say(said, fields)
      dispatch({ type: 'finished' })
      setShowResult(true)
    })
    view?.result(
      run.plan.path.arches.map((a) => run.take.reveal.litOf(a.index)),
    )
    voice = SILENT_VOICE
    if (result.archesLit === result.arches.length) haptics.success()
    // DESIGN-lip-roll.md 1: he floats at the result, or cheers a new best.
    if (shown.improved) {
      moment = 'resultBest'
      merc.cheer()
    } else {
      setMoment('result')
    }
  }

  /**
   * The demo's wave ended: the bay stays as the take left it, and Merc
   * keeps his happy face for a lit wave, then stands. Nothing is kept or
   * shown: the demo's tooltip explains it.
   */
  function finishScripted(): void {
    live = null
    stopLoop()
    voice = SILENT_VOICE
    const face = faceUntil - performance.now()
    if (face <= 0) {
      setMoment('breath')
      return
    }
    setMoment('waveLit')
    later(face, () => {
      if (demoOn() && live === null && moment === 'waveLit') {
        setMoment('breath')
      }
    })
  }

  /** A minute with no voice during a run: it stops, and the mic closes. */
  function restIfQuiet(): void {
    if (performance.now() - lastVoiceAt <= QUIET_LIMIT_SECONDS * 1000) return
    dropRun('rest')
    say('rest')
  }

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(type: 'stop' | 'rest' | 'leave'): void {
    live = null
    settling = false
    stopLoop()
    tones.stop()
    capture.release()
    voice = SILENT_VOICE
    view?.reset(INTRO_CAMERA)
    batch(() => {
      quietMic()
      dispatch({ type })
      setChip(null)
      setShowResult(false)
    })
    merc.stopCheering()
    setMoment('intro')
  }

  // ── What the singer does ───────────────────────────────────
  const openMic = (): void => {
    const { run } = untrack(state)
    const stands = (): boolean =>
      alive && phase() === 'starting' && untrack(state).run === run
    void capture
      .acquire()
      // A take the app's leaving dropped meanwhile unlocks nothing.
      .then(() => (stands() ? capture.audio() : null))
      .then(
        (ctx) => {
          if (!stands()) return
          if (ctx === null) {
            dispatch({ type: 'mic-failed', run, block: 'unavailable' })
            setMoment('intro')
            return
          }
          audio = ctx
          lastVoiceAt = performance.now()
          const fit = knownFit()
          const rooted = fit.source !== 'preset'
          dispatch({ type: 'mic-ready', run, rooted })
          if (rooted) begin(fit, null)
          else {
            openWindow()
            settling = true
            setMoment('countIn')
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
          setMoment('intro')
        },
      )
  }

  const start = (): void => {
    if (demoOn()) return
    const from = phase()
    if (from !== 'intro' && from !== 'result' && from !== 'blocked') return
    level.take()
    runLevel = untrack(exerciseLevel)
    dispatch({ type: 'start' })
    batch(() => {
      setSummary(null)
      setChip(null)
      setShowResult(false)
    })
    view?.reset(INTRO_CAMERA)
    if (from === 'result') say('again')
    merc.stopCheering()
    setMoment('countIn')
    openMic()
  }

  const stop = (): void => {
    if (!isRunPhase(phase()) || demoOn()) return
    dropRun('stop')
    sayIntro()
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as Back drops it: no result, no best.
   */
  function leave(): void {
    // The demo stops itself when the app goes (useExerciseDemo.ts).
    if (!isRunPhase(phase()) || demoOn()) return
    dropRun('leave')
    say('left')
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    sayIntro()
    // He drops in, then buzzes at the first root.
    later(1100, () => {
      if (untrack(merc.state) === 'drop' && moment === 'intro') {
        merc.set(RIDE_STATES.intro)
      }
    })
  })

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') leave()
  }
  document.addEventListener('visibilitychange', onVisibility)
  // Or with the page still showing: the clock's park (room-kit app-leave.ts).
  const stopAppLeave = onAppLeave(leave)

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
    EXERCISE_LIP_ROLL_BAY,
    () => isRunPhase(phase()) && phase() !== 'starting' && !demoOn(),
    stop,
  )

  // ── The demo's way in (scripted-take.ts) ───────────────────
  /** No take, no result, an empty bay; Merc back at the first root. */
  const clearForScript = (): void => {
    live = null
    stopLoop()
    tones.stop()
    voice = SILENT_VOICE
    faceUntil = 0
    view?.reset(INTRO_CAMERA)
    batch(() => {
      quietMic()
      setSummary(null)
      setChip(null)
      setShowResult(false)
    })
    merc.stopCheering()
  }

  const script: LipScript = {
    active: scriptActive,
    audio: () => capture.audio(),
    // The waves the singer would ride now: the demo buzzes the first one.
    note: () => untrack(scenePlan).roots[0],
    enter: (text) => {
      const from = phase()
      if (!demoOn() && from !== 'intro' && from !== 'result') return false
      clearForScript()
      batch(() => {
        setScriptActive(true)
        setScenePlan(introPlan())
        setLine(text)
        dispatch({ type: 'demo', phase: 'intro' })
      })
      setMoment('breath')
      return true
    },
    play: (take) => {
      if (!demoOn()) return
      clearForScript()
      batch(() => {
        setLine('')
        setScenePlan(take.plan)
        dispatch({ type: 'demo', phase: 'run' })
      })
      setMoment('countIn')
      startRun(take.plan, take.preset, null, take)
    },
    rest: () => {
      if (!demoOn()) return
      clearForScript()
      dispatch({ type: 'demo', phase: 'intro' })
      setMoment('breath')
    },
    leave: () => {
      if (!demoOn()) return
      clearForScript()
      batch(() => {
        setScriptActive(false)
        setDemoPlaying(false)
        dispatch({ type: 'demo', phase: 'intro' })
      })
      sayIntro()
      setMoment('intro')
    },
    playing: setDemoPlaying,
  }

  /** Where Merc will ride over the next `seconds` of the demo's take. */
  const mercAhead = (seconds: number): MercSpot[] => {
    const run = live
    const scripted = run?.scripted ?? null
    if (run === null || scripted === null) return []
    return mercAheadOf(
      {
        path: run.plan.path,
        countIn: run.plan.countIn,
        scroll: run.scroll,
        waveAt: run.take.waveAt,
        voice: scripted.voice,
        now: scripted.now(),
      },
      seconds,
    )
  }

  onCleanup(() => {
    alive = false
    live = null
    settling = false
    stopLoop()
    tones.stop()
    for (const id of timers) clearTimeout(id)
    timers.clear()
    document.removeEventListener('visibilitychange', onVisibility)
    stopAppLeave()
    unregisterIndicator()
    awake.set(false)
    setExerciseFocus(false)
  })

  return {
    state,
    line,
    chip,
    riding: ridingWave,
    micLevel: () => loudness,
    summary,
    mercState: merc.state,
    // At the intro he buzzes on his own; in a run he follows the singer.
    mercVoice: () => (moment === 'intro' ? introVoice : voice),
    path: () => scenePlan().path,
    named: () => scenePlan().source !== 'preset',
    showResult,
    start,
    stop,
    attach: (next) => {
      view = next
      next.reset(INTRO_CAMERA)
    },
    script,
    mercAhead,
  }
}
