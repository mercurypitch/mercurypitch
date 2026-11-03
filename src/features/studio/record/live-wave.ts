// ============================================================
// Studio live wave — the take's waveform as it records, on one canvas the width of the view, drawing only the columns each chunk adds
// ============================================================
//
// The canvas keeps the width of the lane's view while the take grows over
// it (StudioLaneTake.tsx clips it to the take), so a chunk neither resizes
// it, which would clear it, nor draws it again: it draws its own columns,
// and the column before them, which the chunk may have finished. Anything
// that moves what is under a column draws it all again: a scroll, a zoom,
// a loop's next pass starting over the range, a resize. Its height and
// colour are read then too, never per chunk: reading them makes the browser
// lay out and style the page there and then.
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioLiveTake } from '@/lib/studio/record/recorder-types'

/** What is in view: song frames from `firstFrame`, `framesPerPixel` to a column. */
export interface StudioLiveWaveView {
  readonly live: StudioLiveTake
  /** The song frame the take's first sample is drawn on. */
  readonly origin: number
  readonly firstFrame: number
  readonly framesPerPixel: number
  /** Columns of the take in view now. */
  readonly width: number
  /** The canvas's width: the lane's view. */
  readonly viewWidth: number
}

export function createStudioLiveWave() {
  let key = ''
  let drawnTo = 0
  let height = 40
  let color = ''

  function columns(
    context: CanvasRenderingContext2D,
    view: StudioLiveWaveView,
    from: number,
    to: number,
  ): void {
    const { live, origin, firstFrame, framesPerPixel } = view
    context.clearRect(from, 0, to - from, height)
    context.fillStyle = color
    const toBucket =
      live.sampleRate / STUDIO_SAMPLE_RATE / live.peaks.bucketFrames
    const middle = height / 2
    const reach = middle - 2
    for (let x = from; x < to; x++) {
      const frame = firstFrame + x * framesPerPixel - origin
      const first = Math.max(0, Math.floor(frame * toBucket))
      const last = Math.min(
        live.count,
        Math.ceil((frame + framesPerPixel) * toBucket),
      )
      let peak = 0
      let loud = 0
      for (let bucket = first; bucket < last; bucket++) {
        peak = Math.max(peak, live.peaks.peaks[bucket])
        loud = Math.max(loud, live.peaks.rms[bucket])
      }
      // As the saved clip draws it (StudioWaveform.tsx): the peaks pale, the
      // loudness solid, so the take keeps its shape when it lands.
      const high = Math.max(0.5, Math.min(1, peak) * reach)
      const body = Math.max(0.5, Math.min(1, peak, loud) * reach)
      context.globalAlpha = 0.42
      context.fillRect(x, middle - high, 1, high * 2)
      context.globalAlpha = 1
      context.fillRect(x, middle - body, 1, body * 2)
    }
  }

  return {
    /** Draw what `view` adds since the last draw, or all of it when anything under it moved. */
    draw(canvas: HTMLCanvasElement, view: StudioLiveWaveView): void {
      const ratio = globalThis.devicePixelRatio || 1
      const next = `${view.origin}|${view.firstFrame}|${view.framesPerPixel}|${view.viewWidth}|${ratio}`
      const whole = next !== key || view.width < drawnTo
      if (whole) {
        // The laid-out height: the flex column sizes the canvas, not its pixels.
        height = canvas.clientHeight > 0 ? canvas.clientHeight : 40
        color = window.getComputedStyle(canvas).color
        const pixelWidth = Math.max(1, Math.round(view.viewWidth * ratio))
        const pixelHeight = Math.max(1, Math.round(height * ratio))
        // Resizing clears and reallocates the canvas: only when its size moves.
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight
      }
      const context = canvas.getContext('2d')
      if (context === null) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const from = whole ? 0 : Math.max(0, drawnTo - 1)
      const to = Math.min(view.width, view.viewWidth)
      if (whole) context.clearRect(0, 0, view.viewWidth, height)
      if (to > from) columns(context, view, from, to)
      key = next
      drawnTo = to
    },
    /** The canvas changed size or was made again: the next draw draws it all. */
    reset(): void {
      key = ''
      drawnTo = 0
    },
  }
}
