// Journey hit-test observation — project the rendered pod surface independently from its offset label.
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    journeyMedallionObservation: {
      point(stageId: string): { x: number; y: number } | null
      dispose(): void
    }
  }
}

/** Read the live scene camera and pod transforms without changing selection or rendering. */
export async function observeJourneyMedallions(page: Page): Promise<void> {
  await page.route('**/src/games/adventure/standalone.tsx*', async (route) => {
    const response = await route.fetch()
    const entry = await response.text()
    await route.fulfill({
      response,
      body: `
const { Scene: JourneyObservedScene, Vector3: JourneyObservedVector } = await import('/@id/three');
const journeyAfterRender = JourneyObservedScene.prototype.onAfterRender;
const journeyHadOwnAfterRender = Object.hasOwn(JourneyObservedScene.prototype, 'onAfterRender');
let journeyObservedScene, journeyObservedCamera, journeyObservedCanvas;
function observeJourneyFrame(...args) {
  const result = journeyAfterRender.apply(this, args);
  if (args[0].getRenderTarget() === null && args[0].domElement.closest('[data-map-state]')) {
    journeyObservedScene = this;
    journeyObservedCamera = args[2];
    journeyObservedCanvas = args[0].domElement;
  }
  return result;
}
JourneyObservedScene.prototype.onAfterRender = observeJourneyFrame;
window.journeyMedallionObservation = {
  point(stageId) {
    const pod = journeyObservedScene?.getObjectByName(stageId + '-journey-medallion');
    if (!pod || !journeyObservedCamera || !journeyObservedCanvas) return null;
    const point = pod.localToWorld(new JourneyObservedVector(0, pod.userData.journeyMedallionSurfaceY, 0));
    point.project(journeyObservedCamera);
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) return null;
    const bounds = journeyObservedCanvas.getBoundingClientRect();
    return { x: bounds.x + (point.x * 0.5 + 0.5) * bounds.width,
      y: bounds.y + (-point.y * 0.5 + 0.5) * bounds.height };
  },
  dispose() {
    if (JourneyObservedScene.prototype.onAfterRender === observeJourneyFrame) {
      if (journeyHadOwnAfterRender) JourneyObservedScene.prototype.onAfterRender = journeyAfterRender;
      else delete JourneyObservedScene.prototype.onAfterRender;
    }
    journeyObservedScene = journeyObservedCamera = journeyObservedCanvas = undefined;
  },
};
${entry}`,
    })
  })
}
