// ============================================================
// Hairline controller — 2AFC pitch discrimination.
//
// Two tones, "which was higher?", gap driven by the 2-down-1-up
// staircase. Practice runs one track and records an estimate;
// Calibration interleaves three tracks (picked at random so the
// listener cannot predict the next move) and pools them into the
// only kind of reading that marks the Mercury Column.
//
// The base pitch roves log-uniformly between rounds: without the
// rove, absolute pitch memory of the previous trial substitutes
// for the discrimination actually being measured.
// ============================================================

import { batch, createSignal } from 'solid-js'
import { gradeForScore, playTierSfx } from '@/features/exercises/feedback'
import type { CalibrationTrack, PooledThreshold } from '@/lib/ear/calibration'
import { calibrationReading, createCalibrationTracks, isCalibrationComplete, nextTrackIndex, recordCalibrationTrial, } from '@/lib/ear/calibration'
import type { ThresholdDrill } from '@/lib/ear/drills'
import type { StaircaseState, ThresholdEstimate } from '@/lib/ear/staircase'
import { createStaircase, recordTrial, thresholdOf } from '@/lib/ear/staircase'
import { completeCalibrationRun, creditEarSession, recordThresholdReading, } from '@/stores/ear-lab-store'

export type HairlineMode = 'practice' | 'calibration'

export type HairlinePhase =
  | 'idle'
  | 'tone-1'
  | 'tone-2'
  | 'answer'
  | 'reveal'
  | 'done'

export interface HairlineResult {
  estimate: ThresholdEstimate | PooledThreshold | null
  trials: number
  mode: HairlineMode
  /** Set on calibration runs: the Mercury Index that got marked. */
  markedIndex?: number
}

const TONE_MS = 600
const GAP_MS = 260
const REVEAL_MS = 550

/** Rove the base log-uniformly across A3..A5. */
function roveBaseFreq(random: () => number): number {
  return 220 * 2 ** (random() * 2)
}

interface AudioLike {
  playTone: (freq: number, durationMs?: number) => Promise<void>
}

export function useHairlineController(
  drill: ThresholdDrill,
  audioEngine: AudioLike,
) {
  const [phase, setPhase] = createSignal<HairlinePhase>('idle')
  const [mode, setMode] = createSignal<HairlineMode>('practice')
  const [trials, setTrials] = createSignal(0)
  const [reversalsDone, setReversalsDone] = createSignal(0)
  const [levelCents, setLevelCents] = createSignal(drill.staircase.start)
  const [lastCorrect, setLastCorrect] = createSignal<boolean | null>(null)
  const [result, setResult] = createSignal<HairlineResult | null>(null)

  let single: StaircaseState | null = null
  let tracks: CalibrationTrack[] = []
  let activeTrackIndex = 0
  let higherFirst = false
  let startedAt = 0
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Total reversals a full run needs (progress display). */
  function reversalTarget(): number {
    const per = drill.staircase.reversalsToStop
    return mode() === 'calibration' ? per * 3 : per
  }

  function currentStaircase(): StaircaseState | null {
    if (mode() === 'practice') return single
    return tracks[activeTrackIndex]?.state ?? null
  }

  function start(runMode: HairlineMode): void {
    cancelled = false
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
      tracks = createCalibrationTracks(drill.id, drill.staircase)
    }
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
    } else if (!single || single.done) {
      finish()
      return
    }

    const level = currentStaircase()?.level ?? drill.staircase.start
    setLevelCents(level)

    const base = roveBaseFreq(Math.random)
    higherFirst = Math.random() < 0.5
    const higher = base * 2 ** (level / 1200)
    const first = higherFirst ? higher : base
    const second = higherFirst ? base : higher

    setPhase('tone-1')
    await audioEngine.playTone(first, TONE_MS)
    if (cancelled) return
    await new Promise((resolve) => {
      timer = setTimeout(resolve, GAP_MS)
    })
    if (cancelled) return
    setPhase('tone-2')
    await audioEngine.playTone(second, TONE_MS)
    if (cancelled) return
    setPhase('answer')
  }

  function answer(pick: 'first' | 'second'): void {
    if (phase() !== 'answer' || cancelled) return
    const correct = (pick === 'first') === higherFirst

    if (mode() === 'practice' && single) {
      single = recordTrial(single, correct)
      setReversalsDone(single.reversals.length)
    } else if (mode() === 'calibration') {
      tracks = recordCalibrationTrial(tracks, activeTrackIndex, correct)
      setReversalsDone(
        tracks.reduce((sum, t) => sum + t.state.reversals.length, 0),
      )
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

    timer = setTimeout(() => {
      if (cancelled) return
      setLastCorrect(null)
      void playRound()
    }, REVEAL_MS)
  }

  function finish(): void {
    const elapsed = performance.now() - startedAt

    if (mode() === 'practice') {
      const estimate = single ? thresholdOf(single) : null
      if (estimate) {
        recordThresholdReading({
          drillId: drill.id,
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
    setPhase('done')
  }

  /** Stop early. A practice track that has turned around twice still
   *  yields a (provisional) reading; an abandoned calibration is
   *  discarded — a half-measured mark must never hit the column. */
  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    clearTimeout(timer)
    if (mode() === 'practice') {
      finish()
      return
    }
    if (isCalibrationComplete(tracks)) {
      finish()
      return
    }
    setResult({ estimate: null, trials: trials(), mode: 'calibration' })
    setPhase('done')
  }

  function reset(): void {
    clearTimeout(timer)
    setPhase('idle')
    setResult(null)
    setLastCorrect(null)
  }

  function dispose(): void {
    cancelled = true
    clearTimeout(timer)
  }

  /** Letter grade for the end card, from how far down the drill's
   *  0-1000 scale the reading lands (shared grading language). */
  function grade(): 'S' | 'A' | 'B' | 'C' | 'D' | null {
    const r = result()
    if (!r?.estimate) return null
    const { novice, expert } = drill.scale
    const t =
      (Math.log(r.estimate.value) - Math.log(novice)) /
      (Math.log(expert) - Math.log(novice))
    return gradeForScore(Math.max(0, Math.min(1, t)) * 100)
  }

  return {
    phase,
    mode,
    trials,
    reversalsDone,
    reversalTarget,
    levelCents,
    lastCorrect,
    result,
    grade,
    start,
    answer,
    stop,
    reset,
    dispose,
  }
}
