// ============================================================
// SpeedGroup - Shared speed control component
// ============================================================

import type { Component } from 'solid-js'
import styles from '@/components/HeaderControls.module.css'

interface SpeedGroupProps {
  speed: number
  onSpeedChange: (speed: number) => void
}

export const SpeedGroup: Component<SpeedGroupProps> = (props) => (
  <div class={styles.speedGroup}>
    <label class={styles.optLabel}>Speed:</label>
    <select
      id="speed-select"
      value={props.speed.toString()}
      class={styles.speedSelect}
      onChange={(e) => {
        const speed = parseFloat(e.currentTarget.value)
        props.onSpeedChange(speed)
      }}
    >
      <option value="0.25">0.25x</option>
      <option value="0.5">0.5x</option>
      <option value="0.75">0.75x</option>
      <option value="1">1x</option>
      <option value="1.25">1.25x</option>
      <option value="1.5">1.5x</option>
      <option value="2">2x</option>
    </select>
  </div>
)
