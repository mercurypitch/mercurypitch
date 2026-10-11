// ============================================================
// useLongNoteController — one Long note run, from the tap to the result
// ============================================================
//
// Owns the room's states (long-note-machine.ts), the microphone
// (useLongNoteCapture.ts), the hold engine (src/lib/hold) and everything
// that answers it: Merc's state, placement and voice, his lines, the chip
// under the timer, the lantern's level and the voice trace.
//
// The engine is ticked once per CAPTURED frame, never once per screen
// frame. Its metrics date the hold on the frames' own clock
// (`computeHoldResult`), so a frame skipped or counted twice would move the
// numbers the singer is shown.
//
// The room opens on the note held last time, else the voiceprint's pick,
// else no note at all: the singer sings any easy note, and the first one
// they settle on (settle-note.ts) becomes the note, remembered for next
// time. The microphone is open only while the room listens: it closes at
// the result, and Again opens it again.
//
// The "how it works" demo sings its takes through this same room, by
// `script` (scripted-take.ts): frames in place of the mic, nothing kept.

import { batch, createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { haptics } from '@/lib/haptics'
import type { HoldEventType, HoldState, HoldTick } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import { computeHoldResult } from '@/lib/hold/hold-metrics'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, nudgeTarget, } from '@/lib/hold/hold-target'
import { loadHoldTarget } from '@/lib/hold/load-hold-target'
import type { MercVoice } from '@/lib/merc/sim'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { createChipFollower } from './chip-follower'
import { fillLevel } from './lantern-geometry'
import type { LongNoteController, LongNoteRunSummary, } from './long-note-controller-types'
import type { LongNoteEvent, LongNoteState } from './long-note-machine'
import { initialLongNoteState, longNoteReducer } from './long-note-machine'
import { isFalseStart, keepRun, resultMoment } from './long-note-run'
import type { LongNoteMoment } from './merc-lines'
import { createMercLineSelector } from './merc-lines'
import { createMercMoves } from './merc-moves'
import { prefersReducedMotion } from './reduced-motion'
import { rememberedLongNote } from './remembered-note'
import { createScreenAwake } from './screen-awake'
import type { LongNoteScript, ScriptedTake } from './scripted-take'
import { settledRunStart, settleLiveNote } from './settle-note'
import { CaptureError, useLongNoteCapture } from './useLongNoteCapture'
import { VoiceTraceBuffer } from './voice-trace-buffer'

// The goal fills the lantern halfway; past it, steady singing fills the top.
const PRESET = HOLD_PRESETS.lantern

export type { MercPlace } from './merc-moves'
export type {
  LongNoteController,
  LongNoteRunSummary,
} from './long-note-controller-types'

/**
 * The longest hold the room times, from the first voice; past it, the note
 * is called ended.
 */
const MAX_HOLD_SECONDS = 90
/** Merc dozes off when nobody sings for this long. */
const SLEEP_AFTER_SECONDS = 25
/** Nobody sang for this long while the room listened: the mic closes. */
const QUIET_LIMIT_SECONDS = 60
/** The halo at the goal, of the brim's full shine. */
export const GOAL_SHINE = 0.5
/** RMS to Merc's 0..1 loudness: -50 dBFS is silent, -10 dBFS is full. */
export function levelFromRms(rms: number): number {
  if (!(rms > 0)) return 0
  const db = 20 * Math.log10(rms)
  return Math.min(1, Math.max(0, (db + 50) / 40))
}

/** The singer's own note, when the room can offer it. */
function offerable(midi: number): boolean {
  return midi >= HOLD_TARGET_MIN_MIDI && midi <= HOLD_TARGET_MAX_MIDI
}

export function useLongNoteController(): LongNoteController {
  const capture = useLongNoteCapture()
  // The voice type's usual note: where the arrows start from no note.
  const picked = loadHoldTarget(untrack(vocalRangePreset))
  const opening =
    rememberedLongNote() ??
    (picked.source === 'voiceprint' ? picked.midi : null)
  const lines = createMercLineSelector()

  const [state, setState] = createSignal<LongNoteState>(
    initialLongNoteState(opening),
  )
  const [hold, setHold] = createSignal<HoldState>(createHoldState())
  const [summary, setSummary] = createSignal<LongNoteRunSummary | null>(null)
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [lanternLevel, setLanternLevel] = createSignal(0)
  const [shine, setShine] = createSignal(0)
  // The demo: on, the note it sings, and the take it is singing.
  const [scriptActive, setScriptActive] = createSignal(false)
  const [scriptNote, setScriptNote] = createSignal<number | null>(null)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  let scripted: ScriptedTake | null = null
  const demoOn = (): boolean => untrack(scriptActive)

  const trace = new VoiceTraceBuffer()
  const noteName = (): string => {
    const target = scriptNote() ?? state().targetMidi
    return target === null ? '' : midiToNoteNameOctave(target)
  }

  const dispatch = (event: LongNoteEvent): void => {
    setState((current) => longNoteReducer(current, event))
  }
  const say = (moment: LongNoteMoment): void => {
    setLine(lines.next(moment, untrack(noteName)))
  }
  const sayIntro = (): void => {
    say(untrack(state).targetMidi === null ? 'introAny' : 'intro')
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

  // ── The lantern's level, eased between runs ────────────────
  let tween = 0
  const easeLevel = (to: number, ms: number): void => {
    if (tween !== 0) cancelAnimationFrame(tween)
    const from = untrack(lanternLevel)
    const t0 = performance.now()
    const step = (): void => {
      const k = Math.min(1, (performance.now() - t0) / ms)
      const eased = 1 - (1 - k) * (1 - k)
      setLanternLevel(from + (to - from) * eased)
      tween = k < 1 ? requestAnimationFrame(step) : 0
    }
    tween = requestAnimationFrame(step)
  }

  // ── Merc ───────────────────────────────────────────────────
  let voice: MercVoice = {
    voiced: false,
    cents: 0,
    level: 0,
    steady: 0,
    midi: opening ?? picked.midi,
  }

  // ── The take ───────────────────────────────────────────────
  let engine = createHoldState()
  let processed = 0
  /** Frames before this one are not the take: the engine hears silence. */
  let heardFrom = 0
  let previous: PitchFrame | null = null
  let lastTick: HoldTick | null = null
  let windowOpen = false
  let windowStartedAt = 0
  /** The last voice the listen heard, on now()'s clock. */
  let heardAt = 0
  let loop = 0
  const chips = createChipFollower()
  let asleep = false
  /** The singer's own note was just named: the first lock says so. */
  let foundPending = false
  // Merc's state and place; after a cheer he sings along with the voice.
  const merc = createMercMoves({
    later,
    still: () => scripted?.still === true || prefersReducedMotion(),
    afterCheer: () => {
      if (!windowOpen) return null
      return engine.phase === 'locked' ? 'lock' : 'sing'
    },
  })

  /** Where the clock stopped: the trace keeps the take it drew. */
  let closedAt = 0
  const now = (): number => {
    if (!windowOpen) return closedAt
    return scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  }

  const clearChip = (): void => {
    chips.reset()
    setChip(null)
  }

  /**
   * Seconds since the take's first voice, on the frames' clock: the wait
   * before it is neither held nor practice.
   */
  const singingSeconds = (): number =>
    engine.firstVoicedAt === null ? 0 : engine.clock - engine.firstVoicedAt

  const openWindow = (): void => {
    if (scripted === null) capture.startWindow()
    windowStartedAt = performance.now()
    heardAt = 0
    engine = createHoldState()
    processed = 0
    heardFrom = 0
    previous = null
    lastTick = null
    asleep = false
    foundPending = false
    merc.stopCheering()
    trace.clear()
    batch(() => {
      setHold(engine)
      clearChip()
    })
    windowOpen = true
    if (loop === 0) loop = requestAnimationFrame(tick)
  }

  const closeWindow = (): PitchFrame[] => {
    closedAt = now()
    windowOpen = false
    setExerciseFocus(false)
    return scripted === null ? capture.takeFrames() : [...scripted.frames()]
  }

  /** Haptics answer a singer; the demo has none. */
  const feel = (kind: 'tapLight' | 'success'): void => {
    if (scripted === null) haptics[kind]()
  }

  const onEvents = (events: readonly HoldEventType[]): void => {
    for (const event of events) {
      switch (event) {
        // On the note, Merc keeps the lock's face (his eyes close happily,
        // as in storyboard 2); off it, he sings after the voice again.
        case 'lock':
          feel('tapLight')
          merc.mood('lock')
          break
        case 'relock':
          merc.mood('lock')
          break
        case 'break':
          merc.mood('sing')
          break
        // Halfway: he steps out of the glass to cheer, and the top is the
        // steady singing's to fill. Full: he cheers again.
        case 'goal':
          feel('success')
          setShine(GOAL_SHINE)
          merc.cheer()
          break
        case 'brim':
          feel('success')
          setShine(1)
          merc.cheer()
          break
        case 'end':
          break
      }
      chips.event(event, foundPending)
      if (event === 'lock') foundPending = false
      scripted?.onEvent(event)
    }
  }

  /** The chip's line after this frame, once the last line has stood. */
  const followChip = (dt: number): void => {
    const voiced = lastTick !== null && lastTick.offCents !== null
    const shown = chips.follow(engine, voiced, dt)
    if (shown !== null) setChip(lines.next(shown, untrack(noteName)))
  }

  const finish = (): void => {
    const take = scripted
    // A hold always has its note; the guard is for the type.
    const target = take?.targetMidi ?? untrack(state).targetMidi
    if (target === null) return
    const frames = closeWindow()
    merc.stopCheering()
    if (take !== null && !take.toResult) {
      // The demo's first take only shows how a note ends: no result.
      clearChip()
      merc.move('beside', take.after)
      return
    }
    const result = computeHoldResult({
      frames,
      state: engine,
      targetMidi: target,
      // The run's practice time: from the first voice, not the mic.
      durationMs: Math.round(singingSeconds() * 1000),
    })

    if (take === null && isFalseStart(engine, result)) {
      dispatch({ type: 'false-start' })
      merc.hopTo('beside', 'listen')
      openWindow()
      return
    }

    // A result: nothing listens again until the singer asks. Only a
    // singer's run is kept; the demo's never.
    let improved = false
    if (take === null) {
      capture.release()
      improved = keepRun(target, result)
    }
    const full = engine.goalReached
    const brim = engine.brimReached
    batch(() => {
      setSummary({
        inBandSeconds: result.metrics.inBandSeconds,
        steadiness: result.locked ? result.score : null,
        locked: result.locked,
        improved,
        full,
        brim,
      })
      clearChip()
      dispatch({ type: 'end' })
      // The light stays as high as the take filled it: halfway at the
      // goal, the brim only when steady singing filled the top.
      setLanternLevel(fillLevel(engine.charge, engine.topCharge))
    })
    // The demo's result keeps Merc's bubble clear for its own tooltip.
    if (take === null) say(resultMoment(improved, full, brim, result.locked))
    merc.move('beside', full || improved ? 'celebrate' : 'idle')
  }

  /** The take's first voice: the hold begins, Merc steps into the glass. */
  const enterHold = (): void => {
    if (scripted === null) {
      dispatch({ type: 'voice' })
      setExerciseFocus(true)
    } else {
      dispatch({ type: 'demo', phase: 'hold' })
    }
    setLine('')
    merc.move('inside', 'sing')
  }

  /** The take against its note: the engine, Merc, the chip, the end. */
  const follow = (frames: readonly PitchFrame[], target: number): void => {
    const phase = untrack(state).phase
    const events: HoldEventType[] = []
    const before = engine.clock
    for (let i = processed; i < frames.length; i++) {
      const frame = frames[i]
      const heard = holdTickFromFrame(frame, previous, target)
      const step =
        i < heardFrom ? { ...heard, offCents: null, level: 0 } : heard
      engine = tickHold(engine, step, PRESET)
      events.push(...engine.events)
      trace.push(
        frame.t,
        step.offCents === null ? null : (engine.needleCents ?? step.offCents),
        engine.inBand,
      )
      lastTick = step
      previous = frame
    }
    const fresh = frames.length > processed
    processed = frames.length
    if (!fresh) return

    const step = lastTick
    const cents = engine.needleCents ?? 0
    voice = {
      voiced: step !== null && step.offCents !== null,
      cents,
      level: levelFromRms(step?.level ?? 0),
      steady:
        step?.offCents !== null && step !== null
          ? 1 - Math.min(1, Math.abs(cents) / PRESET.tolCents)
          : 0,
      midi: target + cents / 100,
    }
    setHold(engine)

    if (phase === 'listen' && engine.phase !== 'waiting') {
      enterHold()
    } else if (phase === 'listen' && !asleep && now() > SLEEP_AFTER_SECONDS) {
      asleep = true
      merc.set('sleep')
      say('sleep')
    }
    onEvents(events)
    followChip(engine.clock - before)
    if (
      engine.phase === 'ended' ||
      (untrack(state).phase === 'hold' && singingSeconds() > MAX_HOLD_SECONDS)
    ) {
      finish()
    }
  }

  /** No note yet: listen for the one the singer settles on. */
  const findNote = (frames: readonly PitchFrame[]): void => {
    if (frames.length === processed) return
    processed = frames.length
    // Against MIDI 0 the offset is the pitch itself, by the engine's own
    // rule for what counts as voiced.
    const step = holdTickFromFrame(frames[frames.length - 1], null, 0)
    voice = {
      voiced: step.offCents !== null,
      cents: 0,
      level: levelFromRms(step.level),
      steady: 0,
      midi: step.offCents === null ? voice.midi : step.offCents / 100,
    }
    const heard = settleLiveNote(frames)
    const midi = heard === null ? null : Math.round(heard)
    if (midi === null || !offerable(midi)) {
      if (!asleep && now() > SLEEP_AFTER_SECONDS) {
        asleep = true
        merc.set('sleep')
        say('sleepAny')
      }
      return
    }
    dispatch({ type: 'settle', midi })
    foundPending = true
    // The note so far counts: replay the take against it. The take is the
    // run the settle found, from its first voice; anything before it (a
    // word, a hum, a cough) the engine hears as silence. Replayed as voice,
    // it was a note the engine had already ended, and the take ended the
    // moment it began (review A2 of PR 973). The engine still counts from
    // the window's first frame, the clock the result reads frames on.
    heardFrom = Math.max(0, settledRunStart(frames))
    processed = 0
    previous = null
    lastTick = null
    engine = createHoldState()
    trace.clear()
    follow(frames, midi)
  }

  /** A minute with no voice while the room listens: the mic closes. */
  const restIfQuiet = (): void => {
    if (untrack(state).phase !== 'listen') return
    if (voice.voiced) heardAt = now()
    else if (now() - heardAt > QUIET_LIMIT_SECONDS) {
      cancel()
      say('rest')
    }
  }

  function tick(): void {
    loop = 0
    if (!alive) return
    const { phase, targetMidi } = untrack(state)
    if (windowOpen && (phase === 'listen' || phase === 'hold')) {
      if (scripted !== null) {
        follow(scripted.frames(), scripted.targetMidi)
      } else {
        const frames = capture.peekFrames()
        if (targetMidi === null) findNote(frames)
        else follow(frames, targetMidi)
        restIfQuiet()
      }
    }
    // A false start inside this tick may already have scheduled the next.
    if (alive && windowOpen && loop === 0) loop = requestAnimationFrame(tick)
  }

  // ── What the singer does ───────────────────────────────────
  const beginListening = (moment: LongNoteMoment | null): void => {
    if (moment !== null) say(moment)
    merc.put('listen', 'beside')
    openWindow()
  }

  /**
   * The note first, then the microphone: iOS changes the audio session when
   * the mic opens, and the note should not be clipped by it. The tone also
   * ends before the take opens, so the mic never hears it as the singer's
   * own note. With no note yet there is nothing to play.
   */
  const openMic = (moment: LongNoteMoment | null): void => {
    const { run, targetMidi } = untrack(state)
    // Nothing to play: open the mic inside the tap itself. After a tone,
    // only if this start still stands: the singer may have left the room,
    // or the app (stopListening), while it played.
    const stands = (): boolean =>
      alive && untrack(state).phase === 'starting' && untrack(state).run === run
    const opened =
      targetMidi === null
        ? capture.acquire()
        : capture
            .playTone(targetMidi)
            .then(() => (stands() ? capture.acquire() : undefined))
    void opened.then(
      () => {
        if (!alive) return
        dispatch({ type: 'mic-ready', run })
        if (untrack(state).phase !== 'listen') return
        beginListening(moment)
        // The page went away while the microphone opened.
        if (document.visibilityState === 'hidden') stopListening()
      },
      (error: unknown) => {
        if (!alive) return
        dispatch({
          type: 'mic-failed',
          run,
          block: error instanceof CaptureError ? error.failure : 'unavailable',
        })
        merc.set('idle')
      },
    )
  }

  const start = (): void => {
    const phase = untrack(state).phase
    if ((phase !== 'intro' && phase !== 'blocked') || demoOn()) return
    dispatch({ type: 'start' })
    openMic(untrack(state).targetMidi === null ? 'introAny' : 'listen')
  }

  const cancel = (): void => {
    if (untrack(state).phase !== 'listen' || demoOn()) return
    if (windowOpen) closeWindow()
    // Back in the intro nothing listens, so the mic goes back too.
    capture.release()
    dispatch({ type: 'cancel' })
    sayIntro()
    merc.put('idle', 'beside')
  }

  /**
   * Nothing listens behind the singer's back: a hold ends where it is, and a
   * take still waiting for a note goes back to the intro. So does a start
   * whose note is playing or whose mic is opening: the mic stays shut.
   */
  function stopListening(): void {
    // The demo's takes listen to nothing; the demo stops itself.
    if (demoOn()) return
    if (untrack(state).phase === 'hold' && windowOpen) finish()
    if (untrack(state).phase === 'listen') cancel()
    if (untrack(state).phase !== 'starting') return
    // A mic still opening is handed straight back (useLongNoteCapture).
    capture.release()
    dispatch({ type: 'cancel' })
    sayIntro()
    merc.put('idle', 'beside')
  }

  const again = (): void => {
    if (untrack(state).phase !== 'result' || demoOn()) return
    dispatch({ type: 'again' })
    batch(() => {
      setSummary(null)
      setShine(0)
      setHold(createHoldState())
    })
    easeLevel(0, 450)
    say('again')
    merc.put('listen', 'beside')
    openMic(null)
  }

  const changeNote = (): void => {
    if (untrack(state).phase !== 'result' || demoOn()) return
    dispatch({ type: 'change-note' })
    batch(() => {
      setSummary(null)
      setShine(0)
    })
    easeLevel(0, 450)
    sayIntro()
    merc.put('idle', 'beside')
  }

  const nudge = (step: 1 | -1): void => {
    if (untrack(state).phase !== 'intro' || demoOn()) return
    const midi = nudgeTarget(untrack(state).targetMidi ?? picked.midi, step)
    dispatch({ type: 'target', midi })
    say('intro')
    void capture.playTone(midi, 0.8)
  }

  /** Never while the take is open (the mic would hear it), nor in the demo. */
  const canHear = (): boolean => {
    const { phase, targetMidi } = state()
    const open = phase === 'listen' || phase === 'hold' || phase === 'starting'
    return targetMidi !== null && !open && !scriptActive()
  }

  const hearNote = (): void => {
    const { targetMidi } = untrack(state)
    if (untrack(canHear) && targetMidi !== null) {
      void capture.playTone(targetMidi)
    }
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    sayIntro()
    later(1100, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
  })

  // Leaving the app mid-hold ends the note there: the clock stops with the
  // page, and frames that resume later would count the gap as held.
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') stopListening()
  }
  document.addEventListener('visibilitychange', onVisibility)

  // The screen stays on while the singer's take listens, and while the
  // demo plays (its own say: not on its end card).
  const awake = createScreenAwake()
  createEffect(() => {
    const { phase } = state()
    awake.set(
      scriptActive() ? demoPlaying() : phase === 'listen' || phase === 'hold',
    )
  })

  // The app's mic watchdog: the icon is on while the room listens, and a
  // microphone that died under it ends the take the same way.
  const unregisterIndicator = registerMicIndicator(
    'long-note-lantern',
    () => {
      const phase = untrack(state).phase
      return !demoOn() && (phase === 'listen' || phase === 'hold')
    },
    stopListening,
  )

  // ── The demo's way in ──────────────────────────────────────
  /** What the lantern shows right now, to ease on from. */
  const shownLevel = (): number =>
    untrack(state).phase === 'hold'
      ? fillLevel(engine.charge, engine.topCharge)
      : untrack(lanternLevel)

  /** No take, no result, an empty trace: the light where it stands. */
  const clearForScript = (): void => {
    if (windowOpen) closeWindow()
    const from = shownLevel()
    scripted = null
    engine = createHoldState()
    closedAt = 0
    trace.clear()
    batch(() => {
      setLanternLevel(from)
      setHold(engine)
      setSummary(null)
      setShine(0)
      clearChip()
    })
  }

  const script: LongNoteScript = {
    active: scriptActive,
    audio: () => capture.audio(),
    note: () => untrack(state).targetMidi ?? picked.midi,
    enter: (text) => {
      const phase = untrack(state).phase
      if (!demoOn() && phase !== 'intro' && phase !== 'result') return false
      clearForScript()
      batch(() => {
        setScriptActive(true)
        setScriptNote(script.note())
        setLine(text)
        dispatch({ type: 'demo', phase: 'intro' })
      })
      easeLevel(0, 450)
      merc.put('idle', 'beside')
      return true
    },
    play: (take) => {
      if (!demoOn()) return
      if (windowOpen) closeWindow()
      scripted = take
      batch(() => {
        setSummary(null)
        setShine(0)
        dispatch({ type: 'demo', phase: 'listen' })
      })
      merc.put('listen', 'beside')
      openWindow()
    },
    rest: () => {
      if (!demoOn()) return
      clearForScript()
      dispatch({ type: 'demo', phase: 'listen' })
      easeLevel(0, 600)
    },
    mood: (next) => {
      if (demoOn()) merc.set(next)
    },
    leave: () => {
      if (!demoOn()) return
      const inside = untrack(merc.place) === 'inside'
      const still = scripted?.still === true
      clearForScript()
      batch(() => {
        setScriptActive(false)
        setScriptNote(null)
        setDemoPlaying(false)
        dispatch({ type: 'demo', phase: 'intro' })
      })
      easeLevel(0, 450)
      sayIntro()
      if (inside && !still) merc.hopTo('beside', 'idle')
      else merc.put('idle', 'beside')
    },
    playing: setDemoPlaying,
  }

  onCleanup(() => {
    alive = false
    document.removeEventListener('visibilitychange', onVisibility)
    unregisterIndicator()
    if (loop !== 0) cancelAnimationFrame(loop)
    if (tween !== 0) cancelAnimationFrame(tween)
    for (const id of timers) clearTimeout(id)
    timers.clear()
    windowOpen = false
    setExerciseFocus(false)
    awake.set(false)
  })

  return {
    state,
    noteName,
    hold,
    summary,
    line,
    chip,
    mercState: merc.state,
    mercPlace: merc.place,
    mercVoice: () => voice,
    // In the hold the engine's two fills; otherwise the level the take
    // left, or emptying for a new one.
    lanternLevel: () => {
      const current = hold()
      return state().phase === 'hold'
        ? fillLevel(current.charge, current.topCharge)
        : lanternLevel()
    },
    lanternGlow: () => {
      const current = hold()
      return state().phase === 'hold' && current.inBand ? 1 : 0.25
    },
    shine,
    trace,
    now,
    toleranceCents: PRESET.tolCents,
    start,
    cancel,
    stop: stopListening,
    again,
    changeNote,
    nudge,
    canHear,
    hearNote,
    script,
  }
}
