import type { Accessor, Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { createDprWatcher, createRedrawScheduler, syncCanvasBacking, } from '@/lib/canvas-size-sync'
import type { ZenCanvasRenderModel } from './zen-canvas-renderer'
import { renderZenPitchCanvas } from './zen-canvas-renderer'
import styles from './ZenPitchCanvas.module.css'

interface ZenPitchCanvasProps {
  model: Accessor<ZenCanvasRenderModel>
  summary: Accessor<string>
}

export const ZenPitchCanvas: Component<ZenPitchCanvasProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let snapshot: ZenCanvasRenderModel | null = null
  let observer: ResizeObserver | null = null

  const draw = (): void => {
    if (canvas === undefined || snapshot === null) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    syncCanvasBacking(canvas, dpr)
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderZenPitchCanvas(ctx, rect.width, rect.height, snapshot)
  }

  const redraw = createRedrawScheduler(draw)

  createEffect(() => {
    snapshot = props.model()
    redraw.queue()
  })

  onMount(() => {
    if (canvas === undefined) return
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => redraw.queue())
      observer.observe(canvas)
    }
    const dprWatcher =
      typeof window.matchMedia === 'function'
        ? createDprWatcher(() => redraw.queue())
        : null
    window.addEventListener('resize', redraw.queue)
    redraw.queue()
    onCleanup(() => {
      dprWatcher?.dispose()
      window.removeEventListener('resize', redraw.queue)
    })
  })

  onCleanup(() => {
    observer?.disconnect()
    redraw.cancel()
  })

  return (
    <div class={styles.frame} data-testid="zen-pitch-canvas">
      <canvas
        ref={canvas}
        class={styles.canvas}
        role="img"
        aria-label="Live singing pitch moving from left to right"
        aria-describedby="zen-pitch-summary"
      />
      <span id="zen-pitch-summary" class={styles.srSummary}>
        {props.summary()}
      </span>
    </div>
  )
}
