// Collectible host observation — inspect completed real scene draws without changing rendering or game state.
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

interface CollectibleHostDraw {
  draws: number
  pickupId: string | null
  scale: number[] | null
  lastDrawScale: number[] | null
}

declare global {
  interface Window {
    collectibleHostObservation: {
      read(): CollectibleHostDraw
      dispose(): void
    }
  }
}

/** Install before the actual entry mounts, using the host's shared Three module. */
export async function observeCollectibleHost(page: Page) {
  await page.route('**/src/games/adventure/standalone.tsx*', async (route) => {
    const response = await route.fetch()
    const entry = await response.text()
    await route.fulfill({
      response,
      body: `
const { Scene: ObservedScene } = await import('/@id/three');
const previousAfterRender = ObservedScene.prototype.onAfterRender;
const hadOwnAfterRender = Object.hasOwn(ObservedScene.prototype, 'onAfterRender');
let observedScene, observedDraws = 0, lastArtworkScale = null;
function afterCollectibleDraw(...args) {
  const result = previousAfterRender.apply(this, args);
  const renderer = args[0];
  if (renderer.getRenderTarget() === null &&
      renderer.domElement.closest('[data-testid="song-runner-scene"]')) {
    observedScene = this;
    const artwork = this.getObjectByName('runner-collectible-c01');
    if (artwork?.visible) {
      observedDraws++;
      lastArtworkScale = artwork.scale.toArray();
    }
  }
  return result;
}
ObservedScene.prototype.onAfterRender = afterCollectibleDraw;
window.collectibleHostObservation = {
  read() {
    const artwork = observedScene?.getObjectByName('runner-collectible-c01');
    return {
      draws: observedDraws,
      pickupId: artwork?.userData.pickupId ?? null,
      scale: artwork?.scale.toArray() ?? null,
      lastDrawScale: lastArtworkScale,
    };
  },
  dispose() {
    if (ObservedScene.prototype.onAfterRender === afterCollectibleDraw) {
      if (hadOwnAfterRender) ObservedScene.prototype.onAfterRender = previousAfterRender;
      else delete ObservedScene.prototype.onAfterRender;
    }
    observedScene = undefined;
  },
};
${entry}`,
    })
  })
}

/** Require both the actual host mesh and a completed host draw at the chosen size. */
export async function expectCollectibleHostScale(
  page: Page,
  pickupId: string,
  scale: number,
  afterDraws: number,
) {
  await expect
    .poll(() => page.evaluate(() => window.collectibleHostObservation.read()))
    .toMatchObject({
      pickupId,
      scale: [scale, scale, scale],
      lastDrawScale: [scale, scale, scale],
    })
  const observed = await page.evaluate(() =>
    window.collectibleHostObservation.read(),
  )
  expect(observed.draws).toBeGreaterThan(afterDraws)
  return observed
}
