// ============================================================
// CentsDeviationPane — Wrapper around CentsDeviationCanvas for pane system
// ============================================================

import type { Component } from 'solid-js'
import { CentsDeviationCanvas } from '@/components/CentsDeviationCanvas'

interface CentsDeviationPaneProps {
  centsOffset: number | null
  targetNote: string | null
  height: number
  isActive: boolean
}

export const CentsDeviationPane: Component<CentsDeviationPaneProps> = (
  props,
) => {
  return (
    <div
      style={{
        width: '100%',
        height: `${props.height}px`,
        position: 'relative',
      }}
    >
      <CentsDeviationCanvas
        centsOffset={props.centsOffset}
        targetNote={props.targetNote}
        isActive={props.isActive}
      />
    </div>
  )
}
