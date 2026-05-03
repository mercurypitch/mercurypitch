// ============================================================
// VolumeGroup - Shared volume control component
// ============================================================

import type { Accessor, Component } from 'solid-js'
import styles from '@/components/HeaderControls.module.css'

interface VolumeGroupProps {
  volume: Accessor<number>
  onVolumeChange: (vol: number) => void
  id?: string
}

// Clamp value between min and max
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export const VolumeGroup: Component<VolumeGroupProps> = (props) => (
  <div class={styles.volumeGroup}>
    <label class={styles.optLabel}>Vol:</label>
    <input
      type="range"
      id={props.id ?? 'volume'}
      min="0"
      max="100"
      value={props.volume()}
      class={styles.volumeSlider}
      onInput={(e) => {
        let vol = parseInt(e.currentTarget.value, 10)
        // Fallback only if the value is not a valid number
        if (isNaN(vol)) vol = 80
        // Clamp to valid range
        vol = clamp(vol, 0, 100)
        props.onVolumeChange(vol)
      }}
    />
    <span class="volume-value">{props.volume()}</span>
  </div>
)
