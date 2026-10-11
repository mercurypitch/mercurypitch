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

import type { Accessor } from 'solid-js'
import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
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
import { setExerciseFocus } from '@/stores/native-shell-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { createChipPacer } from './chip-pacer'
import { HOLD_FILL_MAX } from './lantern-geometry'
import type { LongNoteEvent, LongNoteState } from './long-note-machine'
import { initialLongNoteState, longNoteReducer } from './long-note-machine'
import { isFalseStart, keepRun, resultMoment } from './long-note-run'
import type { LongNoteMoment } from './merc-lines'
import { createMercLineSelector, offMoment } from './merc-lines'
import { rememberedLongNote } from './remembered-note'
import type { LongNoteScript, ScriptedTake } from './scripted-take'
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
  script: LongNoteScript
}

/** The longest hold the room times; past it, the note is called ended. */
const MAX_HOLD_SECONDS = 90
/** Merc dozes off when nobody sings for this long. */
const SLEEP_AFTER_SECONDS = 25
/**
 * A chip line stands at least this long before the next one (chip-pacer),
 * which is also the longest its words can trail the trace's colour.
 */
const CHIP_HOLD_SECONDS = 0.7
/**
 * Off the band this long before the first lock to name the side: until
 * then the singer is still finding the note. After a lock the engine's own
 * break (200 ms off the band) is the moment.
 */
const FIND_SECONDS = 0.9
/**
 * Back on the note after a break, the lock holds this long before the chip
 * says so (0.7 s in the band, with the lock's own 250 ms): a voice hovering
 * at the band's edge keeps its one off line instead of trading it.
 */
const RETURN_SECONDS = 0.45
/** Locked this long before Merc says it is steady. */
const STEADY_SECONDS = 3

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
  // The demo: on, the note it sings, and the take it is singing.
  const [scriptActive, setScriptActive] = createSignal(false)
  const [scriptNote, setScriptNote] = createSignal<number | null>(null)
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
  /** A hop, or straight there for a demo take under reduced motion. */
  const move = (place: MercPlace, then: MercState): void => {
    if (scripted?.still === true) mercFor(then, place)
    else hopTo(place, then)
  }

  // ── The take ───────────────────────────────────────────────
  let engine = createHoldState()
  let processed = 0
  let previous: PitchFrame | null = null
  let lastTick: HoldTick | null = null
  let windowOpen = false
  let windowStartedAt = 0
  let loop = 0
  const chipPacer = createChipPacer(CHIP_HOLD_SECONDS)
  let outOfBandFor = 0
  /** The chip's line while the voice is on the note, set by its events. */
  let onLine: LongNoteMoment = 'lock'
  let asleep = false
  /** The singer's own note was just named: the first lock says so. */
  let foundPending = false

  /** Where the clock stopped: the trace keeps the take it drew. */
  let closedAt = 0
  const now = (): number => {
    if (!windowOpen) return closedAt
    return scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  }

  /** The chip's situation on this frame, shown once the last line stood. */
  const showChip = (moment: LongNoteMoment | null): void => {
    chipPacer.want(moment)
    const shown = chipPacer.take(engine.clock)
    if (shown !== null) setChip(lines.next(shown, untrack(noteName)))
  }
  const clearChip = (): void => {
    chipPacer.reset()
    setChip(null)
  }

  const openWindow = (): void => {
    if (scripted === null) capture.startWindow()
    windowStartedAt = performance.now()
    engine = createHoldState()
    processed = 0
    previous = null
    lastTick = null
    outOfBandFor = 0
    onLine = 'lock'
    asleep = false
    foundPending = false
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
          setMercState('lock')
          onLine = foundPending ? 'found' : 'lock'
          foundPending = false
          break
        case 'relock':
          setMercState('lock')
          onLine = 'lock'
          break
        case 'break':
          setMercState('sing')
          break
        case 'goal':
          feel('success')
          setShining(true)
          onLine = 'full'
          break
        case 'end':
          break
      }
      scripted?.onEvent(event)
    }
  }

  /**
   * What the chip says on this frame, read off the engine state the trace
   * is coloured by, so the words and the colour agree: off the note once
   * the engine has broken the lock (or, before any lock, after
   * FIND_SECONDS off the band), and the on-note line while it is locked.
   * Null while nothing is certain: a moment off the band the engine has
   * not called yet, a gap, a lock only just won back.
   */
  const chipSituation = (): LongNoteMoment | null => {
    const needle = engine.needleCents
    if (lastTick === null || lastTick.offCents === null || needle === null) {
      return null
    }
    if (!engine.inBand) {
      const finding = engine.firstLockAt === null
      const off = finding
        ? outOfBandFor >= FIND_SECONDS
        : engine.phase === 'broken'
      return off ? offMoment(needle) : null
    }
    if (engine.phase !== 'locked') return null
    if (engine.breaks > 0 && engine.lockSeconds < RETURN_SECONDS) return null
    return onLine
  }

  const followChip = (dt: number): void => {
    const voiced = lastTick !== null && lastTick.offCents !== null
    if (voiced && !engine.inBand) outOfBandFor += dt
    else outOfBandFor = 0
    const settled = onLine === 'lock' || onLine === 'found'
    if (settled && engine.lockSeconds >= STEADY_SECONDS) onLine = 'steady'
    showChip(chipSituation())
  }

  const finish = (): void => {
    const take = scripted
    // A hold always has its note; the guard is for the type.
    const target = take?.targetMidi ?? untrack(state).targetMidi
    if (target === null) return
    const frames = closeWindow()
    if (take !== null && !take.toResult) {
      // The demo's first take only shows how a note ends: no result.
      clearChip()
      move('beside', take.after)
      return
    }
    const durationMs = Math.round(performance.now() - windowStartedAt)
    const result = computeHoldResult({
      frames,
      state: engine,
      targetMidi: target,
      durationMs,
    })

    if (take === null && isFalseStart(engine, result)) {
      dispatch({ type: 'false-start' })
      hopTo('beside', 'listen')
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
    batch(() => {
      setSummary({
        inBandSeconds: result.metrics.inBandSeconds,
        steadiness: result.locked ? result.score : null,
        locked: result.locked,
        improved,
        full,
      })
      clearChip()
      dispatch({ type: 'end' })
    })
    // The demo's result keeps Merc's bubble clear for its own tooltip.
    if (take === null) say(resultMoment(improved, full, result.locked))
    move('beside', full || improved ? 'celebrate' : 'idle')
    // Merc is out of the glass: the light may fill the chimney now, from
    // where it stood while he floated on it.
    setLanternLevel(engine.charge * HOLD_FILL_MAX)
    easeLevel(engine.charge, 800)
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
    move('inside', 'sing')
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
      setMercState('sleep')
      say('sleep')
    }
    onEvents(events)
    followChip(engine.clock - before)
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
      if (scripted !== null) {
        follow(scripted.frames(), scripted.targetMidi)
      } else {
        const frames = capture.peekFrames()
        if (targetMidi === null) findNote(frames)
        else follow(frames, targetMidi)
      }
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
    mercFor('idle', 'beside')
  }

  /**
   * Nothing listens behind the singer's back: a hold ends where it is, and a
   * take still waiting for a note goes back to the intro.
   */
  function stopListening(): void {
    // The demo's takes listen to nothing; the demo stops itself.
    if (demoOn()) return
    if (untrack(state).phase === 'hold' && windowOpen) finish()
    if (untrack(state).phase === 'listen') cancel()
  }

  const again = (): void => {
    if (untrack(state).phase !== 'result' || demoOn()) return
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
    if (untrack(state).phase !== 'result' || demoOn()) return
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
    if (untrack(state).phase !== 'intro' || demoOn()) return
    const midi = nudgeTarget(untrack(state).targetMidi ?? picked.midi, step)
    dispatch({ type: 'target', midi })
    say('intro')
    void capture.playTone(midi, 0.8)
  }

  const hearNote = (): void => {
    const { phase, targetMidi } = untrack(state)
    // Never while the take is open: the mic would hear the tone.
    if (phase === 'listen' || phase === 'hold' || phase === 'starting') return
    if (demoOn()) return
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
      return !demoOn() && (phase === 'listen' || phase === 'hold')
    },
    stopListening,
  )

  // ── The demo's way in ──────────────────────────────────────
  /** What the lantern shows right now, to ease on from. */
  const shownLevel = (): number =>
    untrack(state).phase === 'hold'
      ? engine.charge * HOLD_FILL_MAX
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
      setShining(false)
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
      mercFor('idle', 'beside')
      return true
    },
    play: (take) => {
      if (!demoOn()) return
      if (windowOpen) closeWindow()
      scripted = take
      batch(() => {
        setSummary(null)
        setShining(false)
        dispatch({ type: 'demo', phase: 'listen' })
      })
      mercFor('listen', 'beside')
      openWindow()
    },
    rest: () => {
      if (!demoOn()) return
      clearForScript()
      dispatch({ type: 'demo', phase: 'listen' })
      easeLevel(0, 600)
    },
    mood: (next) => {
      if (demoOn()) setMercState(next)
    },
    leave: () => {
      if (!demoOn()) return
      const inside = untrack(mercPlace) === 'inside'
      const still = scripted?.still === true
      clearForScript()
      batch(() => {
        setScriptActive(false)
        setScriptNote(null)
        dispatch({ type: 'demo', phase: 'intro' })
      })
      easeLevel(0, 450)
      sayIntro()
      if (inside && !still) hopTo('beside', 'idle')
      else mercFor('idle', 'beside')
    },
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
    script,
  }
}
