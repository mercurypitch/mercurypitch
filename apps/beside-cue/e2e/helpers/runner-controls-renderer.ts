// Runner controls presentation — isolate the long real-audio course from software-GPU scheduling.

import type { Page } from '@playwright/test'
import type { createSongRunnerRenderer } from '../../../../packages/glass-game/src/render/runner-renderer'

/** No clock, input, audio, physics, score or progress authority lives in this fixture. */
const createControlsRenderer: typeof createSongRunnerRenderer = (container) => {
  const marker = document.createElement('div')
  marker.dataset.testid = 'runner-controls-presentation'
  container.append(marker)
  let disposed = false
  return {
    ready: Promise.resolve(),
    render(snapshot) {
      if (disposed) return false
      marker.dataset.courseSeconds = String(snapshot.courseSeconds)
      marker.dataset.status = snapshot.status
      return true
    },
    resize() {},
    metrics: () => ({
      drawCalls: 0,
      triangles: 0,
      residentChunks: 0,
      targets: 0,
    }),
    dispose() {
      disposed = true
      marker.remove()
    },
  }
}

/** Scoped module boundary; the application and its normal renderer have no test flags. */
export async function useRunnerControlsRenderer(page: Page): Promise<void> {
  await page.route(
    /\/packages\/glass-game\/src\/render\/runner-renderer\.ts(?:\?.*)?$/,
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export const createSongRunnerRenderer = ${createControlsRenderer.toString()};`,
      }),
  )
}
