// ============================================================
// useThresholdRun — the shared engine under every Ruler-A drill.
//
// Owns everything that is the same whether the stimulus is two
// tones (Hairline) or six clicks (The Grid): the practice
// staircase, the 3-track interleaved calibration, progress,
// result recording, and the stop semantics — a practice track
// that turned around twice still reads (provisional); an
// abandoned calibration is discarded, because a half-measured
// mark must never hit the column.
//
// Stopping CANCELS the run, not just its timer. A stimulus is
// already committed to the audio clock by the time Stop is
// pressed, so the drill also gets a cancelStimulus hook to
// silence what is already scheduled; without both halves, a
// stopped drill keeps sounding and then re-arms its own question
// when the in-flight playStimulus() resolves.
//
// The drill supplies one hook: playStimulus(level), which may
// report visual steps (which tone / which click) through the
// provided api.
// ============================================================

import { batch, createSignal, onCleanup } from 'solid-js'
import { gradeForScore } from '@/features/exercises/feedback'
import { playTierSfx } from '@/features/exercises/feedback'
import type { CalibrationTrack, PooledThreshold } from '@/lib/ear/calibration'
import { CALIBRATION_STAIRCASE, calibrationConfig, calibrationReading, createCalibrationTracks, isCalibrationComplete, nextTrackIndex, recordCalibrationTrial, } from '@/lib/ear/calibration'
import type { ThresholdDrill } from '@/lib/ear/drills'
import { INDEX_MAX, scoreReading } from '@/lib/ear/mercury-index'
import type { StaircaseState, ThresholdEstimate } from '@/lib/ear/staircase'
import { createStaircase, recordTrial, thresholdOf } from '@/lib/ear/staircase'
import { completeCalibrationRun, creditEarSession, latestThresholdReading, markSprintSegmentDone, recordThresholdReading, } from '@/stores/ear-lab-store'
import { createRevealPacer } from './reveal-pacing'

export type ThresholdRunMode = 'practice' | 'calibration'

/** Trials a 2-down-1-up track spends per turn, until the run shows
 *  its own pace. */
const PRIOR_TRIALS_PER_TURN = 2.5

export type ThresholdRunPhase =
  | 'idle'
  | 'stimulus'
  | 'answer'
  | 'reveal'
  | 'done'

export interface ThresholdRunResult {
  estimate: ThresholdEstimate | PooledThreshold | null
  trials: number
  mode: ThresholdRunMode
  /** Set on calibration runs: the Mercury Index that got marked. */
  markedIndex?: number
}

export interface StimulusApi {
  /** Report a visual step (1-based tone/click index) to the view. */
  step: (index: number) => void
  /** True once the run was stopped or torn down — stimulus loops
   *  must check this after every await and bail. */
  cancelled: () => boolean
}

export interface ThresholdRunOptions {
  /** Silence anything already committed to the audio clock. Called
   *  on stop and on unmount, before the phase flips. */
  cancelStimulus?: () => void
}

export function useThresholdRun(
  drill: ThresholdDrill,
  playStimulus: (level: number, api: StimulusApi) => Promise<void>,
  options?: ThresholdRunOptions,
) {
  const [phase, setPhase] = createSignal<ThresholdRunPhase>('idle')
  const [mode, setMode] = createSignal<ThresholdRunMode>('practice')
  const [trials, setTrials] = createSignal(0)
  const [reversalsDone, setReversalsDone] = createSignal(0)
  const [level, setLevel] = createSignal(drill.staircase.start)
  const [stimulusStep, setStimulusStep] = createSignal(0)
  const [lastCorrect, setLastCorrect] = createSignal<boolean | null>(null)
  const [result, setResult] = createSignal<ThresholdRunResult | null>(null)
  /** Calibration only: reversals per interleaved track, for the strip. */
  const [trackReversals, setTrackReversals] = createSignal<number[]>([])
  const [activeTrack, setActiveTrack] = createSignal(0)

  let single: StaircaseState | null = null
  let tracks: CalibrationTrack[] = []
  let activeTrackIndex = 0
  let startedAt = 0
  let cancelled = false
  const pacer = createRevealPacer(
    () => {
      setLastCorrect(null)
      void playRound()
    },
    () => cancelled,
  )

  const api: StimulusApi = {
    step: setStimulusStep,
    cancelled: () => cancelled,
  }

  /** Turns each track needs: the sealed protocol's six, or the
   *  drill's own for practice. */
  function trackTarget(): number {
    return mode() === 'calibration'
      ? CALIBRATION_STAIRCASE.reversalsToStop
      : drill.staircase.reversalsToStop
  }

  /** Total turns a full run needs (progress display). */
  function reversalTarget(): number {
    return mode() === 'calibration' ? trackTarget() * 3 : trackTarget()
  }

  /** About how many questions remain: the turns still needed at the
   *  run's own pace so far (a prior of two and a half trials a turn
   *  until it has turned twice), never more than the caps allow. */
  function questionsLeft(): number {
    const turnsLeft = Math.max(0, reversalTarget() - reversalsDone())
    const pace =
      reversalsDone() >= 2 ? trials() / reversalsDone() : PRIOR_TRIALS_PER_TURN
    const live =
      mode() === 'calibration'
        ? tracks.map((t) => t.state)
        : single
          ? [single]
          : []
    const capacity = live
      .filter((state) => !state.done)
      .reduce((sum, state) => sum + (state.config.maxTrials - state.trials), 0)
    return Math.min(Math.round(turnsLeft * pace), capacity)
  }

  function currentStaircase(): StaircaseState | null {
    if (mode() === 'practice') return single
    return tracks[activeTrackIndex]?.state ?? null
  }

  /** Where a practice run's reading is recorded: the drill's own id,
   *  or the track start() was given — Span's sung runs read under
   *  'span-sing'. Calibration always reads under the drill. */
  let runTrackId = drill.id

  function start(runMode: ThresholdRunMode, track?: { drillId: string }): void {
    cancelled = false
    runTrackId =
      runMode === 'practice' ? (track?.drillId ?? drill.id) : drill.id
    startedAt = performance.now()
    batch(() => {
      setMode(runMode)
      setTrials(0)
      setReversalsDone(0)
      setResult(null)
      setLastCorrect(null)
    })
    if (runMode === 'practice') {
      single = createStaircase(drill.staircase)
      tracks = []
    } else {
      single = null
      tracks = createCalibrationTracks(
        drill.id,
        calibrationConfig(
          drill.staircase,
          latestThresholdReading(drill.id)?.value ?? null,
        ),
      )
    }
    setTrackReversals(tracks.map(() => 0))
    setActiveTrack(0)
    void playRound()
  }

  async function playRound(): Promise<void> {
    if (cancelled) return

    if (mode() === 'calibration') {
      const index = nextTrackIndex(tracks)
      if (index === null) {
        finish()
        return
      }
      activeTrackIndex = index
      setActiveTrack(index)
    } else if (!single || single.done) {
      finish()
      return
    }

    const currentLevel = currentStaircase()?.level ?? drill.staircase.start
    batch(() => {
      setLevel(currentLevel)
      setStimulusStep(0)
      setPhase('stimulus')
    })
    await playStimulus(currentLevel, api)
    // Stop may have landed while the stimulus was sounding; arming
    // the answer here would resurrect a finished run.
    if (cancelled) return
    setPhase('answer')
  }

  /** The drill translates its buttons into right/wrong; the run
   *  moves the track and paces the reveal. */
  function answerCorrect(correct: boolean): void {
    if (phase() !== 'answer' || cancelled) return

    if (mode() === 'practice' && single) {
      single = recordTrial(single, correct)
      setReversalsDone(single.reversals.length)
    } else if (mode() === 'calibration') {
      tracks = recordCalibrationTrial(tracks, activeTrackIndex, correct)
      setReversalsDone(
        tracks.reduce((sum, t) => sum + t.state.reversals.length, 0),
      )
      setTrackReversals(tracks.map((t) => t.state.reversals.length))
    }

    playTierSfx(
      correct
        ? { label: 'Perfect', className: 'perfect' }
        : { label: 'Missed', className: 'missed' },
    )

    batch(() => {
      setTrials((t) => t + 1)
      setLastCorrect(correct)
      setPhase('reveal')
    })

    // The verdict is on the stage; the pacer decides when the next
    // trial sounds — the rack's hold, or Next.
    pacer.hold()
  }

  function finish(): void {
    const elapsed = performance.now() - startedAt

    if (mode() === 'practice') {
      const estimate = single ? thresholdOf(single) : null
      if (estimate) {
        recordThresholdReading({
          drillId: runTrackId,
          value: estimate.value,
          spread: estimate.spread,
          tracks: 1,
          source: 'practice',
        })
      }
      setResult({ estimate, trials: trials(), mode: 'practice' })
    } else {
      const pooled = calibrationReading(tracks, drill.staircase.stepMode)
      let markedIndex: number | undefined
      if (pooled) {
        markedIndex = completeCalibrationRun([
          {
            drillId: drill.id,
            value: pooled.value,
            spread: pooled.standardError,
          },
        ]).index
      }
      setResult({
        estimate: pooled,
        trials: trials(),
        mode: 'calibration',
        markedIndex,
      })
    }

    creditEarSession(elapsed)
    // A drill played anywhere counts toward today's sprint — the
    // sprint names what to practise, it does not own the only door
    // into it. Idempotent, so a second run cannot double-book.
    markSprintSegmentDone(drill.id)
    setPhase('done')
  }

  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    // Cancel FIRST: the in-flight playStimulus() checks this when it
    // resolves, and without it the run would re-arm its question
    // after the user has already seen the end card.
    cancelled = true
    pacer.cancel()
    options?.cancelStimulus?.()

    if (mode() === 'practice' || isCalibrationComplete(tracks)) {
      finish()
      return
    }
    setResult({ estimate: null, trials: trials(), mode: 'calibration' })
    setPhase('done')
  }

  function reset(): void {
    cancelled = true
    pacer.cancel()
    options?.cancelStimulus?.()
    setPhase('idle')
    setResult(null)
    setLastCorrect(null)
  }

  function dispose(): void {
    cancelled = true
    pacer.cancel()
    options?.cancelStimulus?.()
  }

  onCleanup(dispose)

  /** Letter grade from where the reading lands on the drill's own
   *  0-1000 scale — the same mapping the Mercury Index uses, so a
   *  grade and a column contribution can never disagree. */
  function grade(): 'S' | 'A' | 'B' | 'C' | 'D' | null {
    const r = result()
    if (!r?.estimate) return null
    return gradeForScore(
      (scoreReading(r.estimate.value, drill.scale) / INDEX_MAX) * 100,
    )
  }

  return {
    phase,
    trackId: () => runTrackId,
    mode,
    trials,
    reversalsDone,
    reversalTarget,
    trackTarget,
    questionsLeft,
    trackReversals,
    activeTrack,
    level,
    stimulusStep,
    lastCorrect,
    /** Where this track's level goes after the verdict — the Last
     *  call plate's consequence line. Null before the first trial. */
    nextLevel: () => currentStaircase()?.level ?? null,
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    result,
    grade,
    start,
    answerCorrect,
    stop,
    reset,
    dispose,
  }
}
