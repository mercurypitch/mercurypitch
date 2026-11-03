// ============================================================
// useFirstNoteController: one First note run, from the tap to the result
// ============================================================
//
// Owns the room's states (first-note-machine.ts), the microphone and the
// audio clock (room-kit useExerciseCapture.ts), the song player
// (song-player.ts), the sequence engine that hears each round's one note
// (src/lib/sequence) and everything that answers it: the singer's entry,
// the voice's trail, the note's line, Merc's state and voice, his lines and
// the chip.
//
// A run is up to FIRST_NOTE_ROUNDS entries from the songs the singer chose
// (the examples, their own, or a mix: first-note-choices.ts), planned as it
// starts (first-note-songs.ts); a song of their own gets stems that play
// once the mic has opened. Each round: the song's band leads in, with
// its last four beats counted down, and stops where its singer comes in.
// The singer's turn opens. The first note their voice sits on is their
// entry, judged by ear alone at the levels that hide the line; then the
// line shows (Singer) and the voice lands the note on the engine's rules,
// held in the band for the level's land time, folded to its nearest
// octave. The song then carries on from the entry with its singer back in:
// after a landing at once, after a miss once Merc has sung the note. Then
// the next entry, and after the last, the result. The microphone opens on
// the tap and closes at the result.
//
// One capture window per round, opened as its lead-in starts. The band's
// end is the player's, on the element's own clock, so the turn opens when
// the lead-in has faded out, and the engine hears nothing before then plus
// RESPONSE_GATE_SECONDS (the band's tail through the speaker reaches the
// mic). The engine is ticked once per CAPTURED frame, on the frames' own
// clock, never once per screen frame.
//
// "How it works" (demo/useFirstNoteDemo.ts) sings its takes through the
// same steps by `script` (scripted-take.ts): frames in place of the mic,
// the countdown and the turn on the take's clock, where the demo's own
// sound plays the band's clip. A scripted take never opens the mic, fires a
// haptic, says a line or keeps a result, and a run's moves wait while the
// demo has the room.

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
import { newestLevel } from '@/components/room-kit/voice-level'
import { EXERCISE_FIRST_NOTE_STAGE } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { RESPONSE_GATE_SECONDS } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import { firstNoteDemoAutoPlays } from '@/stores/first-note-store'
import { firstNoteSource } from './first-note-choices'
import type { Countdown, FirstNoteController, FirstNoteControllerOptions, TrailSink, } from './first-note-controller-contract'
import { YOUR_TURN } from './first-note-controller-contract'
import type { FirstNoteEvent, FirstNoteState, RoundOutcome, } from './first-note-machine'
import { firstNoteReducer, INITIAL_FIRST_NOTE_STATE, isRunPhase, liveRound, } from './first-note-machine'
import { playableSong, songsFrom } from './first-note-own-songs'
import type { FirstNoteLevel } from './first-note-rules'
import { BETWEEN_ROUNDS_MS, FIRST_NOTE_LEVELS, MERC_GAP_SECONDS, MERC_NOTE_SECONDS, } from './first-note-rules'
import type { FirstNoteSummary } from './first-note-run'
import { keepFirstNoteRun, resultMoment, summarizeRun } from './first-note-run'
import type { FirstNoteRound, FirstNoteSong } from './first-note-songs'
import { entryPitch, planRun, songsOfRun } from './first-note-songs'
import { countdownAt, entryChip, lineShows, sameCountdown, } from './first-note-stage'
import { createFirstTurn } from './first-note-turn'
import { createFirstLines } from './merc-lines'
import { FIRST_SPOKEN } from './merc-spoken'
import type { FirstNoteDemoMark, ScriptedFirstTake } from './scripted-take'
import { createScriptedRoom } from './scripted-take'
import type { SongPlayer, SongSound } from './song-player'
import { createSongPlayer } from './song-player'

/** Merc's voice while he sings the note (demo-voice's held level). */
const SUNG_LEVEL = 0.8

/** Merc singing `midi`, held at his sung level. */
const singing = (midi: number): MercVoice => ({
  voiced: true,
  cents: 0,
  level: SUNG_LEVEL,
  steady: 1,
  midi,
})

export function useFirstNoteController(
  options: FirstNoteControllerOptions = {},
): FirstNoteController {
  const capture = useExerciseCapture('first-note', 'First note')
  const voiceOfMerc = options.voice ?? SYNTH_VOICE
  const given = options.songs
  const songsNow = (): readonly FirstNoteSong[] => {
    if (given === undefined) return songsFrom(firstNoteSource())
    return typeof given === 'function' ? given() : given
  }
  const playable = options.playable ?? playableSong
  const makePlayer = options.player ?? createSongPlayer
  const random = options.random ?? Math.random
  const lines = createFirstLines(random)
  // His lines at rest, aloud through the room's clock (merc-speech.ts).
  const speech = createMercSpeech(FIRST_SPOKEN, {
    clock: () => capture.runningAudio(),
  })

  const [state, setState] = createSignal<FirstNoteState>(
    INITIAL_FIRST_NOTE_STATE,
  )
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [summary, setSummary] = createSignal<FirstNoteSummary | null>(null)
  const [resultLevel, setResultLevel] = createSignal('')
  const [inBand, setInBand] = createSignal(false)
  const [countdown, setCountdown] = createSignal<Countdown | null>(null)
  // The demo's: on from its enter to its leave, playing, and its rules.
  const [scriptActive, setScriptActive] = createSignal(false)
  const [demoPlaying, setDemoPlaying] = createSignal(false)
  const [demoRules, setDemoRules] = createSignal<FirstNoteLevel | null>(null)
  const demoOn = (): boolean => untrack(scriptActive)
  const level = createLevelPreset(FIRST_NOTE_LEVELS, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: FirstNoteEvent): void => {
    setState((current) => firstNoteReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = speakingLines(lines, speech, setLine)
  /** His opening line, aloud unless the singer has just left the app. */
  const sayIntro = (aloud = true): void => {
    say(
      untrack(level.preset).line === 'always' ? 'introLine' : 'intro',
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
  let player: SongPlayer | null = null
  /** The run's songs with stems that play, by slug. */
  let playing = new Map<string, FirstNoteSong>()
  let sound: SongSound | null = null
  /** Merc singing the note after a miss. */
  let mercSound: { stop(): void } | null = null
  let runLevel: ExerciseLevel = 'singer'
  let rules: FirstNoteLevel = untrack(level.preset)
  let windowStartedAt = 0
  /** The frame loop runs: a lead-in or a turn is on. */
  let listening = false
  let loudness = 0
  let heardAgain = false
  /** Counts lead-ins, so a replaced one's end never opens a turn. */
  let leadCount = 0
  let sink: TrailSink = () => undefined
  /** The demo's take singing through the room in place of the mic. */
  let scripted: ScriptedFirstTake | null = null

  /** Seconds on the frames' clock: since the window opened, or the take's. */
  const frameNow = (): number =>
    scripted === null
      ? (performance.now() - windowStartedAt) / 1000
      : scripted.now()
  const live = (): FirstNoteRound | null => liveRound(untrack(state))
  /** The demo's moment, to its tooltips; the singer's run has none. */
  const mark = (moment: FirstNoteDemoMark): void => {
    scripted?.onEvent(moment)
  }
  /** The round's song, with its stems minted for this run. */
  const songOf = (round: FirstNoteRound): FirstNoteSong =>
    playing.get(round.song.slug) ?? round.song

  // ── The turn's ears (first-note-turn.ts) ───────────────────
  const turn = createFirstTurn({
    singing: () => phase() === 'sing',
    listening: () => listening,
    entry: () => untrack(state).entry,
    entered: (entry) => {
      dispatch({ type: 'entry', entry })
      setChip(entryChip(entry))
      if (entry.onNote && scripted === null) haptics.tapLight()
      mark('entry')
    },
    heard: (now, band) => {
      voice = now ?? { ...voice, voiced: false, level: 0 }
      setInBand(band)
    },
    heardAgain: () => heardAgain,
    mark,
    decided: (outcome) => endRound(outcome),
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
    mercSound?.stop()
    mercSound = null
    sink(null)
    turn.clear()
    voice = SILENT_VOICE
    setInBand(false)
    setCountdown(null)
  }

  /** The player let go, with the run. */
  const letGoOfSongs = (): void => {
    player?.dispose()
    player = null
    playing = new Map()
  }

  /** The round's lead-in: a fresh capture window, then the band. */
  const playLeadIn = (round: FirstNoteRound): void => {
    if (player === null) return
    stopSound()
    capture.startWindow()
    windowStartedAt = performance.now()
    turn.reset(round, rules)
    sink(null)
    setInBand(false)
    leadCount += 1
    const lead = leadCount
    const leadIn = player.leadIn(songOf(round), round.entry)
    sound = leadIn
    setCountdown({ progress: 0, beats: round.entry.beats.length, lit: 0 })
    setChip(`Entry ${round.index + 1} of ${untrack(state).rounds.length}`)
    merc.set('listen')
    startLoop()
    void leadIn.done.then((played) => {
      if (lead !== leadCount || phase() !== 'band') return
      if (played) toTurn()
      else songFailed()
    })
  }

  /** A round begins: its lead-in. */
  const beginRound = (index: number): void => {
    dispatch({ type: 'intro', index })
    const round = live()
    if (round === null || phase() !== 'band') return
    heardAgain = false
    setLine('')
    playLeadIn(round)
  }

  /**
   * One of the demo's takes in place of the mic: its entry's lead-in begun
   * as a round's is, on the take's clock, its frames flowing. The demo's
   * own sound plays the band's clip; the countdown runs with it.
   */
  const playScripted = (take: ScriptedFirstTake): void => {
    scripted = take
    rules = take.rules
    turn.reset(take.round, take.rules)
    heardAgain = false
    leadCount += 1
    sink(null)
    batch(() => {
      dispatch({ type: 'demo', round: take.round })
      setDemoRules(take.rules)
      setInBand(false)
      setCountdown(countdownAt(take.round.entry, take.round.entry.from))
    })
    merc.set('listen')
    startLoop()
  }

  /** The band has stopped where the singer comes in: their turn. */
  const toTurn = (): void => {
    sound = null
    dispatch({ type: 'turn' })
    // The band's tail leaves the speaker its output latency after the
    // element stops: a Bluetooth speaker's must not be heard as the singer.
    // A demo's take listens when its script says, on its own clock.
    const latency = audio === null ? 0 : outputLatency(audio)
    turn.open(
      scripted?.responseStart ?? frameNow() + RESPONSE_GATE_SECONDS + latency,
    )
    setCountdown(null)
    const entry = untrack(state).entry
    setChip(entry === null ? YOUR_TURN : entryChip(entry))
    merc.set('listen')
    mark('turn')
  }

  /** Where the band is on the song's clock: the player's, or the demo's clip's. */
  const bandAt = (round: FirstNoteRound): number | null => {
    if (scripted !== null) {
      return round.entry.from + scripted.now() - scripted.introAt
    }
    return sound === null ? null : sound.position()
  }

  /** The countdown, from where the band is now. */
  const countDown = (round: FirstNoteRound): void => {
    const at = bandAt(round)
    if (at === null) return
    const next = countdownAt(round.entry, at)
    if (!sameCountdown(untrack(countdown), next)) setCountdown(next)
  }

  /** The trail shows once the line would: from the start, or the entry on. */
  const trailShows = (): boolean =>
    rules.line === 'always' || untrack(state).entry !== null

  /** One screen frame while the room listens (frame-loop.ts). */
  function screenFrame(): void {
    const round = live()
    if (round === null) return
    // A demo's band is its clip, on the take's clock: its turn comes there.
    if (
      phase() === 'band' &&
      scripted !== null &&
      frameNow() >= scripted.turnAt
    ) {
      toTurn()
    }
    if (phase() === 'band') countDown(round)
    const frames = scripted?.frames() ?? capture.peekFrames()
    turn.follow(frames)
    if (!listening) return
    if (phase() === 'sing') {
      const last = frames.length === 0 ? null : frames[frames.length - 1]
      // The demo's voice is not the singer's: the mic's ring stays still.
      loudness =
        scripted !== null || last === null || last.t < turn.responseStart()
          ? 0
          : newestLevel(frames)
      sink(trailShows() ? { points: turn.points(), now: frameNow() } : null)
    } else {
      loudness = 0
    }
  }

  /** On to the next entry once the line has played: only for this run and round. */
  const nextAfter = (playing: Promise<boolean>, index: number): void => {
    const { run } = untrack(state)
    void playing.then(() => {
      life.later(BETWEEN_ROUNDS_MS, () => {
        const now = untrack(state)
        if (now.run !== run || now.current !== index) return
        if (now.phase !== 'landed' && now.phase !== 'missed') return
        if (index + 1 < now.rounds.length) beginRound(index + 1)
        else finishRun()
      })
    })
  }

  /** The song carries on from the entry, its singer back in. */
  const playLine = (round: FirstNoteRound): void => {
    if (player === null) return
    const line = player.line(songOf(round), round.entry)
    sound = line
    nextAfter(line.done, round.index)
  }

  /** After a miss: Merc sings the note, then the singer comes in. */
  const mercSingsTheNote = (round: FirstNoteRound): void => {
    const ctx = audio
    const midi = entryPitch(round.entry)
    if (ctx !== null) {
      mercSound = voiceOfMerc.sing(
        ctx,
        [{ midi, at: 0, seconds: MERC_NOTE_SECONDS }],
        ctx.currentTime + 0.1,
      )
    }
    voice = singing(midi)
    merc.set('sing')
    const index = round.index
    const { run } = untrack(state)
    life.later((MERC_NOTE_SECONDS + MERC_GAP_SECONDS) * 1000 + 100, () => {
      const now = untrack(state)
      if (now.run !== run || now.current !== index || now.phase !== 'missed') {
        return
      }
      mercSound = null
      voice = SILENT_VOICE
      merc.set('idle')
      playLine(round)
    })
  }

  /**
   * After a demo's miss, Merc's face sings the note as the demo's sound
   * sings it, on the take's clock; nothing follows it.
   */
  const mercAnswers = (take: ScriptedFirstTake): void => {
    const answer = take.answer[0]
    if (answer === undefined) return
    const from = Math.max(
      0,
      take.startsAt + answer.at * 1000 - performance.now(),
    )
    const still = (): boolean => scripted === take && phase() === 'missed'
    life.later(from, () => {
      if (!still()) return
      voice = singing(answer.midi)
      merc.set('sing')
    })
    life.later(from + answer.seconds * 1000 + 150, () => {
      if (!still()) return
      voice = SILENT_VOICE
      merc.set('idle')
    })
  }

  /**
   * The round's outcome on the screen: the chip, the band and Merc. A run's
   * is felt and said too; a demo's take is neither, its tooltip says it.
   */
  function showOutcome(outcome: RoundOutcome, inRun: boolean): void {
    const note = midiToNoteNameOctave(outcome.round.entry.midi)
    setInBand(outcome.landed)
    if (outcome.landed) {
      if (inRun) haptics.tapLight()
      setChip(`First note: ${note}`)
      const onNote = outcome.entry?.onNote === true
      if (inRun) say(onNote ? 'landedOnNote' : 'landed', { note })
      merc.cheer()
      return
    }
    setChip(`It was ${note}`)
    if (inRun) say(outcome.voiced ? 'missed' : 'missedSilent', { note })
  }

  /** A round is over: the song carries on, Merc's line, then the next entry. */
  function endRound(outcome: RoundOutcome): void {
    // A demo's take is felt, said and followed by nothing: its tooltip
    // explains it, and the demo moves on. Its own sound sings Merc's note.
    const take = scripted
    stopLoop()
    if (take === null) capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    stopSound()
    showOutcome(outcome, take === null)
    if (take !== null) {
      if (!outcome.landed) mercAnswers(take)
      mark('outcome')
      return
    }
    if (outcome.landed) playLine(outcome.round)
    else mercSingsTheNote(outcome.round)
  }

  /** The run's result: kept, shown, and the mic closed. */
  function finishRun(): void {
    capture.release()
    hush()
    letGoOfSongs()
    const outcomes = untrack(state).outcomes
    const shown = summarizeRun(outcomes)
    const kept = keepFirstNoteRun(runLevel, shown)
    const levelName = exerciseLevelName(runLevel)
    batch(() => {
      dispatch({ type: 'finish' })
      setSummary(shown)
      setResultLevel(levelName)
      setChip(null)
      // The run is over and the mic closed: Merc says the result aloud.
      say(resultMoment(shown, kept), undefined, true)
    })
    if (kept.kept && shown.onNote * 2 >= shown.rounds) {
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
    letGoOfSongs()
    merc.stopCheering()
    batch(() => {
      dispatch({ type: 'stop' })
      setChip(null)
    })
    merc.set('idle')
  }

  /** A song would not play: the run stops, and Merc says so. */
  function songFailed(): void {
    dropRun()
    say('songFailed')
  }

  // ── What the singer does ───────────────────────────────────
  const start = (): void => {
    if (isRunPhase(phase()) || demoOn()) return
    // He stops talking before the mic opens.
    speech.hush()
    const songs = untrack(songsNow)
    if (songs.length === 0) {
      options.onNoSongs?.()
      return
    }
    level.take()
    runLevel = untrack(exerciseLevel)
    rules = untrack(level.preset)
    const rounds = planRun(songs, random)
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
      onOpen: (run, ctx) => {
        audio = ctx
        letGoOfSongs()
        // With `clock: true` the mic opens only on a running clock: a null
        // one goes to onFail (room-mic.ts). Only the type allows it here,
        // and with no clock the songs could not play.
        if (ctx === null) {
          songFailed()
          return
        }
        player = makePlayer(ctx)
        // A song of the singer's own plays from the phone's store, through
        // URLs minted for this page; an example's are its files.
        const own = songsOfRun(rounds).filter((song) => song.kind === 'yours')
        if (own.length === 0) {
          beginRound(0)
          return
        }
        const stillThisRun = (): boolean =>
          untrack(state).run === run && phase() === 'starting'
        Promise.all(own.map(playable)).then(
          (ready) => {
            if (!stillThisRun()) return
            playing = new Map(ready.map((song) => [song.slug, song]))
            beginRound(0)
          },
          () => {
            if (stillThisRun()) songFailed()
          },
        )
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

  /** The lead-in again, in the singer's turn, as the level allows. */
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
    playLeadIn(round)
  }

  /**
   * The singer left the app. Nothing listens behind their back, and the
   * run is dropped, as the mic's tap drops it: no result, no best.
   */
  function leave(): void {
    // Nothing he says is heard behind their back either.
    speech.hush()
    // The demo stops itself on the way out (useExerciseDemo).
    if (demoOn() || !isRunPhase(phase())) return
    dropRun()
    sayIntro(false)
  }

  // ── The screen's life ──────────────────────────────────────
  onMount(() => {
    // A first visit opens on the demo, which says it all: his line waits.
    sayIntro(!firstNoteDemoAutoPlays())
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
      exercise: EXERCISE_FIRST_NOTE_STAGE,
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
    // The demo sings its own song's entry (demo/demo-script.ts): the room
    // has no note of its own to give it.
    note: () => 0,
    clear: () => {
      scripted = null
      leadCount += 1
      hush()
      merc.stopCheering()
      batch(() => {
        dispatch({ type: 'demo', round: null })
        setDemoRules(null)
        setSummary(null)
        setChip(null)
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
    letGoOfSongs()
    speech.dispose()
    life.dispose()
  })

  /** The rules on screen: the demo's while it plays, else the level's. */
  const rulesNow = (): FirstNoteLevel => demoRules() ?? level.preset()

  return {
    state,
    line,
    chip,
    summary,
    resultLevel,
    round: () => liveRound(state()),
    rules: rulesNow,
    lineShown: () =>
      lineShows(rulesNow().line, state().phase, state().entry !== null),
    inBand,
    countdown,
    mercState: merc.state,
    mercVoice: () => voice,
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
