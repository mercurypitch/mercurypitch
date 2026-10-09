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

import type { Accessor } from 'solid-js'
import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { EXERCISE_LONG_NOTE_LANTERN } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { HoldEventType, HoldState, HoldTick } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import { computeHoldResult } from '@/lib/hold/hold-metrics'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, nudgeTarget, } from '@/lib/hold/hold-target'
import { loadHoldTarget } from '@/lib/hold/load-hold-target'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { HOLD_FILL_MAX } from './lantern-geometry'
import { recordLongNoteBest } from './long-note-best'
import type { LongNoteEvent, LongNoteState } from './long-note-machine'
import { initialLongNoteState, longNoteReducer } from './long-note-machine'
import type { LongNoteMoment } from './merc-lines'
import { createMercLineSelector } from './merc-lines'
import { rememberedLongNote, rememberLongNote } from './remembered-note'
import { settleLiveNote } from './settle-note'
import { CaptureError, useLongNoteCapture } from './useLongNoteCapture'
import { VoiceTraceBuffer } from './voice-trace-buffer'

const PRESET = HOLD_PRESETS.exercise

export type MercPlace = 'beside' | 'inside'

export interface LongNoteRunSummary {
  /** The big number: seconds the light filled. */
  readonly inBandSeconds: number
  /** Out of 100, or null when the run never found the note. */
  readonly steadiness: number | null
  readonly locked: boolean
  /** Beat a previous best on this note. */
  readonly improved: boolean
  /** The lantern filled to the goal. */
  readonly full: boolean
}

export interface LongNoteController {
  state: Accessor<LongNoteState>
  /** The note to hold ("A3"), or '' while the singer picks their own. */
  noteName: Accessor<string>
  hold: Accessor<HoldState>
  summary: Accessor<LongNoteRunSummary | null>
  line: Accessor<string>
  chip: Accessor<string | null>
  mercState: Accessor<MercState>
  mercPlace: Accessor<MercPlace>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  lanternLevel: Accessor<number>
  lanternGlow: Accessor<number>
  shining: Accessor<boolean>
  trace: VoiceTraceBuffer
  /** The trace's clock: seconds since the take started. */
  now: () => number
  readonly toleranceCents: number
  start: () => void
  /** Stop listening before a note and go back to the intro. */
  cancel: () => void
  /** The mic button while the room listens: ends the hold, or cancels. */
  stop: () => void
  again: () => void
  changeNote: () => void
  nudge: (step: 1 | -1) => void
  hearNote: () => void
}

/** A take that never found the note and lasted less is not a run. */
const FALSE_START_SECONDS = 1.5
/** The longest hold the room times; past it, the note is called ended. */
const MAX_HOLD_SECONDS = 90
/** Merc dozes off when nobody sings for this long. */
const SLEEP_AFTER_SECONDS = 25
/** The chip never changes faster than this, events aside. */
const CHIP_MIN_SECONDS = 1.1
/** Out of the band this long before a drift line. */
const DRIFT_SECONDS = 0.45
/** Before the first lock the singer is still finding the note: longer. */
const FIND_SECONDS = 0.9
/** Locked this long before Merc says it is steady. */
const STEADY_SECONDS = 3

/** What Merc says over the result. */
function resultMoment(
  improved: boolean,
  full: boolean,
  locked: boolean,
): LongNoteMoment {
  if (improved) return 'newBest'
  if (full) return 'resultFull'
  // The mic is closed by now: never a line that asks for more singing.
  return locked ? 'result' : 'missed'
}

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
  const [mercState, setMercStateSignal] = createSignal<MercState>('drop')
  const [mercPlace, setMercPlace] = createSignal<MercPlace>('beside')
  const [lanternLevel, setLanternLevel] = createSignal(0)
  const [shining, setShining] = createSignal(false)

  const trace = new VoiceTraceBuffer()
  const noteName = (): string => {
    const target = state().targetMidi
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
  // Every change of Merc's state bumps this, so a landing scheduled before
  // it cannot overwrite what came after.
  let mercChange = 0
  const setMercState = (next: MercState): void => {
    mercChange += 1
    setMercStateSignal(next)
  }
  const mercFor = (next: MercState, place: MercPlace): void => {
    batch(() => {
      setMercState(next)
      setMercPlace(place)
    })
  }
  /** A hop from one place to the other, landing in `then`. */
  const hopTo = (place: MercPlace, then: MercState): void => {
    mercFor('hop', place)
    const hop = mercChange
    later(650, () => {
      if (mercChange === hop) setMercState(then)
    })
  }

  // ── The take ───────────────────────────────────────────────
  let engine = createHoldState()
  let processed = 0
  let previous: PitchFrame | null = null
  let lastTick: HoldTick | null = null
  let windowOpen = false
  let windowStartedAt = 0
  let loop = 0
  let chipAt = -Infinity
  let outOfBandFor = 0
  let steadySaidForLock = false
  let asleep = false
  /** The singer's own note was just named: the first lock says so. */
  let foundPending = false

  /** Where the clock stopped: the trace keeps the take it drew. */
  let closedAt = 0
  const now = (): number =>
    windowOpen ? (performance.now() - windowStartedAt) / 1000 : closedAt

  const setChipLine = (moment: LongNoteMoment, force: boolean): void => {
    const t = engine.clock
    if (!force && t - chipAt < CHIP_MIN_SECONDS) return
    chipAt = t
    setChip(lines.next(moment, untrack(noteName)))
  }

  const openWindow = (): void => {
    capture.startWindow()
    windowStartedAt = performance.now()
    engine = createHoldState()
    processed = 0
    previous = null
    lastTick = null
    chipAt = -Infinity
    outOfBandFor = 0
    steadySaidForLock = false
    asleep = false
    foundPending = false
    trace.clear()
    batch(() => {
      setHold(engine)
      setChip(null)
    })
    windowOpen = true
    if (loop === 0) loop = requestAnimationFrame(tick)
  }

  const closeWindow = (): PitchFrame[] => {
    closedAt = now()
    windowOpen = false
    setExerciseFocus(false)
    return capture.takeFrames()
  }

  const onEvents = (events: readonly HoldEventType[]): void => {
    for (const event of events) {
      switch (event) {
        case 'lock':
          haptics.tapLight()
          setMercState('lock')
          later(900, () => {
            if (untrack(mercState) === 'lock') setMercState('sing')
          })
          steadySaidForLock = false
          setChipLine(foundPending ? 'found' : 'lock', true)
          foundPending = false
          break
        case 'relock':
          steadySaidForLock = false
          setChipLine('lock', true)
          break
        case 'break':
          setChipLine('break', true)
          break
        case 'goal':
          haptics.success()
          setShining(true)
          setChipLine('full', true)
          break
        case 'end':
          break
      }
    }
  }

  const followDrift = (dt: number): void => {
    const voiced = lastTick !== null && lastTick.offCents !== null
    if (voiced && !engine.inBand) outOfBandFor += dt
    else outOfBandFor = 0
    // A singer who never finds the note hears which way to go, too.
    const wait = engine.firstLockAt === null ? FIND_SECONDS : DRIFT_SECONDS
    if (outOfBandFor >= wait && engine.needleCents !== null) {
      setChipLine(engine.needleCents > 0 ? 'driftSharp' : 'driftFlat', false)
    }
    if (
      engine.inBand &&
      engine.phase === 'locked' &&
      engine.lockSeconds >= STEADY_SECONDS &&
      !steadySaidForLock
    ) {
      steadySaidForLock = true
      setChipLine('steady', false)
    }
  }

  const finish = (): void => {
    // A hold always has its note; the guard is for the type.
    const target = untrack(state).targetMidi
    if (target === null) return
    const frames = closeWindow()
    const durationMs = Math.round(performance.now() - windowStartedAt)
    const result = computeHoldResult({
      frames,
      state: engine,
      targetMidi: target,
      durationMs,
    })
    const voicedSeconds =
      engine.firstVoicedAt === null || engine.lastVoicedAt === null
        ? 0
        : engine.lastVoicedAt - engine.firstVoicedAt

    if (!result.locked && voicedSeconds < FALSE_START_SECONDS) {
      dispatch({ type: 'false-start' })
      hopTo('beside', 'listen')
      openWindow()
      return
    }

    // A result: nothing listens again until the singer asks.
    capture.release()
    let improved = false
    if (result.locked) {
      recordExerciseResult({
        type: EXERCISE_LONG_NOTE_LANTERN,
        score: result.score,
        metrics: result.metrics,
        completedAt: Date.now(),
      })
      improved = recordLongNoteBest(target, {
        inBandSeconds: result.metrics.inBandSeconds,
        steadiness: result.score,
        at: Date.now(),
      }).improved
      rememberLongNote(target)
    }
    const full = engine.goalReached
    batch(() => {
      setSummary({
        inBandSeconds: result.metrics.inBandSeconds,
        steadiness: result.locked ? result.score : null,
        locked: result.locked,
        improved,
        full,
      })
      setChip(null)
      dispatch({ type: 'end' })
    })
    say(resultMoment(improved, full, result.locked))
    hopTo('beside', full || improved ? 'celebrate' : 'idle')
    // Merc is out of the glass: the light may fill the chimney now, from
    // where it stood while he floated on it.
    setLanternLevel(engine.charge * HOLD_FILL_MAX)
    easeLevel(engine.charge, 800)
  }

  /** The take against its note: the engine, Merc, the chip, the end. */
  const follow = (frames: readonly PitchFrame[], target: number): void => {
    const phase = untrack(state).phase
    const events: HoldEventType[] = []
    const before = engine.clock
    for (let i = processed; i < frames.length; i++) {
      const frame = frames[i]
      const step = holdTickFromFrame(frame, previous, target)
      engine = tickHold(engine, step, PRESET)
      events.push(...engine.events)
      trace.push(
        frame.t,
        step.offCents === null ? null : (engine.needleCents ?? step.offCents),
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
      dispatch({ type: 'voice' })
      setExerciseFocus(true)
      setLine('')
      hopTo('inside', 'sing')
    } else if (phase === 'listen' && !asleep && now() > SLEEP_AFTER_SECONDS) {
      asleep = true
      setMercState('sleep')
      say('sleep')
    }
    onEvents(events)
    followDrift(engine.clock - before)
    if (
      engine.phase === 'ended' ||
      (untrack(state).phase === 'hold' && engine.clock > MAX_HOLD_SECONDS)
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
        setMercState('sleep')
        say('sleepAny')
      }
      return
    }
    dispatch({ type: 'settle', midi })
    foundPending = true
    // The run so far counts: replay the take against the note just named.
    processed = 0
    previous = null
    lastTick = null
    engine = createHoldState()
    trace.clear()
    follow(frames, midi)
  }

  function tick(): void {
    loop = 0
    if (!alive) return
    const { phase, targetMidi } = untrack(state)
    if (windowOpen && (phase === 'listen' || phase === 'hold')) {
      const frames = capture.peekFrames()
      if (targetMidi === null) findNote(frames)
      else follow(frames, targetMidi)
    }
    // A false start inside this tick may already have scheduled the next.
    if (alive && windowOpen && loop === 0) loop = requestAnimationFrame(tick)
  }

  // ── What the singer does ───────────────────────────────────
  const beginListening = (moment: LongNoteMoment | null): void => {
    if (moment !== null) say(moment)
    mercFor('listen', 'beside')
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
    // only if the room is still there.
    const opened =
      targetMidi === null
        ? capture.acquire()
        : capture
            .playTone(targetMidi)
            .then(() => (alive ? capture.acquire() : undefined))
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
        setMercState('idle')
      },
    )
  }

  const start = (): void => {
    const phase = untrack(state).phase
    if (phase !== 'intro' && phase !== 'blocked') return
    dispatch({ type: 'start' })
    openMic(untrack(state).targetMidi === null ? 'introAny' : 'listen')
  }

  const cancel = (): void => {
    if (untrack(state).phase !== 'listen') return
    if (windowOpen) closeWindow()
    // Back in the intro nothing listens, so the mic goes back too.
    capture.release()
    dispatch({ type: 'cancel' })
    sayIntro()
    mercFor('idle', 'beside')
  }

  /**
   * Nothing listens behind the singer's back: a hold ends where it is, and a
   * take still waiting for a note goes back to the intro.
   */
  function stopListening(): void {
    if (untrack(state).phase === 'hold' && windowOpen) finish()
    if (untrack(state).phase === 'listen') cancel()
  }

  const again = (): void => {
    if (untrack(state).phase !== 'result') return
    dispatch({ type: 'again' })
    batch(() => {
      setSummary(null)
      setShining(false)
      setHold(createHoldState())
    })
    easeLevel(0, 450)
    say('again')
    mercFor('listen', 'beside')
    openMic(null)
  }

  const changeNote = (): void => {
    if (untrack(state).phase !== 'result') return
    dispatch({ type: 'change-note' })
    batch(() => {
      setSummary(null)
      setShining(false)
    })
    easeLevel(0, 450)
    sayIntro()
    mercFor('idle', 'beside')
  }

  const nudge = (step: 1 | -1): void => {
    if (untrack(state).phase !== 'intro') return
    const midi = nudgeTarget(untrack(state).targetMidi ?? picked.midi, step)
    dispatch({ type: 'target', midi })
    say('intro')
    void capture.playTone(midi, 0.8)
  }

  const hearNote = (): void => {
    const { phase, targetMidi } = untrack(state)
    // Never while the take is open: the mic would hear the tone.
    if (phase === 'listen' || phase === 'hold' || phase === 'starting') return
    if (targetMidi !== null) void capture.playTone(targetMidi)
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    sayIntro()
    later(1100, () => {
      if (untrack(mercState) === 'drop') setMercState('idle')
    })
  })

  // Leaving the app mid-hold ends the note there: the clock stops with the
  // page, and frames that resume later would count the gap as held.
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') stopListening()
  }
  document.addEventListener('visibilitychange', onVisibility)

  // The app's mic watchdog: the icon is on while the room listens, and a
  // microphone that died under it ends the take the same way.
  const unregisterIndicator = registerMicIndicator(
    'long-note-lantern',
    () => {
      const phase = untrack(state).phase
      return phase === 'listen' || phase === 'hold'
    },
    stopListening,
  )

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
  })

  return {
    state,
    noteName,
    hold,
    summary,
    line,
    chip,
    mercState,
    mercPlace,
    mercVoice: () => voice,
    // While Merc floats on it the light stops short of the cap; otherwise
    // it is the eased level (emptying for a new run, topping up after one).
    lanternLevel: () =>
      state().phase === 'hold' ? hold().charge * HOLD_FILL_MAX : lanternLevel(),
    lanternGlow: () => {
      const current = hold()
      return state().phase === 'hold' && current.inBand ? 1 : 0.25
    },
    shining,
    trace,
    now,
    toleranceCents: PRESET.tolCents,
    start,
    cancel,
    stop: stopListening,
    again,
    changeNote,
    nudge,
    hearNote,
  }
}
