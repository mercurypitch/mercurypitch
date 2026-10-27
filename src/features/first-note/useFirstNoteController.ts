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
// A run is FIRST_NOTE_ROUNDS entries from the example songs, planned as it
// starts (first-note-songs.ts). Each round: the song's band leads in, with
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
import { trailPoint } from '@/components/room-kit/voice-trail'
import { EXERCISE_FIRST_NOTE_STAGE } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import { offTarget } from '@/lib/hold/hold-reading'
import type { MercVoice } from '@/lib/merc/sim'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { holdPresetFor } from '@/lib/sequence/note-listener'
import type { Phrase, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import { firstSteadyNote } from '@/lib/sequence/steady-note'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel, exerciseLevelName } from '@/stores/exercise-level'
import type { EntryHeard, FirstNoteEvent, FirstNoteState, RoundOutcome, } from './first-note-machine'
import { firstNoteReducer, INITIAL_FIRST_NOTE_STATE, isRunPhase, liveRound, } from './first-note-machine'
import type { FirstNoteLevel } from './first-note-rules'
import { BETWEEN_ROUNDS_MS, ENTRY_MS, ENTRY_RUN_GAP_SEC, ENTRY_STEADY_CENTS, FIRST_NOTE_LEVELS, MERC_GAP_SECONDS, MERC_NOTE_SECONDS, } from './first-note-rules'
import type { FirstNoteSummary } from './first-note-run'
import { keepFirstNoteRun, resultMoment, summarizeRun } from './first-note-run'
import type { FirstNoteRound, FirstNoteSong } from './first-note-songs'
import { FIRST_NOTE_SONGS, planRun } from './first-note-songs'
import type { FirstLineFields, FirstMoment } from './merc-lines'
import { createFirstLines } from './merc-lines'
import type { SongPlayer, SongPlayerFactory, SongSound } from './song-player'
import { createSongPlayer } from './song-player'

/** The chip while the singer sings, before their entry. */
export const YOUR_TURN = 'Your turn'
/** Merc's voice while he sings the note (demo-audio's held level). */
const SUNG_LEVEL = 0.8

/** Draws the voice's trail: its readings and now, frames' clock; null clears it. */
export type TrailSink = (
  trail: {
    readonly points: readonly TrailPoint[]
    readonly now: number
  } | null,
) => void

/** The lead-in's countdown: how far through it is, and the beats lit. */
export interface Countdown {
  /** 0 at the lead-in's start, 1 where the singer comes in. */
  readonly progress: number
  /** The beats before the entry, and how many have gone by. */
  readonly beats: number
  readonly lit: number
}

export interface FirstNoteControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  /** The songs (a test's); the example songs by default. */
  readonly songs?: readonly FirstNoteSong[]
  /** The song player (a test's); the streamed one by default. */
  readonly player?: SongPlayerFactory
  readonly random?: () => number
}

export interface FirstNoteController extends ShellRun {
  readonly state: Accessor<FirstNoteState>
  /** Merc's line, in his bubble between rounds; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<FirstNoteSummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The round on screen, or null outside a run. */
  readonly round: Accessor<FirstNoteRound | null>
  /** The rules the run is heard by (the band's height on screen). */
  readonly rules: Accessor<FirstNoteLevel>
  /** The note's line shows now. */
  readonly lineShown: Accessor<boolean>
  /** The voice is in the note's band now. */
  readonly inBand: Accessor<boolean>
  /** The lead-in's countdown while the band plays; null otherwise. */
  readonly countdown: Accessor<Countdown | null>
  readonly mercState: ReturnType<typeof createMercMoves>['state']
  readonly mercVoice: () => MercVoice
  /** "Hear the band again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: TrailSink) => void
}

/** The chip once the singer has come in. */
function entryChip(entry: EntryHeard): string {
  if (entry.onNote) return 'On the note'
  return entry.cents < 0 ? 'Came in low' : 'Came in high'
}

export function useFirstNoteController(
  options: FirstNoteControllerOptions = {},
): FirstNoteController {
  const capture = useExerciseCapture('first-note', 'First note')
  const voiceOfMerc = options.voice ?? SYNTH_VOICE
  const songs = options.songs ?? FIRST_NOTE_SONGS
  const makePlayer = options.player ?? createSongPlayer
  const random = options.random ?? Math.random
  const lines = createFirstLines(random)

  const [state, setState] = createSignal<FirstNoteState>(
    INITIAL_FIRST_NOTE_STATE,
  )
  const [line, setLine] = createSignal('')
  const [chip, setChip] = createSignal<string | null>(null)
  const [summary, setSummary] = createSignal<FirstNoteSummary | null>(null)
  const [resultLevel, setResultLevel] = createSignal('')
  const [inBand, setInBand] = createSignal(false)
  const [countdown, setCountdown] = createSignal<Countdown | null>(null)
  const level = createLevelPreset(FIRST_NOTE_LEVELS, () =>
    isRunPhase(state().phase),
  )

  const dispatch = (event: FirstNoteEvent): void => {
    setState((current) => firstNoteReducer(current, event))
  }
  const phase = () => untrack(state).phase
  const say = (moment: FirstMoment, fields?: FirstLineFields): void => {
    setLine(lines.next(moment, fields))
  }
  const sayIntro = (): void => {
    say(untrack(level.preset).line === 'always' ? 'introLine' : 'intro')
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
  let player: SongPlayer | null = null
  let sound: SongSound | null = null
  /** Merc singing the note after a miss. */
  let mercSound: { stop(): void } | null = null
  let runLevel: ExerciseLevel = 'singer'
  let rules: FirstNoteLevel = untrack(level.preset)
  let engine: SequenceState = createSequenceState(Number.POSITIVE_INFINITY)
  let processed = 0
  let windowStartedAt = 0
  /** The frame loop runs: a lead-in or a turn is on. */
  let listening = false
  let loudness = 0
  let points: TrailPoint[] = []
  /** The turn's readings off the entry's note, as sung: the entry's ears. */
  let heard: PitchPoint[] = []
  let heardAgain = false
  /** Counts lead-ins, so a replaced one's end never opens a turn. */
  let leadCount = 0
  let sink: TrailSink = () => undefined

  const frameNow = (): number => (performance.now() - windowStartedAt) / 1000
  const live = (): FirstNoteRound | null => liveRound(untrack(state))
  const phraseOf = (round: FirstNoteRound): Phrase => ({
    notes: [{ midi: round.entry.midi, at: 0, seconds: MERC_NOTE_SECONDS }],
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
    points = []
    heard = []
    voice = SILENT_VOICE
    setInBand(false)
    setCountdown(null)
  }

  /** The player let go, with the run. */
  const letGoOfSongs = (): void => {
    player?.dispose()
    player = null
  }

  /** The round's lead-in: a fresh capture window, then the band. */
  const playLeadIn = (round: FirstNoteRound): void => {
    if (player === null) return
    stopSound()
    capture.startWindow()
    windowStartedAt = performance.now()
    processed = 0
    points = []
    heard = []
    sink(null)
    setInBand(false)
    engine = createSequenceState(Number.POSITIVE_INFINITY)
    leadCount += 1
    const lead = leadCount
    const playing = player.leadIn(round.song, round.entry)
    sound = playing
    setCountdown({ progress: 0, beats: round.entry.beats.length, lit: 0 })
    setChip(`Entry ${round.index + 1} of ${untrack(state).rounds.length}`)
    merc.set('listen')
    startLoop()
    void playing.done.then((played) => {
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

  /** The band has stopped where the singer comes in: their turn. */
  const toTurn = (): void => {
    sound = null
    dispatch({ type: 'turn' })
    // The band's tail leaves the speaker its output latency after the
    // element stops: a Bluetooth speaker's must not be heard as the singer.
    const latency = audio === null ? 0 : outputLatency(audio)
    engine = createSequenceState(frameNow() + RESPONSE_GATE_SECONDS + latency)
    setCountdown(null)
    const entry = untrack(state).entry
    setChip(entry === null ? YOUR_TURN : entryChip(entry))
    merc.set('listen')
  }

  /** The countdown, from where the band is now. */
  const countDown = (round: FirstNoteRound): void => {
    if (sound === null) return
    const at = sound.position()
    const { from, beats } = round.entry
    const span = round.entry.at - from
    const progress = span > 0 ? Math.min(1, Math.max(0, (at - from) / span)) : 0
    const lit = beats.filter((beat) => at >= beat).length
    const shown = untrack(countdown)
    if (
      shown !== null &&
      shown.lit === lit &&
      Math.abs(shown.progress - progress) < 0.005
    ) {
      return
    }
    setCountdown({ progress, beats: beats.length, lit })
  }

  /** The singer's first steady note: where they came in. */
  const listenForEntry = (round: FirstNoteRound): void => {
    if (untrack(state).entry !== null) return
    const steady = firstSteadyNote(heard, {
      targetMidi: round.entry.midi,
      tolCents: ENTRY_STEADY_CENTS,
      landMs: ENTRY_MS,
      octaveFold: true,
      heldOver: false,
      centreTauSec: holdPresetFor(rules).centreTauSec,
      runGapSec: ENTRY_RUN_GAP_SEC,
    })
    if (steady === null) return
    const entry: EntryHeard = {
      cents: steady.cents,
      onNote: Math.abs(steady.cents) <= rules.tolCents,
    }
    dispatch({ type: 'entry', entry })
    setChip(entryChip(entry))
    if (entry.onNote) haptics.tapLight()
  }

  /** The singer's voice against the note: the trail, the band, Merc. */
  const hearVoice = (frame: PitchFrame, round: FirstNoteRound): void => {
    const target = round.entry.midi
    const point = trailPoint(frame, target)
    points.push(point)
    const off = offTarget(frame, target)
    if (off !== null) heard.push({ t: frame.t, cents: off })
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
      midi: target + point.cents / 100,
    }
  }

  const onEvent = (event: SequenceEvent, round: FirstNoteRound): void => {
    if (event.type === 'phraseEnd') return
    const outcome = engine.outcomes[event.index]
    if (outcome === undefined) return
    const entry = untrack(state).entry
    if (outcome.landed) {
      endRound({
        round,
        // A voice that landed before its entry was taken came in on it.
        entry: entry ?? { cents: outcome.cents, onNote: true },
        landed: true,
        seconds: Math.max(0, outcome.onset - engine.responseStart),
        voiced: true,
        heardAgain,
      })
    } else {
      endRound({
        round,
        entry,
        landed: false,
        seconds: null,
        voiced: outcome.voiced,
        heardAgain,
      })
    }
  }

  /** New captured frames: the turn's entry, trail and engine. */
  const follow = (
    frames: readonly PitchFrame[],
    round: FirstNoteRound,
  ): void => {
    const from = processed
    processed = frames.length
    for (let i = from; i < frames.length && listening; i++) {
      const frame = frames[i]
      if (phase() !== 'sing' || frame.t < engine.responseStart) continue
      hearVoice(frame, round)
      listenForEntry(round)
      engine = tickSequence(engine, frame, phraseOf(round), rules)
      for (const event of engine.events) {
        onEvent(event, round)
        if (phase() !== 'sing') return
      }
    }
  }

  /** The trail shows once the line would: from the start, or the entry on. */
  const trailShows = (): boolean =>
    rules.line === 'always' || untrack(state).entry !== null

  /** One screen frame while the room listens (frame-loop.ts). */
  function screenFrame(): void {
    const round = live()
    if (round === null) return
    if (phase() === 'band') countDown(round)
    const frames = capture.peekFrames()
    follow(frames, round)
    if (!listening) return
    if (phase() === 'sing') {
      const last = frames.length === 0 ? null : frames[frames.length - 1]
      loudness =
        last === null || last.t < engine.responseStart ? 0 : newestLevel(frames)
      sink(trailShows() ? { points, now: frameNow() } : null)
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
    const playing = player.line(round.song, round.entry)
    sound = playing
    nextAfter(playing.done, round.index)
  }

  /** After a miss: Merc sings the note, then the singer comes in. */
  const mercSingsTheNote = (round: FirstNoteRound): void => {
    const ctx = audio
    const midi = round.entry.midi
    if (ctx !== null) {
      mercSound = voiceOfMerc.sing(
        ctx,
        [{ midi, at: 0, seconds: MERC_NOTE_SECONDS }],
        ctx.currentTime + 0.1,
      )
    }
    voice = { voiced: true, cents: 0, level: SUNG_LEVEL, steady: 1, midi }
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

  /** A round is over: the song carries on, Merc's line, then the next entry. */
  function endRound(outcome: RoundOutcome): void {
    stopLoop()
    capture.takeFrames()
    dispatch({ type: 'outcome', outcome })
    const note = midiToNoteNameOctave(outcome.round.entry.midi)
    stopSound()
    if (outcome.landed) {
      haptics.tapLight()
      setChip(`First note: ${note}`)
      say(outcome.entry?.onNote === true ? 'landedOnNote' : 'landed', { note })
      merc.cheer()
      playLine(outcome.round)
    } else {
      setChip(`It was ${note}`)
      say(outcome.voiced ? 'missed' : 'missedSilent', { note })
      mercSingsTheNote(outcome.round)
    }
    setInBand(outcome.landed)
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
      say(resultMoment(shown, kept), {
        onNote: shown.onNote,
        found: shown.found,
        rounds: shown.rounds,
        level: levelName,
      })
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
    const from = phase()
    if (from !== 'intro' && from !== 'result' && from !== 'blocked') return
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
      onOpen: (_run, ctx) => {
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

  /** The lead-in again, in the singer's turn, as the level allows. */
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
    playLeadIn(round)
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
      exercise: EXERCISE_FIRST_NOTE_STAGE,
      on: () => isRunPhase(phase()) && phase() !== 'starting',
      died: stop,
    },
  })

  onCleanup(() => {
    stopLoop()
    stopSound()
    letGoOfSongs()
    life.dispose()
  })

  /** The note's line: by the level in the turn, and always once it is over. */
  const lineShown = (): boolean => {
    const now = state()
    const shows = level.preset().line
    switch (now.phase) {
      case 'band':
        return shows === 'always'
      case 'sing':
        return (
          shows === 'always' || (shows === 'afterEntry' && now.entry !== null)
        )
      case 'landed':
      case 'missed':
        return true
      default:
        return false
    }
  }

  return {
    state,
    line,
    chip,
    summary,
    resultLevel,
    round: () => liveRound(state()),
    rules: level.preset,
    lineShown,
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
    script: { active: () => false },
  }
}
