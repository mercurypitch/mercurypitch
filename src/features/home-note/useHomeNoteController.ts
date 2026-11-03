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
//
// "How it works" (demo/useHomeNoteDemo.ts) sings its takes through the
// same steps by `script` (scripted-take.ts): frames in place of the mic,
// the band's intro and Merc's home on the take's clock, the demo's own
// sound playing them. A scripted take never opens the mic, fires a haptic,
// says a line or keeps a result, and a run's moves wait while the demo has
// the room.

import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createLevelPreset } from '@/components/room-kit/level-preset'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import { createMercSpeech, speakingLines, } from '@/components/room-kit/merc-speech'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
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
import { homeNoteDemoAutoPlays } from '@/stores/home-note-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { BandSound } from './home-note-band'
import { playIntro, playResolve } from './home-note-band'
import type { HomeNoteController, HomeNoteControllerOptions, TrailSink, } from './home-note-controller-contract'
import { YOUR_TURN } from './home-note-controller-contract'
import type { HomeNoteEvent, HomeNoteState, RoundOutcome, } from './home-note-machine'
import { homeNoteReducer, INITIAL_HOME_NOTE_STATE, isRunPhase, liveRound, } from './home-note-machine'
import { createKeyReplay } from './home-note-replay'
import type { HomeRound } from './home-note-round'
import { planRounds, roundWindow } from './home-note-round'
import type { HomeNoteLevel } from './home-note-rules'
import { BETWEEN_ROUNDS_MS, CHORD_SECONDS, HOME_NOTE_LEVELS, HOME_NOTE_ROUNDS, MERC_GAP_SECONDS, MERC_HOME_SECONDS, SOUND_LEAD_SECONDS, } from './home-note-rules'
import type { HomeNoteSummary } from './home-note-run'
import { isQuick, keepHomeNoteRun, resultMoment, summarizeRun, } from './home-note-run'
import { createHomeLines } from './merc-lines'
import { HOME_SPOKEN } from './merc-spoken'
import type { HomeNoteDemoMark, ScriptedHomeTake } from './scripted-take'
import { createScriptedRoom } from './scripted-take'

/** Merc's voice while he sings home (demo-voice's held level). */
const SUNG_LEVEL = 0.8

/** Merc's face while he sings `midi`, held and on it. */
function singing(midi: number): MercVoice {
  return { voiced: true, cents: 0, level: SUNG_LEVEL, steady: 1, midi }
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
  // The demo's: on from its enter to its leave, playing, and its rules.
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const [demoRules, setDemoRules] = createSignal<HomeNoteLevel | null>(null)
  const demoOn = (): boolean => untrack(scriptActive)
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
    afterCheer: () => (isRunPhase(phase()) && !demoOn() ? 'listen' : 'idle'),
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
  let sink: TrailSink = () => undefined
  /** The demo's take singing through the room in place of the mic. */
  let scripted: ScriptedHomeTake | null = null

  /** Seconds on the frames' clock: since the window opened, or the take's. */
  const frameNow = (): number =>
    scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  const live = (): HomeRound | null => liveRound(untrack(state))
  /** The demo's moment, to its tooltips; the singer's run has none. */
  const mark = (moment: HomeNoteDemoMark): void => {
    scripted?.onEvent(moment)
  }
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

  /**
   * One of the demo's takes in place of the mic: its key's intro begun as
   * a round's is, on the take's clock, its frames flowing. The demo's own
   * sound plays the band; the chord lamps light with it.
   */
  const playScripted = (take: ScriptedHomeTake): void => {
    scripted = take
    rules = take.rules
    engine = createSequenceState(take.responseStart)
    processed = 0
    points = []
    heardAgain = false
    mercFrom = Number.POSITIVE_INFINITY
    mercTo = Number.NEGATIVE_INFINITY
    sink(null)
    batch(() => {
      dispatch({ type: 'demo', round: take.round })
      setDemoRules(take.rules)
      setInBand(false)
      setBeat(0)
      setChordsOver(false)
    })
    introCount += 1
    const intro = introCount
    const atTake = (t: number, then: () => void): void => {
      life.later(
        Math.max(0, take.startsAt + t * 1000 - performance.now()),
        () => {
          if (intro === introCount && scripted === take && phase() === 'band') {
            then()
          }
        },
      )
    }
    take.rules.intro.forEach((_, i) => {
      atTake(take.introAt + i * CHORD_SECONDS, () => setBeat(i + 1))
    })
    atTake(take.introAt + take.rules.intro.length * CHORD_SECONDS, () =>
      setChordsOver(true),
    )
    merc.set('listen')
    startLoop()
  }

  /** The intro has reached its end at the speaker: the singer's turn. */
  const toTurn = (): void => {
    dispatch({ type: 'turn' })
    setChip(YOUR_TURN)
    merc.set('listen')
    mark('turn')
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
    if (event.type === 'phraseEnd') {
      mark('phraseEnd')
      return
    }
    mark(`${event.type}:${event.index}`)
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
      sink({ points, now: frameNow() })
    } else {
      loudness = 0
    }
  }

  /**
   * The round's outcome on the screen: the chip, the lamp and Merc. A run's
   * is felt and said too; a demo's take is neither, its tooltip says it.
   */
  function showOutcome(outcome: RoundOutcome, inRun: boolean): void {
    const note = midiToNoteNameOctave(outcome.round.home)
    setInBand(outcome.landed)
    if (outcome.landed) {
      if (inRun) haptics.tapLight()
      setChip(`Home: ${note}`)
      if (inRun) say(isQuick(outcome) ? 'landedQuick' : 'landed', { note })
      merc.cheer()
      return
    }
    setChip(`Home was ${note}`)
    if (inRun) say(outcome.voiced ? 'missed' : 'missedSilent', { note })
  }

  /**
   * After a miss, Merc sings home over the band's chord: his face follows
   * his note, now, or as the demo's sound sings it on the take's clock.
   */
  function answerHome(home: number, take: ScriptedHomeTake | null): void {
    const answer = take?.answer[0]
    const from =
      take === null || answer === undefined
        ? 0
        : Math.max(0, take.startsAt + answer.at * 1000 - performance.now())
    const still = (): boolean => scripted === take && phase() === 'missed'
    const sings = (): void => {
      voice = singing(home)
      merc.set('sing')
    }
    if (from === 0) sings()
    else {
      life.later(from, () => {
        if (still()) sings()
      })
    }
    life.later(from + MERC_HOME_SECONDS * 1000 + 150, () => {
      if (!still()) return
      voice = SILENT_VOICE
      merc.set('idle')
    })
  }

  /** A round is over: home's chord, Merc's line, then the next key. */
  function endRound(outcome: RoundOutcome): void {
    const ctx = audio
    // A demo's take is felt, said and followed by nothing: its tooltip
    // explains it, and the demo moves on. Its own sound plays home's chord.
    const take = scripted
    stopLoop()
    if (take === null) capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    stopSound()
    if (ctx !== null && take === null) {
      sound = playResolve(
        ctx,
        outcome.round,
        outcome.landed ? null : voiceOfMerc,
      )
    }
    showOutcome(outcome, take === null)
    if (!outcome.landed) answerHome(outcome.round.home, take)
    if (take !== null) {
      mark('outcome')
      return
    }
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

  /** At the result, a key's lamp: that key again (home-note-replay.ts). */
  const replay = createKeyReplay({
    audio: () => capture.audio(),
    voice: voiceOfMerc,
    rules: () => rules,
    atResult: () => phase() === 'result',
    // The key's own sound takes over from Merc's line.
    hush: () => speech.hush(),
    play: (ctx, played) => {
      stopSound()
      audio = ctx
      sound = played
    },
    sings: (home) => {
      if (home === null) {
        voice = SILENT_VOICE
        merc.set('idle')
        return
      }
      voice = singing(home)
      merc.stopCheering()
      merc.set('sing')
    },
    later: life.later,
  })
  const endReplay = replay.end
  /** Another tap cuts the key playing. */
  const replayKey = (index: number): void => {
    const outcome = untrack(state).outcomes[index]
    if (outcome !== undefined) replay.play(index, outcome.round)
  }

  /** The keys' window: the singer's, cut to what a phone carries. */
  const keyWindow = () => {
    const window = echoWindow({
      voiceprints: loadLocalVoiceprints(),
      voicePreset: untrack(vocalRangePreset),
    })
    return roundWindow({ low: window.low, high: window.high })
  }

  // ── What the singer does ───────────────────────────────────
  const start = (): void => {
    const from = phase()
    if (demoOn()) return
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
    const rounds = planRounds(HOME_NOTE_ROUNDS, keyWindow(), random)
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
    if (!isRunPhase(phase()) || demoOn()) return
    dropRun()
    sayIntro()
  }

  /** The intro again, in the singer's turn, as the level allows. */
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
    playRoundIntro(round)
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as the mic's tap drops it: no result, no best.
   */
  function leave(): void {
    // Nothing he says or sings is heard behind their back either: a key
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
    sayIntro(!homeNoteDemoAutoPlays())
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
      exercise: EXERCISE_HOME_NOTE_LIGHTHOUSE,
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
    // Home for the demo's key: the middle of the singer's window.
    note: () => {
      const window = keyWindow()
      return Math.round((window.low + window.high) / 2)
    },
    clear: () => {
      scripted = null
      introCount += 1
      endReplay()
      hush()
      merc.stopCheering()
      batch(() => {
        dispatch({ type: 'demo', round: null })
        setDemoRules(null)
        setSummary(null)
        setChip(null)
        setBeat(0)
        setChordsOver(false)
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
    rules: () => demoRules() ?? level.preset(),
    inBand,
    beat,
    chordsOver,
    replaying: replay.playing,
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
    script,
  }
}
