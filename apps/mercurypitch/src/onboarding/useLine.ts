// ============================================================
// useLine: the sung line's controller (S7b beat 8)
// ============================================================
//
// Merc asks: "Sing this line with me." The tap opens the mic inside it, as
// every beat's does, and the audio clock with it: Merc sings the line once,
// in his recorded voice (merc-call.ts, as Echo's calls), the words lighting
// as he goes. Then the singer's turn: two beats counted in by the cursor,
// then the line, the words lighting under the cursor and the voice drawn
// over the notes. Once the line is over the mic shuts and the Karaoke
// engine scores it (line-score.ts): "8 of 10 notes on pitch", and Merc says
// how it went (onboarding-copy.ts lineVerdict). Once more sings it again
// from Merc's call; a turn with no voice in it asks for one.
//
// CALL AND RESPONSE, NOT A SING-ALONG. The mic is raw (echo cancellation
// would bend the pitch), so whatever the phone plays while the singer
// sings reaches the mic, and a line sung over Merc's voice would be scored
// on his. So the singer hears the line first and sings it alone: the turn
// plays nothing. Singing along with his call is fine; it is not scored.
//
// ONE WINDOW, ONE CLOCK. The capture window opens as the call is
// scheduled, so the frames' clock and the audio clock meet there
// (scheduleCall). The call's notes, its end, the count-in and the line are
// all times on that clock, and each screen frame moves on by the newest
// frame's time. The turn starts RESPONSE_GATE_SECONDS after the call ends
// (Merc's voice reaching the mic, as in Echo).
//
// A tap while it listens stops, and so does the page hiding, the app
// going, or the mic dying: back to ready, the mic shut, the call to come
// again (REQ-NFL-037, REQ-NFL-046).

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import type { MercMoves } from '@/components/room-kit/merc-moves'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import type { MicState } from '@/components/room-kit/mic-state'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import type { CaptureFailure, ExerciseCapture, } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { newestLevel } from '@/components/room-kit/voice-level'
import { CALL_LEAD_SECONDS } from '@/features/echo/echo-controller-contract'
import type { CallVoice } from '@/features/echo/merc-call'
import { scheduleCall } from '@/features/echo/merc-call'
import { MERC_CALL, preloadMercVoice } from '@/features/echo/merc-sampler'
import { setSingMicGranted } from '@/features/sing-room/sing-room-settings'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { RESPONSE_GATE_SECONDS } from '@/lib/sequence/sequence-engine'
import { exposeForE2E } from '@/lib/test-utils'
import type { LineEvent, LineSays, LineState } from './line-machine'
import { LINE_START, lineListening, lineReducer, lineSays, } from './line-machine'
import { heardInLine, MAX_LAG_SEC, scoreLine } from './line-score'
import { midiOf } from './note-lane'
import { heardFrame } from './range-take'
import type { TimedNote } from './sung-line'
import { LINE, LINE_BEAT_SEC, lineNotes, linePhrase } from './sung-line'
import { ONBOARDING_AUDIO_OWNER } from './useFirstNote'

/** The line's id to the app's mic watchdog (mic-sentinel.ts). */
export const LINE_MIC_ID = 'native-onboarding-line'

/** The count-in before the singer's line: two beats, s. */
export const COUNT_IN_SEC = 2 * LINE_BEAT_SEC

/**
 * After the line's last note, the mic listens on while a late answer can
 * still end (MAX_LAG_SEC), and a little more, s.
 */
export const TURN_TAIL_SEC = MAX_LAG_SEC + 0.1

/**
 * How far the frames' clock may fall behind the wall clock before the wall
 * clock moves the line on, s: a mic that went quiet under the page still
 * ends the turn, and the line is scored on what came.
 */
export const LATE_FRAMES_SEC = 3

/** A point of the voice drawn: its time on the line's own clock and its note. */
export interface TracePoint {
  /** Seconds from the line's first note. */
  readonly at: number
  /** The note, folded to the octave of the note it is sung against. */
  readonly midi: number
  /** The voice was gone before it: a new stroke starts here. */
  readonly fresh: boolean
}

/** Where the line is: whose pass, and how far, s from its first note. */
export interface LineCursor {
  readonly pass: 'call' | 'turn'
  readonly at: number
}

export interface LineController {
  readonly state: Accessor<LineState>
  /** Which of Merc's lines, or null (the mic's notice speaks in `blocked`). */
  readonly says: Accessor<LineSays | null>
  readonly micState: Accessor<MicState>
  /** The singer's loudness, 0..1: read once a frame by the mic's ring. */
  readonly level: () => number
  /** The tonic the line is sung from, MIDI. */
  readonly tonic: Accessor<number>
  readonly cursor: Accessor<LineCursor | null>
  /** The singer's voice over the line, in the turn and after it. */
  readonly trace: Accessor<readonly TracePoint[]>
  readonly mercState: Accessor<MercState>
  /** Read every frame by Merc's view. */
  readonly mercVoice: () => MercVoice
  readonly still: () => boolean
  /** The beat has come: Merc's voice starts loading. */
  readonly arrive: () => void
  /** The mic: start when it is down, stop while it listens. */
  readonly tapMic: () => void
  /** Once more, and the mic's notice's Try again: from Merc's call. */
  readonly again: () => void
  /** The onboarding is leaving: the mic shut and nothing more read. */
  readonly leave: () => void
}

export interface LineOptions {
  /** Defaults to the room kit's capture under ONBOARDING_AUDIO_OWNER. */
  readonly capture?: ExerciseCapture
  /** The tonic to sing from, read as each start begins (sung-line.ts lineTonic). */
  readonly tonic: () => number
  /** Reduced motion; defaults to the phone's own setting. */
  readonly still?: () => boolean
  /** Merc's voice; his recorded one (MERC_CALL) by default. */
  readonly voice?: CallVoice
  /** Loads Merc's voice; preloadMercVoice by default. */
  readonly preload?: () => Promise<unknown>
}

/** Merc's call under way, on the frames' clock. */
interface LiveCall {
  readonly notes: readonly TimedNote[]
  readonly endsAt: number
  readonly stop: () => void
}

/** A voice folded to the octave of `target`. */
const foldNear = (midi: number, target: number): number =>
  midi + 12 * Math.round((target - midi) / 12)

/** The note sounding at `t`, or the nearest in time. */
function noteNear(notes: readonly TimedNote[], t: number): TimedNote {
  let best = notes[0]
  let gap = Number.POSITIVE_INFINITY
  for (const note of notes) {
    const away = t < note.from ? note.from - t : t >= note.to ? t - note.to : 0
    if (away < gap) {
      best = note
      gap = away
    }
  }
  return best
}

/** The voice comes back after this long without it as a new stroke, s. */
const STROKE_GAP_SEC = 0.15
/** A point is drawn at most this often, s. */
const POINT_EVERY_SEC = 0.03

export function useLine(options: LineOptions): LineController {
  const life = createRoomLife()
  const capture =
    options.capture ?? useExerciseCapture(ONBOARDING_AUDIO_OWNER, 'Onboarding')
  const still = options.still ?? prefersReducedMotion
  const voiceOfMerc = options.voice ?? MERC_CALL
  const preload = options.preload ?? preloadMercVoice

  const [state, setState] = createSignal<LineState>(LINE_START)
  const [tonic, setTonic] = createSignal(untrack(options.tonic))
  const [cursor, setCursor] = createSignal<LineCursor | null>(null)
  const [trace, setTrace] = createSignal<readonly TracePoint[]>([])
  const dispatch = (event: LineEvent): void => {
    setState((now) => lineReducer(now, event))
  }

  const merc: MercMoves = createMercMoves({
    later: life.later,
    still,
    afterCheer: () => 'idle',
  })

  let level = 0
  let voice: MercVoice = SILENT_VOICE
  let call: LiveCall | null = null
  /** The singer's line on the frames' clock, once the turn is set. */
  let turn: readonly TimedNote[] | null = null
  /** The wall clock as the window opened, performance.now() ms. */
  let windowAt = 0
  /** The frames read into the trace so far. */
  let traced = 0
  let lastPoint: TracePoint | null = null
  let lastHeardAt = Number.NEGATIVE_INFINITY

  const running = (): boolean => {
    const { phase } = untrack(state)
    return phase === 'call' || phase === 'turn'
  }
  const loop = createFrameLoop(screenFrame, { alive: life.alive, running })

  /** The mic shut, the call stopped and the loop with it. */
  const shut = (): void => {
    loop.stop()
    call?.stop()
    call = null
    capture.release()
    level = 0
    voice = SILENT_VOICE
  }

  /** Back to ready: the mic shut, the call to come again. */
  const stopListening = (): void => {
    if (!lineListening(untrack(state).phase)) return
    shut()
    turn = null
    dispatch({ type: 'stop' })
    merc.set('idle')
    setCursor(null)
    setTrace([])
  }

  /** The singer's turn is over: a score, or no voice heard in it. */
  const finish = (): void => {
    const notes = turn
    const frames = capture.takeFrames()
    shut()
    setCursor(null)
    if (notes === null) return
    if (!heardInLine(frames, notes)) {
      dispatch({ type: 'unheard' })
      merc.set('idle')
      return
    }
    const score = scoreLine(frames, notes)
    dispatch({ type: 'scored', score })
    if (score.hit / score.total >= 0.7) merc.cheer()
    else merc.set('idle')
  }

  /** New heard frames into the trace, against the singer's line. */
  const traceFrames = (
    frames: readonly PitchFrame[],
    notes: readonly TimedNote[],
  ): void => {
    const added: TracePoint[] = []
    for (; traced < frames.length; traced++) {
      const frame = frames[traced]
      if (frame.t < notes[0].from - COUNT_IN_SEC || !heardFrame(frame)) {
        continue
      }
      const fresh = frame.t - lastHeardAt > STROKE_GAP_SEC
      lastHeardAt = frame.t
      const at = frame.t - notes[0].from
      if (!fresh && lastPoint !== null && at - lastPoint.at < POINT_EVERY_SEC) {
        continue
      }
      const point = {
        at,
        midi: foldNear(midiOf(frame.f0), noteNear(notes, frame.t).midi),
        fresh,
      }
      added.push(point)
      lastPoint = point
    }
    if (added.length > 0) setTrace((now) => [...now, ...added])
  }

  function screenFrame(): void {
    const { phase } = untrack(state)
    const live = call
    if ((phase !== 'call' && phase !== 'turn') || live === null) return
    const frames = capture.peekFrames()
    const newest = frames.length === 0 ? 0 : frames[frames.length - 1].t
    // The frames' clock; the wall clock, LATE_FRAMES_SEC behind, only when
    // the frames have stopped coming (a mic gone quiet under the page).
    const wall = (performance.now() - windowAt) / 1000
    const now = Math.max(newest, wall - LATE_FRAMES_SEC)
    level = newestLevel(frames)

    if (phase === 'call') {
      const sounding = live.notes.find(
        (note) => now >= note.from && now < note.to,
      )
      voice =
        sounding === undefined
          ? SILENT_VOICE
          : {
              voiced: true,
              cents: 0,
              level: 0.6,
              steady: 1,
              midi: sounding.midi,
            }
      setCursor({ pass: 'call', at: now - live.notes[0].from })
      const turnAt = live.endsAt + RESPONSE_GATE_SECONDS
      if (now < turnAt) return
      turn = lineNotes(untrack(tonic), turnAt + COUNT_IN_SEC)
      voice = SILENT_VOICE
      dispatch({ type: 'turn' })
      setCursor({ pass: 'turn', at: now - turn[0].from })
      merc.set('listen')
      return
    }

    const notes = turn
    if (notes === null) return
    voice = { ...SILENT_VOICE, level }
    traceFrames(frames, notes)
    setCursor({ pass: 'turn', at: now - notes[0].from })
    if (now >= notes[notes.length - 1].to + TURN_TAIL_SEC) finish()
  }

  /** Merc's call: on the clock when there is one, else drawn unheard. */
  const beginCall = (clock: AudioContext | null): void => {
    capture.startWindow()
    windowAt = performance.now()
    traced = 0
    lastPoint = null
    lastHeardAt = Number.NEGATIVE_INFINITY
    turn = null
    setTrace([])
    const phrase = linePhrase(untrack(tonic))
    if (clock === null) {
      const notes = lineNotes(untrack(tonic), CALL_LEAD_SECONDS)
      call = {
        notes,
        endsAt: notes[notes.length - 1].to,
        stop: () => undefined,
      }
    } else {
      const scheduled = scheduleCall(
        voiceOfMerc,
        clock,
        phrase,
        CALL_LEAD_SECONDS,
      )
      call = {
        notes: scheduled.notes.map((note, index) => ({ ...note, index })),
        endsAt: scheduled.endsAt,
        stop: () => scheduled.sound.stop(),
      }
    }
    merc.set('sing')
    loop.start()
  }

  const start = (): void => {
    if (lineListening(untrack(state).phase)) return
    setTonic(untrack(options.tonic))
    setCursor(null)
    setTrace([])
    dispatch({ type: 'start' })
    merc.set('listen')
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      clock: true,
      onOpen: (run, clock) => {
        dispatch({ type: 'mic-ready', run })
        setSingMicGranted(true)
        beginCall(clock)
      },
      onFail: (run, block: CaptureFailure) => {
        dispatch({ type: 'mic-failed', run, block })
        if (block === 'denied') setSingMicGranted(false)
        merc.set('idle')
      },
      // The page went while the mic opened.
      onHidden: stopListening,
    })
  }

  // Leaving the page, or the app, or the mic dying: back to ready. The
  // screen stays on while it listens.
  life.watch({
    leave: stopListening,
    listening: () => lineListening(state().phase),
    demo: { on: () => false, playing: () => false },
    mic: {
      exercise: LINE_MIC_ID,
      on: () => running(),
      died: stopListening,
    },
  })

  onCleanup(() => {
    shut()
    life.dispose()
  })

  // Where the line stands, for the bundle probe's walk (E2E only).
  exposeForE2E('mpOnboardingLine', () => {
    const frames = capture.peekFrames()
    const now = untrack(state)
    return {
      phase: now.phase,
      tonic: untrack(tonic),
      frames: frames.length,
      heard: frames.filter(heardFrame).length,
      newest: frames.length === 0 ? 0 : frames[frames.length - 1].t,
      hit: now.score?.hit ?? null,
      total: now.score?.total ?? null,
      lag: now.score?.lag ?? null,
    }
  })

  const micState = createMemo<MicState>(() => {
    switch (state().phase) {
      case 'starting':
      case 'call':
        return 'wait'
      case 'turn':
        return 'sing'
      case 'done':
        return 'done'
      default:
        return 'ready'
    }
  })

  const says = createMemo(() => lineSays(state()))

  return {
    state,
    says,
    micState,
    level: () => level,
    tonic,
    cursor,
    trace,
    mercState: merc.state,
    mercVoice: () => voice,
    still,
    arrive: () => {
      void preload().catch(() => null)
      merc.set('idle')
    },
    tapMic: () => {
      if (lineListening(untrack(state).phase)) stopListening()
      else start()
    },
    again: start,
    leave: shut,
  }
}

/** How many of the line's notes the cursor has passed on this pass. */
export function notesPassed(cursor: LineCursor | null): number {
  if (cursor === null) return 0
  return LINE.filter((note) => cursor.at >= note.at).length
}
