// ============================================================
// useGlideRoom: one glide room's run, from the tap to the result
// ============================================================
//
// The glide rooms (Lip roll's bay, Ng slides' bridge) run the same way,
// and this is that run. A room plugs in by calling it from its controller
// hook with what is its own (GlideRoomSetup, glide-room-contract.ts):
//
//   capture    its microphone and audio clock (its useXCapture())
//   levels     its rules at each level (glide-presets.ts)
//   run        its pure half: the fit, the plan, what an arch's end means
//              for its line, keeping a run and summing it up
//   words      its lines (the core speaks at GlideCoreMoment too) and chip
//   merc       its choreography at the core's moments (glide-ride.ts), and
//              the result he cheers
//   scene      its world: the intro's camera, the scroll, a pitch's height,
//              Merc's feet, and the frame its scene takes
//
// and returns the controller this hands back. Ng slides' useNgController
// is that and nothing more; Lip roll's adds where Merc will ride in the
// demo's take, read from the run in progress (`live`).
//
// The core owns the room's states (glide-room-machine.ts), its tones
// (room-kit room-tones.ts) and the take (glide-take.ts: the glide engine
// and everything it lights). A run: the mic opens on the tap; with neither
// a voiceprint nor a note kept, the singer sings an easy note first
// (settle-note.ts) and the arches are fitted to it. Then the count-in (the
// first root's tone, a breath while the world rolls in) and the arches.
// Between arches the scroll stops: a pause, then the next root plays where
// the level says so (`playsNextRoot`), then the next arch rolls in. After
// the last landing, the result: the run is kept and the view pulls back.
// Stopping, a minute with no voice and leaving the app all drop the run:
// nothing is kept.
//
// One capture window per run, opened as the count-in starts, so the
// frames' clock and the screen's meet at one moment: the path's clock is
// the window's, less the count-in. One loop a screen frame while the run
// is on: it hears the new frames (once each, on their own clock), then
// hands the scene its frame with no signal written unless the chip, the
// line or Merc's state changed. The "how it works" demo sings its takes
// through this same room, by `script`: frames in place of the mic, on the
// take's own clock, and nothing played, felt, said or kept.

import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { createQuietWatch, WALL_CLOCK } from '@/components/room-kit/quiet-watch'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { offerable, QUIET_LIMIT_SECONDS, SILENT_VOICE, } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import { createRoomScript } from '@/components/room-kit/room-script'
import { createRoomTones } from '@/components/room-kit/room-tones'
import { newestLevel } from '@/components/room-kit/voice-level'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { restToneDue, riddenSegmentAt, segmentAt, targetAt, } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import type { GlideTargets } from '@/lib/glide/glide-targets'
import { haptics } from '@/lib/haptics'
import { settleLiveNote } from '@/lib/hold/settle-note'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { vocalRangePreset } from '@/stores/settings-store'
import type { GlideMoment } from './glide-ride'
import { introHum, rideFeet } from './glide-ride'
import type { GlideCoreMoment, GlideLineFields, GlidePlan, GlideRoom, GlideRoomSetup, GlideRoomTypes, GlideRun, GlideView, } from './glide-room-contract'
import { BREATH_TONE_SEC, COUNT_IN_TONE_SEC } from './glide-room-contract'
import type { GlideRoomEvent, GlideRoomState } from './glide-room-machine'
import { glideRoomReducer, initialGlideRoomState, isRunPhase, } from './glide-room-machine'
import { createGlideTake } from './glide-take'

/** Merc's happy face after an arch lights, ms. */
const LOCK_FACE_MS = 600
/** The room's own tone is not drawn as the voice for this long after it, s. */
const TONE_TAIL_SEC = 0.25
/** The path is ended by the room this long after its end, if no frame did. */
const END_GRACE_SEC = 0.5

/** The run in progress: its plan, scroll, take and what it has played. */
interface Live<R extends GlideRoomTypes> extends GlideRun<R> {
  readonly level: GlideLevelId
  readonly settled: number | null
  /** Breaths whose root has played, by the arch they lead into. */
  readonly played: Set<number>
  feetY: number
  /**
   * The voice's eased distance from the path, world y (rideFeet); null
   * before the run's first frame, which takes it from where he stood.
   */
  feetOffset: number | null
  lastFrameAt: number
  resultAsked: boolean
  /** The last arch whose start hushed Merc (-1 before the first). */
  hushed: number
}

export function useGlideRoom<R extends GlideRoomTypes>(
  setup: GlideRoomSetup<R>,
): GlideRoom<R> {
  const { capture, words, scene } = setup
  const options = setup.options ?? {}
  /** The easy note a run starts from: the room's own, else the Warm-up's. */
  const startNote = (): number | null =>
    setup.run.remembered() ?? options.root ?? null
  const tones = createRoomTones()
  const voicePreset = untrack(vocalRangePreset)

  const [state, setState] = createSignal<GlideRoomState>(
    initialGlideRoomState(),
  )
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [singing, setSinging] = createSignal(false)
  const [summary, setSummary] = createSignal<R['summary'] | null>(null)
  const [showResult, setShowResult] = createSignal(false)
  // The demo: on, and playing (the screen stays on only while it plays).
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const demoOn = (): boolean => untrack(scriptActive)
  const level = createLevelPreset<GlidePreset>(setup.levels, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: GlideRoomEvent): void => {
    setState((current) => glideRoomReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = (
    moment: GlideCoreMoment | R['line'],
    fields?: GlideLineFields,
  ): void => {
    setLine(words.lines.next(moment, fields))
  }

  /** The arches as they would be fitted now, before the singer is heard. */
  const knownFit = (settledMidi: number | null = startNote()): GlideTargets =>
    setup.run.fit({
      voiceprints: loadLocalVoiceprints(),
      settledMidi,
      voicePreset,
    })
  const introPlan = (): R['plan'] =>
    setup.run.plan(knownFit(), untrack(level.preset))
  const [scenePlan, setScenePlan] = createSignal<GlidePlan>(untrack(introPlan))
  /** The plan the scene draws: the intro's, a run's or the demo's take's. */
  const drawPlan = (plan: GlidePlan): void => {
    setScenePlan(plan)
  }
  /** His own sound at the intro, on the first root (introHum). */
  let introVoice: MercVoice = introHum(untrack(scenePlan).roots[0])
  const sayIntro = (): void => {
    const plan = introPlan()
    drawPlan(plan)
    introVoice = introHum(plan.roots[0])
    const { moment, fields } = words.intro(
      plan.source === 'preset' ? null : plan,
      options.routine === true,
    )
    say(moment, fields)
  }

  // ── Timers that belong to the screen ───────────────────────
  // The screen's life (room-kit room-life.ts): its timers from here, its
  // watch once the room's leave and stop exist.
  const life = createRoomLife()

  // ── Merc ───────────────────────────────────────────────────
  /** The singer's voice for him, during a run (hearMerc). */
  let voice: MercVoice = SILENT_VOICE
  const merc = createMercMoves({
    later: life.later,
    still: prefersReducedMotion,
    afterCheer: () => 'idle',
  })
  const states = setup.merc.states
  let faceUntil = 0
  let moment: GlideMoment = 'intro'
  const setMoment = (next: GlideMoment): void => {
    if (next === moment && untrack(merc.state) === states[next]) return
    moment = next
    merc.set(states[next])
  }

  // ── The run ────────────────────────────────────────────────
  let view: GlideView<R['frame']> | null = null
  let audio: AudioContext | null = null
  let live: Live<R> | null = null
  let windowStartedAt = 0
  let processed = 0
  /** How loud the newest frame is, 0..1, for the mic's ring. */
  let loudness = 0
  let settling = false
  /** The level a run is sung at, pinned at its start. */
  let runLevel: GlideLevelId = untrack(exerciseLevel)

  /** Seconds on the window's clock. */
  const windowNow = (): number => (performance.now() - windowStartedAt) / 1000

  /** The mic hears nothing now: no arch sung, no loudness. */
  const quietMic = (): void => {
    loudness = 0
    setSinging(false)
  }

  const openWindow = (): void => {
    capture.startWindow()
    windowStartedAt = performance.now()
    processed = 0
  }

  const loop = createFrameLoop(screenFrame, {
    alive: life.alive,
    running: () => live !== null || settling,
  })
  /** A minute with no voice during a run, on the wall clock. */
  const quiet = createQuietWatch({
    limitSeconds: QUIET_LIMIT_SECONDS,
    clock: WALL_CLOCK,
  })

  /** The chip's arch: the count-in and a breath lead into theirs. */
  const archOf = (run: Live<R>, t: number): number =>
    t < 0 ? 0 : run.take.archAt(t)

  const onArchEnd = (run: Live<R>, arch: number, heard: R['heard']): void => {
    if (heard.lit) {
      if (run.scripted === null) haptics.tapLight()
      faceUntil = performance.now() + LOCK_FACE_MS
    }
    if (run.scripted !== null) return
    const arches = run.plan.path.arches
    const next = arches[arch + 1] as (typeof arches)[number] | undefined
    if (next === undefined) return
    const { moment: said, fields } = words.afterArch(
      heard,
      run.preset,
      next.rootMidi,
      arches[arch].topMidi,
    )
    say(said, fields)
  }

  /** The moment for Merc, from the path's clock and the voice. */
  const rideMoment = (run: Live<R>, t: number): GlideMoment => {
    if (performance.now() < faceUntil) return 'lit'
    if (t < 0) return 'countIn'
    const segment = segmentAt(run.plan.path, t)
    if (
      segment === null ||
      segment.phase === 'breath' ||
      segment.phase === 'landing'
    ) {
      return 'breath'
    }
    return run.take.state.voiceMidi === null ? 'quiet' : 'voiced'
  }

  /** His voice for the renderer: the singer's, against the path. */
  const hearMerc = (run: Live<R>, t: number): void => {
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
    quiet.heard()
  }

  /** The next root's tone, after the rest's pause, where the level plays it. */
  const breathTone = (run: Live<R>, t: number): void => {
    if (audio === null || run.scripted !== null) return
    const arch = restToneDue(run.plan.path, run.preset, t, run.played)
    if (arch === null) return
    tones.play(audio, run.plan.roots[arch], BREATH_TONE_SEC)
    run.take.mute(t + BREATH_TONE_SEC + TONE_TAIL_SEC)
  }

  /** What the singer reads, written only when it changes. */
  const showArch = (run: Live<R>, t: number): void => {
    // The demo's tooltips and its take's pill speak for it.
    if (run.scripted !== null) return
    const arch = archOf(run, t)
    const text = words.chip(arch, run.plan.path.arches.length)
    if (untrack(chip) !== text) setChip(text)
    // No words while the singer sings an arch: Merc speaks in the breaths.
    // He is hushed once, as each arch starts, so a line said as an arch
    // ends stays up even when the screen's clock is a hair behind the
    // frames'.
    const ridden = riddenSegmentAt(run.plan.path, t)
    const sung = ridden !== null
    if (ridden !== null && ridden.arch > run.hushed) {
      run.hushed = ridden.arch
      if (untrack(line) !== '') setLine('')
    }
    if (untrack(singing) !== sung) setSinging(sung)
    if (arch === run.plan.path.arches.length - 1 && !run.resultAsked) {
      run.resultAsked = true
      scene.preloadResult()
      view?.prepareResult()
    }
  }

  /** One screen frame while a run or its settle is on (frame-loop.ts). */
  function screenFrame(): void {
    const run = live
    if (run !== null) runFrame(run)
    else if (settling) settleFrame()
  }

  function runFrame(run: Live<R>): void {
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
    const target = t < 0 ? null : targetAt(run.plan.path, t)
    const arch = run.plan.path.arches[run.take.archAt(t)]
    const pathY = scene.feetTarget(null, target, arch)
    const feet = rideFeet(
      run.feetOffset ?? run.feetY - pathY,
      scene.feetTarget(run.take.state.voiceMidi, target, arch),
      pathY,
      dt,
      scene.rideTauSec,
    )
    run.feetOffset = feet.offset
    run.feetY = feet.y
    if (view !== null) {
      view.frame(
        scene.frame(run, t, {
          strips: run.take.drain(),
          trace: run.take.trace,
          feetY: run.feetY,
          // Only in the singer's turn, as the mic shows it: the engine
          // judges an arch's last instant, the mic gives it to the landing.
          contact:
            scripted === null && riddenSegmentAt(run.plan.path, t) !== null
              ? run.take.contact(t)
              : null,
        }),
      )
    }
    breathTone(run, t)
    showArch(run, t)
    setMoment(rideMoment(run, t))
    if (scripted === null) restIfQuiet()
  }

  /** No root yet: the first easy note the singer settles on fits the arches. */
  function settleFrame(): void {
    const frames = capture.peekFrames()
    loudness = newestLevel(frames)
    if (frames.length === processed) return
    processed = frames.length
    const heard = settleLiveNote(frames)
    const last = frames[frames.length - 1]
    if (last.conf > 0.5 && last.f0 > 0) quiet.heard()
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
    const plan = setup.run.plan(fit, preset)
    drawPlan(plan)
    startRun(plan, preset, settled, null)
  }

  /**
   * A run on `plan` from its count-in: the singer's, its window opened and
   * its first root played, or the demo's `scripted` take, on its own clock
   * with its own sound.
   */
  function startRun(
    plan: GlidePlan,
    preset: GlidePreset,
    settled: number | null,
    scripted: R['scripted'] | null,
  ): void {
    const scroll = scene.scroll(plan, scripted)
    let run: Live<R> | null = null
    const take = createGlideTake({
      path: plan.path,
      preset,
      scroll,
      playheadX: scene.playheadX,
      pitchY: scene.pitchY,
      heard: setup.run.heard,
      onArchEnd: (arch, heard) => {
        if (run !== null && live === run) onArchEnd(run, arch, heard)
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
      feetY: scene.feetStartY,
      feetOffset: null,
      lastFrameAt: performance.now(),
      resultAsked: false,
      hushed: -1,
      scripted,
    }
    live = run
    view?.reset(scene.introCamera)
    // The count-in's note: the room's, or the demo's own (its demo-sound.ts).
    take.mute(-plan.countIn + COUNT_IN_TONE_SEC + TONE_TAIL_SEC)
    if (scripted === null) {
      openWindow()
      if (audio !== null) tones.play(audio, plan.roots[0], COUNT_IN_TONE_SEC)
      if (settled === null) {
        say('listen', { note: midiToNoteNameOctave(plan.roots[0]) })
      }
    }
    loop.start()
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(run: Live<R>, result: GlideResult): void {
    if (run.scripted !== null) {
      finishScripted()
      return
    }
    live = null
    loop.stop()
    tones.stop()
    capture.release()
    const kept = setup.run.keep(run.level, result, run.settled)
    const shown = setup.run.summarize(
      result,
      kept,
      exerciseLevelName(run.level),
    )
    const { moment: said, fields } = words.result(result, shown, run.preset)
    batch(() => {
      quietMic()
      setSummary(() => shown)
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
    if (setup.merc.cheers(result, shown)) {
      moment = 'cheer'
      merc.cheer()
    } else {
      setMoment('result')
    }
  }

  /**
   * The demo's take ended: the world stays as the take left it, and Merc
   * keeps his happy face for a lit arch, then stands. Nothing is kept or
   * shown: the demo's tooltip explains it.
   */
  function finishScripted(): void {
    live = null
    loop.stop()
    voice = SILENT_VOICE
    const face = faceUntil - performance.now()
    if (face <= 0) {
      setMoment('breath')
      return
    }
    setMoment('lit')
    life.later(face, () => {
      if (demoOn() && live === null && moment === 'lit') {
        setMoment('breath')
      }
    })
  }

  /** A minute with no voice during a run: it stops, and the mic closes. */
  function restIfQuiet(): void {
    if (!quiet.quiet()) return
    dropRun('rest')
    say('rest')
  }

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(type: 'stop' | 'rest' | 'leave'): void {
    live = null
    settling = false
    loop.stop()
    tones.stop()
    capture.release()
    voice = SILENT_VOICE
    view?.reset(scene.introCamera)
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
  /**
   * The mic opens inside the tap, then the clock the room's tones play on
   * (room-kit room-mic.ts); the run, or its settle, starts once both have.
   */
  const openMic = (): void => {
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      clock: true,
      onOpen: (run, ctx) => {
        audio = ctx
        quiet.heard()
        const fit = knownFit()
        const rooted = fit.source !== 'preset'
        dispatch({ type: 'mic-ready', run, rooted })
        if (rooted) begin(fit, null)
        else {
          openWindow()
          settling = true
          setMoment('countIn')
          loop.start()
        }
      },
      onFail: (run, block) => {
        dispatch({ type: 'mic-failed', run, block })
        setMoment('intro')
      },
      onHidden: leave,
    })
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
    view?.reset(scene.introCamera)
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
    // He drops in, then sings at the first root on his own.
    life.later(1100, () => {
      if (untrack(merc.state) === 'drop' && moment === 'intro') {
        merc.set(states.intro)
      }
    })
  })

  // Leaving the page, or the app, drops a run (room-kit room-life.ts).
  // The screen stays on, and the rail out of reach, while a run is on;
  // the screen stays on while the demo plays too (its own say: not on its
  // card or its end), but the rail stays: a demo can be left at any time.
  // The app's mic watchdog: the icon is on while the run hears the
  // singer, and a microphone that died under it stops the run.
  life.watch({
    leave,
    listening: () => isRunPhase(state().phase) && !scriptActive(),
    demo: { on: scriptActive, playing: demoPlaying },
    holdsFocus: true,
    mic: {
      exercise: setup.exercise,
      on: () => isRunPhase(phase()) && phase() !== 'starting' && !demoOn(),
      died: stop,
    },
  })

  // ── The demo's way in ──────────────────────────────────────
  /** No take, no result, an empty world; Merc back at the first root. */
  const clearForScript = (): void => {
    live = null
    loop.stop()
    tones.stop()
    voice = SILENT_VOICE
    faceUntil = 0
    view?.reset(scene.introCamera)
    batch(() => {
      quietMic()
      setSummary(null)
      setChip(null)
      setShowResult(false)
    })
    merc.stopCheering()
  }

  // In and out on the room kit's terms (room-script.ts); the moves are
  // the core's own.
  const script: GlideRoom<R>['script'] = createRoomScript({
    active: scriptActive,
    phase,
    audio: () => capture.audio(),
    // The arches the singer would sing now: the demo sings the first one.
    note: () => untrack(scenePlan).roots[0],
    enter: (text) => {
      clearForScript()
      batch(() => {
        setScriptActive(true)
        drawPlan(introPlan())
        setLine(text)
        dispatch({ type: 'demo', phase: 'intro' })
      })
      setMoment('breath')
    },
    play: (take) => {
      clearForScript()
      batch(() => {
        setLine('')
        if (scene.demoDrawsTake) drawPlan(take.plan)
        dispatch({ type: 'demo', phase: 'run' })
      })
      setMoment('countIn')
      startRun(take.plan, take.preset, null, take)
    },
    rest: () => {
      clearForScript()
      dispatch({ type: 'demo', phase: 'intro' })
      setMoment('breath')
    },
    leave: () => {
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
  })

  onCleanup(() => {
    live = null
    settling = false
    loop.stop()
    tones.stop()
    life.dispose()
  })

  return {
    state,
    line,
    chip,
    singing,
    micLevel: () => loudness,
    summary,
    mercState: merc.state,
    // At the intro he sings on his own; in a run he follows the singer.
    mercVoice: () => (moment === 'intro' ? introVoice : voice),
    lines: () => {
      const plan = scenePlan()
      return {
        path: plan.path,
        root: plan.source === 'preset' ? null : plan.roots[0],
      }
    },
    showResult,
    settledNote: () => {
      const note = startNote()
      return note === null ? null : Math.round(note)
    },
    start,
    stop,
    attach: (next) => {
      view = next
      next.reset(scene.introCamera)
    },
    script,
    live: () => live,
  }
}
