// ============================================================
// GuitarTuner — point the mic at your guitar and tune up.
//
// Renders a needle-style display with cent deviation, auto-detects
// which string is being played, and shows flat/in-tune/sharp state.
// Uses the existing PitchDetector for frequency detection.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, Match, onCleanup, Show, Switch, } from 'solid-js'
import { computeCentsDeviation, frequencyToMidi } from '@/lib/frequency-to-note'
import type { TunerResult, TuningPreset } from '@/lib/guitar/tuner'
import { classifyPitch, getTuningFrequencies, getTuningStringNames, STRING_LABELS, TUNER_CLOSE_CENTS, TUNER_IN_TUNE_CENTS, } from '@/lib/guitar/tuner'
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

// ── Inline status icons (no text glyphs — house style) ────────
// Small currentColor-stroked SVGs matching the project icon set.

const ICON_SIZE = 14

const CheckIcon: Component = () => (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CloseTuneIcon: Component = () => (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)

const SharpIcon: Component = () => (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

const FlatIcon: Component = () => (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

// ── Props ─────────────────────────────────────────────────────

interface GuitarTunerProps {
  /** Whether the tuner is actively listening. */
  isActive: () => boolean
  /** Gets the latest time-domain audio data from the mic. */
  getTimeData: () => Float32Array
  /** Audio context sample rate (0 if not ready). */
  sampleRate: () => number
  /** Play a reference tone at the given frequency, so the user can tune the
   *  string by ear. Omitted = the note buttons only toggle the manual target. */
  onPlayNote?: (frequency: number) => void
}

// ── Helpers ───────────────────────────────────────────────────

function pickNeedleColor(r: TunerResult): string {
  if (r.inTune) return COLOR_IN_TUNE
  if (r.close) return COLOR_CLOSE
  return COLOR_SHARP_FLAT
}

/** Icon + label for the current tuning state (no text glyphs). */
const TuneStatus: Component<{ result: TunerResult }> = (props) => (
  <Switch>
    <Match when={props.result.inTune}>
      <CheckIcon /> In Tune
    </Match>
    <Match when={props.result.close}>
      <CloseTuneIcon /> Close
    </Match>
    <Match when={props.result.centsDeviation > 0}>
      <SharpIcon /> Sharp
    </Match>
    <Match when={props.result.centsDeviation <= 0}>
      <FlatIcon /> Flat
    </Match>
  </Switch>
)

/**
 * Build a manual-override result. Returns a NEW object — never mutates
 * the input, so Solid signals fire correctly. Classifies against the
 * chosen string's target in the *selected* tuning (targetHz), not the
 * standard-tuning frequency, so alternate presets override correctly.
 */
function manualTuneResult(
  frequency: number,
  clarity: number,
  manualString: string,
  targetHz: number,
): TunerResult {
  const cents = computeCentsDeviation(
    frequencyToMidi(frequency, false),
    frequencyToMidi(targetHz, false),
  )
  const absCents = Math.abs(cents)
  return {
    frequency,
    clarity,
    midi: frequencyToMidi(frequency),
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
        // Classify against the SELECTED preset's strings so alternate
        // tunings actually retune (not just relabel).
        const freqs = tuningFreqs()
        const names = tuningNames()
        const ms = manualString()
        const manualIdx = ms != null && ms !== '' ? names.indexOf(ms) : -1
        // Manual mode tunes to the chosen string with NO signal gate — the
        // user declared intent, so show the deviation even when the string is
        // far off (a fresh/slack string can sit >50 cents from everything).
        // Auto mode keeps the gate so off-string noise can't read "in tune".
        const final =
          manualIdx >= 0
            ? manualTuneResult(
                detected.frequency,
                detected.clarity,
                names[manualIdx],
                freqs[manualIdx],
              )
            : classifyPitch(detected.frequency, detected.clarity, freqs, names)

        if (final) {
          // Stability tracking: same string for N consecutive frames.
          if (final.stringName === prevString) {
            stableCounter++
          } else {
            stableCounter = 0
            prevString = final.stringName
          }
          setStable(stableCounter >= STABILITY_FRAMES)
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
                <TuneStatus result={r()} />
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
                onClick={() => {
                  // Sound the string's reference pitch (tune by ear)...
                  props.onPlayNote?.(tuningFreqs()[idx()])
                  // ...and focus the tuner on this string (click again to
                  // release back to auto-detect).
                  setManualString(manualString() === name ? null : name)
                }}
                aria-label={`Play and tune ${name}`}
                title={`Play ${name.replace(/\d/, '')} reference tone`}
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
