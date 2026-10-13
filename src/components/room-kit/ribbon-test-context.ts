// ============================================================
// A 2D context that records the voice ribbon, for the ribbon's tests
// ============================================================
//
// Long note's trace and Echo's ribbon both draw with ribbon.ts; their tests
// read the strokes through this. jsdom has no canvas. This stands in for
// one: every call is a no-op except the ones the ribbon is made of, which
// it keeps, so a test can read which colours each stroke's gradient carried
// and where along the ribbon.

export interface RecordedStroke {
  /** The stroke's gradient stops in order; empty for a plain colour. */
  stops: readonly (readonly [number, string])[]
  width: number
}

export interface RecordingContext {
  ctx: CanvasRenderingContext2D
  strokes: RecordedStroke[]
}

export function recordingContext(): RecordingContext {
  const strokes: RecordedStroke[] = []
  const state: Record<string | symbol, unknown> = {}
  const gradient = (): CanvasGradient & {
    stops: (readonly [number, string])[]
  } => {
    const stops: (readonly [number, string])[] = []
    return {
      stops,
      addColorStop: (offset: number, colour: string) => {
        stops.push([offset, colour])
      },
    }
  }
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'createLinearGradient') return gradient
      if (key === 'stroke') {
        return () => {
          const style = target.strokeStyle as { stops?: [number, string][] }
          strokes.push({
            stops: typeof style === 'object' ? (style.stops ?? []) : [],
            width: Number(target.lineWidth),
          })
        }
      }
      if (key in target) return target[key]
      return () => undefined
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes }
}

export interface RibbonColour {
  at: number
  /** Warm, more red than blue: the amber of a stretch off the line. */
  amber: boolean
  alpha: number
}

/** A gradient's stops as colours; fully clear stops are left out. */
export function ribbonColours(
  stops: readonly (readonly [number, string])[],
): RibbonColour[] {
  const out: RibbonColour[] = []
  for (const [at, colour] of stops) {
    const m =
      /rgba\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?), ([\d.e-]+)\)/.exec(
        colour,
      )
    if (m === null) continue
    const alpha = Number(m[4])
    if (alpha <= 0) continue
    out.push({ at, amber: Number(m[1]) > Number(m[3]), alpha })
  }
  return out
}
