// ============================================================
// PitchDisplay — Shows detected pitch with cents indicator
// ============================================================

import type { Component } from 'solid-js'
import { createMemo } from 'solid-js'
import type { PitchResult } from '@/types'
import styles from './PitchDisplay.module.css'

interface PitchDisplayProps {
  pitch: () => PitchResult | null
  targetNote: () => string | null
}

function centsClass(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= 10) return styles.inTune
  if (cents > 0) return styles.sharp
  return styles.flat
}

export const PitchDisplay: Component<PitchDisplayProps> = (props) => {
  const noteDisplay = createMemo(() => {
    const p = props.pitch()
    if (!p || !p.noteName) return '--'
    return `${p.noteName}${p.octave}`
  })

  const freqDisplay = createMemo(() => {
    const p = props.pitch()
    if (!p || !p.noteName) return '-- Hz'
    return `${p.frequency.toFixed(1)} Hz`
  })

  const markerLeft = createMemo(() => {
    const p = props.pitch()
    if (!p || !p.noteName) return '50%'
    const pct = ((p.cents + 50) / 100) * 100
    return `${Math.max(0, Math.min(100, pct))}%`
  })

  const markerClass = createMemo(() => {
    const p = props.pitch()
    if (!p || !p.noteName) return ''
    return centsClass(p.cents)
  })

  return (
    <div class={styles.root}>
      <h3 class={styles.title}>Your Pitch</h3>
      <div class={styles.noteName}>{noteDisplay()}</div>
      <div class={styles.frequency}>{freqDisplay()}</div>
      <div class={styles.centsDisplay}>
        <div class={styles.centsBar}>
          <div
            class={`${styles.marker} ${markerClass()}`}
            style={{ left: markerLeft() }}
          />
          <div class={styles.centsCenter} />
        </div>
        <div class={styles.labels}>
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>
    </div>
  )
}
