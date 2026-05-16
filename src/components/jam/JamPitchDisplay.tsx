// ── JamPitchDisplay ──────────────────────────────────────────────────
// Compact pitch display for jam sessions. Shows detected note name,
// frequency, and a cents deviation bar (-50 to +50).

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { jamLocalPitch } from '@/stores/jam-store'
import styles from './JamPitchDisplay.module.css'

export const JamPitchDisplay: Component = () => {
  const noteLabel = createMemo(() => {
    const p = jamLocalPitch()
    return p && p.noteName ? p.noteName : '--'
  })

  const freqLabel = createMemo(() => {
    const p = jamLocalPitch()
    return p && p.frequency > 0 ? `${p.frequency.toFixed(1)} Hz` : '-- Hz'
  })

  const markerLeft = createMemo(() => {
    const p = jamLocalPitch()
    if (!p || p.frequency === 0) return '50%'
    return `${Math.max(0, Math.min(100, ((p.cents + 50) / 100) * 100))}%`
  })

  const markerClass = createMemo(() => {
    const p = jamLocalPitch()
    if (!p || p.frequency === 0) return ''
    const abs = Math.abs(p.cents)
    if (abs <= 10) return styles.inTune
    return p.cents > 0 ? styles.sharp : styles.flat
  })

  return (
    <div class={styles.pitchDisplay}>
      <Show
        when={jamLocalPitch()}
        fallback={<span class={styles.waiting}>Listening...</span>}
      >
        <span class={styles.note}>{noteLabel()}</span>
        <span class={styles.freq}>{freqLabel()}</span>
        <div class={styles.centsBar}>
          <div
            class={`${styles.centsMarker} ${markerClass()}`}
            style={{ left: markerLeft() }}
          />
          <div class={styles.centsCenter} />
        </div>
        <div class={styles.centsLabels}>
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </Show>
    </div>
  )
}
