// ============================================================
// LRCLIB results must be visible on a short screen
// ============================================================
//
// Reported from a tablet used as a laptop: search for lyrics in the studio,
// get results, and there is nowhere to see them — "the scroll simply doesn't
// budge". Measured, the results list was 40px tall at 1280x800 and 0px tall
// at 1280x660, holding 960px of rows.
//
// Nothing was broken in the list itself. Every box from the panel down was
// `flex: 1; min-height: 0`, and the panel-variant rule dropped the list's
// `max-height: 320px` so it could fill a tall panel. That left the list as the
// only element in the chain able to shrink, so it absorbed the entire deficit,
// and its own `overflow-y: auto` had no height to scroll inside. The panel's
// `min-height: 120px` floor could not help either: the fixed workspace set
// `min-height: 0` inline, and inline beats every stylesheet.
//
// So this measures the two things a user would: are the results tall enough to
// read, and can you get to the ones below the fold. Three viewports, because
// the defect was present on a full-height laptop too — it was only total at
// tablet height.

import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

interface MixerE2EStore {
  initSessionStore: () => Promise<void>
  getUvrSession: (id: string) => unknown
  importUvrSessionDurable: (session: unknown) => Promise<boolean>
}

const SESSION_ID = 'e2e-lyrics-short-viewport'
const TONE_WAV = writeToneWav(220, 8)
const toneDataUrl = `data:audio/wav;base64,${fs
  .readFileSync(TONE_WAV)
  .toString('base64')}`

/** More results than any short panel could show at once. */
const MATCHES = Array.from({ length: 24 }, (_, i) => ({
  id: 1000 + i,
  trackName: `Result number ${i + 1}`,
  artistName: `Artist ${i + 1}`,
  albumName: 'Album',
  duration: 180,
  instrumental: false,
  plainLyrics: 'la la la',
  syncedLyrics: '[00:01.00] la la la',
}))

const VIEWPORTS = [
  { name: 'laptop', width: 1280, height: 800 },
  // Samsung Tab S9+ landscape, minus browser chrome — the reported case.
  { name: 'tab-s9-landscape', width: 1280, height: 660 },
  { name: 'short-laptop', width: 1024, height: 560 },
] as const

test.describe('the studio lyrics search shows its results', () => {
  test.beforeEach(async ({ page }) => {
    // The search never leaves the machine: LRCLIB is stubbed so the row count
    // is fixed and the test does not depend on a third party being up.
    await page.route('**/lrclib.net/api/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MATCHES),
      })
    })
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
  })

  for (const vp of VIEWPORTS) {
    test(`results are readable and scrollable at ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await dismissOverlays(page)
      await page.waitForFunction(() => window.__pp?.appStore !== undefined)

      await page.evaluate(
        async ({ audioUrl, sessionId }) => {
          const store = window.__pp?.appStore as unknown as MixerE2EStore
          await store.initSessionStore()
          if (store.getUvrSession(sessionId) === undefined) {
            await store.importUvrSessionDurable({
              sessionId,
              status: 'completed',
              progress: 100,
              originalFile: {
                name: 'Short viewport lyrics.wav',
                size: 1,
                mimeType: 'audio/wav',
              },
              outputs: { vocal: audioUrl, instrumental: audioUrl },
              createdAt: Date.now(),
            })
          }
        },
        { audioUrl: toneDataUrl, sessionId: SESSION_ID },
      )

      await page.goto(`/#/karaoke/session/${SESSION_ID}/mixer`)
      await dismissOverlays(page)
      await expect(page.locator('.stem-mixer')).toBeVisible({ timeout: 20_000 })

      await page.locator('[title="Search Lyrics Online"]').first().click()

      const list = page.locator('.sm-song-picker-list')
      await expect(list).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('.sm-song-picker-row').first()).toBeVisible()

      const geometry = await page.evaluate(() => {
        const list = document.querySelector('.sm-song-picker-list')
        const picker = document.querySelector('.sm-song-picker')
        if (list === null || picker === null) return null
        return {
          listHeight: list.clientHeight,
          listScrollHeight: list.scrollHeight,
          listOverflowY: getComputedStyle(list).overflowY,
          pickerOverflowY: getComputedStyle(picker).overflowY,
          rowHeight:
            document
              .querySelector('.sm-song-picker-row')
              ?.getBoundingClientRect().height ?? 0,
        }
      })
      expect(geometry).not.toBeNull()

      // At least a row and a half of results. The floor is 96px; anything
      // under one row means the list collapsed again.
      expect(geometry!.listHeight).toBeGreaterThanOrEqual(
        geometry!.rowHeight * 1.5,
      )
      expect(['auto', 'scroll']).toContain(geometry!.listOverflowY)

      // And the rest of the results have to be reachable. Scroll the list and
      // confirm it actually moved — this is the "doesn't budge" complaint.
      const scrolled = await list.evaluate((el) => {
        el.scrollTop = el.scrollHeight
        return el.scrollTop
      })
      expect(scrolled).toBeGreaterThan(0)

      // The last row is only meaningful if the list can be scrolled to it.
      await page.locator('.sm-song-picker-row').last().scrollIntoViewIfNeeded()
      await expect(page.locator('.sm-song-picker-row').last()).toBeInViewport()

      await page.screenshot({
        path: `test-results/lyrics-search-${vp.name}.png`,
      })
    })
  }
})
