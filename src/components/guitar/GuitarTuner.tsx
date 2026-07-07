// ============================================================
// GuitarTuner — point the mic at your guitar and tune up.
//
// Renders a needle-style display with cent deviation, auto-detects
// which string is being played, and shows flat/in-tune/sharp state.
// Uses the existing PitchDetector for frequency detection.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import type { TunerResult } from '@/lib/guitar/tuner'
import { classifyPitch, getTargetHz, getTuningFrequencies, getTuningStringNames, STRING_LABELS, } from '@/lib/guitar/tuner'
import { PitchDetector } from '@/lib/pitch-detector'
import styles from './GuitarTuner.module.css'

// ── Types ──────────────────────────────────────────────────────

export type TuningPreset =
  | 'Standard'
  | 'Drop D'
  | 'Half Step Down'
  | 'Open G'
  | 'DADGAD'

interface GuitarTunerProps {
  /** Whether the tuner is actively listening. */
  isActive: () => boolean
  /** Gets the latest time-domain audio data from the mic. */
  getTimeData: () => Float32Array
  /** Audio context sample rate (0 if not ready). */
  sampleRate: () => number
}

// ── Constants ──────────────────────────────────────────────────

const IN_TUNE_THRESHOLD = 5
const CLOSE_THRESHOLD = 15
const STABILITY_FRAMES = 8

// ── Component ──────────────────────────────────────────────────

export const GuitarTuner: Component<GuitarTunerProps> = (props) => {
  const [result, setResult] = createSignal<TunerResult | null>(null)
  const [selectedPreset, setSelectedPreset] =
    createSignal<TuningPreset>('Standard')
  const [manualString, setManualString] = createSignal<string | null>(null)
  const [stable, setStable] = createSignal(false)

  let pitchDetector: PitchDetector | null = null
  let animFrameId: number | null = null
  let stableCounter = 0
  let prevString: string | null = null

  // ── Detection loop ──────────────────────────────────────────

  const stopDetection = () => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    pitchDetector = null
    stableCounter = 0
    prevString = null
    setStable(false)
  }

  const startDetection = () => {
    if (animFrameId !== null) return

    const loop = () => {
      if (!props.isActive()) {
        stopDetection()
        return
      }

      const timeData = props.getTimeData()
      if (timeData.length > 0) {
        // Lazy-init the detector with correct sample rate
        if (!pitchDetector) {
          const sr = props.sampleRate()
          pitchDetector = new PitchDetector({
            sampleRate: sr > 0 ? sr : 44100,
            minFrequency: 70,
            maxFrequency: 400,
          })
        }

        const detected = pitchDetector!.detect(timeData)
        if (detected.clarity > 0.35) {
          const r = classifyPitch(detected.frequency, detected.clarity)
          if (r) {
            // Stability tracking: same string for N consecutive frames
            if (r.stringName === prevString) {
              stableCounter++
            } else {
              stableCounter = 0
              prevString = r.stringName
            }
            setStable(stableCounter >= STABILITY_FRAMES)

            // Manual string override
            const ms = manualString()
            if (ms != null && ms !== '') {
              const targetHz = getTargetHz(ms)
              const cents = 1200 * Math.log2(detected.frequency / targetHz)
              const absCents = Math.abs(cents)
              r.stringName = ms
              r.stringLabel = STRING_LABELS[ms] ?? ms
              r.targetHz = targetHz
              r.centsDeviation = Math.round(cents * 10) / 10
              r.inTune = absCents <= IN_TUNE_THRESHOLD
              r.close = absCents <= CLOSE_THRESHOLD
            }

            setResult({ ...r })
          }
        }
      }

      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  // Sync loop with isActive
  createEffect(() => {
    if (props.isActive()) {
      startDetection()
    } else {
      stopDetection()
    }
  })

  onCleanup(() => {
    stopDetection()
  })

  // ── Derived display values ──────────────────────────────────

  const needleAngle = () => {
    const r = result()
    if (!r) return 0
    // Map cents to degrees: -50 → -45deg, 0 → 0deg, +50 → +45deg
    return Math.max(-45, Math.min(45, r.centsDeviation * 0.9))
  }

  const needleColor = () => {
    const r = result()
    if (!r) return 'var(--bg-tertiary)'
    if (r.inTune) return '#4caf50'
    if (r.close) return '#ffc107'
    return '#f44336'
  }

  const tuningFreqs = () => getTuningFrequencies(selectedPreset())
  const tuningNames = () => getTuningStringNames(selectedPreset())

  // ── Render ───────────────────────────────────────────────────

  return (
    <div class={styles.panel} data-testid="guitar-tuner">
      {/* Header with preset selector */}
      <div class={styles.header}>
        <span class={styles.title}>Tuner</span>
        <select
          class={styles.presetSelect}
          value={selectedPreset()}
          onChange={(e) =>
            setSelectedPreset(e.currentTarget.value as TuningPreset)
          }
          aria-label="Tuning preset"
        >
          <option value="Standard">Standard</option>
          <option value="Drop D">Drop D</option>
          <option value="Half Step Down">½ Step Down</option>
          <option value="Open G">Open G</option>
          <option value="DADGAD">DADGAD</option>
        </select>
      </div>

      {/* Needle display */}
      <div class={styles.needleArea}>
        {/* Scale labels */}
        <div class={styles.scale}>
          <span class={styles.scaleMarkL}>-50</span>
          <span class={styles.scaleMark}>-25</span>
          <span class={styles.scaleMarkC}>0</span>
          <span class={styles.scaleMark}>+25</span>
          <span class={styles.scaleMarkR}>+50</span>
        </div>

        {/* Arc track */}
        <div class={styles.arcTrack}>
          <div class={styles.arcRedL} />
          <div class={styles.arcYellowL} />
          <div class={styles.arcGreen} />
          <div class={styles.arcYellowR} />
          <div class={styles.arcRedR} />
        </div>

        {/* Needle */}
        <div
          class={styles.needle}
          style={{
            transform: `rotate(${needleAngle()}deg)`,
            '--needle-color': needleColor(),
          }}
        />

        {/* Center pivot */}
        <div class={styles.centerDot} />
      </div>

      {/* Cents readout */}
      <div class={styles.readout}>
        <Show
          when={result()}
          fallback={<span class={styles.placeholder}>Play a string...</span>}
        >
          {(r) => (
            <>
              <span class={styles.centsValue} style={{ color: needleColor() }}>
                {r().centsDeviation > 0 ? '+' : ''}
                {r().centsDeviation.toFixed(1)}¢
              </span>
              <span class={styles.stringName}>{r().stringLabel}</span>
              <span class={styles.targetLabel}>
                {r().targetHz.toFixed(1)} Hz
              </span>
              <span class={styles.tuneStatus} style={{ color: needleColor() }}>
                {r().inTune
                  ? '✓ In Tune'
                  : r().close
                    ? '⟳ Close'
                    : r().centsDeviation > 0
                      ? '↑ Sharp'
                      : '↓ Flat'}
              </span>
              <Show when={stable() && r().inTune}>
                <span class={styles.stableBadge}>Locked</span>
              </Show>
            </>
          )}
        </Show>
      </div>

      {/* Per-string selector buttons */}
      <div class={styles.stringSelector}>
        <For each={tuningNames()}>
          {(name, idx) => (
            <button
              type="button"
              class={styles.stringBtn}
              classList={{
                [styles.stringBtnActive]:
                  manualString() === name ||
                  (manualString() == null &&
                    result() != null &&
                    result()!.stringName === name),
              }}
              onClick={() =>
                setManualString(manualString() === name ? null : name)
              }
              aria-label={`Tune ${name}`}
              aria-pressed={
                manualString() === name ||
                (manualString() == null &&
                  result() != null &&
                  result()!.stringName === name)
              }
            >
              <span class={styles.stringBtnLabel}>
                {name.replace(/\d/, '')}
              </span>
              <span class={styles.stringBtnFreq}>
                {tuningFreqs()[idx()].toFixed(1)}
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
