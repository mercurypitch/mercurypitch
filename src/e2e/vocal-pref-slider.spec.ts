// ============================================================
// Per-singer vocal slider — real-mouse drag behaviour
// ============================================================
//
// Regression spec for the Vocals slider in the karaoke playlist editor.
// The gesture under test is a genuine pointer drag (mouse down on the
// thumb, several moves, release) — the exact gesture that broke twice:
// first the row-recreation-per-input bug (#345 review), then the
// snap-back regression (#346). Every assertion here runs against the
// real app in Chromium, not a re-implementation of the handlers.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

interface KaraokePlaylistsBridge {
  createPlaylistWithItems: (
    name: string,
    items: { kind: 'session' | 'group'; refId: string; singerName?: string }[],
  ) => Promise<{ id: string }>
  getPlaylist: (
    id: string,
  ) => { items: { id: string; vocalVolume?: number }[] } | undefined
}

declare global {
  interface Window {
    __karaokePlaylists?: KaraokePlaylistsBridge
  }
}

test.describe('Vocal preference slider', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    // Karaoke tab hosts the playlist gallery (and with it the editor).
    await page.locator('#tab-karaoke').click()
    await page.waitForTimeout(300)

    // Seed one playlist with one (unknown-session) item via the e2e bridge —
    // the editor renders rows fine for unresolved refs, no audio needed.
    const playlistId = await page.evaluate(async () => {
      const store = window.__karaokePlaylists
      if (!store) throw new Error('karaoke playlist bridge missing')
      const pl = await store.createPlaylistWithItems('Drag Spec', [
        { kind: 'session', refId: 'spec-session', singerName: 'Ana' },
      ])
      return pl.id
    })
    expect(playlistId).toBeTruthy()

    // Open the gallery section if collapsed, then expand this playlist's
    // editor ("Edit songs & groups").
    const editBtn = page.locator('button[title="Edit songs & groups"]').first()
    if (!(await editBtn.isVisible().catch(() => false))) {
      await page
        .locator('button', { hasText: 'Playlists' })
        .first()
        .click()
        .catch(() => {})
      await page.waitForTimeout(200)
    }
    await editBtn.click()
    await expect(page.getByTestId('vocal-pref-slider').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('thumb follows a real mouse drag and commits on release @smoke', async ({
    page,
  }) => {
    const slider = page.getByTestId('vocal-pref-slider').first()
    const box = await slider.boundingBox()
    if (!box) throw new Error('slider has no bounding box')

    const y = box.y + box.height / 2
    // Start at the current thumb (value 0 → left edge) and drag to ~80%.
    await page.mouse.move(box.x + 2, y)
    await page.mouse.down()

    const midValues: number[] = []
    for (const frac of [0.2, 0.4, 0.6, 0.8]) {
      await page.mouse.move(box.x + box.width * frac, y, { steps: 4 })
      await page.waitForTimeout(60)
      midValues.push(Number(await slider.inputValue()))
    }

    // While the button is still down, the thumb must track the pointer —
    // monotonically increasing, no snap back to the starting value.
    expect(midValues[0]).toBeGreaterThan(0)
    for (let k = 1; k < midValues.length; k++) {
      expect(midValues[k]).toBeGreaterThanOrEqual(midValues[k - 1])
    }
    expect(midValues[midValues.length - 1]).toBeGreaterThanOrEqual(60)

    await page.mouse.up()
    await page.waitForTimeout(300)

    // Released: the DOM keeps the dragged value…
    const finalValue = Number(await slider.inputValue())
    expect(finalValue).toBeGreaterThanOrEqual(60)

    // …the readout shows it…
    await expect(page.locator('text=/^\\d+%$/').first()).toHaveText(
      `${finalValue}%`,
    )

    // …and the store persisted it (what actually pre-applies at song start).
    const stored = await page.evaluate(() => {
      const store = window.__karaokePlaylists
      const pls = store as unknown as {
        getPlaylistsReactive: () => {
          name: string
          items: { vocalVolume?: number }[]
        }[]
      }
      const pl = pls.getPlaylistsReactive().find((p) => p.name === 'Drag Spec')
      return pl?.items[0]?.vocalVolume ?? null
    })
    expect(stored).not.toBeNull()
    expect(Math.round((stored as number) * 100)).toBe(finalValue)
  })

  test('a second drag also works (state is not stuck after a commit)', async ({
    page,
  }) => {
    const slider = page.getByTestId('vocal-pref-slider').first()
    const box = await slider.boundingBox()
    if (!box) throw new Error('slider has no bounding box')
    const y = box.y + box.height / 2

    // First drag to ~80%.
    await page.mouse.move(box.x + 2, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.8, y, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    const first = Number(await slider.inputValue())
    expect(first).toBeGreaterThanOrEqual(60)

    // Second drag back down to ~20% must work the same way.
    const box2 = await slider.boundingBox()
    if (!box2) throw new Error('slider has no bounding box after commit')
    await page.mouse.move(box2.x + box2.width * 0.8, y)
    await page.mouse.down()
    await page.mouse.move(box2.x + box2.width * 0.2, y, { steps: 6 })
    await page.waitForTimeout(60)
    const midValue = Number(await slider.inputValue())
    await page.mouse.up()
    await page.waitForTimeout(300)

    expect(midValue).toBeLessThan(first)
    const second = Number(await slider.inputValue())
    expect(second).toBeLessThanOrEqual(40)
  })
})
