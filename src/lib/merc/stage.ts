// ============================================================
// Merc stage — the app's way to put a live Merc on screen
// ============================================================
//
// mountMercStage never throws into the UI. Merc is decoration on top of an
// exercise, so when he cannot be drawn (no WebGL2, a shader the driver
// rejects, a context that never comes back) the stage reports ok: false and
// every method becomes a no-op; the exercise runs on without him. onFailure
// fires once, whenever that happens, so a host can swap in a still.
//
// A lost context (iOS drops it when the app goes to the background) is not a
// failure: the renderer rebuilds after the restore and ok stays true.

import type { MercQuality, MercState, MercView, MercViewName, } from './constants'
import type { MercRenderer } from './renderer'
import { mount } from './renderer'
import type { MercVoice } from './sim'

export interface MercStageOptions {
  /**
   * Default 'medium': one sample per pixel at three quarters of the size,
   * about a quarter of High's GPU time.
   */
  quality?: MercQuality
  /** Draw over the page instead of the opaque #0d1117 stage. */
  transparent?: boolean
  /** Default 'front'. */
  view?: MercViewName | MercView
  /** Default 'idle'. */
  state?: MercState
  /** Default min(2, devicePixelRatio). */
  pixelRatio?: number
  /** Called once, when Merc stops drawing for good (also during mount). */
  onFailure?: (reason: string) => void
}

export interface MercStage {
  /** False when Merc cannot be drawn; the methods are then no-ops. */
  readonly ok: boolean
  setState(name: MercState): void
  setVoice(voice: MercVoice): void
  /** Stops the frame loop (Merc holds his pose) until unpaused. */
  setPaused(paused: boolean): void
  /** Releases the loop, listeners, GL objects, the context and the canvas. */
  destroy(): void
}

const failedStage = (): MercStage => ({
  ok: false,
  setState() {},
  setVoice() {},
  setPaused() {},
  destroy() {},
})

const reasonOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

export function mountMercStage(
  container: HTMLElement,
  opts: MercStageOptions = {},
): MercStage {
  let reported = false
  const report = (err: unknown): void => {
    if (reported) return
    reported = true
    try {
      opts.onFailure?.(reasonOf(err))
    } catch (cbErr) {
      console.warn('[merc] onFailure threw:', cbErr)
    }
  }

  let renderer: MercRenderer
  try {
    renderer = mount(container, {
      quality: opts.quality ?? 'medium',
      transparent: opts.transparent ?? false,
      view: opts.view ?? 'front',
      state: opts.state ?? 'idle',
      pixelRatio: opts.pixelRatio,
      onFailure: report,
    })
  } catch (err) {
    console.warn('[merc] cannot draw Merc:', reasonOf(err))
    report(err)
    return failedStage()
  }

  let destroyed = false
  // Every call is guarded: a throw here would land in the host's handler.
  const guard = (fn: (r: MercRenderer) => void): void => {
    if (destroyed || !renderer.ok) return
    try {
      fn(renderer)
    } catch (err) {
      console.warn('[merc] stage call failed:', reasonOf(err))
      report(err)
      destroyed = true
      try {
        renderer.destroy()
      } catch {
        // Already failing; nothing further to release safely.
      }
    }
  }

  return {
    get ok() {
      return !destroyed && renderer.ok
    },
    setState(name) {
      guard((r) => r.setState(name))
    },
    setVoice(voice) {
      guard((r) => r.setVoice(voice))
    },
    setPaused(paused) {
      guard((r) => r.setPaused(paused))
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      try {
        renderer.destroy()
      } catch (err) {
        console.warn('[merc] destroy failed:', reasonOf(err))
      }
    },
  }
}
