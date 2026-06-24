// ============================================================
// SpectrogramPane — Wrapper around SpectrogramCanvas for pane system
// ============================================================

import type { Component } from 'solid-js'
import { SpectrogramCanvas } from '@/components/SpectrogramCanvas'
import type { ColourMapId } from '@/lib/colour-maps'

interface SpectrogramPaneProps {
  magnitudeSpectrum: Float32Array | null
  phaseSpectrum?: Float32Array | null | undefined
  sampleRate: number
  isActive: boolean
  timeRange: [number, number]
  height: number
  colourMap?: ColourMapId
  peakBinsOnly?: boolean
}

export const SpectrogramPane: Component<SpectrogramPaneProps> = (props) => {
  return (
    <div
      style={{
        width: '100%',
        height: `${props.height}px`,
        position: 'relative',
      }}
    >
      <SpectrogramCanvas
        magnitudeSpectrum={props.magnitudeSpectrum}
        phaseSpectrum={props.phaseSpectrum}
        sampleRate={props.sampleRate}
        isActive={props.isActive}
        colourMap={props.colourMap}
        peakBinsOnly={props.peakBinsOnly}
        showPianoKeys
      />
    </div>
  )
}
