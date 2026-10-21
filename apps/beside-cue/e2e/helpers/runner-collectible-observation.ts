// Collectible host observation — count real artwork draws at paused raster checkpoints.
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
const { Scene: ObservedScene, Mesh: ObservedMesh } = await import('/@id/three');
const previousBeforeRender = ObservedScene.prototype.onBeforeRender;
const previousAfterRender = ObservedScene.prototype.onAfterRender;
const hadOwnBeforeRender = Object.hasOwn(ObservedScene.prototype, 'onBeforeRender');
const hadOwnAfterRender = Object.hasOwn(ObservedScene.prototype, 'onAfterRender');
const previousMeshBefore = ObservedMesh.prototype.onBeforeRender;
const previousMeshAfter = ObservedMesh.prototype.onAfterRender;
const hadOwnMeshBefore = Object.hasOwn(ObservedMesh.prototype, 'onBeforeRender');
const hadOwnMeshAfter = Object.hasOwn(ObservedMesh.prototype, 'onAfterRender');
let observedScene, observedDraws = 0, lastArtworkScale = null;
const drawStarts = new WeakMap();
const isHost = renderer => renderer.getRenderTarget() === null &&
  renderer.domElement.closest('[data-testid="song-runner-scene"]');
function beforeCollectibleFrame(...args) {
  const result = previousBeforeRender.apply(this, args);
  if (isHost(args[0])) {
    observedScene = this;
    window.hostRasterCheckpoints.beginFrame(args[0].getContext());
  }
  return result;
}
function afterCollectibleDraw(...args) {
  const result = previousAfterRender.apply(this, args);
  if (isHost(args[0])) window.hostRasterCheckpoints.finishFrame(args[0].getContext());
  return result;
}
function beforeArtworkDraw(...args) {
  const result = previousMeshBefore.apply(this, args);
  if (this.name === 'runner-collectible-c01' && isHost(args[0]))
    drawStarts.set(this, window.hostRasterCheckpoints.read().forwardedDraws);
  return result;
}
function afterArtworkDraw(...args) {
  const result = previousMeshAfter.apply(this, args);
  if (this.name === 'runner-collectible-c01' && isHost(args[0]) &&
      window.hostRasterCheckpoints.read().forwardedDraws > drawStarts.get(this)) {
    observedDraws++;
    lastArtworkScale = this.scale.toArray();
  }
  return result;
}
ObservedScene.prototype.onBeforeRender = beforeCollectibleFrame;
ObservedScene.prototype.onAfterRender = afterCollectibleDraw;
ObservedMesh.prototype.onBeforeRender = beforeArtworkDraw;
ObservedMesh.prototype.onAfterRender = afterArtworkDraw;
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
    if (ObservedScene.prototype.onBeforeRender === beforeCollectibleFrame) {
      if (hadOwnBeforeRender) ObservedScene.prototype.onBeforeRender = previousBeforeRender;
      else delete ObservedScene.prototype.onBeforeRender;
    }
    if (ObservedScene.prototype.onAfterRender === afterCollectibleDraw) {
      if (hadOwnAfterRender) ObservedScene.prototype.onAfterRender = previousAfterRender;
      else delete ObservedScene.prototype.onAfterRender;
    }
    if (ObservedMesh.prototype.onBeforeRender === beforeArtworkDraw) {
      if (hadOwnMeshBefore) ObservedMesh.prototype.onBeforeRender = previousMeshBefore;
      else delete ObservedMesh.prototype.onBeforeRender;
    }
    if (ObservedMesh.prototype.onAfterRender === afterArtworkDraw) {
      if (hadOwnMeshAfter) ObservedMesh.prototype.onAfterRender = previousMeshAfter;
      else delete ObservedMesh.prototype.onAfterRender;
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
  await expect
    .poll(() =>
      page.evaluate(() => window.collectibleHostObservation.read().draws),
    )
    .toBeGreaterThan(afterDraws)
  const observed = await page.evaluate(() =>
    window.collectibleHostObservation.read(),
  )
  expect(observed.draws).toBeGreaterThan(afterDraws)
  return observed
}
