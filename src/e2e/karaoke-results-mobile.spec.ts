// ============================================================
// Karaoke stem results on a phone — no sideways scroll, no jammed actions
// ============================================================
//
// Two complaints from the same screen, both about width:
//
//   * the whole page scrolls sideways when a song's name is long — and
//     the seeded example rows ("Josh Woodward — Goodbye to Spring") are
//     the longest names most visitors will ever have;
//   * the per-stem Play / Download / Replace buttons touch each other on
//     the longer rows ("Instrumental"), so there is nothing to aim at.
//
// The page must never scroll sideways. That has regressed here more than
// once, so this asserts it against the real built app rather than against
// a stylesheet.

import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

interface ResultsE2EStore {
  initSessionStore: () => Promise<void>
  getUvrSession: (id: string) => unknown
  importUvrSessionDurable: (session: unknown) => Promise<boolean>
}

const SESSION_ID = 'e2e-karaoke-results-mobile'
// As long as a seeded example row's, which is the case that broke.
const LONG_NAME = 'Josh Woodward — Goodbye to Spring (Instrumental Mix)'
const PHONE = { width: 390, height: 844 }
const SMALL_PHONE = { width: 320, height: 568 }
const TONE_WAV = writeToneWav(220, 1)
const toneDataUrl = `data:audio/wav;base64,${fs
  .readFileSync(TONE_WAV)
  .toString('base64')}`

test.use({ viewport: PHONE })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(() => window.__pp?.appStore !== undefined)

  await page.evaluate(
    async ({ audioUrl, name, sessionId }) => {
      const store = window.__pp?.appStore as unknown as ResultsE2EStore
      await store.initSessionStore()
      if (store.getUvrSession(sessionId) === undefined) {
        await store.importUvrSessionDurable({
          sessionId,
          status: 'completed',
          progress: 100,
          originalFile: { name, size: 1, mimeType: 'audio/wav' },
          outputs: { vocal: audioUrl, instrumental: audioUrl },
          createdAt: Date.now(),
        })
      }
    },
    { audioUrl: toneDataUrl, name: LONG_NAME, sessionId: SESSION_ID },
  )

  await page.goto(`/#/karaoke/session/${SESSION_ID}`)
  await dismissOverlays(page)
  await expect(page.locator('.uvr-result-viewer')).toBeVisible({
    timeout: 15_000,
  })
})

async function pageOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const widest: { selector: string; right: number }[] = []
    const limit = root.clientWidth
    for (const node of document.querySelectorAll<HTMLElement>('body *')) {
      const box = node.getBoundingClientRect()
      if (box.width === 0 || box.right <= limit + 1) continue
      widest.push({
        selector: `${node.tagName.toLowerCase()}.${node.className.toString().split(' ').filter(Boolean).slice(0, 3).join('.')}`,
        right: Math.round(box.right),
      })
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: limit,
      widest: widest.slice(0, 8),
    }
  })
}

test.describe('the stem results view on a phone', () => {
  test('never scrolls sideways, however long the song name is @smoke', async ({
    page,
  }) => {
    const metrics = await pageOverflow(page)
    expect(
      metrics.widest,
      `elements past the right edge: ${JSON.stringify(metrics.widest)}`,
    ).toEqual([])
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  })

  test('still fits on the narrowest phone', async ({ page }) => {
    await page.setViewportSize(SMALL_PHONE)
    const metrics = await pageOverflow(page)
    expect(
      metrics.widest,
      `elements past the right edge: ${JSON.stringify(metrics.widest)}`,
    ).toEqual([])
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  })

  test('keeps the stem actions apart and thumb-sized', async ({ page }) => {
    const gaps = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rv-stem-card-actions')]
      return rows.map((row) => {
        const boxes = [...row.children].map((child) =>
          child.getBoundingClientRect(),
        )
        const smallest = boxes.reduce(
          (min, box) => Math.min(min, box.width, box.height),
          Number.POSITIVE_INFINITY,
        )
        const tightest = boxes
          .slice(1)
          .reduce(
            (min, box, index) => Math.min(min, box.left - boxes[index].right),
            Number.POSITIVE_INFINITY,
          )
        const label =
          row.parentElement?.querySelector('.rv-stem-name')?.textContent ?? '?'
        return { label, smallest, tightest, count: boxes.length }
      })
    })

    expect(gaps.length).toBeGreaterThan(0)
    for (const row of gaps) {
      expect(row.count, `${row.label} has no actions`).toBeGreaterThan(1)
      // A finger needs something to aim at, and a gap to miss into.
      expect(
        row.smallest,
        `${row.label} action too small`,
      ).toBeGreaterThanOrEqual(36)
      expect(
        row.tightest,
        `${row.label} actions are glued`,
      ).toBeGreaterThanOrEqual(4)
    }
  })
})
