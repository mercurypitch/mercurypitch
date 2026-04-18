// ============================================================
// PitchDisplay — Shows detected pitch with cents indicator
// (mirrors #pitch-reference in the original JS app)
// ============================================================

import type { Component} from 'solid-js';
import { createMemo } from 'solid-js'
import type { PitchResult } from '@/types'

interface PitchDisplayProps {
  pitch: () => PitchResult | null
  targetNote: () => string | null
}

// Map cents to a CSS class for the marker color
function centsClass(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= 10) return 'in-tune'
  if (cents > 0) return 'sharp'
  return 'flat'
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

  // Map cents (-50 to +50) to left percentage (0% to 100%)
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
    <div id="pitch-reference">
      <h3>Your Pitch</h3>
      <div id="detected-note">{noteDisplay()}</div>
      <div id="detected-freq">{freqDisplay()}</div>
      <div id="cents-display">
        <div id="cents-bar">
          <div
            id="cents-marker"
            class={markerClass()}
            style={{ left: markerLeft() }}
          />
          <div class="cents-center" />
        </div>
        <div class="cents-labels">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>
    </div>
  )
}
