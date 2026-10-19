// ============================================================
// useRange: the range's controller (S7b beat 4)
// ============================================================
//
// Merc asks for a slide down, as low as feels easy, then one up, as high as
// feels easy. Each slide is one window of the room kit's capture, read once
// a screen frame (range-take.ts); the two together are the range, the Voice
// Mirror's computeRange. The ladder (range-ladder.ts) lights the rungs the
// voice dwelt on as it goes, and Merc climbs beside it at the voice's
// height: his `reach`, squashed low and stretched tall with the pitch, his
// colour going teal to violet with it (S7b §3.3).
//
// From the first note, Find my range opens the mic inside its own tap, so
// the slides start at once (`start`). Opened on its own (Keep's "Find your
// range first"), the range waits in `ready` for the mic's tap, with the
// house priming copy under it, since this may be the first time the app
// asks for the microphone.
//
// A measured range is saved at once, as an onboarding voiceprint
// (voiceprint-service.ts, as the web's First Light does): before any
// account is mentioned, and before the singer can back out of the reveal.
// It names the twin too (singerForRange), the one the reveal will find.
//
// A tap while it listens stops, and so does the page hiding, the app going,
// the mic dying under it or a minute of quiet: back to ready, the mic shut,
// the slides to do again from the first (REQ-NFL-037, REQ-NFL-046).

import type { Accessor } from 'solid-js'
import { batch, createMemo, createSignal, onCleanup, untrack } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
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
import { saveVoiceprint } from '@/db/services/voiceprint-service'
import { setSingMicGranted } from '@/features/sing-room/sing-room-settings'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { RangeResult } from '@/lib/mirror/metrics'
import { computeRange, summarize } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { exposeForE2E } from '@/lib/test-utils'
import { midiOf } from './note-lane'
import type { LadderView } from './range-ladder'
import { emptyLadder, growLadder, reachCents } from './range-ladder'
import type { RangeEvent, RangeLine, RangeState } from './range-machine'
import { RANGE_START, rangeLine, rangeReducer } from './range-machine'
import type { SlideReading } from './range-take'
import { heardFrame, readRange, readSlide, slideSoFar } from './range-take'
import { LANDED_MS, ONBOARDING_AUDIO_OWNER } from './useFirstNote'

/**
 * The range's id to the app's mic watchdog. Its own, beside the first
 * note's: the watchdog keeps one icon per id (mic-sentinel.ts), and the two
 * beats share one capture.
 */
export const RANGE_MIC_ID = 'native-onboarding-range'

/** The ladder is read again this often while a slide runs, ms. */
export const LADDER_EVERY_MS = 100

export interface RangeController {
  readonly state: Accessor<RangeState>
  /** Merc's line, or null (the mic's notice speaks in `blocked`). */
  readonly line: Accessor<RangeLine | null>
  readonly micState: Accessor<MicState>
  /** The singer's loudness, 0..1: read once a frame by the mic's ring. */
  readonly level: () => number
  readonly ladder: Accessor<LadderView>
  readonly mercState: Accessor<MercState>
  /** Read every frame by Merc's view. */
  readonly mercVoice: () => MercVoice
  /** Nothing moves: Merc keeps to the ladder's foot. */
  readonly still: () => boolean
  /** The slides start: call it inside the tap that asked for them. */
  readonly start: () => void
  /** The mic: start in ready or after a miss, stop while it listens. */
  readonly tapMic: () => void
  /** The mic's notice's Try again. */
  readonly retry: () => void
  /** The onboarding is leaving: the mic shut and nothing more read. */
  readonly leave: () => void
}

export interface RangeOptions {
  /** Defaults to the room kit's capture under ONBOARDING_AUDIO_OWNER. */
  readonly capture?: ExerciseCapture
  /** Reduced motion; defaults to the phone's own setting. */
  readonly still?: () => boolean
  /** The note held on the first beat, MIDI: the ladder starts around it. */
  readonly anchor?: () => number | null
  /** A range was measured. Defaults to saving it (saveRangeVoiceprint). */
  readonly onMeasured?: (range: RangeResult) => void
}

/** Keep a measured range as an onboarding voiceprint, twin and all. */
export function saveRangeVoiceprint(range: RangeResult): void {
  // Local first, and the local write cannot throw (voiceprint-service.ts);
  // a failed upload is logged there. Nothing here is the singer's to see.
  saveVoiceprint({
    summary: summarize({ range, accuracy: null, steadiness: null }),
    twin: singerForRange(range),
    source: 'onboarding',
  }).catch(() => undefined)
}

const listening = (phase: RangeState['phase']): boolean =>
  phase === 'starting' || phase === 'down' || phase === 'up'

export function useRange(options: RangeOptions = {}): RangeController {
  const life = createRoomLife()
  const capture =
    options.capture ?? useExerciseCapture(ONBOARDING_AUDIO_OWNER, 'Onboarding')
  const still = options.still ?? prefersReducedMotion
  const anchor = options.anchor ?? (() => null)
  const onMeasured = options.onMeasured ?? saveRangeVoiceprint

  const [state, setState] = createSignal<RangeState>(RANGE_START)
  const [reading, setReading] = createSignal<SlideReading | null>(null)
  const [ladder, setLadder] = createSignal<LadderView>(
    emptyLadder(untrack(anchor)),
  )
  const dispatch = (event: RangeEvent): void => {
    setState((now) => rangeReducer(now, event))
  }

  const merc: MercMoves = createMercMoves({
    later: life.later,
    still,
    afterCheer: () => 'idle',
  })
  life.later(LANDED_MS, () => {
    if (untrack(merc.state) === 'drop') merc.set('idle')
  })

  let level = 0
  let voice: MercVoice = SILENT_VOICE
  /** The first slide, once it is over. */
  let slides: PitchFrame[][] = []
  /** When the ladder was last read, performance.now() ms. */
  let ladderAt = Number.NEGATIVE_INFINITY
  /**
   * A rung has lit. Until one has, a fresh run centres the ladder on the
   * held note, which the first beat names after this controller is made.
   */
  let litOnce = false

  // ── The ladder ─────────────────────────────────────────────
  /**
   * A fresh run: nothing lit, no pins. Around the held note before any
   * rung has lit; after that, on the ladder as tall as it grew.
   */
  const clearLadder = (): void => {
    const empty = emptyLadder(untrack(anchor))
    setLadder(litOnce ? { ...empty, span: untrack(ladder).span } : empty)
  }

  /** The ladder from what the voice has given so far. */
  const readLadder = (
    frames: readonly PitchFrame[],
    now: SlideReading,
    heard: number | null,
  ): void => {
    const sofar =
      now.kind === 'sliding'
        ? [...slides, slideSoFar(frames, now.onset)]
        : slides
    const range = sofar.length === 0 ? null : computeRange(sofar)
    if (range !== null) litOnce = true
    const before = untrack(ladder)
    const low = range?.lowMidi ?? null
    const high = range?.highMidi ?? null
    setLadder({
      span: growLadder(before.span, low, high),
      lit: range?.qualifyingMidis ?? [],
      low,
      high,
      voice: heard ?? before.voice,
      locked: false,
    })
  }

  /** The measured range on the ladder: every rung between the pins, locked. */
  const lockLadder = (range: RangeResult): void => {
    litOnce = true
    const before = untrack(ladder)
    setLadder({
      span: growLadder(before.span, range.lowMidi, range.highMidi),
      lit: range.qualifyingMidis,
      low: range.lowMidi,
      high: range.highMidi,
      voice: before.voice,
      locked: true,
    })
  }

  // ── The slides ─────────────────────────────────────────────
  const running = (): boolean => {
    const { phase } = untrack(state)
    return phase === 'down' || phase === 'up'
  }
  const loop = createFrameLoop(screenFrame, { alive: life.alive, running })

  /** The mic shut and the loop stopped; Merc at rest. */
  const shut = (): void => {
    loop.stop()
    capture.release()
    level = 0
    voice = SILENT_VOICE
    setReading(null)
  }

  /** Back to ready: the mic shut, the slides to do again. */
  const stopListening = (): void => {
    if (!listening(untrack(state).phase)) return
    shut()
    slides = []
    dispatch({ type: 'stop' })
    merc.set('idle')
    clearLadder()
  }

  /** The second slide is over: a range, or another go. */
  const measure = (): void => {
    const outcome = readRange(slides)
    shut()
    slides = []
    dispatch({ type: 'measured', outcome })
    if (outcome.kind === 'range') {
      lockLadder(outcome.range)
      merc.cheer()
      onMeasured(outcome.range)
      return
    }
    merc.set('idle')
  }

  function screenFrame(): void {
    const { phase } = untrack(state)
    if (phase !== 'down' && phase !== 'up') return
    const frames = capture.peekFrames()
    const newest = frames.length === 0 ? null : frames[frames.length - 1]
    level = newestLevel(frames)
    const heard =
      newest !== null && heardFrame(newest) ? midiOf(newest.f0) : null
    // His reach reads the voice's height on the ladder as it now stands.
    voice =
      heard === null
        ? { ...SILENT_VOICE, level }
        : {
            voiced: true,
            cents: reachCents(heard, untrack(ladder).span),
            level,
            steady: 1,
            midi: heard,
          }
    const now = readSlide(frames)
    setReading(now)

    if (now.kind === 'done') {
      slides = [...slides, [...now.frames]]
      if (phase === 'down') {
        dispatch({ type: 'slid' })
        // The second slide: a new window, a new floor.
        capture.startWindow()
        setReading(null)
        readLadder([], { kind: 'floor' }, heard)
        return
      }
      measure()
      return
    }

    const at = performance.now()
    if (at - ladderAt >= LADDER_EVERY_MS) {
      ladderAt = at
      readLadder(frames, now, heard)
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
    if (phase !== 'ready' && phase !== 'missed' && phase !== 'blocked') return
    slides = []
    batch(() => {
      dispatch({ type: 'start' })
      clearLadder()
    })
    merc.set('listen')
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      onOpen: (run) => {
        dispatch({ type: 'mic-ready', run })
        setSingMicGranted(true)
        merc.set('reach')
        ladderAt = Number.NEGATIVE_INFINITY
        capture.startWindow()
        loop.start()
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
    listening: () => listening(state().phase),
    demo: { on: () => false, playing: () => false },
    mic: {
      exercise: RANGE_MIC_ID,
      on: () => running(),
      died: stopListening,
    },
  })

  onCleanup(() => {
    loop.stop()
    capture.release()
    life.dispose()
  })

  // Where the slides stand, for the bundle probe's walk (E2E only).
  exposeForE2E('mpOnboardingRange', () => {
    const frames = capture.peekFrames()
    const now = untrack(state)
    const shown = untrack(ladder)
    return {
      phase: now.phase,
      miss: now.miss,
      reading: untrack(reading)?.kind ?? null,
      slides: slides.length,
      frames: frames.length,
      heard: frames.filter(heardFrame).length,
      newest: frames.length === 0 ? 0 : frames[frames.length - 1].t,
      low: shown.low,
      high: shown.high,
    }
  })

  const line = createMemo(() => rangeLine(state(), reading()))

  const micState = createMemo<MicState>(() => {
    switch (state().phase) {
      case 'starting':
        return 'wait'
      case 'down':
      case 'up':
        return 'sing'
      case 'done':
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
    ladder,
    mercState: merc.state,
    mercVoice: () => voice,
    still,
    start,
    tapMic: () => {
      if (listening(untrack(state).phase)) stopListening()
      else start()
    },
    retry: start,
    leave: shut,
  }
}
