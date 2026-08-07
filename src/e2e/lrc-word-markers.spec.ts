// ============================================================
// LRC word markers — real-pointer tick drag on the overview
// ============================================================
//
// The decision logic — which tick is under a pixel, which ticks are worth
// drawing — is unit tested in `overview-word-markers.test.ts`. What only a
// real pointer can prove is the layer under it: that pointer events reach the
// canvas at all, that the waveform lane's inset and the device pixel ratio are
// accounted for in both directions, and that a drag commits a new time instead
// of panning the lane.
//
// The tick is found by hovering for the `ew-resize` cursor rather than by
// recomputing the canvas layout here. A second copy of that maths in the test
// would agree with a broken implementation, and the cursor is what a user
// actually aims by.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 3).

import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

interface MixerE2EStore {
  initSessionStore: () => Promise<void>
  getUvrSession: (id: string) => unknown
  importUvrSessionDurable: (session: unknown) => Promise<boolean>
}

const SESSION_ID = 'e2e-lrc-word-markers'
/** Long enough that word ticks land seconds apart rather than pixels apart. */
const TONE_WAV = writeToneWav(220, 20)
const toneDataUrl = `data:audio/wav;base64,${fs
  .readFileSync(TONE_WAV)
  .toString('base64')}`

/**
 * Word-timed LRC, deliberately sparse. Four words spread over twenty seconds
 * cannot be thinned away by the overplot filter, so the tick under test is
 * always drawn and therefore always grabbable.
 */
const LRC = [
  '[00:02.00] hold [00:06.00] on',
  '[00:11.00] soul [00:16.00] mate',
].join('\n')

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
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
            name: 'Word marker regression.wav',
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
  await expect(page.locator('.stem-mixer')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.sm-canvas-overview')).toBeVisible({
    timeout: 15_000,
  })

  // Lyrics go in through the app's own upload path. Writing them straight
  // into storage would skip the parse that produces the word timings the
  // ticks are drawn from.
  // Two of these exist — the toolbar's and the empty-state drop zone's. Either
  // feeds the same handler.
  await page
    .locator('input[type="file"][accept=".txt,.lrc"]')
    .first()
    .setInputFiles({
      name: 'word-markers.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from(LRC, 'utf8'),
    })
  await expect(page.locator('.sm-lyrics-lines')).toBeVisible({
    timeout: 10_000,
  })

  await page
    .getByTitle('Map lyric timing with the marker or onset taps')
    .click()
  await expect(page.locator('.sm-lyrics-gen-lines')).toBeVisible()

  const ticks = page.getByRole('checkbox', { name: 'Word ticks' })
  if (!(await ticks.isChecked())) await ticks.check()
})

/** Every mapped word's displayed timestamp, in row order. */
async function wordTimes(page: import('@playwright/test').Page) {
  return page.locator('.sm-lyrics-gen-word-time').allTextContents()
}

/**
 * Sweep the overview lane for the pixel where the pointer turns into a
 * horizontal resize — the app's own signal that a tick is grabbable.
 */
async function findTickX(
  page: import('@playwright/test').Page,
  from: number,
  to: number,
): Promise<number> {
  const canvas = page.locator('.sm-canvas-overview')
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('Overview canvas has no bounding box')
  const y = box.y + box.height / 2

  for (let x = box.x + from; x <= box.x + to; x += 2) {
    await page.mouse.move(x, y)
    const cursor = await canvas.evaluate(
      (el) => (el as HTMLCanvasElement).style.cursor,
    )
    if (cursor === 'ew-resize') return x
  }
  throw new Error(`No word tick found between ${from}px and ${to}px`)
}

test('drags a word tick to a new time with a real pointer @smoke', async ({
  page,
}) => {
  const before = await wordTimes(page)
  expect(before.length).toBeGreaterThanOrEqual(4)

  const box = await page.locator('.sm-canvas-overview').boundingBox()
  if (box === null) throw new Error('Overview canvas has no bounding box')
  const y = box.y + box.height / 2

  // The first tick is the first line's start, a fifth of the way in.
  const tickX = await findTickX(page, 0, box.width * 0.45)

  await page.mouse.move(tickX, y)
  await page.mouse.down()
  await page.mouse.move(tickX + 24, y, { steps: 10 })
  await page.mouse.up()

  const after = await wordTimes(page)
  expect(after).not.toEqual(before)

  // Exactly one word moved, and it moved later — a pan would have moved
  // nothing, and a bad inverse transform would have moved the wrong one.
  const changed = after.filter((t, i) => t !== before[i])
  expect(changed).toHaveLength(1)
  const movedIdx = after.findIndex((t, i) => t !== before[i])
  expect(movedIdx).toBe(0)
  expect(parseTime(after[0])).toBeGreaterThan(parseTime(before[0]))
})

test('clicking a tick moves the mapping cursor without retiming it', async ({
  page,
}) => {
  const before = await wordTimes(page)
  const box = await page.locator('.sm-canvas-overview').boundingBox()
  if (box === null) throw new Error('Overview canvas has no bounding box')
  const y = box.y + box.height / 2

  // The third tick is the second line's start, past the midpoint.
  const tickX = await findTickX(page, box.width * 0.5, box.width * 0.95)
  await page.mouse.click(tickX, y)

  // A press with no movement is a pick, not a drag: the cursor jumps there
  // and every timestamp is left exactly as it was.
  expect(await wordTimes(page)).toEqual(before)
  await expect(page.locator('.sm-lyrics-gen-line-current')).toHaveAttribute(
    'data-lyrics-index',
    '1',
  )
})

test('leaves the ticks alone when the toggle is off', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Word ticks' }).uncheck()

  const box = await page.locator('.sm-canvas-overview').boundingBox()
  if (box === null) throw new Error('Overview canvas has no bounding box')

  // Nothing is grabbable, so the sweep finds no resize cursor anywhere.
  await expect(findTickX(page, 0, box.width * 0.95)).rejects.toThrow(
    /No word tick found/,
  )
})

/** "0:02.00" -> 2 */
function parseTime(label: string): number {
  const [minutes, seconds] = label.split(':')
  return Number(minutes) * 60 + Number(seconds)
}
