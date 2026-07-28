// ============================================================
// Take spectrogram — renders the worker's pre-binned image
//
// SpectrogramCanvas scrolls one live frame at a time. A recorded take is the
// other shape: the whole thing is already known, so it draws once from the
// column-major Uint8 grid the worker produced.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onMount } from 'solid-js'
import type { ColourMapId } from '@/lib/colour-maps'
import { getColourMap } from '@/lib/colour-maps'
import type { TakeAnalysisResult } from '@/lib/take-analysis-client'
import styles from './AnalysisDashboard.module.css'

export interface TakeSpectrogramProps {
  analysis: TakeAnalysisResult
  colourMap?: ColourMapId
}

export const TakeSpectrogram: Component<TakeSpectrogramProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined

  const draw = () => {
    if (!canvas) return
    const { image, cols, rows } = props.analysis
    if (cols === 0 || rows === 0) return

    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    // Draw at native grid size, then let CSS scale it to the container —
    // one putImageData instead of a per-pixel loop over the display size.
    canvas.width = cols
    canvas.height = rows

    const colour = getColourMap(props.colourMap ?? 'viridis')
    const imageData = ctx.createImageData(cols, rows)
    const out = imageData.data

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Row 0 is the lowest frequency; canvas y grows downward, so flip.
        const y = rows - 1 - r
        const [red, green, blue] = colour(image[c * rows + r] / 255)
        const idx = (y * cols + c) * 4
        out[idx] = red
        out[idx + 1] = green
        out[idx + 2] = blue
        out[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

  onMount(draw)
  createEffect(draw)

  return (
    <div>
      <div class={styles.spectrogramWrap}>
        <div class={styles.traceAxis}>
          <span>{Math.round(props.analysis.maxFreq / 1000)}k</span>
          <span>0 Hz</span>
        </div>
        <canvas ref={canvas} class={styles.spectrogramCanvas} />
      </div>
      <div class={styles.trendFoot}>
        <span>0s</span>
        <span>
          {props.analysis.truncated ? 'First 5 minutes' : 'Frequency over time'}
        </span>
        <span>{Math.round(props.analysis.durationSec)}s</span>
      </div>
    </div>
  )
}
