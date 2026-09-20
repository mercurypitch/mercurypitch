// ============================================================
// Jam room — the words follow the song, and leave your hands alone
// ============================================================
//
// Owner report (2026-09-20, tablet): "the lyrics when playback is running
// now stick the current line into the middle of the panel, and do not
// allow scroll". The sheet re-centred on every tick of the song's clock,
// so a scroll was undone a frame later. It centres ONCE per line now, and
// not at all while a hand is on it.
//
// The owner's second worry is pinned here too: a sheet that has been
// scrolled must never stay where it was left once the song moves on.
//
// jsdom cannot scroll, so the unit tests (JamSongLyrics.follow.test.tsx)
// count scrollTo calls. This drives a real wheel and a real finger against
// a song that is really playing.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const LINE_COUNT = 24
const LINE_EVERY_SEC = 1.5
const SONG_SEC = 40

const TONE_WAV = readFileSync(writeToneWav(440, SONG_SEC))

const stamp = (sec: number): string => {
  const minutes = Math.floor(sec / 60)
  const rest = (sec - minutes * 60).toFixed(2).padStart(5, '0')
  return `[${String(minutes).padStart(2, '0')}:${rest}]`
}

const LYRICS = [
  ...Array.from(
    { length: LINE_COUNT },
    (_, i) =>
      `${stamp(0.5 + i * LINE_EVERY_SEC)}Line number ${i + 1} of the song`,
  ),
  '',
].join('\n')

/**
 * Serve the tone the way a bucket does: in ranges.
 *
 * A plain `fulfill` answers 200 with the whole file, and an element fed
 * that way is not seekable at all -- `seekable` stays empty and every jump
 * lands on zero. The other jam specs never notice, because they never play
 * from the middle. This one has to, so it answers the Range header.
 */
async function serveSeekableTone(page: Page): Promise<void> {
  await page.route('**/demo/goodbye-to-spring/*.m4a', async (route) => {
    const total = TONE_WAV.byteLength
    const asked = /bytes=(\d+)-(\d*)/.exec(
      route.request().headers().range ?? '',
    )
    if (asked === null) {
      await route.fulfill({
        contentType: 'audio/wav',
        headers: { 'Accept-Ranges': 'bytes' },
        body: TONE_WAV,
      })
      return
    }
    const start = Number(asked[1])
    const end =
      asked[2] === '' ? total - 1 : Math.min(Number(asked[2]), total - 1)
    await route.fulfill({
      status: 206,
      contentType: 'audio/wav',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${total}`,
      },
      body: TONE_WAV.subarray(start, end + 1),
    })
  })
}

async function openSongRoom(page: Page): Promise<void> {
  await serveSeekableTone(page)
  await page.route('**/demo/goodbye-to-spring/lyrics.lrc', (route) =>
    route.fulfill({ contentType: 'text/plain', body: LYRICS }),
  )
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
  await expect(page.locator('[data-line="0"]')).toBeVisible()
}

/** Where the sheet is, and how far the line being sung is from its middle. */
async function sheet(page: Page) {
  return await page.evaluate(() => {
    const box = document.querySelector('[data-line="0"]')?.parentElement
    if (box === null || box === undefined) return null
    const row = box.querySelector('[data-current]')
    const boxBox = box.getBoundingClientRect()
    const rowBox = row?.getBoundingClientRect()
    return {
      scrollTop: box.scrollTop,
      current: row?.getAttribute('data-line') ?? null,
      offBy:
        rowBox === undefined
          ? null
          : Math.abs(
              rowBox.top + rowBox.height / 2 - (boxBox.top + boxBox.height / 2),
            ),
    }
  })
}

const scrollTop = async (page: Page) => (await sheet(page))?.scrollTop ?? -1
const offBy = async (page: Page) => (await sheet(page))?.offBy ?? 999

/** The middle of the lyric sheet, to point a wheel or a finger at. */
async function middleOfSheet(page: Page) {
  const box = await page
    .locator('[data-line="0"]')
    .locator('xpath=..')
    .boundingBox()
  expect(box).not.toBeNull()
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  }
}

/**
 * Start the song from a line far enough down that there is room to scroll.
 *
 * Waits until the element can actually be moved that far: a jump made
 * before it can lands on zero, and the song then plays from the top.
 */
async function playFromTheMiddle(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector('audio')
        return el !== null && el.seekable.length > 0
          ? el.seekable.end(el.seekable.length - 1)
          : 0
      }),
    )
    .toBeGreaterThan(SONG_SEC - 1)
  await page.locator('[data-line="12"]').click()
  await expect(page.getByLabel('Lyric position')).toHaveText(
    `Line 13 / ${LINE_COUNT}`,
  )
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => offBy(page)).toBeLessThanOrEqual(6)
}

/**
 * The sheet has to hold still for this long after a scroll.
 *
 * Well inside the hands-off window, so a slow machine cannot turn the
 * catch-up that is SUPPOSED to follow into a failure here.
 */
const HOLD_SAMPLES = 4
const HOLD_SAMPLE_MS = 100

async function expectItStays(page: Page, at: number): Promise<void> {
  for (let i = 0; i < HOLD_SAMPLES; i++) {
    await page.waitForTimeout(HOLD_SAMPLE_MS)
    expect(Math.abs((await scrollTop(page)) - at)).toBeLessThanOrEqual(3)
  }
}

test.describe('the jam lyric sheet, with a mouse', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('lets a wheel scroll a playing song, then comes back for the next line @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    await playFromTheMiddle(page)
    const centred = await scrollTop(page)
    expect(centred).toBeGreaterThan(150)

    const at = await middleOfSheet(page)
    await page.mouse.move(at.x, at.y)
    await page.mouse.wheel(0, -260)
    // A wheel scroll is animated; read where it lands, not where it starts.
    await page.waitForTimeout(250)
    const left = await scrollTop(page)
    expect(left).toBeLessThan(centred - 120)

    // The whole bug: this used to be undone within a frame.
    await expectItStays(page, left)

    // And it is never left there. The song moves on, the hand is gone, the
    // line being sung is back in the middle.
    await expect
      .poll(() => offBy(page), { timeout: 8000 })
      .toBeLessThanOrEqual(6)
    const after = await sheet(page)
    expect(Number(after?.current)).toBeGreaterThan(12)

    // ...and it keeps following, line after line, with no help.
    const line = Number(after?.current)
    await expect
      .poll(async () => Number((await sheet(page))?.current), {
        timeout: 8000,
      })
      .toBeGreaterThan(line)
    await expect
      .poll(() => offBy(page), { timeout: 4000 })
      .toBeLessThanOrEqual(6)
  })

  test('leaves a paused song where the reader put it, and picks it up on Play', async ({
    page,
  }) => {
    await openSongRoom(page)
    await playFromTheMiddle(page)
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()

    const centred = await scrollTop(page)
    const at = await middleOfSheet(page)
    await page.mouse.move(at.x, at.y)
    await page.mouse.wheel(0, -260)
    await page.waitForTimeout(250)
    const left = await scrollTop(page)
    expect(left).toBeLessThan(centred - 120)

    // Long past the hands-off window. Nothing is being sung, so there is
    // nothing to follow: reading ahead in a stopped song is the reader's
    // business.
    await page.waitForTimeout(2000)
    expect(Math.abs((await scrollTop(page)) - left)).toBeLessThanOrEqual(3)

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect
      .poll(() => offBy(page), { timeout: 8000 })
      .toBeLessThanOrEqual(6)
  })
})

test.describe('the jam lyric sheet, with a finger', () => {
  // A tablet on its side: the report's device.
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

  test('lets a finger scroll a playing song, then comes back @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    await playFromTheMiddle(page)
    const centred = await scrollTop(page)
    expect(centred).toBeGreaterThan(150)

    // Real touch points through CDP: the scroll has to be the browser's own
    // pan, arriving as touchmove, which is what the sheet listens for.
    const at = await middleOfSheet(page)
    const cdp = await page.context().newCDPSession(page)
    type TouchType = 'touchStart' | 'touchMove' | 'touchEnd'
    const touch = (type: TouchType, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: y === undefined ? [] : [{ x: at.x, y, id: 1 }],
      })
    const dragDown = async () => {
      await touch('touchStart', at.y - 90)
      for (const dy of [-60, -30, 0, 30, 60, 90, 120]) {
        await touch('touchMove', at.y + dy)
      }
      // Come to rest before lifting, so there is no fling: the sheet has to
      // be still for a reason this spec controls.
      for (let rest = 0; rest < 2; rest++) {
        await page.waitForTimeout(80)
        await touch('touchMove', at.y + 120)
      }
      await touch('touchEnd')
      return await scrollTop(page)
    }

    // Retried: the first synthetic touch after a layout settles is
    // occasionally swallowed (see jam-stage-layout.spec.ts).
    await expect.poll(dragDown, { timeout: 15000 }).toBeLessThan(centred - 100)
    await page.waitForTimeout(150)
    const left = await scrollTop(page)
    await expectItStays(page, left)

    await expect
      .poll(() => offBy(page), { timeout: 8000 })
      .toBeLessThanOrEqual(6)
  })
})
