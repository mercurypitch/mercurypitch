import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import type { AccuracyTier, SensitivityPreset } from '@/stores/settings-store'
import { accuracyTier, applyAccuracyTier, applySensitivityPreset, sensitivityPreset, } from '@/stores/settings-store'
import styles from './MicSensitivityControls.module.css'

const TIERS: Array<{ value: AccuracyTier; label: string }> = [
  { value: 'learning', label: 'Learning' },
  { value: 'singer', label: 'Singer' },
  { value: 'professional', label: 'Professional' },
]

const ROOMS: Array<{ value: SensitivityPreset; label: string }> = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'home', label: 'Home' },
  { value: 'noisy', label: 'Noisy' },
]

/**
 * Quick mic/scoring presets for the sidebar. Surfaces the existing
 * accuracy-tier (scoring strictness) and sensitivity (room noise) presets that
 * otherwise only live in the Settings page, plus an opt-in auto-calibrate.
 */
export function MicSensitivityControls(props: {
  onAutoCalibrate?: () => void | Promise<void>
}): JSX.Element {
  const [calibrating, setCalibrating] = createSignal(false)

  const runCalibrate = async () => {
    if (calibrating()) return
    setCalibrating(true)
    try {
      await props.onAutoCalibrate?.()
    } finally {
      setCalibrating(false)
    }
  }

  return (
    <div
      class="mic-sensitivity-controls"
      style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}
    >
      <div
        style={{ display: 'flex', 'flex-direction': 'column', gap: '0.2rem' }}
      >
        <span style={{ 'font-size': '0.7rem', opacity: '0.7' }}>
          Strictness
        </span>
        <SegmentedControl
          options={TIERS}
          value={accuracyTier()}
          onChange={applyAccuracyTier}
          ariaLabel="Scoring strictness"
          grow
        />
      </div>

      <div
        style={{ display: 'flex', 'flex-direction': 'column', gap: '0.2rem' }}
      >
        <span style={{ 'font-size': '0.7rem', opacity: '0.7' }}>Room</span>
        <SegmentedControl
          options={ROOMS}
          value={sensitivityPreset()}
          onChange={applySensitivityPreset}
          ariaLabel="Room noise"
          grow
        />
      </div>

      <button
        type="button"
        class={styles.autoBtn}
        classList={{ [styles.calibrating]: calibrating() }}
        disabled={calibrating()}
        onClick={() => void runCalibrate()}
        title="Sample the room for ~1s and pick a sensitivity"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="1" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="23" />
        </svg>
        {calibrating() ? 'Calibrating…' : 'Auto-calibrate'}
      </button>
    </div>
  )
}
