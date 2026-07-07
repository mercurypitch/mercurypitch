// ============================================================
// GuitarTuner — point the mic at your guitar and tune up.
//
// Renders a needle-style display with cent deviation, auto-detects
// which string is being played, and shows flat/in-tune/sharp state.
// Uses the existing PitchDetector for frequency detection.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import type { TunerResult, TuningPreset } from '@/lib/guitar/tuner'
import { classifyPitch, getTargetHz, getTuningFrequencies, getTuningStringNames, STRING_LABELS, TUNER_CLOSE_CENTS, TUNER_IN_TUNE_CENTS, } from '@/lib/guitar/tuner'
import { PitchDetector } from '@/lib/pitch-detector'
import styles from './GuitarTuner.module.css'

// ── Tuner-specific constants ──────────────────────────────────

/** Frames a reading must stay on the same string before "locked". */
const STABILITY_FRAMES = 8
/** Minimum clarity threshold for pitch detection in tuner mode. */
const TUNER_DETECT_CLARITY = 0.35
/** Audio sample rate fallback when context isn't ready. */
const DEFAULT_SAMPLE_RATE = 44100
/** Min/max frequency range for guitar tuning (covers low E to high e). */
const TUNABLE_FREQ_MIN = 70
const TUNABLE_FREQ_MAX = 400
/** Needle arc max angle in degrees (maps ±50 cents to ±this). */
const NEEDLE_MAX_ANGLE = 45
/** Scale factor: cents → degrees (45 / 50 = 0.9). */
const NEEDLE_ANGLE_SCALE = NEEDLE_MAX_ANGLE / 50
/** Display round-trip: cent decimals. */
const CENTS_DECIMALS = 10

// ── Color semantics (CSS variable names, not raw hex) ─────────

const COLOR_IN_TUNE = 'var(--color-green, #4caf50)'
const COLOR_CLOSE = 'var(--color-yellow, #ffc107)'
const COLOR_SHARP_FLAT = 'var(--color-red, #f44336)'
const COLOR_MUTED = 'var(--bg-tertiary)'

// ── Props ─────────────────────────────────────────────────────

interface GuitarTunerProps {
  /** Whether the tuner is actively listening. */
  isActive: () => boolean
  /** Gets the latest time-domain audio data from the mic. */
  getTimeData: () => Float32Array
  /** Audio context sample rate (0 if not ready). */
  sampleRate: () => number
}

// ── Helpers ───────────────────────────────────────────────────

function pickNeedleColor(r: TunerResult): string {
  if (r.inTune) return COLOR_IN_TUNE
  if (r.close) return COLOR_CLOSE
  return COLOR_SHARP_FLAT
}

function tuneStatusLabel(r: TunerResult): string {
  if (r.inTune) return '✓ In Tune'
  if (r.close) return '⟳ Close'
  return r.centsDeviation > 0 ? '↑ Sharp' : '↓ Flat'
}

/**
 * Build a manual-override result. Returns a NEW object — never mutates
 * the input, so Solid signals fire correctly.
 */
function overrideResult(
  detected: TunerResult,
  manualString: string,
): TunerResult {
  const targetHz = getTargetHz(manualString)
  const cents = 1200 * Math.log2(detected.frequency / targetHz)
  const absCents = Math.abs(cents)
  return {
    ...detected,
    stringName: manualString,
    stringLabel: STRING_LABELS[manualString] ?? manualString,
    targetHz,
    centsDeviation: Math.round(cents * CENTS_DECIMALS) / CENTS_DECIMALS,
    inTune: absCents <= TUNER_IN_TUNE_CENTS,
    close: absCents <= TUNER_CLOSE_CENTS,
  }
}

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
      if (timeData.length === 0) {
        animFrameId = requestAnimationFrame(loop)
        return
      }

      // Lazy-init the detector with correct sample rate
      if (!pitchDetector) {
        const sr = props.sampleRate()
        pitchDetector = new PitchDetector({
          sampleRate: sr > 0 ? sr : DEFAULT_SAMPLE_RATE,
          minFrequency: TUNABLE_FREQ_MIN,
          maxFrequency: TUNABLE_FREQ_MAX,
        })
      }

      const detected = pitchDetector.detect(timeData)
      if (detected.clarity > TUNER_DETECT_CLARITY) {
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

          // Manual string override — produces a new object, no mutation
          const final =
            manualString() != null && manualString() !== ''
              ? overrideResult(r, manualString()!)
              : r

          setResult(final)
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
    return Math.max(
      -NEEDLE_MAX_ANGLE,
      Math.min(NEEDLE_MAX_ANGLE, r.centsDeviation * NEEDLE_ANGLE_SCALE),
    )
  }

  const needleColor = () => {
    const r = result()
    return r ? pickNeedleColor(r) : COLOR_MUTED
  }

  const tuningFreqs = () => getTuningFrequencies(selectedPreset())
  const tuningNames = () => getTuningStringNames(selectedPreset())

  /** Derived: is a given string name currently active? */
  const isStringActive = (name: string) => {
    const ms = manualString()
    if (ms === name) return true
    if (ms != null && ms !== '') return false
    const r = result()
    return r != null && r.stringName === name
  }

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
        <div class={styles.scale}>
          <span class={styles.scaleMarkL}>-50</span>
          <span class={styles.scaleMark}>-25</span>
          <span class={styles.scaleMarkC}>0</span>
          <span class={styles.scaleMark}>+25</span>
          <span class={styles.scaleMarkR}>+50</span>
        </div>

        <div class={styles.arcTrack}>
          <div class={styles.arcRedL} />
          <div class={styles.arcYellowL} />
          <div class={styles.arcGreen} />
          <div class={styles.arcYellowR} />
          <div class={styles.arcRedR} />
        </div>

        <div
          class={styles.needle}
          style={{
            transform: `rotate(${needleAngle()}deg)`,
            '--needle-color': needleColor(),
          }}
        />

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
                {tuneStatusLabel(r())}
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
          {(name, idx) => {
            const active = isStringActive(name)
            return (
              <button
                type="button"
                class={styles.stringBtn}
                classList={{ [styles.stringBtnActive]: active }}
                onClick={() =>
                  setManualString(manualString() === name ? null : name)
                }
                aria-label={`Tune ${name}`}
                aria-pressed={active}
              >
                <span class={styles.stringBtnLabel}>
                  {name.replace(/\d/, '')}
                </span>
                <span class={styles.stringBtnFreq}>
                  {tuningFreqs()[idx()].toFixed(1)}
                </span>
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}
