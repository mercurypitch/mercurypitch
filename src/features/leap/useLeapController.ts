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
//
// "How it works" (demo/useLeapDemo.ts) sings its takes through the same
// steps by `script` (scripted-take.ts): frames in place of the mic, Merc's
// call and his answer on the take's clock, the demo's own sound singing
// them. A scripted take never opens the mic, fires a haptic, says a line or
// keeps a result, and a run's moves wait while the demo has the room.

import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { createMercSinger, singing } from '@/components/room-kit/merc-singer'
import { createMercSpeech, speakingLines, } from '@/components/room-kit/merc-speech'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import { outputLatency, SYNTH_VOICE } from '@/components/room-kit/round-voice'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { newestLevel } from '@/components/room-kit/voice-level'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_LEAP_CLIFFS } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import { singerWindow } from '@/lib/sequence/sung-window'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { leapDemoAutoPlays } from '@/stores/leap-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { LeapController, LeapControllerOptions, LeapLampView, TrailSink, } from './leap-controller-contract'
import { YOUR_TURN } from './leap-controller-contract'
import type { LeapEvent, LeapState, RoundOutcome } from './leap-machine'
import { INITIAL_LEAP_STATE, isRunPhase, leapReducer, liveRound, } from './leap-machine'
import { leapOutcome, leapPhrase, mercNotes } from './leap-phrase'
import type { LeapRound, NoteWindow } from './leap-round'
import { planRounds } from './leap-round'
import type { LeapLevel } from './leap-rules'
import { AFTER_ANSWER_MS, BETWEEN_ROUNDS_MS, LEAP_LEVELS, LEAP_ROUNDS, leapName, leapSong, namesPrecisely, sizeName, SOUND_LEAD_SECONDS, VOICE_TAIL_SECONDS, } from './leap-rules'
import type { LeapSummary } from './leap-run'
import { callMoment, keepLeapRun, landedMoment, missedMoment, resultMoment, summarizeRun, } from './leap-run'
import type { LeapLineFields } from './merc-lines'
import { createLeapLines } from './merc-lines'
import { LEAP_SPOKEN } from './merc-spoken'
import type { LeapDemoMark, ScriptedLeapTake } from './scripted-take'
import { createScriptedRoom } from './scripted-take'
import { readLeapVoice } from './voice-reading'

export function useLeapController(
  options: LeapControllerOptions = {},
): LeapController {
  const capture = useExerciseCapture('leap', 'Leap')
  const voiceOfMerc = options.voice ?? SYNTH_VOICE
  const random = options.random ?? Math.random
  const lines = createLeapLines(random)
  // His lines at rest, aloud through the room's clock (merc-speech.ts).
  const speech = createMercSpeech(LEAP_SPOKEN, {
    clock: () => capture.runningAudio(),
  })

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
  // The demo's: on from its enter to its leave, playing, and its rules.
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const [demoRules, setDemoRules] = createSignal<LeapLevel | null>(null)
  const demoOn = (): boolean => untrack(scriptActive)

  const dispatch = (event: LeapEvent): void => {
    setState((current) => leapReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = speakingLines(lines, speech, setLine)
  /** His opening line, aloud unless the singer has just left the app. */
  const sayIntro = (aloud = true): void => {
    say(
      untrack(level.preset).mercSingsBoth ? 'introMatch' : 'intro',
      undefined,
      aloud,
    )
  }

  // ── Timers that belong to the screen (room-kit room-life.ts) ───
  const life = createRoomLife()

  // ── Merc ───────────────────────────────────────────────────
  let voice: MercVoice = SILENT_VOICE
  const merc = createMercMoves({
    later: life.later,
    still: prefersReducedMotion,
    afterCheer: () => (isRunPhase(phase()) && !demoOn() ? 'listen' : 'idle'),
  })
  const { faceFor, sing } = createMercSinger({
    voice: voiceOfMerc,
    lead: SOUND_LEAD_SECONDS,
    tail: VOICE_TAIL_SECONDS,
    later: life.later,
    face: (next) => {
      voice = next
    },
    merc,
    after: () => (isRunPhase(phase()) ? 'listen' : 'idle'),
  })

  // ── The run ────────────────────────────────────────────────
  let audio: AudioContext | null = null
  let runLevel: ExerciseLevel = 'singer'
  let rules: LeapLevel = untrack(level.preset)
  const [runRules, setRunRules] = createSignal<LeapLevel>(rules)
  /** The run names its sixths "major": it asks for the minor one too. */
  const precise = (): boolean => namesPrecisely(rules)
  let sound: { stop(): void } | null = null
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
  /** The demo's take singing through the room in place of the mic. */
  let scripted: ScriptedLeapTake | null = null

  /** Seconds on the frames' clock: since the window opened, or the take's. */
  const frameNow = (): number =>
    scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  const live = (): LeapRound | null => liveRound(untrack(state))
  /** The demo's moment, to its tooltips; the singer's run has none. */
  const mark = (moment: LeapDemoMark): void => {
    scripted?.onEvent(moment)
  }

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

  /** Notes on the take's clock (`at`), on the wall clock, ms from now. */
  const onTake = (take: ScriptedLeapTake) => (at: number) =>
    take.startsAt + at * 1000 - performance.now()

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

  /**
   * One of the demo's takes in place of the mic: its leap called as a
   * round's is, on the take's clock, its frames flowing. The demo's own
   * sound sings Merc's call; his face follows it.
   */
  const playScripted = (take: ScriptedLeapTake): void => {
    scripted = take
    rules = take.rules
    engine = createSequenceState(take.responseStart)
    processed = 0
    points = []
    voicedInTurn = false
    heardAgain = false
    bandSince = null
    callNotes = take.call.map((note) => ({
      midi: note.midi,
      from: note.at,
      to: note.at + note.seconds,
    }))
    const { round } = take
    batch(() => {
      dispatch({ type: 'demo', round })
      setDemoRules(take.rules)
      setLamp({
        name: leapName(round.kind, precise()),
        up: round.kind.up,
        state: 'toCome',
      })
      setRevealed(take.rules.mercSingsBoth)
    })
    callCount += 1
    const call = callCount
    faceFor(
      take.call,
      onTake(take),
      () => call === callCount && phase() === 'call',
    )
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
    const read = readLeapVoice(frame, round, rules.tolCents)
    points.push(read.point)
    voice = read.voice ?? { ...voice, voiced: false, level: 0 }
    if (read.voice !== null) voicedInTurn = true
    bandSince = read.inTarget ? (bandSince ?? frame.t) : null
    batch(() => {
      setOnTarget(read.inTarget)
      setOnFrom(read.onFrom)
    })
  }

  /** The leap's outcome from the engine, once its target is decided. */
  const outcomeOf = (round: LeapRound): RoundOutcome | null =>
    leapOutcome(engine, round, { voiced: voicedInTurn, heardAgain })

  const onEvent = (event: SequenceEvent, round: LeapRound): void => {
    mark(
      event.type === 'phraseEnd' ? 'phraseEnd' : `${event.type}:${event.index}`,
    )
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
    const frames = scripted?.frames() ?? capture.peekFrames()
    follow(frames, round)
    if (!listening) return
    if (phase() === 'sing') {
      const last = frames.length === 0 ? null : frames[frames.length - 1]
      // The demo's voice is not the singer's: the mic's ring stays still.
      loudness =
        scripted !== null || last === null || last.t < engine.responseStart
          ? 0
          : newestLevel(frames)
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
    // A demo's take is felt, said and followed by nothing: its tooltip
    // explains it, and the demo moves on.
    const take = scripted
    stopLoop()
    if (take === null) capture.takeFrames()
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
      if (take === null) haptics.tapLight()
      batch(() => {
        setChip(`Landed: ${note}`)
        setLamp({
          name: leapName(round.kind, precise()),
          up: round.kind.up,
          state: 'landed',
        })
        setRevealed(true)
        setOnTarget(true)
        if (take === null) say(landedMoment(rules, round.kind), fields)
      })
      merc.cheer()
      if (take === null) nextAfter(BETWEEN_ROUNDS_MS, round.index)
      else mark('outcome')
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
      if (take === null) say(missedMoment(outcome), fields)
    })
    // He sings both notes, his line drawn as he sings them.
    answerCount += 1
    const answer = answerCount
    const current = (): boolean =>
      answer === answerCount && phase() === 'missed'
    if (take !== null) {
      // The demo's sound sings them, on the take's clock.
      faceFor(take.answer, onTake(take), current)
      mark('outcome')
      return
    }
    let wait = AFTER_ANSWER_MS
    if (ctx !== null) {
      const sung = sing(ctx, mercNotes(round, true), current)
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
      // The run is over and the mic closed: Merc says the result aloud.
      say(resultMoment(shown, kept), undefined, true)
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
    // The leap's own notes take over from Merc's line.
    speech.hush()
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

  /** The singer's window, as a run plans its leaps in it. */
  const runWindow = (): NoteWindow =>
    singerWindow({
      voiceprints: loadLocalVoiceprints(),
      voicePreset: untrack(vocalRangePreset),
    })

  // ── What the singer does ───────────────────────────────────
  const start = (): void => {
    const from = phase()
    if (demoOn()) return
    if (from !== 'intro' && from !== 'result' && from !== 'blocked') return
    // He stops talking before the mic opens.
    speech.hush()
    // A leap still sounding from the result stops with the tap.
    endReplay()
    stopSound()
    voice = SILENT_VOICE
    level.take()
    runLevel = untrack(exerciseLevel)
    rules = untrack(level.preset)
    setRunRules(() => rules)
    const rounds = planRounds(LEAP_ROUNDS, runWindow(), rules, random)
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
    if (!isRunPhase(phase()) || demoOn()) return
    dropRun()
    sayIntro()
  }

  /** Merc's call again, in the singer's turn, as the level allows. */
  const canHearAgain = (): boolean => {
    const now = state()
    if (now.phase !== 'sing' || scriptActive()) return false
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
    // Nothing he says or sings is heard behind their back either: a leap
    // heard again at the result stops too.
    speech.hush()
    // The demo stops itself on the way out (useExerciseDemo).
    if (demoOn()) return
    if (!isRunPhase(phase())) {
      endReplay()
      stopSound()
      return
    }
    dropRun()
    sayIntro(false)
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    // A first visit opens on the demo, which says it all: his line waits.
    sayIntro(!leapDemoAutoPlays())
    life.later(1100, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
  })

  life.watch({
    leave,
    listening: () => isRunPhase(state().phase) && !scriptActive(),
    demo: { on: scriptActive, playing: demoPlaying },
    holdsFocus: true,
    mic: {
      exercise: EXERCISE_LEAP_CLIFFS,
      on: () => isRunPhase(phase()) && phase() !== 'starting' && !demoOn(),
      // A mic that died drops the run as leaving does, Merc silent: a call
      // or another app may have the sound, and his line would take it back.
      died: leave,
    },
  })

  // ── The demo's way in (scripted-take.ts) ───────────────────
  const script = createScriptedRoom({
    voice: voiceOfMerc,
    active: scriptActive,
    setActive: setScriptActive,
    setPlaying: setDemoPlaying,
    phase,
    audio: () => capture.audio(),
    ready: options.ready,
    // Merc's note for the demo's leap: the middle of the singer's window.
    note: () => {
      const window = runWindow()
      return Math.round((window.low + window.high) / 2)
    },
    clear: () => {
      scripted = null
      callCount += 1
      endReplay()
      hush()
      merc.stopCheering()
      batch(() => {
        dispatch({ type: 'demo', round: null })
        setDemoRules(null)
        setSummary(null)
        setChip(null)
        setLamp(null)
        setRevealed(false)
        setAnswering(false)
      })
    },
    load: playScripted,
    current: () => scripted,
    // The demo's words take over from his, and its end shows his opening
    // line without saying it: the demo has just said it all.
    line: (text) => {
      speech.hush()
      setLine(text)
    },
    sayIntro: () => sayIntro(false),
    merc: merc.set,
    later: life.later,
    mark,
  })

  onCleanup(() => {
    stopLoop()
    stopSound()
    speech.dispose()
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
    rules: () => demoRules() ?? level.preset(),
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
    script,
  }
}
