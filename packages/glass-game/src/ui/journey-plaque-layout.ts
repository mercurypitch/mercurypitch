// Journey plaque layout — cache museum HUD measurements outside the scene animation loop.

import type { JourneyLabelBounds } from './journey-plaque-placement'
import { journeyPlaquePlacement } from './journey-plaque-placement'

export interface JourneyPlaqueLayout {
  refresh(): void
  update(stageId: string, x: number, y: number): void
  dispose(): void
}

export function createJourneyPlaqueLayout(deps: {
  container: HTMLElement
  labels: ReadonlyMap<string, HTMLButtonElement>
  plaqueSelector: string
  obstacles(): readonly (HTMLElement | undefined)[]
}): JourneyPlaqueLayout {
  const sizes = new Map<
    string,
    {
      element: HTMLButtonElement
      width: number
      height: number
      buttonWidth: number
      buttonHeight: number
      bounds: JourneyLabelBounds
    }
  >()
  const observed = new Set<Element>()
  const viewport = { left: 0, top: 0, right: 0, bottom: 0 }
  let obstacles: JourneyLabelBounds[] = []
  let frame: number | undefined
  let disposed = false
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(refresh)

  function refresh(): void {
    if (!disposed && frame === undefined) frame = requestAnimationFrame(measure)
  }

  function measure(): void {
    frame = undefined
    const bounds = deps.container.getBoundingClientRect()
    viewport.right = bounds.width
    viewport.bottom = bounds.height
    const targets = new Set<Element>([deps.container])
    obstacles = []
    for (const element of deps.obstacles()) {
      if (element === undefined) continue
      targets.add(element)
      const box = element.getBoundingClientRect()
      if (box.width > 0 && box.height > 0)
        obstacles.push({
          left: box.left - bounds.left,
          top: box.top - bounds.top,
          right: box.right - bounds.left,
          bottom: box.bottom - bounds.top,
        })
    }
    sizes.clear()
    for (const [stageId, element] of deps.labels) {
      targets.add(element)
      const plaque = element.querySelector<HTMLElement>(deps.plaqueSelector)
      if (plaque === null) continue
      targets.add(plaque)
      const box = plaque.getBoundingClientRect()
      const button = element.getBoundingClientRect()
      sizes.set(stageId, {
        element,
        width: box.width,
        height: box.height,
        buttonWidth: button.width,
        buttonHeight: button.height,
        bounds: { left: 0, top: 0, right: 0, bottom: 0 },
      })
    }
    for (const element of observed) {
      if (targets.has(element)) continue
      observer?.unobserve(element)
      observed.delete(element)
    }
    for (const element of targets) {
      if (observed.has(element)) continue
      observer?.observe(element)
      observed.add(element)
    }
  }

  function update(stageId: string, x: number, y: number): void {
    const entry = sizes.get(stageId)
    if (entry === undefined) return
    // The existing cartouche transform includes a 12px leader and centers X.
    entry.bounds.left = x - entry.buttonWidth / 2
    entry.bounds.right = x + entry.buttonWidth / 2
    entry.bounds.top = y + 12
    entry.bounds.bottom = y + 12 + entry.buttonHeight
    const placement = journeyPlaquePlacement(
      entry.bounds,
      entry.width,
      entry.height,
      viewport,
      obstacles,
    )
    if (entry.element.dataset.plaquePlacement !== placement)
      entry.element.dataset.plaquePlacement = placement
  }

  window.addEventListener('resize', refresh)
  refresh()
  return {
    refresh,
    update,
    dispose() {
      disposed = true
      if (frame !== undefined) cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', refresh)
      sizes.clear()
      observed.clear()
    },
  }
}
