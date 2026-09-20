// ============================================================
// Jam room — two rows above the words, not three
// ============================================================
//
// Owner report (2026-09-20, tablet): "our song takes too much space in the
// third row". A song room had the header, the playback controls, and then a
// bar of its own for the song's name, line count and timeline -- three rows
// of chrome over the lyrics.
//
//   row 1   room name · SONG NAME · code · people         … room actions
//   row 2   picker, play, how to sing, pitch  |  line · take · timeline
//   ------  the words
//
// The name is a fact about the room, so it went into the header (as much
// as fits; the rest on hover or a tap). The timeline went onto the row of
// the buttons that move it, and wraps under them where there is no width.
//
// Layout is the whole subject and jsdom lays nothing out, so every claim
// here is a measured box.
//
// ── The preview room is wider than a real one ───────────────────────
// A spec's room is the preview room, and its playback bar carries a 243px
// "these peers are not real" note that no real room has. On a tablet that
// note puts the row within a few pixels of wrapping the timeline under the
// buttons, which a font's width on another machine would decide -- so the
// tablet test takes it out, leaving exactly the bar a host really has, and
// says so where it does.

import type { Locator, Page } from '@playwright/test'
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

async function openSongRoom(page: Page): Promise<void> {
  await page.route('**/demo/goodbye-to-spring/*.m4a', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: TONE_WAV }),
  )
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

const header = (page: Page) => page.getByTestId('jam-room-header')
const chip = (page: Page) => page.getByTestId('jam-now-singing')
const row = (page: Page) => page.getByTestId('jam-transport-row')
const bar = (page: Page) => page.getByTestId('jam-transport-bar')
const timeline = (page: Page) => page.getByTestId('jam-song-timeline')

async function boxOf(target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  return box ?? { x: 0, y: 0, width: 0, height: 0 }
}

const pageScrollsSideways = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  )

/**
 * Take the preview-only note out of the bar, leaving a real host's buttons.
 * See the header: it is 243px that only a spec's room has.
 */
async function asARealRoom(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '[data-testid="jam-transport-bar"] [role="note"] { display: none !important; }',
  })
}

/** The timeline shares a line with the buttons, to their right. */
async function expectTimelineBesideTheButtons(page: Page): Promise<void> {
  const buttons = await boxOf(bar(page))
  const where = await boxOf(timeline(page))
  expect(where.x).toBeGreaterThanOrEqual(buttons.x + buttons.width)
  const middle = where.y + where.height / 2
  expect(middle).toBeGreaterThan(buttons.y)
  expect(middle).toBeLessThan(buttons.y + buttons.height)
}

/** The words start right under the playback row: there is no third row. */
async function expectNoThirdRow(page: Page): Promise<void> {
  const rowBox = await boxOf(row(page))
  const words = await boxOf(
    page.locator('[data-line="0"]').locator('xpath=../..'),
  )
  // A gap, not a bar: the old row was 40px and change.
  expect(words.y - (rowBox.y + rowBox.height)).toBeLessThan(24)
}

test.describe('a song room on a desk', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('names the song in the header and puts the timeline beside the buttons @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)

    // Row 1: the name is IN the header, after the room's name.
    await expect(chip(page)).toBeVisible()
    await expect(chip(page)).toContainText('Goodbye to Spring')
    const head = await boxOf(header(page))
    const name = await boxOf(chip(page))
    expect(name.y).toBeGreaterThanOrEqual(head.y)
    expect(name.y + name.height).toBeLessThanOrEqual(head.y + head.height + 1)
    const roomName = await boxOf(header(page).getByRole('heading'))
    expect(name.x).toBeGreaterThanOrEqual(roomName.x + roomName.width)
    // One line of header, as before there was a name in it.
    expect(head.height).toBeLessThan(64)

    // Row 2: the timeline shares a line with the buttons, to their right.
    await expectTimelineBesideTheButtons(page)
    // Wide enough to drag, which is the point of giving it the leftovers.
    const scrubber = await boxOf(timeline(page).getByRole('slider'))
    expect(scrubber.width).toBeGreaterThan(200)
    // One line of buttons, and the words straight under it.
    expect((await boxOf(row(page))).height).toBeLessThan(56)

    await expectNoThirdRow(page)
    expect(await pageScrollsSideways(page)).toBe(false)
  })

  test('still says where the song is, and still lets the host move it', async ({
    page,
  }) => {
    await openSongRoom(page)
    await expect(page.getByLabel('Lyric position')).toHaveText(
      'Intro · 3 lines',
    )
    await page.locator('[data-line="1"]').click()
    await expect(page.getByLabel('Lyric position')).toHaveText('Line 2 / 3')

    // The timeline is outside the stage that owns the audio now; a press on
    // it still has to move the song.
    const slider = timeline(page).getByRole('slider')
    await slider.focus()
    await page.keyboard.press('Home')
    await expect(page.getByLabel('Lyric position')).toHaveText(
      'Intro · 3 lines',
    )
  })

  test('draws the timeline to the length of the FILE, and keeps it', async ({
    page,
  }) => {
    await openSongRoom(page)
    const slider = timeline(page).getByRole('slider')
    // The catalogue says minutes; the file that was served is four seconds.
    await expect(slider).toHaveAttribute('aria-valuemax', String(TONE_SEC))

    // The pitch guide landing replaces the song object over the same file.
    // The element never reports its length twice, so forgetting it here
    // would be for good.
    await expect(page.getByTestId('jam-pitch-notice')).toHaveCount(0, {
      timeout: 30000,
    })
    await expect(slider).toHaveAttribute('aria-valuemax', String(TONE_SEC))
  })

  test('leaves with the song', async ({ page }) => {
    await openSongRoom(page)
    await expect(chip(page)).toBeVisible()

    const rail = page.locator('[data-tour="jam.rail-picker"]')
    await rail.getByRole('button', { name: /^Exercises/ }).click()
    await rail.getByRole('button', { name: /Long Note/ }).click()

    await expect(chip(page)).toHaveCount(0)
    await expect(timeline(page)).toHaveCount(0)
  })
})

test.describe('a song room on a tablet', () => {
  test.describe('on its side', () => {
    test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

    test('keeps two rows above the words, with the sidebar open @smoke', async ({
      page,
    }) => {
      await openSongRoom(page)
      await asARealRoom(page)
      await expect(chip(page)).toBeVisible()

      // Row 1 is one line. The name gave way to fit -- it did not push the
      // people onto a second line, which is what it did at first (38px of
      // header became 60).
      const head = await boxOf(header(page))
      expect(head.height).toBeLessThan(44)
      expect((await boxOf(chip(page))).width).toBeGreaterThan(90)

      // Row 2 is one line: a host's buttons in their capsule, then the
      // timeline in the 630px they leave -- long enough to drag by a thumb.
      await expectTimelineBesideTheButtons(page)
      expect((await boxOf(row(page))).height).toBeLessThan(56)
      const scrubber = await boxOf(timeline(page).getByRole('slider'))
      expect(scrubber.width).toBeGreaterThan(380)

      // And the words start where the third row used to.
      await expectNoThirdRow(page)
      const words = await boxOf(
        page.locator('[data-line="0"]').locator('xpath=../..'),
      )
      expect(words.y).toBeLessThan(190)
      expect(await pageScrollsSideways(page)).toBe(false)
    })

    test('wraps the timeline under the buttons when they leave it no room', async ({
      page,
    }) => {
      // A narrower window, and the preview note left IN: as crowded as the
      // row gets. The timeline takes the next line whole rather than
      // squeezing in as a stub. (At 1180 it no longer wraps even with the
      // note -- the room's mode left the bar on a song, and took 230px
      // with it.)
      await page.setViewportSize({ width: 1000, height: 820 })
      await openSongRoom(page)
      const buttons = await boxOf(bar(page))
      const where = await boxOf(timeline(page))
      expect(where.y).toBeGreaterThanOrEqual(buttons.y + buttons.height - 1)
      const scrubber = await boxOf(timeline(page).getByRole('slider'))
      expect(scrubber.width).toBeGreaterThan(400)
      await expectNoThirdRow(page)
    })
  })

  test.describe('upright', () => {
    test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true })

    test('shows as much of the name as fits, and the rest on a tap @smoke', async ({
      page,
    }) => {
      await openSongRoom(page)
      const name = chip(page)
      await expect(name).toBeVisible()
      await expect(name).toHaveAttribute('title', /^Goodbye to Spring · .+/)

      const clipped = () =>
        name.evaluate((el) => {
          const text = el.querySelector('span')
          return text === null ? false : text.scrollWidth > text.clientWidth + 1
        })
      expect(await clipped()).toBe(true)

      await name.click()
      await expect(name).toHaveAttribute('aria-expanded', 'true')
      expect(await clipped()).toBe(false)
      expect(await pageScrollsSideways(page)).toBe(false)

      await name.click()
      await expect(name).toHaveAttribute('aria-expanded', 'false')
      expect(await clipped()).toBe(true)
    })

    test('puts the name, the code and the people on a line of their own', async ({
      page,
    }) => {
      // Beside a fixed 366px of room buttons there is no row left at this
      // width, and the strip used to be stacked into it one pill per line:
      // 92px of header for a room of one. Name and buttons, then the strip.
      await openSongRoom(page)
      const head = await boxOf(header(page))
      expect(head.height).toBeLessThan(84)
      const name = await boxOf(chip(page))
      const roomName = await boxOf(header(page).getByRole('heading'))
      expect(name.y).toBeGreaterThanOrEqual(roomName.y + roomName.height - 2)
      expect(name.x).toBeLessThan(head.x + 4)
    })

    test('wraps the timeline under the buttons rather than squeezing either', async ({
      page,
    }) => {
      await openSongRoom(page)
      const rowBox = await boxOf(row(page))
      const where = await boxOf(timeline(page))
      // Inside the row, inside the screen, and a usable width wherever the
      // wrap put it.
      expect(where.x).toBeGreaterThanOrEqual(rowBox.x - 1)
      expect(where.x + where.width).toBeLessThanOrEqual(
        rowBox.x + rowBox.width + 1,
      )
      const scrubber = await boxOf(timeline(page).getByRole('slider'))
      expect(scrubber.width).toBeGreaterThan(140)
      await expectNoThirdRow(page)
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  })
})

test.describe('a song room on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('gives the timeline the whole width, and only the buttons scroll @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    await expect(chip(page)).toBeVisible()

    const rowBox = await boxOf(row(page))
    const buttons = await boxOf(bar(page))
    const where = await boxOf(timeline(page))
    // Under the buttons, edge to edge.
    expect(where.y).toBeGreaterThanOrEqual(buttons.y + buttons.height - 1)
    expect(where.width).toBeGreaterThan(rowBox.width - 4)

    // Scrolling the buttons must not take the timeline with them: a bar of
    // a song that slides away under the thumb dragging it is unusable.
    await bar(page).evaluate((el) => {
      el.scrollLeft = 200
    })
    const after = await boxOf(timeline(page))
    expect(after.x).toBe(where.x)
    expect(await row(page).evaluate((el) => el.scrollLeft)).toBe(0)
    expect(await pageScrollsSideways(page)).toBe(false)
  })
})
