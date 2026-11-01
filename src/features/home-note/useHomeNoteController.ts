// ============================================================
// useHomeNoteController: one Home note run, from the tap to the result
// ============================================================
//
// Owns the room's states (home-note-machine.ts), the microphone and the
// audio clock (room-kit useExerciseCapture.ts), the band (home-note-
// band.ts), the sequence engine that hears each round's one note
// (src/lib/sequence) and everything that answers it: the voice's trail,
// the lighthouse, Merc's state and voice, his lines and the chip.
//
// A run is HOME_NOTE_ROUNDS keys at the singer's level, planned as it
// starts (home-note-round.ts) in the singer's window: the voiceprint's
// range, else the voice type's. Each round: the band plays its intro (and
// at Learning Merc sings home after it), the band stops, and the singer
// sings home. The voice lands it on the engine's rules, held in the band
// for the level's land time, folded to home's nearest octave. Then home's
// chord plays under the singer, or under Merc singing home after a miss,
// and the next key comes. After the last, the result. The microphone opens
// on the tap and closes at the result.
//
// One capture window per round, opened as its intro is scheduled, so the
// frames' clock and the audio clock meet at one moment. The intro is
// scheduled a little ahead on the audio clock and its end carried to the
// frames' clock with the output latency; the engine hears nothing before
// that end plus RESPONSE_GATE_SECONDS (the band's tail through the speaker
// reaches the mic). The engine is ticked once per CAPTURED frame, on the
// frames' own clock, never once per screen frame.

import type { Accessor } from 'solid-js'
import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { createMercSpeech, speakingLines, } from '@/components/room-kit/merc-speech'
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
import { trailPoint } from '@/components/room-kit/voice-trail'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { EXERCISE_HOME_NOTE_LIGHTHOUSE } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { echoWindow } from '@/lib/sequence/phrase-fit'
import type { Phrase, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { vocalRangePreset } from '@/stores/settings-store'
import type { BandSound } from './home-note-band'
import { playIntro, playKeyAgain, playResolve } from './home-note-band'
import type { HomeNoteEvent, HomeNoteState, RoundOutcome, } from './home-note-machine'
import { homeNoteReducer, INITIAL_HOME_NOTE_STATE, isRunPhase, liveRound, } from './home-note-machine'
import type { HomeRound } from './home-note-round'
import { planRounds, roundWindow } from './home-note-round'
import type { HomeNoteLevel } from './home-note-rules'
import { BETWEEN_ROUNDS_MS, CHORD_SECONDS, HOME_NOTE_LEVELS, HOME_NOTE_ROUNDS, MERC_GAP_SECONDS, MERC_HOME_SECONDS, SOUND_LEAD_SECONDS, } from './home-note-rules'
import type { HomeNoteSummary } from './home-note-run'
import { isQuick, keepHomeNoteRun, resultMoment, summarizeRun, } from './home-note-run'
import { createHomeLines } from './merc-lines'
import { HOME_SPOKEN } from './merc-spoken'

/** The chip while the singer sings. */
export const YOUR_TURN = 'Your turn'
/** Merc's voice while he sings home (demo-voice's held level). */
const SUNG_LEVEL = 0.8

/** Merc's face while he sings `midi`, held and on it. */
function singing(midi: number): MercVoice {
  return { voiced: true, cents: 0, level: SUNG_LEVEL, steady: 1, midi }
}

/** Draws the voice's trail: its readings and now, frames' clock; null clears it. */
export type TrailSink = (
  trail: {
    readonly points: readonly TrailPoint[]
    readonly now: number
  } | null,
) => void

export interface HomeNoteControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  readonly random?: () => number
}

export interface HomeNoteController extends ShellRun {
  readonly state: Accessor<HomeNoteState>
  /** Merc's line, in his bubble between rounds; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<HomeNoteSummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The round on screen, or null outside a run. */
  readonly round: Accessor<HomeRound | null>
  /** The rules the run is heard by (the band's height on screen). */
  readonly rules: Accessor<HomeNoteLevel>
  /** The voice is in home's band now. */
  readonly inBand: Accessor<boolean>
  /**
   * The band's chord count in this intro: the lighthouse pulses on each,
   * and the chip's lamps light.
   */
  readonly beat: Accessor<number>
  /** The intro's last chord has ended: every lamp has passed. */
  readonly chordsOver: Accessor<boolean>
  /** The key of the result heard again now, by its index; null for none. */
  readonly replaying: Accessor<number | null>
  /** At the result: key `index` again, its intro and Merc singing home. */
  readonly replayKey: (index: number) => void
  readonly mercState: ReturnType<typeof createMercMoves>['state']
  readonly mercVoice: () => MercVoice
  /** "Hear it again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: TrailSink) => void
}

export function useHomeNoteController(
  options: HomeNoteControllerOptions = {},
): HomeNoteController {
  const capture = useExerciseCapture('home-note', 'Home note')
  const voiceOfMerc = options.voice ?? SYNTH_VOICE
  const random = options.random ?? Math.random
  const lines = createHomeLines(random)
  // His lines at rest, aloud through the room's clock (merc-speech.ts).
  const speech = createMercSpeech(HOME_SPOKEN, {
    clock: () => capture.runningAudio(),
  })

  const [state, setState] = createSignal<HomeNoteState>(INITIAL_HOME_NOTE_STATE)
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [summary, setSummary] = createSignal<HomeNoteSummary | null>(null)
  const [resultLevel, setResultLevel] = createSignal('')
  const [inBand, setInBand] = createSignal(false)
  const [beat, setBeat] = createSignal(0)
  const [chordsOver, setChordsOver] = createSignal(false)
  const [replaying, setReplaying] = createSignal<number | null>(null)
  const level = createLevelPreset(HOME_NOTE_LEVELS, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: HomeNoteEvent): void => {
    setState((current) => homeNoteReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = speakingLines(lines, speech, setLine)
  /** His opening line, aloud unless the singer has just left the app. */
  const sayIntro = (aloud = true): void => {
    say(
      untrack(level.preset).mercSingsHome ? 'introMatch' : 'intro',
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
    afterCheer: () => (isRunPhase(phase()) ? 'listen' : 'idle'),
  })

  // ── The run ────────────────────────────────────────────────
  let audio: AudioContext | null = null
  let runLevel: ExerciseLevel = 'singer'
  let rules: HomeNoteLevel = untrack(level.preset)
  let sound: BandSound | null = null
  let engine: SequenceState = createSequenceState(0)
  let processed = 0
  let windowStartedAt = 0
  /** Merc's home note at Learning, on the frames' clock. */
  let mercFrom = Number.POSITIVE_INFINITY
  let mercTo = Number.NEGATIVE_INFINITY
  /** The frame loop runs: an intro or a turn is on. */
  let listening = false
  let loudness = 0
  let points: TrailPoint[] = []
  let heardAgain = false
  /** Counts intros, so a replayed intro's pending pulses never fire. */
  let introCount = 0
  /** Counts keys heard again, so an old one's pending moments never fire. */
  let replayCount = 0
  let sink: TrailSink = () => undefined

  const frameNow = (): number => (performance.now() - windowStartedAt) / 1000
  const live = (): HomeRound | null => liveRound(untrack(state))
  const phraseOf = (round: HomeRound): Phrase => ({
    notes: [{ midi: round.home, at: 0, seconds: MERC_HOME_SECONDS }],
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
  }

  /** Off the sound, the loop, the trail and Merc's voice. */
  const hush = (): void => {
    stopLoop()
    stopSound()
    sink(null)
    points = []
    voice = SILENT_VOICE
    setInBand(false)
  }

  /**
   * The round's intro: the band (and at Learning, Merc), a fresh capture
   * window, and a fresh engine that hears nothing until the intro is over.
   */
  const playRoundIntro = (round: HomeRound): void => {
    const ctx = audio
    if (ctx === null) return
    stopSound()
    capture.startWindow()
    windowStartedAt = performance.now()
    processed = 0
    points = []
    sink(null)
    setInBand(false)
    const a0 = ctx.currentTime
    const latency = outputLatency(ctx)
    const onFrames = (t: number): number => t - a0 + latency
    sound = playIntro(ctx, round, rules, voiceOfMerc)
    const start = a0 + SOUND_LEAD_SECONDS
    const bandEnd = start + rules.intro.length * CHORD_SECONDS
    if (rules.mercSingsHome) {
      mercFrom = onFrames(bandEnd + MERC_GAP_SECONDS)
      mercTo = mercFrom + MERC_HOME_SECONDS
    } else {
      mercFrom = Number.POSITIVE_INFINITY
      mercTo = Number.NEGATIVE_INFINITY
    }
    engine = createSequenceState(onFrames(sound.endAt) + RESPONSE_GATE_SECONDS)
    // The lighthouse pulses and the chip's lamps light as each chord
    // reaches the speaker; the last lamp goes out with the last chord.
    setBeat(0)
    setChordsOver(false)
    introCount += 1
    const intro = introCount
    const atSpeaker = (t: number, then: () => void): void => {
      life.later(Math.max(0, onFrames(t) * 1000), () => {
        if (intro === introCount && phase() === 'band') then()
      })
    }
    rules.intro.forEach((_, i) => {
      atSpeaker(start + i * CHORD_SECONDS, () => setBeat(i + 1))
    })
    atSpeaker(bandEnd, () => setChordsOver(true))
    merc.set('listen')
    setChip(`Key ${round.index + 1} of ${untrack(state).rounds.length}`)
    startLoop()
  }

  /** A round begins: its intro. */
  const beginRound = (index: number): void => {
    dispatch({ type: 'intro', index })
    const round = live()
    if (round === null || phase() !== 'band') return
    heardAgain = false
    setLine('')
    playRoundIntro(round)
  }

  /** The intro has reached its end at the speaker: the singer's turn. */
  const toTurn = (): void => {
    dispatch({ type: 'turn' })
    setChip(YOUR_TURN)
    merc.set('listen')
  }

  /** The singer's voice against home: the trail, the band, Merc. */
  const hearVoice = (frame: PitchFrame, round: HomeRound): void => {
    const point = trailPoint(frame, round.home)
    points.push(point)
    if (point.cents === null) {
      voice = { ...voice, voiced: false, level: 0 }
      setInBand(false)
      return
    }
    const tol = rules.tolCents
    setInBand(Math.abs(point.cents) <= tol)
    voice = {
      voiced: true,
      cents: point.cents,
      level: levelFromRms(frame.rms),
      steady: 1 - Math.min(1, Math.abs(point.cents) / tol),
      midi: round.home + point.cents / 100,
    }
  }

  const onEvent = (event: SequenceEvent, round: HomeRound): void => {
    if (event.type === 'phraseEnd') return
    const outcome = engine.outcomes[event.index]
    if (outcome === undefined) return
    if (outcome.landed) {
      endRound({
        round,
        landed: true,
        cents: outcome.cents,
        seconds: Math.max(0, outcome.onset - engine.responseStart),
        voiced: true,
        heardAgain,
      })
    } else {
      endRound({
        round,
        landed: false,
        cents: null,
        seconds: null,
        voiced: outcome.voiced,
        heardAgain,
      })
    }
  }

  /** New captured frames: the turn's trail and its engine. */
  const follow = (frames: readonly PitchFrame[], round: HomeRound): void => {
    const from = processed
    processed = frames.length
    for (let i = from; i < frames.length && listening; i++) {
      const frame = frames[i]
      if (phase() !== 'sing' || frame.t < engine.responseStart) continue
      hearVoice(frame, round)
      engine = tickSequence(engine, frame, phraseOf(round), rules)
      for (const event of engine.events) {
        onEvent(event, round)
        if (phase() !== 'sing') return
      }
    }
  }

  /** One screen frame while the room listens (frame-loop.ts). */
  function screenFrame(): void {
    const round = live()
    if (round === null) return
    if (phase() === 'band' && frameNow() >= engine.responseStart) toTurn()
    const frames = capture.peekFrames()
    follow(frames, round)
    if (!listening) return
    if (phase() === 'sing') {
      const last = frames.length === 0 ? null : frames[frames.length - 1]
      loudness =
        last === null || last.t < engine.responseStart ? 0 : newestLevel(frames)
      sink({ points, now: frameNow() })
    } else {
      loudness = 0
    }
  }

  /** A round is over: home's chord, Merc's line, then the next key. */
  function endRound(outcome: RoundOutcome): void {
    const ctx = audio
    stopLoop()
    capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    const note = midiToNoteNameOctave(outcome.round.home)
    stopSound()
    if (ctx !== null) {
      sound = playResolve(
        ctx,
        outcome.round,
        outcome.landed ? null : voiceOfMerc,
      )
    }
    if (outcome.landed) {
      haptics.tapLight()
      setChip(`Home: ${note}`)
      say(isQuick(outcome) ? 'landedQuick' : 'landed', { note })
      merc.cheer()
    } else {
      setChip(`Home was ${note}`)
      say(outcome.voiced ? 'missed' : 'missedSilent', { note })
      // He sings home over the band's chord: his face follows his note.
      voice = singing(outcome.round.home)
      merc.set('sing')
      life.later(MERC_HOME_SECONDS * 1000 + 150, () => {
        if (phase() !== 'missed') return
        voice = SILENT_VOICE
        merc.set('idle')
      })
    }
    setInBand(outcome.landed)
    // On to the next key: only for this run and this round, so a run
    // stopped and started again meanwhile is never moved on by the old one.
    const { run } = untrack(state)
    const index = outcome.round.index
    life.later(BETWEEN_ROUNDS_MS, () => {
      const now = untrack(state)
      if (now.run !== run || now.current !== index) return
      if (now.phase !== 'landed' && now.phase !== 'missed') return
      if (index + 1 < now.rounds.length) beginRound(index + 1)
      else finishRun()
    })
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(): void {
    capture.release()
    hush()
    const outcomes = untrack(state).outcomes
    const shown = summarizeRun(outcomes)
    const kept = keepHomeNoteRun(runLevel, shown)
    const levelName = exerciseLevelName(runLevel)
    batch(() => {
      dispatch({ type: 'finish' })
      setSummary(shown)
      setResultLevel(levelName)
      setChip(null)
      // The run is over and the mic closed: Merc says the result aloud.
      say(resultMoment(shown, kept), undefined, true)
    })
    if (kept.kept && shown.found * 2 >= shown.rounds) {
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
    })
    merc.set('idle')
  }

  /** A key heard again at the result goes quiet, its moments with it. */
  const endReplay = (): void => {
    replayCount += 1
    setReplaying(null)
  }

  /**
   * Key `round` again, on a running clock: its intro as the run played it,
   * then Merc singing home over home's chord, his face with his note.
   */
  function playKey(ctx: AudioContext, round: HomeRound, index: number): void {
    const mine = replayCount
    stopSound()
    audio = ctx
    const played = playKeyAgain(ctx, round, rules, voiceOfMerc)
    sound = played
    setReplaying(index)
    const latency = outputLatency(ctx)
    const at = (t: number, then: () => void): void => {
      life.later(Math.max(0, (t - ctx.currentTime + latency) * 1000), () => {
        if (mine === replayCount && phase() === 'result') then()
      })
    }
    at(played.mercAt, () => {
      voice = singing(round.home)
      merc.stopCheering()
      merc.set('sing')
    })
    at(played.mercAt + MERC_HOME_SECONDS + 0.15, () => {
      voice = SILENT_VOICE
      merc.set('idle')
    })
    at(played.endAt, () => setReplaying(null))
  }

  /** At the result, a key's lamp: that key again. Another tap cuts it. */
  const replayKey = (index: number): void => {
    if (phase() !== 'result') return
    const outcome = untrack(state).outcomes[index]
    if (outcome === undefined) return
    endReplay()
    // The key's own sound takes over from Merc's line.
    speech.hush()
    const mine = replayCount
    // Asked inside the tap: iOS starts the clock only from a gesture.
    void capture.audio().then((ctx) => {
      if (ctx === null || mine !== replayCount || phase() !== 'result') return
      playKey(ctx, outcome.round, index)
    })
  }

  // ── What the singer does ───────────────────────────────────
  const start = (): void => {
    const from = phase()
    if (from !== 'intro' && from !== 'result' && from !== 'blocked') return
    // He stops talking before the mic opens.
    speech.hush()
    // A key still sounding from the result stops with the tap.
    endReplay()
    stopSound()
    voice = SILENT_VOICE
    level.take()
    runLevel = untrack(exerciseLevel)
    rules = untrack(level.preset)
    const window = echoWindow({
      voiceprints: loadLocalVoiceprints(),
      voicePreset: untrack(vocalRangePreset),
    })
    const rounds = planRounds(
      HOME_NOTE_ROUNDS,
      roundWindow({ low: window.low, high: window.high }),
      random,
    )
    batch(() => {
      dispatch({ type: 'start', rounds })
      setSummary(null)
      setChip(null)
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

  /** The intro again, in the singer's turn, as the level allows. */
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
    playRoundIntro(round)
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as the mic's tap drops it: no result, no best.
   */
  function leave(): void {
    // Nothing he says is heard behind their back either.
    speech.hush()
    if (!isRunPhase(phase())) return
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

  life.watch({
    leave,
    listening: () => isRunPhase(state().phase),
    demo: { on: () => false, playing: () => false },
    holdsFocus: true,
    mic: {
      exercise: EXERCISE_HOME_NOTE_LIGHTHOUSE,
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

  /** Merc's voice: his own home note while he sings it, else the singer's. */
  const mercVoice = (): MercVoice => {
    const round = live()
    if (round !== null && phase() === 'band') {
      const t = frameNow()
      if (t >= mercFrom && t < mercTo) return singing(round.home)
      return { ...SILENT_VOICE, midi: round.home }
    }
    return voice
  }

  return {
    state,
    line,
    chip,
    summary,
    resultLevel,
    round: () => liveRound(state()),
    rules: level.preset,
    inBand,
    beat,
    chordsOver,
    replaying,
    replayKey,
    mercState: merc.state,
    mercVoice,
    micLevel: () => loudness,
    canHearAgain,
    hearAgain,
    start,
    stop,
    drawTrail: (next) => {
      sink = next
    },
    script: { active: () => false },
  }
}
