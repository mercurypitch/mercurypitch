// Glassware terrace browser gate — real asset loading and captured PCM earn separate, persistent breaks.

import { expect, test } from '@playwright/test'
import { GLASSWARE_TRIO_STUDY } from '../../../packages/glass-game/src/content/glassware-trio-study'
import { createGlassGame } from '../../../packages/glass-game/src/core/game'
import { installThawingInput } from './helpers/thawing-song-input'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

const level = GLASSWARE_TRIO_STUDY
const saveKey = `beside-cue:glass-adventure:progress:${level.id}`

for (const exhibit of level.breakables) {
  test(`${exhibit.label} sings, releases the mic and restores independently @smoke`, async ({
    page,
  }) => {
    await installThawingInput(page, {
      progress: {
        ...createGlassGame(level).saveProgress(),
        checkpointId: `${exhibit.id}-view`,
      },
    })
    await page.addInitScript(() =>
      localStorage.setItem(
        'beside-cue:glass-adventure:automatic-singing',
        'off',
      ),
    )
    const errors: string[] = []
    const loaded: { url: string; status: number }[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (response) => {
      if (response.url().includes('/glassware-trio-v1/')) {
        loaded.push({ url: response.url(), status: response.status() })
      }
    })
    await page.goto('/glass-game/?layout=glassware-trio')
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    await expect(game).toHaveAttribute('data-completed', '0')
    expect(loaded).toHaveLength(3)
    expect(loaded.every((response) => response.status === 200)).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByTestId('glass-sing-action').tap()
    const panel = page.getByLabel('Voice challenge', { exact: true })
    await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
      timeout: 20_000,
    })
    await page.waitForTimeout(500)
    await expect(game).toHaveAttribute('data-completed', '0')
    await page.evaluate(() => window.thawingInput.tone(60))
    await expect(game).toHaveAttribute('data-completed', '1', {
      timeout: 15_000,
    })
    await page.evaluate(() => window.thawingInput.silent())
    await expect(panel).not.toBeVisible({ timeout: 10_000 })
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.thawingInput.streams.every((stream) =>
            stream
              .getAudioTracks()
              .every((track) => track.readyState === 'ended'),
          ),
        ),
      )
      .toBe(true)
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      saveKey,
    )
    expect(saved.completedBreakableIds).toEqual([exhibit.id])
    await page.reload()
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    await expect(game).toHaveAttribute('data-completed', '1')
    expect(await page.evaluate(() => window.thawingInput.streams.length)).toBe(
      0,
    )
    expect(errors).toEqual([])
  })
}
