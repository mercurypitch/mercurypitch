// ============================================================
// useLeapController: one Leap run, from the tap to the result
// ============================================================
//
// Owns the room's states (leap-machine.ts), the microphone and the audio
// clock (room-kit useExerciseCapture.ts), Merc's voice (the room kit's
// RoundVoice), the sequence engine that hears each leap as two notes
// (src/lib/sequence) and everything that answers it: the voice's trail,
// the ledges' lines, the lantern, Merc's state and voice, his lines, the
// chip and the leap's lamp under it.
//
// A run is LEAP_ROUNDS leaps at the singer's level, planned as it starts
// (leap-round.ts) in the singer's window: the voiceprint's range, else the
// voice type's. Each round: Merc names the leap and sings his note (both
// notes, at Learning), then the singer's turn: his note, then the leap.
// The engine hears the two as a phrase in free time, never folded; the leap
// lands when the target does, held in its band for the level's land time.
// Then the lantern lights and the next leap comes; after a miss, Merc sings
// both notes first. After the last, the result, where each leap's row
// plays it again. The microphone opens on the tap and closes at the result.
//
// One capture window per round, opened as its call is scheduled, so the
// frames' clock and the audio clock meet at one moment. The call is
// scheduled a little ahead on the audio clock and its end carried to the
// frames' clock with the output latency; the engine hears nothing before
// that end plus RESPONSE_GATE_SECONDS (his voice through the speaker
// reaches the mic). The engine is ticked once per CAPTURED frame, on the
// frames' own clock, never once per screen frame.

import type { Accessor } from 'solid-js'
import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import type { ShellRun } from '@/components/room-kit/RoomShell'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { outputLatency, SYNTH_VOICE } from '@/components/room-kit/round-voice'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { levelFromRms, newestLevel } from '@/components/room-kit/voice-level'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_LEAP_CLIFFS } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import { offTarget } from '@/lib/hold/hold-reading'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { echoWindow } from '@/lib/sequence/phrase-fit'
import type { PhraseNote, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { vocalRangePreset } from '@/stores/settings-store'
import { trailNote } from './cliff-layout'
import type { LeapEvent, LeapState, RoundOutcome } from './leap-machine'
import { INITIAL_LEAP_STATE, isRunPhase, leapReducer, liveRound, } from './leap-machine'
import { leapOutcome, leapPhrase, mercNotes } from './leap-phrase'
import type { LeapRound } from './leap-round'
import { planRounds, roundWindow } from './leap-round'
import type { LeapLevel } from './leap-rules'
import { AFTER_ANSWER_MS, BETWEEN_ROUNDS_MS, LEAP_LEVELS, LEAP_ROUNDS, leapName, leapSong, namesPrecisely, sizeName, SOUND_LEAD_SECONDS, } from './leap-rules'
import type { LeapSummary } from './leap-run'
import { callMoment, keepLeapRun, landedMoment, missedMoment, resultMoment, summarizeRun, } from './leap-run'
import type { LeapLineFields, LeapMoment } from './merc-lines'
import { createLeapLines } from './merc-lines'

/** The chip while the singer sings. */
export const YOUR_TURN = 'Your turn'
/** Merc's voice while he sings (demo-voice's held level). */
const SUNG_LEVEL = 0.8
/** His voice's tail through the speaker, past the end of his last note, s. */
const VOICE_TAIL_SECONDS = 0.18

/** Merc's face while he sings `midi`, held and on it. */
function singing(midi: number): MercVoice {
  return { voiced: true, cents: 0, level: SUNG_LEVEL, steady: 1, midi }
}

/** What the leap's lamp under the chip shows. */
export type LeapLampState = 'toCome' | 'landed' | 'missed'

/** The leap's lamp: "Up a fifth", which way, and how it went. */
export interface LeapLampView {
  readonly name: string
  readonly up: boolean
  readonly state: LeapLampState
}

/** Draws the voice: its readings and now (frames' clock), the hold; null clears it. */
export type TrailSink = (
  trail: {
    readonly points: readonly TrailPoint[]
    readonly now: number
    /** The target's hold so far, 0 to 1 of the land time. */
    readonly hold: number
  } | null,
) => void

export interface LeapControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  readonly random?: () => number
}

export interface LeapController extends ShellRun {
  readonly state: Accessor<LeapState>
  /** Merc's line, in his bubble; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The leap's lamp under the chip: its name, its way and how it went. */
  readonly lamp: Accessor<LeapLampView | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<LeapSummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The round on screen, or null outside a run. */
  readonly round: Accessor<LeapRound | null>
  /** The rules the run is heard by (the band's height on screen). */
  readonly rules: Accessor<LeapLevel>
  /** The rules of the last run, as its result names its leaps. */
  readonly runRules: Accessor<LeapLevel>
  /** The voice sits on Merc's note now. */
  readonly onFrom: Accessor<boolean>
  /** The voice is in the target's band now: the lantern warms. */
  readonly onTarget: Accessor<boolean>
  /** The target's name shows: once the leap has landed or Merc has sung it. */
  readonly revealed: Accessor<boolean>
  /** Merc sings both notes after a miss: his line draws. */
  readonly answering: Accessor<boolean>
  readonly mercState: ReturnType<typeof createMercMoves>['state']
  readonly mercVoice: () => MercVoice
  /** "Hear Merc again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The round of the result heard again now, by its index; null for none. */
  readonly replaying: Accessor<number | null>
  /** At the result: round `index` again, Merc singing both its notes. */
  readonly replayLeap: (index: number) => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: TrailSink) => void
}

/** A sound of Merc's, scheduled on the audio clock. */
interface Sung {
  readonly endAt: number
  stop(): void
}

export function useLeapController(
  options: LeapControllerOptions = {},
): LeapController {
  const capture = useExerciseCapture('leap', 'Leap')
  const voiceOfMerc = options.voice ?? SYNTH_VOICE
  const random = options.random ?? Math.random
  const lines = createLeapLines(random)

  const [state, setState] = createSignal<LeapState>(INITIAL_LEAP_STATE)
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [lamp, setLamp] = createSignal<LeapLampView | null>(null)
  const [summary, setSummary] = createSignal<LeapSummary | null>(null)
  const [resultLevel, setResultLevel] = createSignal('')
  const [onFrom, setOnFrom] = createSignal(false)
  const [onTarget, setOnTarget] = createSignal(false)
  const [revealed, setRevealed] = createSignal(false)
  const [answering, setAnswering] = createSignal(false)
  const [replaying, setReplaying] = createSignal<number | null>(null)
  const level = createLevelPreset(LEAP_LEVELS, () => isRunPhase(state().phase))

  const dispatch = (event: LeapEvent): void => {
    setState((current) => leapReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = (moment: LeapMoment, fields?: LeapLineFields): void => {
    setLine(lines.next(moment, fields))
  }
  const sayIntro = (): void => {
    say(untrack(level.preset).mercSingsBoth ? 'introMatch' : 'intro')
  }

  // ── Timers that belong to the screen (room-kit room-life.ts) ───
  const life = createRoomLife()

  // ── Merc ───────────────────────────────────────────────────
  let voice: MercVoice = SILENT_VOICE
  const merc = createMercMoves({
    later: life.later,
    still: prefersReducedMotion,
    afterCheer: () => (isRunPhase(phase()) ? 'listen' : 'idle'),
  })

  // ── The run ────────────────────────────────────────────────
  let audio: AudioContext | null = null
  let runLevel: ExerciseLevel = 'singer'
  let rules: LeapLevel = untrack(level.preset)
  const [runRules, setRunRules] = createSignal<LeapLevel>(rules)
  /** The run names its sixths "major": it asks for the minor one too. */
  const precise = (): boolean => namesPrecisely(rules)
  let sound: Sung | null = null
  let engine: SequenceState = createSequenceState(0)
  let processed = 0
  let windowStartedAt = 0
  /** Merc's notes in the call, on the frames' clock. */
  let callNotes: { midi: number; from: number; to: number }[] = []
  /** The frame loop runs: a call or a turn is on. */
  let listening = false
  let loudness = 0
  let points: TrailPoint[] = []
  let heardAgain = false
  let voicedInTurn = false
  /** When the voice entered the target's band, frames' clock; null outside. */
  let bandSince: number | null = null
  /** Counts calls, so a replayed call's pending moments never fire. */
  let callCount = 0
  /** Counts Merc's answers and replays, so an old one's moments never fire. */
  let answerCount = 0
  let sink: TrailSink = () => undefined

  const frameNow = (): number => (performance.now() - windowStartedAt) / 1000
  const live = (): LeapRound | null => liveRound(untrack(state))

  const loop = createFrameLoop(screenFrame, {
    alive: life.alive,
    running: () => listening,
  })
  const startLoop = (): void => {
    listening = true
    loop.start()
  }
  const stopLoop = (): void => {
    listening = false
    loudness = 0
    loop.stop()
  }

  const stopSound = (): void => {
    sound?.stop()
    sound = null
  }

  /** Off the sound, the loop, the trail and Merc's voice. */
  const hush = (): void => {
    stopLoop()
    stopSound()
    sink(null)
    points = []
    voice = SILENT_VOICE
    batch(() => {
      setOnFrom(false)
      setOnTarget(false)
    })
  }

  /** Merc sings `notes` from a moment from now; his face follows each one. */
  const sing = (
    ctx: AudioContext,
    notes: readonly PhraseNote[],
    current: () => boolean,
  ): Sung => {
    const start = ctx.currentTime + SOUND_LEAD_SECONDS
    const sung = voiceOfMerc.sing(ctx, notes, start)
    const latency = outputLatency(ctx)
    const at = (t: number, then: () => void): void => {
      life.later(Math.max(0, (t - ctx.currentTime + latency) * 1000), () => {
        if (current()) then()
      })
    }
    for (const note of notes) {
      at(start + note.at, () => {
        voice = singing(note.midi)
        merc.stopCheering()
        merc.set('sing')
      })
    }
    const last = notes[notes.length - 1]
    if (last !== undefined) {
      at(start + last.at + last.seconds + 0.1, () => {
        voice = SILENT_VOICE
        merc.set(isRunPhase(phase()) ? 'listen' : 'idle')
      })
    }
    return {
      endAt: sung.endAt + VOICE_TAIL_SECONDS,
      stop: () => sung.stop(),
    }
  }

  /**
   * The round's call: Merc's note (both, at Learning), a fresh capture
   * window, and a fresh engine that hears nothing until the call is over.
   */
  const callRound = (round: LeapRound): void => {
    const ctx = audio
    if (ctx === null) return
    stopSound()
    capture.startWindow()
    windowStartedAt = performance.now()
    processed = 0
    points = []
    voicedInTurn = false
    bandSince = null
    sink(null)
    batch(() => {
      setOnFrom(false)
      setOnTarget(false)
    })
    const a0 = ctx.currentTime
    const latency = outputLatency(ctx)
    const onFrames = (t: number): number => t - a0 + latency
    callCount += 1
    const call = callCount
    const notes = mercNotes(round, rules.mercSingsBoth)
    const sung = sing(
      ctx,
      notes,
      () => call === callCount && phase() === 'call',
    )
    sound = sung
    const start = a0 + SOUND_LEAD_SECONDS
    callNotes = notes.map((note) => ({
      midi: note.midi,
      from: onFrames(start + note.at),
      to: onFrames(start + note.at + note.seconds),
    }))
    engine = createSequenceState(onFrames(sung.endAt) + RESPONSE_GATE_SECONDS)
    merc.set('listen')
    startLoop()
  }

  /** A round begins: Merc names the leap and calls it. */
  const beginRound = (index: number): void => {
    dispatch({ type: 'call', index })
    const round = live()
    if (round === null || phase() !== 'call') return
    heardAgain = false
    const song = leapSong(round.kind)
    batch(() => {
      setChip(`Leap ${round.index + 1} of ${untrack(state).rounds.length}`)
      setLamp({
        name: leapName(round.kind, precise()),
        up: round.kind.up,
        state: 'toCome',
      })
      setRevealed(rules.mercSingsBoth)
      setAnswering(false)
      say(callMoment(rules, round.kind), {
        leap: leapName(round.kind, precise()),
        song: song?.short,
      })
    })
    callRound(round)
  }

  /** The call has reached its end at the speaker: the singer's turn. */
  const toTurn = (): void => {
    dispatch({ type: 'turn' })
    setChip(YOUR_TURN)
    merc.set('listen')
  }

  /** The singer's voice against both notes: the trail, the lines, the lantern. */
  const hearVoice = (frame: PitchFrame, round: LeapRound): void => {
    const toTarget = offTarget(frame, round.to)
    const toFrom = offTarget(frame, round.from)
    const off = offTarget(frame, trailNote(round))
    points.push({ t: frame.t, cents: off })
    if (toTarget === null || toFrom === null) {
      voice = { ...voice, voiced: false, level: 0 }
      bandSince = null
      batch(() => {
        setOnFrom(false)
        setOnTarget(false)
      })
      return
    }
    voicedInTurn = true
    const tol = rules.tolCents
    const inTarget = Math.abs(toTarget) <= tol
    bandSince = inTarget ? (bandSince ?? frame.t) : null
    batch(() => {
      setOnTarget(inTarget)
      setOnFrom(Math.abs(toFrom) <= tol)
    })
    voice = {
      voiced: true,
      cents: toTarget,
      level: levelFromRms(frame.rms),
      steady: 1 - Math.min(1, Math.abs(toTarget) / (tol * 4)),
      midi: round.to + toTarget / 100,
    }
  }

  /** The leap's outcome from the engine, once its target is decided. */
  const outcomeOf = (round: LeapRound): RoundOutcome | null =>
    leapOutcome(engine, round, { voiced: voicedInTurn, heardAgain })

  const onEvent = (event: SequenceEvent, round: LeapRound): void => {
    if (event.type === 'phraseEnd') {
      const outcome = outcomeOf(round)
      if (outcome !== null) endRound(outcome)
      return
    }
    if (event.index !== 1) return
    const outcome = outcomeOf(round)
    if (outcome !== null) endRound(outcome)
  }

  /** New captured frames: the turn's trail and its engine. */
  const follow = (frames: readonly PitchFrame[], round: LeapRound): void => {
    const from = processed
    processed = frames.length
    for (let i = from; i < frames.length && listening; i++) {
      const frame = frames[i]
      if (phase() !== 'sing' || frame.t < engine.responseStart) continue
      hearVoice(frame, round)
      engine = tickSequence(engine, frame, leapPhrase(round), rules)
      for (const event of engine.events) {
        onEvent(event, round)
        if (phase() !== 'sing') return
      }
    }
  }

  /** The target's hold so far, 0 to 1, at `now` on the frames' clock. */
  const holdAt = (now: number): number =>
    bandSince === null
      ? 0
      : Math.min(1, Math.max(0, ((now - bandSince) * 1000) / rules.landMs))

  /** One screen frame while the room listens (frame-loop.ts). */
  function screenFrame(): void {
    const round = live()
    if (round === null) return
    if (phase() === 'call' && frameNow() >= engine.responseStart) toTurn()
    const frames = capture.peekFrames()
    follow(frames, round)
    if (!listening) return
    if (phase() === 'sing') {
      const last = frames.length === 0 ? null : frames[frames.length - 1]
      loudness =
        last === null || last.t < engine.responseStart ? 0 : newestLevel(frames)
      const now = frameNow()
      sink({ points, now, hold: holdAt(now) })
    } else {
      loudness = 0
    }
  }

  /** On to the next leap after `ms`: only for this run and this round. */
  const nextAfter = (ms: number, index: number): void => {
    const { run } = untrack(state)
    life.later(ms, () => {
      const now = untrack(state)
      if (now.run !== run || now.current !== index) return
      if (now.phase !== 'landed' && now.phase !== 'missed') return
      if (index + 1 < now.rounds.length) beginRound(index + 1)
      else finishRun()
    })
  }

  /** A round is over: the lantern, Merc's line, then the next leap. */
  function endRound(outcome: RoundOutcome): void {
    const ctx = audio
    stopLoop()
    capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    const { round } = outcome
    const note = midiToNoteNameOctave(round.to)
    const fields: LeapLineFields = {
      leap: leapName(round.kind, precise()),
      size: sizeName(round.kind.size, precise()),
      song: leapSong(round.kind)?.short,
      from: midiToNoteNameOctave(round.from),
      note,
      way: round.kind.up ? 'up' : 'down',
    }
    stopSound()
    bandSince = null
    sink(null)
    if (outcome.landed) {
      haptics.tapLight()
      batch(() => {
        setChip(`Landed: ${note}`)
        setLamp({
          name: leapName(round.kind, precise()),
          up: round.kind.up,
          state: 'landed',
        })
        setRevealed(true)
        setOnTarget(true)
        say(landedMoment(rules, round.kind), fields)
      })
      merc.cheer()
      nextAfter(BETWEEN_ROUNDS_MS, round.index)
      return
    }
    batch(() => {
      setChip(`It was ${note}`)
      setLamp({
        name: leapName(round.kind, precise()),
        up: round.kind.up,
        state: 'missed',
      })
      setRevealed(true)
      setOnTarget(false)
      setAnswering(true)
      say(missedMoment(outcome), fields)
    })
    // He sings both notes, his line drawn as he sings them.
    answerCount += 1
    const answer = answerCount
    let wait = AFTER_ANSWER_MS
    if (ctx !== null) {
      const sung = sing(ctx, mercNotes(round, true), () => {
        return answer === answerCount && phase() === 'missed'
      })
      sound = sung
      wait += Math.max(0, (sung.endAt - ctx.currentTime) * 1000)
    }
    nextAfter(wait, round.index)
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(): void {
    capture.release()
    hush()
    const outcomes = untrack(state).outcomes
    const shown = summarizeRun(outcomes)
    const kept = keepLeapRun(runLevel, shown)
    const levelName = exerciseLevelName(runLevel)
    batch(() => {
      dispatch({ type: 'finish' })
      setSummary(shown)
      setResultLevel(levelName)
      setChip(null)
      setLamp(null)
      setAnswering(false)
      say(resultMoment(shown, kept), {
        found: shown.landed,
        rounds: shown.rounds,
        level: levelName,
      })
    })
    if (kept.kept && shown.landed * 2 >= shown.rounds) {
      haptics.success()
      merc.cheer()
    } else {
      merc.set('idle')
    }
  }

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(): void {
    capture.release()
    hush()
    merc.stopCheering()
    batch(() => {
      dispatch({ type: 'stop' })
      setChip(null)
      setLamp(null)
      setAnswering(false)
    })
    merc.set('idle')
  }

  /** A leap heard again at the result goes quiet, its moments with it. */
  const endReplay = (): void => {
    answerCount += 1
    setReplaying(null)
  }

  /** At the result, a leap's row: Merc sings both its notes again. */
  const replayLeap = (index: number): void => {
    if (phase() !== 'result') return
    const outcome = untrack(state).outcomes[index]
    if (outcome === undefined) return
    endReplay()
    const mine = answerCount
    const current = (): boolean => mine === answerCount && phase() === 'result'
    // Asked inside the tap: iOS starts the clock only from a gesture.
    void capture.audio().then((ctx) => {
      if (ctx === null || !current()) return
      audio = ctx
      stopSound()
      const sung = sing(ctx, mercNotes(outcome.round, true), current)
      sound = sung
      setReplaying(index)
      const ms = (sung.endAt - ctx.currentTime + outputLatency(ctx)) * 1000
      life.later(Math.max(0, ms), () => {
        if (current()) setReplaying(null)
      })
    })
  }

  // ── What the singer does ───────────────────────────────────
  const start = (): void => {
    const from = phase()
    if (from !== 'intro' && from !== 'result' && from !== 'blocked') return
    // A leap still sounding from the result stops with the tap.
    endReplay()
    stopSound()
    voice = SILENT_VOICE
    level.take()
    runLevel = untrack(exerciseLevel)
    rules = untrack(level.preset)
    setRunRules(() => rules)
    const window = echoWindow({
      voiceprints: loadLocalVoiceprints(),
      voicePreset: untrack(vocalRangePreset),
    })
    const rounds = planRounds(
      LEAP_ROUNDS,
      roundWindow({ low: window.low, high: window.high }),
      rules,
      random,
    )
    batch(() => {
      dispatch({ type: 'start', rounds })
      setSummary(null)
      setChip(null)
      setLamp(null)
      setLine('')
    })
    merc.stopCheering()
    merc.set('listen')
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      clock: true,
      onOpen: (_run, ctx) => {
        audio = ctx
        beginRound(0)
      },
      onFail: (run, block) => {
        dispatch({ type: 'blocked', run, block })
        merc.set('idle')
      },
      onHidden: leave,
    })
  }

  const stop = (): void => {
    if (!isRunPhase(phase())) return
    dropRun()
    sayIntro()
  }

  /** Merc's call again, in the singer's turn, as the level allows. */
  const canHearAgain = (): boolean => {
    const now = state()
    if (now.phase !== 'sing') return false
    const allowance = level.preset().hearAgain
    if (allowance === 'never') return false
    return allowance === 'anyTime' || now.replays === 0
  }

  const hearAgain = (): void => {
    if (!untrack(canHearAgain)) return
    const round = live()
    if (round === null) return
    stopLoop()
    capture.takeFrames()
    dispatch({ type: 'hearAgain' })
    heardAgain = true
    setChip(`Leap ${round.index + 1} of ${untrack(state).rounds.length}`)
    callRound(round)
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as the mic's tap drops it: no result, no best.
   */
  function leave(): void {
    if (!isRunPhase(phase())) return
    dropRun()
    sayIntro()
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    sayIntro()
    life.later(1100, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
  })

  life.watch({
    leave,
    listening: () => isRunPhase(state().phase),
    demo: { on: () => false, playing: () => false },
    holdsFocus: true,
    mic: {
      exercise: EXERCISE_LEAP_CLIFFS,
      on: () => isRunPhase(phase()) && phase() !== 'starting',
      died: stop,
    },
  })

  onCleanup(() => {
    stopLoop()
    stopSound()
    life.dispose()
  })

  /** Merc's voice: his own note while he calls it, else the singer's. */
  const mercVoice = (): MercVoice => {
    const round = live()
    if (round !== null && phase() === 'call') {
      const t = frameNow()
      const note = callNotes.find((n) => t >= n.from && t < n.to)
      if (note !== undefined) return singing(note.midi)
      return { ...SILENT_VOICE, midi: round.from }
    }
    return voice
  }

  return {
    state,
    line,
    chip,
    lamp,
    summary,
    resultLevel,
    round: () => liveRound(state()),
    rules: level.preset,
    runRules,
    onFrom,
    onTarget,
    revealed,
    answering,
    mercState: merc.state,
    mercVoice,
    micLevel: () => loudness,
    canHearAgain,
    hearAgain,
    replaying,
    replayLeap,
    start,
    stop,
    drawTrail: (next) => {
      sink = next
    },
    script: { active: () => false },
  }
}
