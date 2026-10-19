// ============================================================
// useFirstNote: the first note's controller (S7b beats 2 and 3)
// ============================================================
//
// Merc says hello and asks for one note: drops in and says it, unless he
// said hello in the alley this session (S7b beat 1, alley-greeting.ts),
// when he is there already and asks at once. Until the singer taps, the lane
// plays a silent example line and nothing is captured: no mic, no audio
// clock, no prompt (REQ-NFL-019, REQ-NFL-020). The tap opens the mic inside
// itself (room-kit room-mic.ts, REQ-NFL-028), through the room kit's
// capture, so the mic manager and the mic's watchdog own it (REQ-NFL-036).
// Then the take is read once a screen frame (first-note.ts): the room's
// floor, a voiced onset, three seconds (up to six on a screen too slow to
// have heard enough), a settled note. The voice is drawn as it comes, and
// the note is named only from a settled reading.
//
// A tap while it listens stops, and so does the page hiding, the app going
// or the mic dying under it: back to hello, the mic shut (REQ-NFL-037,
// REQ-NFL-046). A minute with no voice shuts it as well, as in the rooms.
//
// A grant here is the Sing room's grant too (sing-room-settings.ts): the
// room under the onboarding then skips its own priming screen and arrives
// live (REQ-NFL-027), and a refusal makes its remembered grant a lie, so
// it is taken back.

import type { Accessor } from 'solid-js'
import { batch, createMemo, createSignal, onCleanup, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import type { StrokePoint } from '@/components/room-kit/GlideRibbon'
import type { MercMoves } from '@/components/room-kit/merc-moves'
import { createMercMoves } from '@/components/room-kit/merc-moves'
import type { MicState } from '@/components/room-kit/mic-state'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { QUIET_LIMIT_SECONDS, SILENT_VOICE, } from '@/components/room-kit/room-constants'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import type { CaptureFailure, ExerciseCapture, } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { newestLevel } from '@/components/room-kit/voice-level'
import type { SettledNote } from '@/features/onboarding/settled-note'
import { setSingMicGranted } from '@/features/sing-room/sing-room-settings'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { CONF_MIN } from '@/lib/pitch-measurements/f0'
import { exposeForE2E } from '@/lib/test-utils'
import { alleyGreeted } from './alley-greeting'
import type { TakeReading } from './first-note'
import { readTake } from './first-note'
import type { NoteEvent, NoteLine, NoteState } from './first-note-machine'
import { FIRST_NOTE_START, firstNoteLine, firstNoteReducer, } from './first-note-machine'
import type { LaneBox } from './note-lane'
import { DEMO_MIDI, DEMO_SEC, demoClock, demoFrames, laneReference, midiOf, voiceStrokes, } from './note-lane'

/** The capture's owner, to the mic manager, the audio lease and the watchdog. */
export const ONBOARDING_AUDIO_OWNER = 'native-onboarding'

/** Merc's drop lands and settles into his idle breath by then, ms. */
export const LANDED_MS = 1300
/** His hello has its moment, then the ask takes its place, ms. */
export const GREET_MS = 2200

/** What the lane is for the controller: its box, and the ribbon on it. */
export interface LaneHost {
  /** The lane's box now, or null before it has a size. */
  readonly box: () => LaneBox | null
  readonly draw: (
    strokes: readonly (readonly StrokePoint[])[],
    scale: number,
  ) => void
}

export interface FirstNoteController {
  readonly state: Accessor<NoteState>
  /** Merc's line, or null (the mic's notice speaks in `blocked`). */
  readonly line: Accessor<NoteLine | null>
  readonly micState: Accessor<MicState>
  /** The singer's loudness, 0..1: read once a frame by the mic's ring. */
  readonly level: () => number
  /** The example line is on the lane, and labelled. */
  readonly demo: Accessor<boolean>
  readonly mercState: Accessor<MercState>
  /** Read every frame by Merc's view. */
  readonly mercVoice: () => MercVoice
  /** Nothing moves: the example drawn whole, Merc without his drop. */
  readonly still: () => boolean
  readonly attachLane: (lane: LaneHost) => void
  /** The mic: start in hello or after a miss, stop while it listens. */
  readonly tapMic: () => void
  /** The mic's notice's Try again. */
  readonly retry: () => void
  /** The lane changed size: draw what it shows again. */
  readonly redraw: () => void
  /** The onboarding is leaving: the mic shut and nothing more drawn. */
  readonly leave: () => void
}

export interface FirstNoteOptions {
  /** Defaults to the room kit's capture under ONBOARDING_AUDIO_OWNER. */
  readonly capture?: ExerciseCapture
  /** Reduced motion; defaults to the phone's own setting. */
  readonly still?: () => boolean
  /**
   * Merc has said hello in the alley this session: no drop, no hello, the
   * ask at once. Defaults to alley-greeting.ts.
   */
  readonly greeted?: boolean
}

export function useFirstNote(
  options: FirstNoteOptions = {},
): FirstNoteController {
  const life = createRoomLife()
  const capture =
    options.capture ?? useExerciseCapture(ONBOARDING_AUDIO_OWNER, 'Onboarding')
  const still = options.still ?? prefersReducedMotion

  const [state, setState] = createSignal<NoteState>(FIRST_NOTE_START)
  const [reading, setReading] = createSignal<TakeReading | null>(null)
  const metInAlley = options.greeted ?? alleyGreeted()
  const [greeted, setGreeted] = createSignal(metInAlley)
  const [demo, setDemo] = createSignal(true)
  const dispatch = (event: NoteEvent): void => {
    setState((now) => firstNoteReducer(now, event))
  }

  const merc: MercMoves = createMercMoves({
    later: life.later,
    still,
    afterCheer: () => 'idle',
  })
  if (metInAlley) merc.set('idle')
  else {
    life.later(LANDED_MS, () => {
      if (untrack(merc.state) === 'drop') merc.set('idle')
    })
    life.later(GREET_MS, () => setGreeted(true))
  }

  let level = 0
  let voice: MercVoice = SILENT_VOICE

  // ── The lane ───────────────────────────────────────────────
  let lane: LaneHost | null = null
  const scaleOf = (box: LaneBox): number => box.width / 390

  const drawFrames = (
    frames: readonly PitchFrame[],
    now: number,
    ref: number | null,
  ): void => {
    const box = lane?.box() ?? null
    if (lane === null || box === null) return
    lane.draw(
      ref === null ? [] : voiceStrokes(frames, now, box, ref),
      scaleOf(box),
    )
  }

  // The example: drawn on its own clock while it is on the lane, or whole
  // and still under reduced motion.
  const example = demoFrames(DEMO_SEC)
  let demoStarted = 0
  let demoFrame = 0
  const drawExample = (at: number): void => {
    drawFrames(
      example.filter((frame) => frame.t <= at),
      at,
      DEMO_MIDI,
    )
  }
  const exampleTick = (now: number): void => {
    demoFrame = 0
    if (!life.alive() || !untrack(demo)) return
    drawExample(demoClock((now - demoStarted) / 1000))
    demoFrame = requestAnimationFrame(exampleTick)
  }
  const startExample = (): void => {
    setDemo(true)
    if (demoFrame !== 0) cancelAnimationFrame(demoFrame)
    demoFrame = 0
    if (untrack(still)) {
      drawExample(DEMO_SEC)
      return
    }
    demoStarted = performance.now()
    demoFrame = requestAnimationFrame(exampleTick)
  }
  const stopExample = (): void => {
    setDemo(false)
    if (demoFrame !== 0) cancelAnimationFrame(demoFrame)
    demoFrame = 0
    drawFrames([], 0, null)
  }

  // ── The take ───────────────────────────────────────────────
  const running = (): boolean => untrack(state).phase === 'listen'
  const loop = createFrameLoop(screenFrame, { alive: life.alive, running })

  /** The mic shut and the loop stopped; Merc and the lane at rest. */
  const shut = (): void => {
    loop.stop()
    capture.release()
    level = 0
    voice = SILENT_VOICE
    setReading(null)
  }

  /** Back to hello: the mic shut, the example on the lane again. */
  const stopListening = (): void => {
    const { phase } = untrack(state)
    if (phase !== 'starting' && phase !== 'listen') return
    shut()
    dispatch({ type: 'stop' })
    merc.set('idle')
    startExample()
  }

  /** The take is over: a note named, or a miss. */
  const settle = (note: SettledNote | null): void => {
    if (note !== null) {
      shut()
      dispatch({ type: 'heard', note })
      merc.cheer()
      return
    }
    dispatch({ type: 'missed' })
    if (untrack(state).phase === 'listen') {
      // Listening again by itself: a new window, a new floor.
      capture.startWindow()
      setReading(null)
      return
    }
    shut()
    merc.set('idle')
    startExample()
  }

  function screenFrame(): void {
    if (untrack(state).phase !== 'listen') return
    const frames = capture.peekFrames()
    const newest = frames.length === 0 ? null : frames[frames.length - 1]
    level = newestLevel(frames)
    const ref = laneReference(frames)
    voice =
      newest !== null && newest.f0 > 0
        ? {
            voiced: true,
            cents: 0,
            level,
            steady: 1,
            midi: midiOf(newest.f0),
          }
        : { ...SILENT_VOICE, level }
    drawFrames(frames, newest?.t ?? 0, ref)
    const now = readTake(frames)
    setReading(now)
    if (now.kind === 'done') {
      settle(now.note)
      return
    }
    // A minute and no voice: the mic goes back, as in every room.
    if (
      now.kind === 'waiting' &&
      newest !== null &&
      newest.t >= QUIET_LIMIT_SECONDS
    ) {
      stopListening()
    }
  }

  const start = (): void => {
    const { phase } = untrack(state)
    if (phase !== 'hello' && phase !== 'missed' && phase !== 'blocked') return
    batch(() => {
      dispatch({ type: 'start' })
      stopExample()
    })
    merc.set('listen')
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      onOpen: (run) => {
        dispatch({ type: 'mic-ready', run })
        setSingMicGranted(true)
        capture.startWindow()
        loop.start()
      },
      onFail: (run, block: CaptureFailure) => {
        dispatch({ type: 'mic-failed', run, block })
        if (block === 'denied') setSingMicGranted(false)
        merc.set('idle')
        startExample()
      },
      // The page went while the mic opened.
      onHidden: stopListening,
    })
  }

  // Leaving the page, or the app, or the mic dying: back to hello. The
  // screen stays on while it listens.
  life.watch({
    leave: stopListening,
    listening: () => {
      const { phase } = state()
      return phase === 'starting' || phase === 'listen'
    },
    demo: { on: () => false, playing: () => false },
    mic: {
      exercise: ONBOARDING_AUDIO_OWNER,
      on: () => untrack(state).phase === 'listen',
      died: stopListening,
    },
  })

  onCleanup(() => {
    loop.stop()
    if (demoFrame !== 0) cancelAnimationFrame(demoFrame)
    demoFrame = 0
    capture.release()
    life.dispose()
  })

  // What the take stands on, for the bundle probe's walk (E2E only): a
  // walk that hears no note can then say whether the window had any voice.

  exposeForE2E('mpOnboarding', () => {
    const frames = capture.peekFrames()
    const now = untrack(state)
    return {
      phase: now.phase,
      misses: now.misses,
      reading: untrack(reading)?.kind ?? null,
      frames: frames.length,
      voiced: frames.filter((frame) => frame.f0 > 0).length,
      sure: frames.filter((frame) => frame.f0 > 0 && frame.conf >= CONF_MIN)
        .length,
      newest: frames.length === 0 ? 0 : frames[frames.length - 1].t,
    }
  })

  const line = createMemo(() => firstNoteLine(state(), reading(), greeted()))

  const micState = createMemo<MicState>(() => {
    switch (state().phase) {
      case 'starting':
        return 'wait'
      case 'listen':
        return 'sing'
      case 'heard':
        return 'done'
      default:
        return 'ready'
    }
  })

  return {
    state,
    line,
    micState,
    level: () => level,
    demo,
    mercState: merc.state,
    mercVoice: () => voice,
    still,
    attachLane: (host) => {
      lane = host
      if (untrack(demo)) startExample()
    },
    tapMic: () => {
      const { phase } = untrack(state)
      if (phase === 'starting' || phase === 'listen') stopListening()
      else start()
    },
    retry: start,
    redraw: () => {
      if (!untrack(demo)) return
      if (untrack(still)) drawExample(DEMO_SEC)
    },
    leave: () => {
      shut()
      if (demoFrame !== 0) cancelAnimationFrame(demoFrame)
      demoFrame = 0
    },
  }
}
