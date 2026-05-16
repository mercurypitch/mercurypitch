// ── JamPitchDisplay ──────────────────────────────────────────────────
// Compact pitch display for jam sessions. Shows detected note name,
// frequency, and a cents deviation bar (-50 to +50).

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { jamLocalPitch } from '@/stores/jam-store'

function centsClass(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= 10) return 'in-tune'
  return cents > 0 ? 'sharp' : 'flat'
}

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
    return p && p.frequency > 0 ? centsClass(p.cents) : ''
  })

  return (
    <div class="jam-pitch-display">
      <Show when={jamLocalPitch()} fallback={<span class="jam-pitch-waiting">Listening...</span>}>
        <span class="jam-pitch-note">{noteLabel()}</span>
        <span class="jam-pitch-freq">{freqLabel()}</span>
        <div class="jam-cents-bar">
          <div class={`jam-cents-marker ${markerClass()}`} style={{ left: markerLeft() }} />
          <div class="jam-cents-center" />
        </div>
        <div class="jam-cents-labels">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </Show>
    </div>
  )
}
