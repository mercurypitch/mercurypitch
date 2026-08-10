// ============================================================
// HairlineDrill — 2AFC pitch discrimination.
//
// Stimulus: two tones separated by the staircase's current gap,
// higher-first at a coin flip, base pitch roved log-uniformly so
// absolute pitch memory cannot substitute for discrimination.
//
// The stage shows two mercury beads whose separation tracks the
// gap: as the ear sharpens they close in until they nearly merge.
// They deliberately sit at the SAME height — showing which tone
// was higher would answer the question for the eye instead of the
// ear. The gap in cents is displayed openly (it is the
// difficulty, not the answer).
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, onMount } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import { HAIRLINE_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import styles from './EarDrill.module.css'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { ThresholdRunMode } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface HairlineDrillProps {
  onBack: () => void
  /** When set, the run starts immediately in this mode (the
   *  dashboard's Calibrate CTA jumps straight in). */
  autoStartMode?: ThresholdRunMode
}

/** Rove the base log-uniformly across A3..A5. */
function roveBaseFreq(random: () => number): number {
  return 220 * 2 ** (random() * 2)
}

export function HairlineDrill(props: HairlineDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('hairline')
  if (!drill) throw new Error('hairline drill missing from catalogue')

  let higherFirst = false

  const run = useThresholdRun(
    drill,
    async (level, api) => {
      const base = roveBaseFreq(Math.random)
      higherFirst = Math.random() < 0.5
      const higher = base * 2 ** (level / 1200)

      api.step(1)
      await audioEngine.playTone(
        higherFirst ? higher : base,
        HAIRLINE_TIMING.toneMs,
      )
      if (api.cancelled()) return
      await new Promise((resolve) => setTimeout(resolve, HAIRLINE_TIMING.gapMs))
      if (api.cancelled()) return
      api.step(2)
      await audioEngine.playTone(
        higherFirst ? base : higher,
        HAIRLINE_TIMING.toneMs,
      )
    },
    // Stop cuts the tone that is already sounding; without this the
    // drill keeps playing after the end card appears.
    { cancelStimulus: () => audioEngine.stopTone(60) },
  )

  onMount(() => {
    if (props.autoStartMode) run.start(props.autoStartMode)
  })

  /** Bead separation from the staircase level, log-scaled across
   *  the drill's floor..ceiling so early coarse steps stay on
   *  screen. */
  const separation = createMemo(() => {
    const { min, max } = drill.staircase
    const t =
      (Math.log(run.level()) - Math.log(min)) / (Math.log(max) - Math.log(min))
    return 10 + Math.max(0, Math.min(1, t)) * 110
  })

  const beadClass = (step: number) =>
    `${styles.bead} ${
      run.phase() === 'stimulus' && run.stimulusStep() === step
        ? styles.active
        : ''
    }`

  return (
    <ThresholdDrillView
      title="Hairline"
      drillId="hairline"
      description="Two tones. Pick the higher one. The gap between them keeps shrinking toward the finest difference your ear can still resolve — that number, in cents, is your reading. It falls as you improve, and there is no ceiling to park at."
      listenHint="Listen…"
      answerHint="Which tone was higher?"
      levelCaption="Gap"
      levelLabel={() => `${run.level().toFixed(1)}¢`}
      formatValue={(value) => value.toFixed(1)}
      unitLabel="cents"
      unitShort="¢"
      latestValue={() => latestThresholdReading('hairline')?.value ?? null}
      run={run}
      stage={() => (
        <svg class={styles.beads} viewBox="0 0 320 90" aria-hidden="true">
          <line class={styles.beadRail} x1="30" x2="290" y1="45" y2="45" />
          <circle
            class={beadClass(1)}
            cx={160 - separation() / 2}
            cy="45"
            r="14"
          />
          <circle
            class={beadClass(2)}
            cx={160 + separation() / 2}
            cy="45"
            r="14"
          />
        </svg>
      )}
      answers={() => (
        <div class={styles.answerRow}>
          <button
            type="button"
            class={styles.answerBtn}
            disabled={run.phase() !== 'answer'}
            onClick={() => run.answerCorrect(higherFirst)}
          >
            First was higher
          </button>
          <button
            type="button"
            class={styles.answerBtn}
            disabled={run.phase() !== 'answer'}
            onClick={() => run.answerCorrect(!higherFirst)}
          >
            Second was higher
          </button>
        </div>
      )}
      onBack={props.onBack}
    />
  )
}
