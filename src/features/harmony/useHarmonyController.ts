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
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { Phrase, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { callSeconds, createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { NoteWindow } from '@/lib/sequence/sung-window'
import { singerWindow } from '@/lib/sequence/sung-window'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { harmonyWay } from '@/stores/harmony-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { HarmonyController, HarmonyControllerOptions, HarmonyLampState, HarmonyTrailSink, } from './harmony-controller-contract'
import { YOUR_TURN } from './harmony-controller-contract'
import type { HarmonyTrailPoint } from './harmony-ear'
import { readHarmonyVoice, togetherIndex, togetherPos, turnPos, } from './harmony-ear'
import type { HarmonyLine } from './harmony-line'
import { planLines } from './harmony-line'
import type { HarmonyEvent, HarmonyState, LineOutcome } from './harmony-machine'
import { harmonyReducer, INITIAL_HARMONY_STATE, isRunPhase, isSinging, liveLine, } from './harmony-machine'
import { after, harmonyLine, harmonyPhrase, lineOutcome, mercCall, mercLine, missedPair, } from './harmony-phrase'
import type { HarmonyLevel } from './harmony-rules'
import { AFTER_ANSWER_MS, BETWEEN_LINES_MS, HARMONY_LEVELS, HARMONY_LINES, MERC_GAP_SECONDS, SOUND_LEAD_SECONDS, taskName, TOGETHER_BREATH_SECONDS, togetherRules, VOICE_TAIL_SECONDS, } from './harmony-rules'
import type { HarmonySummary } from './harmony-run'
import { callMoment, keepHarmonyRun, landedMoment, missedFields, missedMoment, resultMoment, summarizeRun, } from './harmony-run'
import type { HarmonyMoment } from './merc-lines'
import { createHarmonyLines } from './merc-lines'
import { HARMONY_SPOKEN } from './merc-spoken'

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
  // His lines at rest, aloud through the room's clock once recorded.
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
  const [replaying, setReplaying] = createSignal<number | null>(null)
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
  const { sing } = createMercSinger({
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
  /** What the engine hears by: the level's rules, or its rules together. */
  let heardRules: HarmonyLevel = rules
  let sound: { stop(): void } | null = null
  /** When Merc's call ends, audio clock s, his voice's tail with it; 0 for none. */
  let soundEnd = 0
  /** Together, a line is over and Merc still sings his to its end. */
  let finishing = false
  let engine: SequenceState = createSequenceState(0)
  let phrase: Phrase = { notes: [] }
  let processed = 0
  let windowStartedAt = 0
  /** Merc's notes in the call (and with the singer), on the frames' clock. */
  let callNotes: { midi: number; from: number; to: number }[] = []
  /** The singer's turn begins here, frames' clock. */
  let turnAt = 0
  /** The frame loop runs: a call or a turn is on. */
  let listening = false
  let loudness = 0
  let points: HarmonyTrailPoint[] = []
  let heardAgain = false
  let voicedInTurn = false
  /** When the voice entered the band of its note, frames' clock; null outside. */
  let bandSince: number | null = null
  /** The harmony note the voice is on, and since when (frames' clock). */
  let onNote = 0
  let onNoteSince = 0
  /** Counts calls, so a replayed call's pending moments never fire. */
  let callCount = 0
  /** Counts Merc's answers and replays, so an old one's moments never fire. */
  let answerCount = 0
  let sink: HarmonyTrailSink = () => undefined

  const frameNow = (): number => (performance.now() - windowStartedAt) / 1000
  const live = (): HarmonyLine | null => liveLine(untrack(state))
  /** Merc's pace: from one of his notes to the next, s. */
  const step = (): number => rules.noteSeconds + MERC_GAP_SECONDS

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
    points = []
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
    processed = 0
    points = []
    voicedInTurn = false
    bandSince = null
    onNote = 0
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
    phrase = harmonyPhrase(current, rules)
    if (together) {
      heardRules = togetherRules(rules)
      turnAt = onFrames(start + sungWith[0].at)
      engine = createSequenceState(turnAt)
    } else {
      heardRules = rules
      engine = createSequenceState(onFrames(sung.endAt) + RESPONSE_GATE_SECONDS)
      turnAt = engine.responseStart
    }
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
    onNote = 0
    onNoteSince = turnAt
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

  /** The note the voice is on now: the engine's, or Merc's clock's together. */
  const noteAt = (t: number, current: HarmonyLine): number => {
    const notes = current.harmony.length
    return runWay() === 'together'
      ? togetherIndex(t, turnAt, step(), notes)
      : Math.min(notes - 1, engine.current)
  }

  /** The singer's voice against its note: the trail, Merc's face, the band. */
  const hearVoice = (frame: PitchFrame, current: HarmonyLine): void => {
    const note = noteAt(frame.t, current)
    if (note !== onNote) {
      onNote = note
      onNoteSince = frame.t
      bandSince = null
    }
    const together = runWay() === 'together'
    const pos = together
      ? togetherPos(frame.t, turnAt, step(), current.harmony.length)
      : turnPos(note, onNoteSince, frame.t)
    const read = readHarmonyVoice(
      frame,
      current.harmony[note],
      rules.tolCents,
      pos,
    )
    points.push(read.point)
    if (read.voice !== null) voicedInTurn = true
    if (!together) voice = read.voice ?? { ...voice, voiced: false, level: 0 }
    bandSince = read.inBand ? (bandSince ?? frame.t) : null
  }

  /** A note of the harmony landed or missed: its lamp says so. */
  const onEvent = (event: SequenceEvent): void => {
    if (event.type === 'phraseEnd') return
    lamp(event.index, event.type === 'land' ? 'lit' : 'missed')
  }

  /** New captured frames: the turn's trail, its engine, its outcome. */
  const follow = (
    frames: readonly PitchFrame[],
    current: HarmonyLine,
  ): void => {
    const from = processed
    processed = frames.length
    for (let i = from; i < frames.length && listening; i++) {
      const frame = frames[i]
      if (!isSinging(phase()) || frame.t < engine.responseStart) continue
      hearVoice(frame, current)
      engine = tickSequence(engine, frame, phrase, heardRules)
      for (const event of engine.events) onEvent(event)
      const outcome = lineOutcome(engine, current, {
        voiced: voicedInTurn,
        heardAgain,
      })
      if (outcome !== null) {
        endLine(outcome)
        return
      }
    }
  }

  /** The note's hold so far, 0 to 1, at `now` on the frames' clock. */
  const holdAt = (now: number): number =>
    bandSince === null
      ? 0
      : Math.min(1, Math.max(0, ((now - bandSince) * 1000) / rules.landMs))

  /** One screen frame while the room listens (frame-loop.ts). */
  function screenFrame(): void {
    const current = live()
    if (current === null) return
    if (phase() === 'call' && frameNow() >= turnAt) toTurn()
    const frames = capture.peekFrames()
    follow(frames, current)
    if (!listening) return
    if (!isSinging(phase())) {
      loudness = 0
      return
    }
    const last = frames.length === 0 ? null : frames[frames.length - 1]
    loudness =
      last === null || last.t < engine.responseStart ? 0 : newestLevel(frames)
    const head = points.length === 0 ? null : points[points.length - 1]
    sink({
      points,
      head: head === null || head.midi === null ? null : head,
      hold: holdAt(frameNow()),
    })
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
    capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    bandSince = null
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
    const ctx = audio
    stopSound()
    const current = outcome.line
    if (outcome.inHarmony) {
      haptics.tapLight()
      batch(() => {
        setChip('In harmony')
        say(landedMoment(current))
      })
      merc.cheer()
      nextAfter(BETWEEN_LINES_MS, current.index)
      return
    }
    const at = outcome.firstMiss ?? 0
    const fields = missedFields(outcome)
    batch(() => {
      setChip(fields === null ? null : `It was ${fields.note}`)
      setAnswering(at)
      say(missedMoment(outcome), fields ?? undefined)
    })
    // He sings his note, then the third from it, the pair drawn as he does.
    answerCount += 1
    const answer = answerCount
    let wait = AFTER_ANSWER_MS
    if (ctx !== null) {
      const sung = sing(ctx, missedPair(current, at), () => {
        return answer === answerCount && phase() === 'missed'
      })
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

  /** The run stops where it is: nothing kept, the mic closed. */
  function dropRun(): void {
    capture.release()
    hush()
    merc.stopCheering()
    batch(() => {
      dispatch({ type: 'stop' })
      setChip(null)
      setTask(null)
      setAnswering(null)
      setMercLit(0)
      setLamps([])
    })
    merc.set('idle')
  }

  /** A line heard again at the result goes quiet, its moments with it. */
  const endReplay = (): void => {
    answerCount += 1
    setReplaying(null)
  }

  /** At the result, a line's row: Merc sings it in two voices. */
  const replayLine = (index: number): void => {
    if (phase() !== 'result') return
    const outcome = untrack(state).outcomes[index]
    if (outcome === undefined) return
    endReplay()
    // The line's own voices take over from Merc's words.
    speech.hush()
    const mine = answerCount
    const current = (): boolean => mine === answerCount && phase() === 'result'
    // Asked inside the tap: iOS starts the clock only from a gesture.
    void capture.audio().then((ctx) => {
      if (ctx === null || !current()) return
      audio = ctx
      stopSound()
      const his = sing(ctx, mercLine(outcome.line, rules), current)
      const theirs = voiceOfMerc.sing(
        ctx,
        harmonyLine(outcome.line, rules),
        ctx.currentTime + SOUND_LEAD_SECONDS,
      )
      sound = {
        stop: () => {
          his.stop()
          theirs.stop()
        },
      }
      setReplaying(index)
      const ms = (his.endAt - ctx.currentTime + outputLatency(ctx)) * 1000
      life.later(Math.max(0, ms), () => {
        if (current()) setReplaying(null)
      })
    })
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
    if (!isRunPhase(phase())) return
    dropRun()
    sayIntro()
  }

  /** Merc's call again, in the singer's own turn, as the level allows. */
  const canHearAgain = (): boolean => {
    const now = state()
    if (now.phase !== 'sing') return false
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
    sayIntro()
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
    listening: () => isRunPhase(state().phase),
    demo: { on: () => false, playing: () => false },
    holdsFocus: true,
    mic: {
      exercise: EXERCISE_HARMONY_LAKE,
      on: () => isRunPhase(phase()) && phase() !== 'starting',
      // A mic that died drops the run as leaving does, Merc silent: a call
      // or another app may have the sound, and his line would take it back.
      died: leave,
    },
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
    rules: level.preset,
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
    replaying,
    replayLine,
    start,
    stop,
    drawTrail: (next) => {
      sink = next
    },
    script: { active: () => false },
  }
}
