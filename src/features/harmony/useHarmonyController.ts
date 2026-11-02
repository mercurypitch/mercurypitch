// ============================================================
// useHarmonyController: one Harmony run, from the tap to the result
// ============================================================
//
// Owns the room's states (harmony-machine.ts), the microphone and the
// audio clock (room-kit useExerciseCapture.ts), Merc's voice (the room
// kit's RoundVoice, through its singer), the sequence engine that hears
// the harmony (src/lib/sequence) and everything that answers it: the
// voice's trail along the lamps, the lamps themselves, Merc's state and
// voice, his lines, the chip and the task under it.
//
// A run is HARMONY_LINES lines at the singer's level, planned as it starts
// (harmony-line.ts) so each harmony sits in the singer's window. Each line:
// Merc's call (his line; at Learning the harmony after it). Then, taking
// turns, the singer sings the harmony on their own, heard in free time as
// Echo hears a phrase, nothing heard before his call's end plus
// RESPONSE_GATE_SECONDS (his voice through the speaker reaches the mic).
// Together, Merc sings his line again after a breath and the singer sings
// with him, each harmony note heard in its time on his clock, nothing
// gated: the headphones keep his voice out of the mic. A line sung in
// harmony is cheered; after a missed note Merc sings his note, then the
// third from it. After the last line, the result, where each line's row
// plays it again in two voices. The mic opens on the tap and closes at
// the result.
//
// One capture window per line, opened as its call is scheduled, so the
// frames' clock and the audio clock meet at one moment; the engine is
// ticked once per CAPTURED frame, on the frames' own clock.
//
// "How it works" (demo/useHarmonyDemo.ts) sings its takes through the same
// steps by `script` (scripted-take.ts): frames in place of the mic, Merc's
// call and his pair on the take's clock, the demo's own sound singing them.
// A scripted take never opens the mic, fires a haptic, says a line or keeps
// a result, and a run's moves wait while the demo has the room.

import { batch, createEffect, createMemo, createSignal, on, onCleanup, onMount, untrack, } from 'solid-js'
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
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_HARMONY_LAKE } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { MercVoice } from '@/lib/merc/sim'
import { callSeconds, RESPONSE_GATE_SECONDS, } from '@/lib/sequence/sequence-engine'
import type { NoteWindow } from '@/lib/sequence/sung-window'
import { singerWindow } from '@/lib/sequence/sung-window'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { harmonyDemoAutoPlays, harmonyWay } from '@/stores/harmony-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { HarmonyController, HarmonyControllerOptions, HarmonyLampState, HarmonyTrailSink, } from './harmony-controller-contract'
import { YOUR_TURN } from './harmony-controller-contract'
import type { HarmonyLine } from './harmony-line'
import { planLines } from './harmony-line'
import type { HarmonyEvent, HarmonyState, LineOutcome } from './harmony-machine'
import { harmonyReducer, INITIAL_HARMONY_STATE, isRunPhase, isSinging, liveLine, } from './harmony-machine'
import { after, mercCall, mercLine, missedPair } from './harmony-phrase'
import { createLineReplay } from './harmony-replay'
import type { HarmonyLevel } from './harmony-rules'
import { AFTER_ANSWER_MS, BETWEEN_LINES_MS, HARMONY_LEVELS, HARMONY_LINES, SOUND_LEAD_SECONDS, taskName, TOGETHER_BREATH_SECONDS, togetherRules, VOICE_TAIL_SECONDS, } from './harmony-rules'
import type { HarmonySummary } from './harmony-run'
import { callMoment, keepHarmonyRun, landedMoment, missedFields, missedMoment, resultMoment, summarizeRun, } from './harmony-run'
import { createHarmonyTurn } from './harmony-turn'
import type { HarmonyMoment } from './merc-lines'
import { createHarmonyLines } from './merc-lines'
import { HARMONY_SPOKEN } from './merc-spoken'
import type { HarmonyDemoMark, ScriptedHarmonyTake } from './scripted-take'
import { createScriptedRoom } from './scripted-take'

/** Every lamp of a line waiting for the voice. */
const waiting = (line: HarmonyLine): HarmonyLampState[] =>
  line.harmony.map(() => 'waiting')

export function useHarmonyController(
  options: HarmonyControllerOptions = {},
): HarmonyController {
  const capture = useExerciseCapture('harmony', 'Harmony')
  const voiceOfMerc = options.voice ?? SYNTH_VOICE
  const random = options.random ?? Math.random
  const lines = createHarmonyLines(random)
  // His lines at rest, aloud through the room's clock (merc-spoken.ts).
  const speech = createMercSpeech(HARMONY_SPOKEN, {
    clock: () => capture.runningAudio(),
  })

  const [state, setState] = createSignal<HarmonyState>(INITIAL_HARMONY_STATE)
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [task, setTask] = createSignal<string | null>(null)
  const [summary, setSummary] = createSignal<HarmonySummary | null>(null)
  const [resultLevel, setResultLevel] = createSignal('')
  const [mercLit, setMercLit] = createSignal(0)
  const [lamps, setLamps] = createSignal<readonly HarmonyLampState[]>([])
  const [answering, setAnswering] = createSignal<number | null>(null)
  // The demo's: on from its enter to its leave, playing, and its rules.
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const [demoRules, setDemoRules] = createSignal<HarmonyLevel | null>(null)
  const demoOn = (): boolean => untrack(scriptActive)
  const level = createLevelPreset(HARMONY_LEVELS, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: HarmonyEvent): void => {
    setState((current) => harmonyReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const runWay = () => untrack(state).way
  const say = speakingLines(lines, speech, setLine)
  /** His opening line: for the way, and whether he sings the harmony first. */
  const introMoment = createMemo((): HarmonyMoment => {
    const both = level.preset().mercSingsBoth
    if (harmonyWay() === 'together') {
      return both ? 'introBothTogether' : 'introTogether'
    }
    return both ? 'introBoth' : 'intro'
  })
  /** His opening line for the level and the way, aloud unless asked not to. */
  const sayIntro = (aloud = true): void => {
    say(untrack(introMoment), undefined, aloud)
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
  const { sing, faceFor } = createMercSinger({
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
  let rules: HarmonyLevel = untrack(level.preset)
  let sound: { stop(): void } | null = null
  /** When Merc's call ends, audio clock s, his voice's tail with it; 0 for none. */
  let soundEnd = 0
  /** Together, a line is over and Merc still sings his to its end. */
  let finishing = false
  let windowStartedAt = 0
  /** Merc's notes in the call (and with the singer), on the frames' clock. */
  let callNotes: { midi: number; from: number; to: number }[] = []
  /** The frame loop runs: a call or a turn is on. */
  let listening = false
  let loudness = 0
  let heardAgain = false
  /** Counts calls, so a replayed call's pending moments never fire. */
  let callCount = 0
  /** Counts Merc's answers and replays, so an old one's moments never fire. */
  let answerCount = 0
  let sink: HarmonyTrailSink = () => undefined

  /** The demo's take singing through the room in place of the mic. */
  let scripted: ScriptedHarmonyTake | null = null

  /** Seconds on the frames' clock: since the window opened, or the take's. */
  const frameNow = (): number =>
    scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  /** The demo's moment, to its tooltips; the singer's run has none. */
  const mark = (moment: HarmonyDemoMark): void => {
    scripted?.onEvent(moment)
  }
  /** Notes on the take's clock (`at`), on the wall clock, ms from now. */
  const onTake = (take: ScriptedHarmonyTake) => (at: number) =>
    take.startsAt + at * 1000 - performance.now()
  const live = (): HarmonyLine | null => liveLine(untrack(state))

  // ── The line's ears (harmony-turn.ts) ──────────────────────
  const turn = createHarmonyTurn({
    singing: () => isSinging(phase()),
    together: () => runWay() === 'together',
    listening: () => listening,
    heardAgain: () => heardAgain,
    lamp: (index, next) => lamp(index, next),
    mark,
    face: (heard) => {
      voice = heard ?? { ...voice, voiced: false, level: 0 }
    },
    decided: (outcome) => endLine(outcome),
  })

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
    soundEnd = 0
    finishing = false
  }

  /** Off the sound, the loop, the trail and Merc's voice. */
  const hush = (): void => {
    stopLoop()
    stopSound()
    sink(null)
    turn.clear()
    voice = SILENT_VOICE
  }

  /** A lamp of the harmony to a new state. */
  const lamp = (index: number, next: HarmonyLampState): void => {
    setLamps((all) => all.map((was, i) => (i === index ? next : was)))
  }

  /** The window, the engine and the trail, fresh for a line's call. */
  const freshTurn = (): void => {
    stopSound()
    capture.startWindow()
    windowStartedAt = performance.now()
    turn.clear()
    sink(null)
  }

  /**
   * A line's call: Merc's line (the harmony after it at Learning), and
   * together his line again after a breath, scheduled at once on the audio
   * clock. Each of his lamps lights as he sings it; at Learning the
   * harmony's are heard as he sings them.
   */
  const callLine = (current: HarmonyLine): void => {
    const ctx = audio
    if (ctx === null) return
    freshTurn()
    batch(() => {
      setMercLit(0)
      setLamps(waiting(current))
    })
    const a0 = ctx.currentTime
    const latency = outputLatency(ctx)
    const onFrames = (t: number): number => t - a0 + latency
    callCount += 1
    const call = callCount
    const together = runWay() === 'together'
    const { notes, his } = mercCall(current, rules)
    const sungWith = after(
      mercLine(current, rules),
      callSeconds({ notes }) + TOGETHER_BREATH_SECONDS,
    )
    const all = together ? [...notes, ...sungWith] : notes
    const lit = (i: number): void => {
      if (i < his) setMercLit(i + 1)
      else if (i < notes.length) lamp(i - his, 'heard')
      else setMercLit(i - notes.length + 1)
    }
    const sung = sing(
      ctx,
      all,
      () =>
        call === callCount && (phase() === 'call' || phase() === 'together'),
      lit,
    )
    sound = sung
    soundEnd = sung.endAt
    const start = a0 + SOUND_LEAD_SECONDS
    callNotes = all.map((note) => ({
      midi: note.midi,
      from: onFrames(start + note.at),
      to: onFrames(start + note.at + note.seconds),
    }))
    // Together the singer comes in with him; taking turns, after his
    // voice has left the speaker.
    const turnAt = together
      ? onFrames(start + sungWith[0].at)
      : onFrames(sung.endAt) + RESPONSE_GATE_SECONDS
    turn.open({
      line: current,
      rules,
      heardBy: together ? togetherRules(rules) : rules,
      responseStart: turnAt,
      turnAt,
    })
    merc.set('listen')
    startLoop()
  }

  /**
   * One of the demo's takes in place of the mic: its line called as a run's
   * is, taking turns, on the take's clock, its frames flowing. The demo's
   * own sound sings Merc's call; his face and his lamps follow it.
   */
  const playScripted = (take: ScriptedHarmonyTake): void => {
    scripted = take
    rules = take.rules
    heardAgain = false
    turn.open({
      line: take.line,
      rules: take.rules,
      heardBy: take.rules,
      responseStart: take.responseStart,
      turnAt: take.responseStart,
    })
    callNotes = take.call.map((note) => ({
      midi: note.midi,
      from: note.at,
      to: note.at + note.seconds,
    }))
    batch(() => {
      dispatch({ type: 'demo', line: take.line })
      setDemoRules(take.rules)
      setMercLit(0)
      setLamps(waiting(take.line))
      setTask(taskName(take.line.below))
      setAnswering(null)
    })
    callCount += 1
    const call = callCount
    faceFor(
      take.call,
      onTake(take),
      () => call === callCount && phase() === 'call',
      (i) => setMercLit(i + 1),
    )
    merc.set('listen')
    startLoop()
  }

  /** A line begins: Merc says what comes and calls it. */
  const beginLine = (index: number): void => {
    dispatch({ type: 'call', index })
    const current = live()
    if (current === null || phase() !== 'call') return
    heardAgain = false
    batch(() => {
      setChip(`Line ${current.index + 1} of ${untrack(state).lines.length}`)
      setTask(taskName(current.below))
      setAnswering(null)
      say(callMoment(current, runWay(), rules.mercSingsBoth))
    })
    callLine(current)
  }

  /** The call has reached its end at the speaker: the singer's turn. */
  const toTurn = (): void => {
    dispatch({ type: 'turn' })
    turn.start()
    const current = live()
    batch(() => {
      if (current !== null) setLamps(waiting(current))
      // Together, no words: the chip keeps counting the lines.
      if (runWay() === 'turns') {
        setChip(YOUR_TURN)
        setLine('')
      }
    })
    if (runWay() === 'turns') merc.set('listen')
  }

  /** One screen frame while the room listens (frame-loop.ts). */
  function screenFrame(): void {
    if (live() === null) return
    if (phase() === 'call' && frameNow() >= turn.turnAt()) toTurn()
    const frames = scripted?.frames() ?? capture.peekFrames()
    turn.follow(frames)
    if (!listening) return
    if (!isSinging(phase())) {
      loudness = 0
      return
    }
    const last = frames.length === 0 ? null : frames[frames.length - 1]
    // The demo's voice is not the singer's: the mic's ring stays still.
    loudness =
      scripted !== null || last === null || last.t < turn.responseStart()
        ? 0
        : newestLevel(frames)
    sink(turn.trail(frameNow()))
  }

  /** On to the next line after `ms`: only for this run and this line. */
  const nextAfter = (ms: number, index: number): void => {
    const { run } = untrack(state)
    life.later(ms, () => {
      const now = untrack(state)
      if (now.run !== run || now.current !== index) return
      if (now.phase !== 'landed' && now.phase !== 'missed') return
      if (index + 1 < now.lines.length) beginLine(index + 1)
      else finishRun()
    })
  }

  /**
   * A line is over: its lamps at once, then Merc's answer and the next.
   * Together, the singer can land the last note while Merc still sings
   * his: his line ends as sung, and his answer waits for it.
   */
  function endLine(outcome: LineOutcome): void {
    const ctx = audio
    stopLoop()
    if (scripted === null) capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    sink(null)
    const left =
      ctx === null || runWay() !== 'together'
        ? 0
        : (soundEnd - ctx.currentTime) * 1000
    if (left <= 0) {
      answerLine(outcome)
      return
    }
    finishing = true
    const { run } = untrack(state)
    life.later(left, () => {
      const now = untrack(state)
      if (now.run !== run || now.current !== outcome.line.index) return
      if (now.phase === 'landed' || now.phase === 'missed') answerLine(outcome)
    })
  }

  /** Merc's answer to a line: a cheer, or his note and the third from it. */
  function answerLine(outcome: LineOutcome): void {
    stopSound()
    if (outcome.inHarmony) cheerLine(outcome.line)
    else answerMiss(outcome)
  }

  /**
   * A line sung in harmony: cheered, then the next. A demo's take is felt,
   * said and followed by nothing: its tooltip explains it.
   */
  function cheerLine(current: HarmonyLine): void {
    const take = scripted
    if (take === null) haptics.tapLight()
    batch(() => {
      setChip('In harmony')
      if (take === null) say(landedMoment(current))
    })
    merc.cheer()
    if (take === null) nextAfter(BETWEEN_LINES_MS, current.index)
    else mark('outcome')
  }

  /** A note missed: he sings his note, then the third from it, drawn as he does. */
  function answerMiss(outcome: LineOutcome): void {
    const ctx = audio
    const take = scripted
    const current = outcome.line
    const at = outcome.firstMiss ?? 0
    const fields = missedFields(outcome)
    batch(() => {
      setChip(fields === null ? null : `It was ${fields.note}`)
      setAnswering(at)
      if (take === null) say(missedMoment(outcome), fields ?? undefined)
    })
    answerCount += 1
    const answer = answerCount
    const answering = (): boolean =>
      answer === answerCount && phase() === 'missed'
    if (take !== null) {
      // The demo's sound sings the pair, on the take's clock.
      faceFor(take.answer, onTake(take), answering)
      mark('outcome')
      return
    }
    let wait = AFTER_ANSWER_MS
    if (ctx !== null) {
      const sung = sing(ctx, missedPair(current, at), answering)
      sound = sung
      wait += Math.max(0, (sung.endAt - ctx.currentTime) * 1000)
    }
    nextAfter(wait, current.index)
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(): void {
    capture.release()
    hush()
    const { outcomes, way } = untrack(state)
    const shown = summarizeRun(outcomes)
    const kept = keepHarmonyRun(runLevel, way, shown)
    batch(() => {
      dispatch({ type: 'finish' })
      setSummary(shown)
      setResultLevel(exerciseLevelName(runLevel))
      setChip(null)
      setTask(null)
      setAnswering(null)
      // The run is over and the mic closed: Merc says the result aloud.
      say(resultMoment(shown, kept), undefined, true)
    })
    if (kept.kept && shown.inHarmony * 2 >= shown.lines) {
      haptics.success()
      merc.cheer()
    } else {
      merc.set('idle')
    }
  }

  /** No line on the lake: no chip, no task, no pair, no lamp lit. */
  const clearLine = (): void => {
    setChip(null)
    setTask(null)
    setAnswering(null)
    setMercLit(0)
    setLamps([])
  }

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(): void {
    capture.release()
    hush()
    merc.stopCheering()
    batch(() => {
      dispatch({ type: 'stop' })
      clearLine()
    })
    merc.set('idle')
  }

  // ── The result's lines heard again (harmony-replay.ts) ─────
  const replay = createLineReplay({
    audio: () => capture.audio(),
    sing,
    voice: voiceOfMerc,
    rules: () => rules,
    atResult: () => phase() === 'result',
    hush: () => speech.hush(),
    play: (ctx, next) => {
      audio = ctx
      stopSound()
      sound = next
    },
    later: life.later,
  })
  const endReplay = replay.end
  /** At the result, a line's row: Merc sings it in two voices. */
  const replayLine = (index: number): void => {
    const outcome = untrack(state).outcomes[index]
    if (outcome !== undefined) replay.play(index, outcome.line)
  }

  /** The singer's window, as a run plans its harmonies in it. */
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
    // A line still sounding from the result stops with the tap.
    endReplay()
    stopSound()
    voice = SILENT_VOICE
    level.take()
    runLevel = untrack(exerciseLevel)
    rules = untrack(level.preset)
    const planned = planLines(HARMONY_LINES, runWindow(), rules, random)
    batch(() => {
      dispatch({ type: 'start', lines: planned, way: harmonyWay() })
      setSummary(null)
      setChip(null)
      setTask(null)
      setLine('')
      setAnswering(null)
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
        beginLine(0)
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

  /** Merc's call again, in the singer's own turn, as the level allows. */
  const canHearAgain = (): boolean => {
    const now = state()
    if (now.phase !== 'sing' || scriptActive()) return false
    const allowance = level.preset().hearAgain
    if (allowance === 'never') return false
    return allowance === 'anyTime' || now.replays === 0
  }

  const hearAgain = (): void => {
    if (!untrack(canHearAgain)) return
    const current = live()
    if (current === null) return
    stopLoop()
    capture.takeFrames()
    dispatch({ type: 'hearAgain' })
    heardAgain = true
    setChip(`Line ${current.index + 1} of ${untrack(state).lines.length}`)
    callLine(current)
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as the mic's tap drops it: no result, no best.
   */
  function leave(): void {
    // Nothing he says or sings is heard behind their back either: a line
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
    sayIntro(!harmonyDemoAutoPlays())
    life.later(1100, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
  })

  // A new way or level chosen at rest: his opening line for it, shown, not
  // said.
  createEffect(
    on(
      introMoment,
      () => {
        if (phase() === 'intro') sayIntro(false)
      },
      { defer: true },
    ),
  )

  life.watch({
    leave,
    listening: () => isRunPhase(state().phase) && !scriptActive(),
    demo: { on: scriptActive, playing: demoPlaying },
    holdsFocus: true,
    mic: {
      exercise: EXERCISE_HARMONY_LAKE,
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
    // The demo's harmony about the middle of the singer's window.
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
        dispatch({ type: 'demo', line: null })
        setDemoRules(null)
        setSummary(null)
        clearLine()
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

  /** Merc's voice: his own notes while he sings his line, else the singer's. */
  const mercVoice = (): MercVoice => {
    const current = live()
    const p = phase()
    if (current !== null && (p === 'call' || p === 'together' || finishing)) {
      const t = frameNow()
      const note = callNotes.find((n) => t >= n.from && t < n.to)
      if (note !== undefined) return singing(note.midi)
      return { ...SILENT_VOICE, midi: current.merc[0] }
    }
    return voice
  }

  return {
    state,
    line,
    chip,
    task,
    summary,
    resultLevel,
    current: () => liveLine(state()),
    rules: () => demoRules() ?? level.preset(),
    way: () => {
      const now = state()
      return isRunPhase(now.phase) || now.phase === 'result'
        ? now.way
        : harmonyWay()
    },
    mercLit,
    harmonyLamps: lamps,
    answering,
    mercState: merc.state,
    mercVoice,
    micLevel: () => loudness,
    canHearAgain,
    hearAgain,
    replaying: replay.playing,
    replayLine,
    script,
    start,
    stop,
    drawTrail: (next) => {
      sink = next
    },
  }
}
