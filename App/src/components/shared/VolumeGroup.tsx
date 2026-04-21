// ============================================================
// VolumeGroup - Shared volume control component
// ============================================================

import type { Component } from 'solid-js'

interface VolumeGroupProps {
  volume: () => number
  onVolumeChange: (vol: number) => void
  id?: string
}

export const VolumeGroup: Component<VolumeGroupProps> = (props) => (
  <div class="volume-group">
    <label class="opt-label">Vol:</label>
    <input
      type="range"
      id={props.id ?? 'volume'}
      min="0"
      max="100"
      value={props.volume()}
      class="volume-slider"
      onInput={(e) => {
        const vol = parseInt(e.currentTarget.value) || 80
        props.onVolumeChange(vol)
      }}
    />
    <span class="volume-value">{props.volume()}</span>
  </div>
)
