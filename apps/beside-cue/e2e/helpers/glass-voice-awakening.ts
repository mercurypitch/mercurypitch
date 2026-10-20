// Intact awakening regression — earn completion through real PCM and retain the rendered glass after reload.
import { expect, test, type Page } from '@playwright/test'
import { installMuseumRasterCheckpoints, renderMuseumCheckpoint, restoreMuseumRaster, } from './museum-raster-checkpoints'

interface AwakeningFixtures {
  openMuseum(
    page: Page,
    options: {
      path: string
      levelId: string
      checkpointId: string
      completedBreakableIds: string[]
      tutorialPreference: string
      waitForEncounter: boolean
    },
  ): Promise<void>
  setVoice(page: Page, midi: number, amplitude: number): Promise<void>
  expectMicrophoneOff(page: Page): Promise<void>
}

interface AwakeningDraw {
  intactDraws: number
  intactVisible: boolean
  shardCount: number
  shardsVisible: boolean
  emissiveIntensity: number
}

declare global {
  interface Window {
    awakeningDrawObservation: { read(): AwakeningDraw }
  }
}

const levelId = 'glassworks-unbroken-archive/archive-awakening'
const encounterId = `${levelId}/diadem/encounter/sunlit-diadem`

/** Observe actual forwarded draws; renderer callbacks alone do not establish raster output. */
async function observeAwakeningDraws(page: Page): Promise<void> {
  await installMuseumRasterCheckpoints(page)
  await page.route('**/src/games/adventure/standalone.tsx*', async (route) => {
    const response = await route.fetch()
    const entry = await response.text()
    await route.fulfill({
      response,
      body: `
const { Scene: AwakeningScene, Mesh: AwakeningMesh } = await import('/@id/three');
const previousSceneBeforeRender = AwakeningScene.prototype.onBeforeRender;
const previousSceneAfterRender = AwakeningScene.prototype.onAfterRender;
const previousMeshBeforeRender = AwakeningMesh.prototype.onBeforeRender;
const meshDrawStarts = new WeakMap();
const previousMeshAfterRender = AwakeningMesh.prototype.onAfterRender;
const intactName = ${JSON.stringify(`vessel-intact-${encounterId}`)};
const shardsName = ${JSON.stringify(`vessel-shards-${encounterId}`)};
let observedScene, intactDraws = 0;
const isMuseumDraw = renderer => renderer.getRenderTarget() === null &&
  renderer.domElement.closest('[data-testid="glass-adventure"]');
AwakeningScene.prototype.onBeforeRender = function (...args) {
  const result = previousSceneBeforeRender.apply(this, args);
  if (isMuseumDraw(args[0])) window.museumRasterCheckpoints.beginFrame(args[0].getContext());
  return result;
};
AwakeningMesh.prototype.onBeforeRender = function (...args) {
  const result = previousMeshBeforeRender.apply(this, args);
  if (this.name === intactName && isMuseumDraw(args[0])) meshDrawStarts.set(this, window.museumRasterCheckpoints.read().forwardedDraws);
  return result;
};
AwakeningScene.prototype.onAfterRender = function (...args) {
  const result = previousSceneAfterRender.apply(this, args);
  if (isMuseumDraw(args[0])) {
    observedScene = this;
    window.museumRasterCheckpoints.finishFrame(args[0].getContext());
  }
  return result;
};
AwakeningMesh.prototype.onAfterRender = function (...args) {
  const result = previousMeshAfterRender.apply(this, args);
  if (this.name === intactName && isMuseumDraw(args[0]) && window.museumRasterCheckpoints.read().forwardedDraws > (meshDrawStarts.get(this) ?? Infinity)) intactDraws++;
  return result;
};
window.awakeningDrawObservation = {
  read() {
    const intact = observedScene?.getObjectByName(intactName);
    const shards = observedScene?.getObjectByName(shardsName);
    const materials = intact ? (Array.isArray(intact.material) ? intact.material : [intact.material]) : [];
    return {
      intactDraws, intactVisible: intact?.visible === true,
      shardCount: shards?.children.length ?? -1, shardsVisible: shards?.visible === true,
      emissiveIntensity: Math.max(0, ...materials.filter(material => material.transmission > 0).map(material => material.emissiveIntensity)),
    };
  },
};
${entry}`,
    })
  })
}

async function readSavedIds(page: Page): Promise<string[]> {
  return page.evaluate((id) => {
    const value = localStorage.getItem(
      `beside-cue:glass-adventure:progress:${id}`,
    )
    if (value === null) throw new Error('Awakening progress is missing.')
    return (JSON.parse(value) as { completedBreakableIds: string[] })
      .completedBreakableIds
  }, levelId)
}

async function expectIntactDraw(page: Page, afterDraws = 0): Promise<void> {
  await renderMuseumCheckpoint(page)
  await expect
    .poll(() => page.evaluate(() => window.awakeningDrawObservation.read()))
    .toMatchObject({
      intactVisible: true,
      shardCount: 0,
      shardsVisible: false,
      emissiveIntensity: 0.16,
    })
  await expect
    .poll(() =>
      page.evaluate(() => window.awakeningDrawObservation.read().intactDraws),
    )
    .toBeGreaterThan(afterDraws)
}

async function expectAwakeningHud(page: Page, count: number): Promise<void> {
  for (const name of ['Leave museum', 'Open settings']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()
    await button.click({ trial: true })
  }
  await expect(
    page.locator(`[aria-label="${count} of 3 main exhibits opened"]`),
  ).toBeVisible()
}

export function registerAwakeningVoiceTest(fixtures: AwakeningFixtures): void {
  test('Unbroken Archive earns an intact awakening with real PCM and preserves it after reload @smoke', async ({
    page,
  }, testInfo) => {
    try {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await observeAwakeningDraws(page)
      await page.addInitScript(() => {
        localStorage.setItem(
          'beside-cue:glass-adventure:comfortable-note',
          '57',
        )
      })
      await fixtures.openMuseum(page, {
        path: '/glass-game/?layout=unbroken-archive',
        levelId,
        checkpointId: `${levelId}/diadem/checkpoint/entry`,
        completedBreakableIds: [],
        tutorialPreference: `tutorial:${levelId}:unbroken-archive-awakening:v1`,
        waitForEncounter: false,
      })
      await renderMuseumCheckpoint(page)
      const adventure = page.getByTestId('glass-adventure')
      const identity = page
        .getByRole('heading', {
          name: 'The Unbroken Archive',
          includeHidden: true,
        })
        .locator('..')
      const shortDisplay = (page.viewportSize()?.height ?? Infinity) <= 500
      await expect(adventure).toHaveAttribute('data-completed', '0')
      expect(await readSavedIds(page)).toEqual([])
      await page.getByRole('button', { name: 'Recenter camera' }).click()
      await expect
        .poll(
          async () =>
            -Math.cos(Number(await adventure.getAttribute('data-camera-yaw'))),
        )
        .toBeGreaterThan(0.99)
      await page.keyboard.down('KeyW')
      try {
        await expect
          .poll(
            async () => Number(await adventure.getAttribute('data-player-z')),
            { timeout: 8000, intervals: [50] },
          )
          .toBeGreaterThan(-0.7)
      } finally {
        await page.keyboard.up('KeyW')
      }
      const sing = page.getByRole('button', { name: 'Sing to the glass' })
      await expect(sing).toBeVisible()
      await expect(adventure).toHaveAttribute('data-completed', '0')
      const beforeDraws = await page.evaluate(
        () => window.awakeningDrawObservation.read().intactDraws,
      )
      await fixtures.setVoice(page, 57, 0)
      await sing.click()
      const panel = page.getByRole('region', { name: 'Voice challenge' })
      await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
        timeout: 12_000,
      })
      await expectAwakeningHud(page, 0)
      await expect(identity).toHaveCSS('opacity', shortDisplay ? '0' : '1')
      await fixtures.setVoice(page, 57, 0.1)
      await expect(adventure).toHaveAttribute('data-completed', '1', {
        timeout: 15_000,
      })
      await fixtures.setVoice(page, 57, 0)
      await expect(panel).toBeHidden()
      await fixtures.expectMicrophoneOff(page)
      expect(await readSavedIds(page)).toEqual([encounterId])
      await expectIntactDraw(page, beforeDraws)
      await expect(adventure).toHaveAttribute(
        'data-challenge-camera-mode',
        'exploration',
      )
      await expect(identity).toHaveCSS('opacity', '1')
      await expectAwakeningHud(page, 1)
      await expect(page.getByTestId('merc-narration-caption')).toHaveCount(0)
      expect(
        await page.evaluate(() => ({
          narration: window.glassVoiceFixture.narrationStarts,
          fracture: window.glassVoiceFixture.fractureStarts,
        })),
      ).toEqual({ narration: 0, fracture: 0 })
      await testInfo.attach('awakened-intact-glass', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      await page.reload()
      await expect(adventure).toHaveAttribute('data-ready', 'true', {
        timeout: 40_000,
      })
      await expect(adventure).toHaveAttribute('data-completed', '1')
      expect(await readSavedIds(page)).toEqual([encounterId])
      await expectIntactDraw(page)
      await expect(identity).toHaveCSS('opacity', '1')
      await expectAwakeningHud(page, 1)
      expect(
        await page.evaluate(() => ({
          captures: window.glassVoiceFixture.sources.length,
          narration: window.glassVoiceFixture.narrationStarts,
          fracture: window.glassVoiceFixture.fractureStarts,
        })),
      ).toEqual({ captures: 0, narration: 0, fracture: 0 })
      await testInfo.attach('restored-intact-glass', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      expect(errors).toEqual([])
    } finally {
      try {
        if (!page.isClosed())
          await testInfo.attach('awakening-raster-mode', {
            body: JSON.stringify(
              await page.evaluate(() => window.museumRasterCheckpoints?.read()),
            ),
            contentType: 'application/json',
          })
      } finally {
        await restoreMuseumRaster(page)
      }
    }
  })
}
