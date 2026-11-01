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

import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { createQuietWatch, secondsClock, } from '@/components/room-kit/quiet-watch'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { offerable, QUIET_LIMIT_SECONDS, } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import { createRoomScript } from '@/components/room-kit/room-script'
import type { RoutineRunOptions } from '@/components/room-kit/routine-stop'
import { levelFromRms, newestLevel } from '@/components/room-kit/voice-level'
import { haptics } from '@/lib/haptics'
import type { HoldEventType, HoldState, HoldTick } from '@/lib/hold/hold-engine'
import { createHoldState, holdTickFromFrame, LANTERN_LEVELS, tickHold, } from '@/lib/hold/hold-engine'
import { computeHoldResult } from '@/lib/hold/hold-metrics'
import { nudgeTarget } from '@/lib/hold/hold-target'
import { loadHoldTarget } from '@/lib/hold/load-hold-target'
import { settledRunStart, settleLiveNote } from '@/lib/hold/settle-note'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { createChipFollower } from './chip-follower'
import { createLanternEase } from './lantern-ease'
import { fillLevel } from './lantern-geometry'
import type { LongNoteController, LongNoteRunSummary, } from './long-note-controller-types'
import type { LongNoteEvent, LongNoteState } from './long-note-machine'
import { initialLongNoteState, longNoteReducer } from './long-note-machine'
import { heldNoteChosen, longNoteOpening } from './long-note-opening'
import { isFalseStart, keepRun, resultMoment } from './long-note-run'
import type { LongNoteMoment } from './merc-lines'
import { createMercLineSelector } from './merc-lines'
import type { LongNoteScript, ScriptedTake } from './scripted-take'
import { useLongNoteCapture } from './useLongNoteCapture'
import { VoiceTraceBuffer } from './voice-trace-buffer'

export type { MercPlace } from '@/components/room-kit/merc-moves'
export { levelFromRms } from '@/components/room-kit/voice-level'
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
/** The halo at the goal, of the brim's full shine. */
export const GOAL_SHINE = 0.5

export function useLongNoteController(
  options: RoutineRunOptions = {},
): LongNoteController {
  const capture = useLongNoteCapture()
  // The voice type's usual note: where the arrows start from no note.
  const picked = loadHoldTarget(untrack(vocalRangePreset))
  const opening = longNoteOpening(picked, options.root ?? null)
  const lines = createMercLineSelector()

  const [state, setState] = createSignal<LongNoteState>(
    initialLongNoteState(opening),
  )
  const [hold, setHold] = createSignal<HoldState>(createHoldState())
  const [summary, setSummary] = createSignal<LongNoteRunSummary | null>(null)
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  // The level a take left, between takes (in the hold, the engine's fills).
  const lantern = createLanternEase()
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
    if (untrack(state).targetMidi === null) say('introAny')
    else say(options.routine === true ? 'routine' : 'intro')
  }

  // ── Timers that belong to the screen ───────────────────────
  // The screen's life (room-kit room-life.ts): its timers from here, its
  // watch once the room's leave and stop exist.
  const life = createRoomLife()

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
  /** The singer's loudness in the newest frame, for the mic's ring. */
  let loudness = 0
  // The take's rules (the goal fills the lantern halfway; past it, steady
  // singing fills the top): the singer's level as the take opens, or the
  // demo's own. Between takes the band follows the level as it is picked.
  const level = createLevelPreset(
    LANTERN_LEVELS,
    () => windowOpen || scriptActive(),
  )
  const loop = createFrameLoop(screenFrame, {
    alive: life.alive,
    running: () => windowOpen,
  })
  const chips = createChipFollower()
  let asleep = false
  /** The singer's own note was just named: the first lock says so. */
  let foundPending = false
  // Merc's state and place; after a cheer he sings along with the voice.
  const merc = createMercMoves({
    later: life.later,
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
  /**
   * A minute with no voice while the room listens, on the take's own clock
   * (now(), the one its frames are dated on), not the wall's.
   */
  const quiet = createQuietWatch({
    limitSeconds: QUIET_LIMIT_SECONDS,
    clock: secondsClock(now),
  })

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
    level.take(scripted?.preset)
    windowStartedAt = performance.now()
    // The take's start counts as heard: its quiet minute starts here.
    quiet.heard(0)
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
    loop.start()
  }

  const closeWindow = (): PitchFrame[] => {
    closedAt = now()
    windowOpen = false
    loudness = 0
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
        // Halfway: he steps out of the glass to cheer, and the top fills by
        // the voice's steadiness. Full: he cheers again.
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
      improved = keepRun(target, result, heldNoteChosen(target, picked))
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
      // goal, the brim only when the top filled too.
      lantern.set(fillLevel(engine.charge, engine.topCharge))
    })
    // The demo's result keeps Merc's bubble clear for its own tooltip.
    if (take === null) say(resultMoment(improved, engine, result.locked))
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
    const rules = untrack(level.preset)
    const events: HoldEventType[] = []
    const before = engine.clock
    for (let i = processed; i < frames.length; i++) {
      const frame = frames[i]
      const heard = holdTickFromFrame(frame, previous, target)
      const step =
        i < heardFrom ? { ...heard, offCents: null, level: 0 } : heard
      engine = tickHold(engine, step, rules)
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
          ? 1 - Math.min(1, Math.abs(cents) / rules.tolCents)
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
    if (voice.voiced) quiet.heard()
    else if (quiet.quiet()) {
      cancel()
      say('rest')
    }
  }

  /**
   * One screen frame while the take is open (frame-loop.ts). A false start
   * in it opens the next take, and with it the next frame.
   */
  function screenFrame(): void {
    const { phase, targetMidi } = untrack(state)
    if (phase !== 'listen' && phase !== 'hold') return
    if (scripted !== null) {
      follow(scripted.frames(), scripted.targetMidi)
    } else {
      const frames = capture.peekFrames()
      loudness = newestLevel(frames)
      if (targetMidi === null) findNote(frames)
      else follow(frames, targetMidi)
      restIfQuiet()
    }
  }

  // ── What the singer does ───────────────────────────────────
  const beginListening = (moment: LongNoteMoment | null): void => {
    if (moment !== null) say(moment)
    merc.put('listen', 'beside')
    openWindow()
  }

  /**
   * The note first, then the microphone (room-kit room-mic.ts): iOS changes
   * the audio session when the mic opens, and the note should not be
   * clipped by it. The tone also ends before the take opens, so the mic
   * never hears it as the singer's own note. With no note yet there is
   * nothing to play, and the mic opens inside the tap itself.
   */
  const openMic = (moment: LongNoteMoment | null): void => {
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      tone: untrack(state).targetMidi,
      // Only the start that stands hears its answer, so the room listens
      // now: a singer who stopped, started again or played the demo while
      // a browser's prompt was up has moved on, and hears nothing.
      onOpen: (run) => {
        dispatch({ type: 'mic-ready', run })
        beginListening(moment)
        // The page went away while the microphone opened.
        if (document.visibilityState === 'hidden') stopListening()
      },
      onFail: (run, block) => {
        dispatch({ type: 'mic-failed', run, block })
        merc.set('idle')
      },
    })
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
   * The mic stops listening: a hold ends where it is, and a take still
   * waiting for a note goes back to the intro. So does a start whose note
   * is playing or whose mic is opening: the mic stays shut.
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
    lantern.ease(0, 450)
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
    lantern.ease(0, 450)
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
    life.later(1100, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
  })

  /** No take, no result, an empty trace, and the light at `level`. */
  const clearTake = (level: number): void => {
    if (windowOpen) closeWindow()
    engine = createHoldState()
    closedAt = 0
    trace.clear()
    batch(() => {
      lantern.set(level)
      setHold(engine)
      setSummary(null)
      setShine(0)
      clearChip()
    })
  }

  /**
   * The singer left the app. Nothing listens behind their back, and a hold
   * is dropped, as Back drops it (owner, 11 Oct 2026: an exercise gets done
   * or not): no run, no best, no practice time. The mic closes and the room
   * is back at its start, with Merc saying why the note stopped. A take
   * still waiting for its note, or for the mic, goes back as before.
   */
  function leave(): void {
    if (demoOn() || untrack(state).phase !== 'hold') {
      stopListening()
      return
    }
    clearTake(0)
    capture.release()
    merc.stopCheering()
    dispatch({ type: 'leave' })
    say('left')
    merc.put('idle', 'beside')
  }

  // Leaving the page, or the app, ends the take (room-kit room-life.ts):
  // the clock stops with the page, so frames that resumed later would also
  // count the gap as held. The screen stays on while the singer's take
  // listens, and while the demo plays (its own say: not on its end card);
  // the rail is this room's own (enterHold). The app's mic watchdog: the
  // icon is on while the room listens, and a microphone that died under it
  // ends the take the same way.
  life.watch({
    leave,
    listening: () => {
      const { phase } = state()
      return phase === 'listen' || phase === 'hold'
    },
    demo: { on: scriptActive, playing: demoPlaying },
    mic: {
      exercise: 'long-note-lantern',
      on: () => {
        const phase = untrack(state).phase
        return !demoOn() && (phase === 'listen' || phase === 'hold')
      },
      died: stopListening,
    },
  })

  // ── The demo's way in ──────────────────────────────────────
  /** What the lantern shows right now, to ease on from. */
  const shownLevel = (): number =>
    untrack(state).phase === 'hold'
      ? fillLevel(engine.charge, engine.topCharge)
      : untrack(lantern.level)

  /** No take, no result, an empty trace: the light where it stands. */
  const clearForScript = (): void => {
    clearTake(shownLevel())
    scripted = null
  }

  // In and out on the room kit's terms (room-script.ts); the moves are
  // this room's own.
  const script: LongNoteScript = {
    ...createRoomScript<ScriptedTake>({
      active: scriptActive,
      phase: () => untrack(state).phase,
      audio: () => capture.audio(),
      note: () => untrack(state).targetMidi ?? picked.midi,
      enter: (text) => {
        clearForScript()
        batch(() => {
          setScriptActive(true)
          setScriptNote(script.note())
          setLine(text)
          dispatch({ type: 'demo', phase: 'intro' })
        })
        lantern.ease(0, 450)
        merc.put('idle', 'beside')
      },
      // A take keeps the light where it is: it only closes a take's window.
      play: (take) => {
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
        clearForScript()
        dispatch({ type: 'demo', phase: 'listen' })
        lantern.ease(0, 600)
      },
      // Where Merc is, and how he moves, before the take is cleared.
      leave: () => {
        const inside = untrack(merc.place) === 'inside'
        const still = scripted?.still === true
        clearForScript()
        batch(() => {
          setScriptActive(false)
          setScriptNote(null)
          setDemoPlaying(false)
          level.follow()
          dispatch({ type: 'demo', phase: 'intro' })
        })
        lantern.ease(0, 450)
        sayIntro()
        if (inside && !still) merc.hopTo('beside', 'idle')
        else merc.put('idle', 'beside')
      },
      playing: setDemoPlaying,
    }),
    mood: (next) => {
      if (demoOn()) merc.set(next)
    },
  }

  onCleanup(() => {
    loop.stop()
    lantern.stop()
    windowOpen = false
    setExerciseFocus(false)
    life.dispose()
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
    micLevel: () => loudness,
    // In the hold the engine's two fills; otherwise the level the take
    // left, or emptying for a new one.
    lanternLevel: () => {
      const current = hold()
      return state().phase === 'hold'
        ? fillLevel(current.charge, current.topCharge)
        : lantern.level()
    },
    lanternGlow: () => {
      const current = hold()
      return state().phase === 'hold' && current.inBand ? 1 : 0.25
    },
    shine,
    trace,
    now,
    toleranceCents: () => level.preset().tolCents,
    start,
    cancel,
    stop: stopListening,
    again,
    changeNote,
    nudge,
    canHear,
    hearNote,
    script,
    settledNote: () => untrack(state).targetMidi,
  }
}
