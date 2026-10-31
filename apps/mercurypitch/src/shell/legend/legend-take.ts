// ============================================================
// Legend take — one sung pass of a Legend, in the native room
// ============================================================
//
// The room's half that hears the singer. It keeps every rule the web's
// stage keeps, and none of its chrome:
//
//   - Never transposed. The line is sung at its written pitch: no octave
//     shift reaches the session (MISTAKES.md, "Never transpose a weekly
//     challenge to the singer's range").
//   - One armed attempt counts once. A ranked take arms the attempt in the
//     tap that starts it; practice clears any; and whatever happens after,
//     the attempt is let go when the singer leaves the take or the room.
//     The web stage could leave one armed after a failed save, and the next
//     sight-singing drill would then have posted to the Legend board.
//   - The same scoring and the same funnel. The zen session hears the line
//     (one pass, `loopLimit: 1`), `summarizeChallengeRun` scores it, and a
//     ranked take goes through `recordChallengeStageResult` to the board,
//     exactly as the web's stage does. With no take recorder on the phone,
//     the replay is reported unsupported, which never costs the score.
//   - The room shows its own result. The attempt names the room as its
//     presenter, so its saving and its result never reach the app's card
//     (challenge-result-store.ts).
//
// The mic is the premium rooms' (useExerciseCapture), opened inside the
// singer's tap (openRoomMic). Its frames are handed to the session as the
// web's practice frames, on the same clock. A take ends when the page or
// the app goes, as every premium room's does (room-life.ts), and nothing
// is recorded for it.

import type { Accessor } from 'solid-js'
import { createEffect, createRoot, createSignal, onCleanup, untrack, } from 'solid-js'
import { createFrameLoop } from '@/components/room-kit/frame-loop'
import { createRoomLife } from '@/components/room-kit/room-life'
import { openRoomMic } from '@/components/room-kit/room-mic'
import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import { useExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import { clearRoomChallengeResult, roomChallengeResult, roomFinalizing, } from '@/features/challenges/challenge-result-store'
import type { ChallengeRunSummary } from '@/features/challenges/challenge-stage-model'
import { challengeToZenExercise, summarizeChallengeRun, } from '@/features/challenges/challenge-stage-model'
import { recordChallengeStageResult } from '@/features/challenges/challenge-stage-voice-take'
import { activeWeeklyAttempt, beginWeeklyAttempt, clearWeeklyAttempt, } from '@/features/challenges/weekly-attempt'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import type { PracticeFrame } from '@/features/practice/usePracticeController'
import type { ZenPitchPoint, ZenPitchRun } from '@/features/zen/types'
import type { ZenPitchSession } from '@/features/zen/useZenPitchSession'
import { useZenPitchSession } from '@/features/zen/useZenPitchSession'
import type { ExerciseResult } from '@/lib/domain/exercise-contracts'
import { frequencyToMidi, midiToNoteName } from '@/lib/frequency-to-note'
import { setExerciseFocus } from '@/stores/native-shell-store'
import type { PitchResult } from '@/types'

/** The mic's owner, and the exercise its icon belongs to. */
export const LEGEND_OWNER = 'weekly-legend'

/** A take on the board, or practice that is never recorded. */
export type TakeKind = 'ranked' | 'practice'

/**
 * `idle` at the room's door; `starting` while the mic opens; `live` while
 * the line plays and the room hears it; `result` once it is scored;
 * `blocked` when the mic would not open.
 */
export type TakePhase = 'idle' | 'starting' | 'live' | 'result' | 'blocked'

export interface TakeState {
  readonly phase: TakePhase
  /** The number of the room's last start. */
  readonly run: number
}

/** What a scored take keeps: its trace, frozen, and its score. */
export interface TakeOutcome {
  readonly points: ZenPitchPoint[]
  readonly summary: ChallengeRunSummary
}

/** Where a ranked take's save stands. */
export type SaveState = 'saving' | 'posted' | 'failed'

export interface LegendTake {
  readonly state: Accessor<TakeState>
  readonly kind: Accessor<TakeKind>
  /** The Legend the take is of, from its start until the room's door. */
  readonly challenge: Accessor<WeeklyChallenge | null>
  readonly block: Accessor<CaptureFailure | null>
  /** The take's session, while it has one. */
  readonly session: Accessor<ZenPitchSession | null>
  readonly outcome: Accessor<TakeOutcome | null>
  /** A ranked take's save, once it is scored; null for practice. */
  readonly saveState: Accessor<SaveState | null>
  /** The line plays, at its written pitch. */
  readonly linePlaying: Accessor<boolean>
  /** Start a take: call it inside the singer's tap, the mic opens in it. */
  readonly start: (challenge: WeeklyChallenge, kind: TakeKind) => void
  /** End the take now and score what was sung, as the web's End & score. */
  readonly stop: () => void
  /** From a result or a blocked mic, back to the room's door. */
  readonly done: () => void
  /** Play the line, or stop it playing. The first note plays in the tap. */
  readonly playLine: (challenge: WeeklyChallenge) => void
}

/** A take on the phone has no recorder: the replay is unsupported. */
const NO_REPLAY = {
  capture: () => null,
  state: () => 'unsupported' as const,
  stop: async () => null,
}

/** How long a handed-off take may wait for its save to begin. */
const SAVE_START_MS = 5000

/**
 * A heard frame as the web's practice frames carry it. The session reads
 * the frequency and the clarity; the rest is filled so the shape is whole.
 */
function pitchOf(hz: number, clarity: number): PitchResult {
  const midi = frequencyToMidi(hz)
  return {
    freq: hz,
    frequency: hz,
    clarity,
    midi,
    note: midiToNoteName(midi),
    noteName: midiToNoteName(midi),
    targetMidi: 0,
    targetNote: '',
    cents: 0,
    octave: Math.floor(midi / 12) - 1,
  }
}

/** The room's take. Call it in the room's component: it owns the mic. */
export function createLegendTake(): LegendTake {
  const capture = useExerciseCapture(LEGEND_OWNER, 'Legend')
  const life = createRoomLife()

  const [state, setState] = createSignal<TakeState>({ phase: 'idle', run: 0 })
  const [kind, setKind] = createSignal<TakeKind>('practice')
  const [challenge, setChallenge] = createSignal<WeeklyChallenge | null>(null)
  const [block, setBlock] = createSignal<CaptureFailure | null>(null)
  const [session, setSession] = createSignal<ZenPitchSession | null>(null)
  const [outcome, setOutcome] = createSignal<TakeOutcome | null>(null)
  const [handedOff, setHandedOff] = createSignal(false)
  const [sawSaving, setSawSaving] = createSignal(false)
  const [saveLate, setSaveLate] = createSignal(false)
  const [linePlaying, setLinePlaying] = createSignal(false)

  let disposeSession: (() => void) | null = null
  let listeners = new Set<(frame: PracticeFrame) => void>()
  let finishedRun: ZenPitchRun | null = null
  let windowAt = 0
  let fed = 0
  let completing = false
  let lineTimers: ReturnType<typeof setTimeout>[] = []
  let lineToken = 0

  // The take's frames, as the session hears them: on the performance clock
  // the session runs on, from the moment the take's window opened.
  const feed = (): void => {
    const frames = capture.peekFrames()
    for (; fed < frames.length; fed += 1) {
      const frame = frames[fed]
      const heard: PracticeFrame = {
        atMs: windowAt + frame.t * 1000,
        beat: 0,
        micActive: true,
        pitch: frame.f0 > 0 ? pitchOf(frame.f0, frame.conf) : null,
      }
      for (const listener of [...listeners]) listener(heard)
    }
  }
  const loop = createFrameLoop(feed, {
    alive: life.alive,
    running: () => untrack(state).phase === 'live',
  })

  const endSession = (): void => {
    disposeSession?.()
    disposeSession = null
    listeners = new Set()
    setSession(null)
  }

  /** A fresh session for the line: one per take, never transposed. */
  const sessionFor = (picked: WeeklyChallenge): ZenPitchSession | null => {
    const definition = challengeToZenExercise({
      id: picked.id,
      title: picked.title,
      targetItems: picked.targetItems,
    })
    if (definition === null) return null
    endSession()
    finishedRun = null
    const made = createRoot((dispose) => {
      disposeSession = dispose
      return useZenPitchSession({
        initialExerciseDefinition: definition,
        subscribeFrames: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        // The room opened the mic in the tap, and lets it go itself.
        micActive: () => capture.held(),
        startMic: async () => capture.held(),
        stopMic: () => undefined,
        loopLimit: 1,
        onLoopLimitReached: () => {
          queueMicrotask(() => {
            void complete()
          })
        },
        onRunFinalized: (run) => {
          finishedRun ??= run
        },
      })
    })
    setSession(made)
    return made
  }

  /** Let this Legend's armed attempt go, if it is still armed. */
  const disarm = (picked: WeeklyChallenge | null): void => {
    const armed = activeWeeklyAttempt()
    if (picked !== null && armed !== null && armed.challengeId === picked.id) {
      clearWeeklyAttempt()
    }
  }

  const stopLine = (): void => {
    lineToken += 1
    for (const timer of lineTimers) clearTimeout(timer)
    lineTimers = []
    setLinePlaying(false)
  }

  const playLine = (picked: WeeklyChallenge): void => {
    if (untrack(linePlaying)) {
      stopLine()
      return
    }
    const definition = challengeToZenExercise({
      id: picked.id,
      title: picked.title,
      targetItems: picked.targetItems,
    })
    if (definition === null || definition.targets.length === 0) return
    stopLine()
    setLinePlaying(true)
    const token = lineToken
    const beatSec = 60 / definition.bpm
    const targets = definition.targets
    const firstBeat = targets[0].startBeat
    const play = (index: number): void => {
      if (token !== lineToken) return
      const target = targets[index]
      void capture
        .playTone(
          definition.defaultRootMidi + target.semitone,
          Math.max(0.12, target.durationBeats * beatSec),
        )
        .catch(() => undefined)
    }
    // The first note inside the tap, so the phone's audio wakes for it.
    play(0)
    for (let index = 1; index < targets.length; index += 1) {
      const at = (targets[index].startBeat - firstBeat) * beatSec * 1000
      lineTimers.push(setTimeout(() => play(index), at))
    }
    const last = targets[targets.length - 1]
    const total = (last.startBeat - firstBeat + last.durationBeats) * beatSec
    lineTimers.push(
      setTimeout(() => {
        if (token !== lineToken) return
        lineTimers = []
        setLinePlaying(false)
      }, total * 1000),
    )
  }

  const complete = async (): Promise<void> => {
    const made = untrack(session)
    const picked = untrack(challenge)
    if (completing || made === null || picked === null) return
    if (untrack(state).phase !== 'live') return
    completing = true
    loop.stop()
    made.finish()
    capture.takeFrames()
    capture.release()
    const run = finishedRun
    const targets = untrack(made.targets)
    const summary = summarizeChallengeRun(
      run?.points ?? [],
      targets,
      run?.durationSec ?? 0,
    )
    setOutcome({ points: run?.points ?? [], summary })
    setState({ phase: 'result', run: untrack(state).run })
    if (untrack(kind) !== 'ranked') return
    // The funnel every scored exercise uses: the armed attempt consumes
    // this entry and writes the board's row, as the web's stage does.
    const result: ExerciseResult = {
      type: EXERCISE_SIGHT_SINGING,
      score: summary.score,
      metrics: {
        durationMs: Math.round((run?.durationSec ?? 0) * 1000),
        notesAttempted: summary.notesAttempted,
        notesScored: summary.notesScored,
        avgAccuracy: summary.avgAccuracy,
        bestNote: summary.bestNote,
      },
      completedAt: Date.now(),
    }
    await recordChallengeStageResult({
      voiceCapture: NO_REPLAY,
      challengeId: picked.id,
      targetNotes: targets.map((target) => midiToNoteName(target.startMidi)),
      result,
    })
    setHandedOff(true)
    // A save that never begins (the attempt was let go meanwhile) is not
    // waited on for ever.
    life.later(SAVE_START_MS, () => setSaveLate(true))
  }

  const start = (picked: WeeklyChallenge, nextKind: TakeKind): void => {
    const phase = untrack(state).phase
    if (phase === 'starting' || phase === 'live') return
    // One take's save at a time: a second could be shown the first's.
    if (untrack(roomFinalizing)) return
    stopLine()
    const made = sessionFor(picked)
    if (made === null) return
    if (nextKind === 'ranked') {
      beginWeeklyAttempt({
        challengeId: picked.id,
        title: picked.title,
        exercise: EXERCISE_SIGHT_SINGING,
        targetScore: picked.targetScore,
        rewardBadgeId: picked.rewardBadgeId,
        founderScore: picked.founderScore,
        targetItems: picked.targetItems,
        presenter: 'native-room',
      })
    } else {
      // Practice clears any armed attempt, so a leftover cannot claim it.
      clearWeeklyAttempt()
    }
    clearRoomChallengeResult()
    completing = false
    setHandedOff(false)
    setSawSaving(false)
    setSaveLate(false)
    setOutcome(null)
    setBlock(null)
    setChallenge(picked)
    setKind(nextKind)
    const run = untrack(state).run + 1
    setState({ phase: 'starting', run })
    // No audio clock asked for: nothing plays during the take, and the
    // frames are read on the performance clock the session runs on.
    openRoomMic({
      capture,
      alive: life.alive,
      state,
      onOpen: (opened) => {
        capture.startWindow()
        windowAt = performance.now()
        fed = 0
        setState({ phase: 'live', run: opened })
        void made.start()
        loop.start()
      },
      onFail: (failed, why) => {
        if (nextKind === 'ranked') disarm(picked)
        endSession()
        setBlock(why)
        setState({ phase: 'blocked', run: failed })
      },
      onHidden: () => leave(),
    })
  }

  const stop = (): void => {
    if (untrack(state).phase === 'live') void complete()
  }

  /** The singer left the take: nothing of it is recorded. */
  const leave = (): void => {
    stopLine()
    const phase = untrack(state).phase
    if (phase !== 'starting' && phase !== 'live') return
    loop.stop()
    untrack(session)?.finish()
    capture.release()
    if (untrack(kind) === 'ranked') disarm(untrack(challenge))
    endSession()
    setState({ phase: 'idle', run: untrack(state).run })
  }

  const done = (): void => {
    // A save that failed leaves the attempt armed; the door arms it again.
    disarm(untrack(challenge))
    clearRoomChallengeResult()
    endSession()
    setOutcome(null)
    setHandedOff(false)
    setBlock(null)
    setState({ phase: 'idle', run: untrack(state).run })
  }

  createEffect(() => {
    if (roomFinalizing()) setSawSaving(true)
  })

  const saveState = (): SaveState | null => {
    if (kind() !== 'ranked' || state().phase !== 'result') return null
    const presented = roomChallengeResult()
    if (presented !== null && presented.challengeId === challenge()?.id) {
      return 'posted'
    }
    if (!handedOff() || roomFinalizing()) return 'saving'
    return sawSaving() || saveLate() ? 'failed' : 'saving'
  }

  life.watch({
    leave,
    listening: () => state().phase === 'live',
    demo: { on: linePlaying, playing: linePlaying },
    holdsFocus: true,
    mic: {
      exercise: LEGEND_OWNER,
      on: () => state().phase === 'live',
      died: leave,
    },
  })

  onCleanup(() => {
    loop.stop()
    stopLine()
    // Whatever happened, nothing stays armed past the room: a take handed
    // off has been read already, and anything else was never sung.
    disarm(untrack(challenge))
    endSession()
    clearRoomChallengeResult()
    setExerciseFocus(false)
    life.dispose()
  })

  return {
    state,
    kind,
    challenge,
    block,
    session,
    outcome,
    saveState,
    linePlaying,
    start,
    stop,
    done,
    playLine,
  }
}
