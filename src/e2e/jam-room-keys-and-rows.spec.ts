// ============================================================
// Jam room — rows you press, and a Space bar that plays
// ============================================================
//
// Two things a host's hands found before their eyes did. Every lyric row
// wore the text cursor and could be selected, so jumping to the chorus felt
// like editing a document; and Space started a karaoke song but did nothing
// for a melody, because the key was the song stage's and not the room's.
//
// Both halves live in CSS or on `window`, which jsdom cannot judge, so they
// are driven here. The stems are intercepted: a spec must not need a bucket.
// They are still answered the way the bucket answers them (serveDemoStems).

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const TONE_SEC = 4
const TONE_WAV = readFileSync(writeToneWav(440, TONE_SEC))
const LYRICS = [
  '[00:00.50]First line of the song',
  '[00:01.50]Second line of the song',
  '[00:02.50]Third line of the song',
  '',
].join('\n')

/**
 * The demo's stems and words, without the bucket.
 *
 * The stems are answered in ranges, as the bucket answers them. A plain
 * `fulfill` sends the whole file with a 200, and Chromium will not seek a
 * file served that way: `seekable` is [0, 0], so every press on a line put
 * the media clock back on zero a few dozen milliseconds after the label had
 * moved, and the label check passed only when it got there first. See
 * serveSeekableTone in jam-lyrics-follow.spec.ts.
 */
async function serveDemoStems(page: Page): Promise<void> {
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
  await page.route('**/demo/goodbye-to-spring/lyrics.lrc', (route) =>
    route.fulfill({ contentType: 'text/plain', body: LYRICS }),
  )
}

async function openRoom(page: Page): Promise<void> {
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()
}

/**
 * Wait for the preview room to finish filling.
 *
 * Its people arrive on timers (signaling-mock.ts): Ada 0.9s after the room
 * opens and Bo 2s after, each connecting 0.6s later. Every arrival
 * re-renders the host's Parts bar above the words, and Ada's wraps it onto
 * a second row, which moves every lyric row 24px down at this width. A drag
 * aimed from boxes measured a moment before that pressed the bar instead of
 * the first line, and selected from the bar's hint to the split handle: a
 * lone "\n", because the rows' own text stays out of any selection. Bo
 * connecting is the last thing the preview does, so from then on nothing
 * above the words moves.
 */
async function waitForTheRoomToFill(page: Page): Promise<void> {
  await expect(
    page.getByTestId('jam-room-header').getByText('Bo', { exact: true }),
  ).toBeVisible()
}

/** How far into the backing track a seek can go; 0 until it can. */
const seekableSec = (page: Page) =>
  page.evaluate(() => {
    const audio = document.querySelector<HTMLAudioElement>(
      '[data-tour="jam.stage"] audio',
    )
    return audio !== null && audio.seekable.length > 0
      ? audio.seekable.end(audio.seekable.length - 1)
      : 0
  })

/** Where the backing track's clock came to rest; -1 while it is seeking. */
const settledClockSec = (page: Page) =>
  page.evaluate(() => {
    const audio = document.querySelector<HTMLAudioElement>(
      '[data-tour="jam.stage"] audio',
    )
    return audio?.seeking === false ? audio.currentTime : -1
  })

const rail = (page: Page) => page.locator('[data-tour="jam.rail-picker"]')
const selectedText = (page: Page) =>
  page.evaluate(() => window.getSelection()?.toString() ?? '')

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('a lyric row', () => {
  test('is pressed, never selected @smoke', async ({ page }) => {
    await serveDemoStems(page)
    await openRoom(page)
    await rail(page)
      .getByRole('button', { name: /Goodbye to Spring/ })
      .click()

    const second = page.locator('[data-line="1"]')
    await expect(second).toBeVisible()
    // The hand, because pressing it goes somewhere.
    await expect(second).toHaveCSS('cursor', 'pointer')
    await expect(second.locator('xpath=..')).toHaveCSS('user-select', 'none')

    // Every gesture below is aimed at a row, so the rows must stay put under
    // it (waitForTheRoomToFill). And every press on a row moves the media
    // clock, which cannot move until the backing track is seekable: the
    // words get here first.
    await waitForTheRoomToFill(page)
    await expect.poll(() => seekableSec(page)).toBeGreaterThanOrEqual(TONE_SEC)

    // A double click used to highlight a word...
    await second.dblclick()
    expect(await selectedText(page)).toBe('')

    // ...and a drag down the column smeared a selection across it.
    const from = await page.locator('[data-line="0"]').boundingBox()
    const to = await page.locator('[data-line="2"]').boundingBox()
    expect(from).not.toBeNull()
    expect(to).not.toBeNull()
    await page.mouse.move((from?.x ?? 0) + 30, (from?.y ?? 0) + 8)
    await page.mouse.down()
    await page.mouse.move((to?.x ?? 0) + 120, (to?.y ?? 0) + 8, { steps: 6 })
    await page.mouse.up()
    expect(await selectedText(page)).toBe('')

    // And the press still does what it is for. The third line, because the
    // double click has already taken the song to the second, and pressing
    // that one again would pass without moving anything. The clock first:
    // the label is written the moment the line is pressed, and has to still
    // say so once the backing track has finished its seek.
    await page.locator('[data-line="2"]').click()
    await expect.poll(() => settledClockSec(page)).toBeCloseTo(2.5, 2)
    await expect(page.getByLabel('Lyric position')).toHaveText('Line 3 / 3')
  })
})

test.describe('the Space bar', () => {
  test('plays and pauses a melody, not only a song @smoke', async ({
    page,
  }) => {
    await openRoom(page)
    await rail(page)
      .getByRole('button', { name: /^Exercises/ })
      .click()
    await rail(page)
      .getByRole('button', { name: /Long Note/ })
      .click()

    const start = page.getByRole('button', {
      name: 'Start playback for everyone here',
    })
    await expect(start).toBeVisible()

    // Focus is still on the row that was just clicked -- the very case a
    // key handler that defers to buttons gets wrong.
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  })

  test('still plays and pauses a song', async ({ page }) => {
    await serveDemoStems(page)
    await openRoom(page)
    await rail(page)
      .getByRole('button', { name: /Goodbye to Spring/ })
      .click()
    await expect(page.locator('[data-line="0"]')).toBeVisible()

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  })

  // That Space stays a space in a text field, and stays with a dialog that
  // has the focus, is pinned in jam-transport-space.test.tsx.
})
