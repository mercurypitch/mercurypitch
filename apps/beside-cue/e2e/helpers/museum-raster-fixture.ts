// Museum layout fixture — real 3D checkpoint frames surround native DOM interaction checks.
import type { Page } from '@playwright/test'
import { installHostRasterCheckpoints, renderHostCheckpoint, restoreHostRaster, } from './host-raster-checkpoints'

declare global {
  interface Window {
    museumLayoutObservation?: { dispose(): void }
  }
}

export async function installMuseumLayoutRaster(page: Page): Promise<void> {
  await installHostRasterCheckpoints(page, '[data-map-state]')
  await page.route('**/src/games/adventure/standalone.tsx*', async (route) => {
    const response = await route.fetch()
    const entry = await response.text()
    await route.fulfill({
      response,
      body: `
const { Scene: LayoutScene } = await import('/@id/three');
const before = LayoutScene.prototype.onBeforeRender;
const after = LayoutScene.prototype.onAfterRender;
const ownBefore = Object.hasOwn(LayoutScene.prototype, 'onBeforeRender');
const ownAfter = Object.hasOwn(LayoutScene.prototype, 'onAfterRender');
const isMap = renderer => renderer.getRenderTarget() === null &&
  renderer.domElement.closest('[data-map-state]');
function beforeLayout(...args) {
  const result = before.apply(this, args);
  if (isMap(args[0])) window.hostRasterCheckpoints.beginFrame(args[0].getContext());
  return result;
}
function afterLayout(...args) {
  const result = after.apply(this, args);
  if (isMap(args[0])) window.hostRasterCheckpoints.finishFrame(args[0].getContext());
  return result;
}
LayoutScene.prototype.onBeforeRender = beforeLayout;
LayoutScene.prototype.onAfterRender = afterLayout;
window.museumLayoutObservation = { dispose() {
  if (LayoutScene.prototype.onBeforeRender === beforeLayout) {
    if (ownBefore) LayoutScene.prototype.onBeforeRender = before;
    else delete LayoutScene.prototype.onBeforeRender;
  }
  if (LayoutScene.prototype.onAfterRender === afterLayout) {
    if (ownAfter) LayoutScene.prototype.onAfterRender = after;
    else delete LayoutScene.prototype.onAfterRender;
  }
} };
${entry}`,
    })
  })
}

export async function renderMuseumLayoutFrame(page: Page): Promise<void> {
  if (await page.locator('[data-map-state]').count())
    await renderHostCheckpoint(page)
}

export async function restoreMuseumLayoutRaster(page: Page): Promise<void> {
  if (page.isClosed()) return
  try {
    await page.evaluate(() => window.museumLayoutObservation?.dispose())
  } finally {
    await restoreHostRaster(page)
  }
}
