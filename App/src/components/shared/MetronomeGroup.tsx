// ============================================================
// MetronomeGroup - Shared metronome control component
// ============================================================

import type { Component } from 'solid-js'
import { MetronomeButton } from '@/components/MetronomeButton'

interface MetronomeGroupProps {
  active: () => boolean
  onClick: () => void
}

export const MetronomeGroup: Component<MetronomeGroupProps> = (props) => (
  <div class="metronome-group">
    <MetronomeButton active={props.active()} onClick={props.onClick} />
  </div>
)