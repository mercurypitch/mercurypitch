// ============================================================
// The jam room's playback controls: one capsule, and More
// ============================================================
//
// Owner request, 2026-09-20. Two things were wrong with the bar. The
// live-pitch toggle sat in a box of its own between the transport and the
// room's mode, belonging to neither; and Unison / Harmony Stack / Relay sat
// beside a karaoke song they do nothing to -- they deal a DRILL's melody
// out into parts, and a song's parts are dealt line by line above the words.
//
// So: the toggle shares the transport's capsule, and the tempo and the mode
// live behind a More button that remembers being opened, the way the
// practice bars' More does. On a song there is nothing behind it, so it is
// not drawn -- and the 230px it gives back is what lets the timeline stay
// beside the buttons on a tablet with plenty to spare.
//
// jsdom lays nothing out and cannot tell a capsule from a row of loose
// boxes, so the geometry is checked here, in a real browser.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const TONE_WAV = readFileSync(writeToneWav(440, 4))
const LYRICS = [
  '[00:00.50]First line of the song',
  '[00:01.50]Second line of the song',
  '',
].join('\n')

/** The preview room opens on a drill, with the visitor as its host. */
async function openDrillRoom(page: Page): Promise<void> {
  await page.route('**/demo/goodbye-to-spring/*.m4a', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: TONE_WAV }),
  )
  await page.route('**/demo/goodbye-to-spring/lyrics.lrc', (route) =>
    route.fulfill({ contentType: 'text/plain', body: LYRICS }),
  )
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(capsule(page)).toBeVisible()
}

async function loadTheSong(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
  await expect(page.locator('[data-line="0"]')).toBeVisible()
}

async function loadADrill(page: Page): Promise<void> {
  const rail = page.locator('[data-tour="jam.rail-picker"]')
  await rail.getByRole('button', { name: /^Exercises/ }).click()
  await rail.getByRole('button', { name: /Long Note/ }).click()
  await expect(page.locator('[data-line="0"]')).toHaveCount(0)
}

const capsule = (page: Page) => page.getByTestId('jam-controls')
const pitchToggle = (page: Page) => page.getByTestId('jam-pitch-toggle')
const more = (page: Page) => page.getByTestId('jam-more-toggle')
const modes = (page: Page) => page.getByRole('group', { name: 'Room mode' })
const tempo = (page: Page) =>
  page.getByRole('spinbutton', { name: 'Playback BPM' })
const timeline = (page: Page) => page.getByTestId('jam-song-timeline')

async function boxOf(target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  return box ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** `inner` is drawn wholly inside `outer`. */
async function expectInside(inner: Locator, outer: Locator): Promise<void> {
  const a = await boxOf(inner)
  const b = await boxOf(outer)
  expect(a.x).toBeGreaterThanOrEqual(b.x)
  expect(a.y).toBeGreaterThanOrEqual(b.y)
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 0.5)
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + 0.5)
}

/**
 * Let what More opened finish arriving before anything is measured.
 *
 * Only ITS animations: the room has indicators that pulse for ever, and
 * waiting on every animation in the document waits for ever with them.
 */
const settled = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    const opened = document.getElementById('jam-more-controls')
    const arriving = Array.from(opened?.children ?? []).flatMap((el) =>
      el.getAnimations(),
    )
    await Promise.all(arriving.map((a) => a.finished))
  })

const pageScrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  )

test.describe('a drill room on a desk', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('keeps the live-pitch toggle and More in the capsule with the transport @smoke', async ({
    page,
  }) => {
    await openDrillRoom(page)
    const pick = page.getByRole('button', { name: 'Choose a drill or a song' })
    await expectInside(pick, capsule(page))
    await expectInside(pitchToggle(page), capsule(page))
    await expectInside(more(page), capsule(page))

    // One line of buttons, all of a height: the toggle is not a smaller
    // box that happens to be standing next to the transport.
    const transportButton = await boxOf(pick)
    for (const button of [pitchToggle(page), more(page)]) {
      const box = await boxOf(button)
      expect(Math.abs(box.height - transportButton.height)).toBeLessThan(2)
      expect(
        Math.abs(
          box.y +
            box.height / 2 -
            (transportButton.y + transportButton.height / 2),
        ),
      ).toBeLessThan(2)
    }
  })

  test('folds the tempo and the room mode away until More is pressed', async ({
    page,
  }) => {
    await openDrillRoom(page)
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(modes(page)).toHaveCount(0)
    await expect(tempo(page)).toHaveCount(0)

    await more(page).click()
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(more(page)).toHaveAttribute(
      'aria-label',
      'Hide extra controls',
    )
    await expect(modes(page)).toBeVisible()
    await expect(tempo(page)).toBeVisible()
    await settled(page)

    // Beside the capsule, on its line -- there is the width for it here.
    const box = await boxOf(capsule(page))
    for (const opened of [modes(page), tempo(page)]) {
      const at = await boxOf(opened)
      expect(at.x).toBeGreaterThanOrEqual(box.x + box.width)
      expect(at.y + at.height / 2).toBeGreaterThan(box.y)
      expect(at.y + at.height / 2).toBeLessThan(box.y + box.height)
    }

    // And they still drive the room from in there.
    await modes(page).getByRole('button', { name: 'Harmony Stack' }).click()
    await expect(
      modes(page).getByRole('button', { name: 'Harmony Stack' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await more(page).click()
    await expect(modes(page)).toHaveCount(0)
    await expect(tempo(page)).toHaveCount(0)
  })

  test('stays open on the next visit once it has been opened', async ({
    page,
  }) => {
    await openDrillRoom(page)
    await more(page).click()
    await expect(modes(page)).toBeVisible()

    // A new tab, not a reload: the room is remembered per tab, so a reload
    // walks straight back in -- as a guest, who has no More to find open.
    // What More remembers is per DEVICE, and a new tab shares that.
    const next = await page.context().newPage()
    await openDrillRoom(next)
    await expect(more(next)).toHaveAttribute('aria-expanded', 'true')
    await expect(modes(next)).toBeVisible()
  })

  test('has no More and no room mode on a song, and gets them back with a drill', async ({
    page,
  }) => {
    await openDrillRoom(page)
    // Opened during the drill, which is the case worth having: the song
    // must not inherit a row of controls that do nothing to it.
    await more(page).click()
    await expect(modes(page)).toBeVisible()

    await loadTheSong(page)
    await expect(more(page)).toHaveCount(0)
    await expect(modes(page)).toHaveCount(0)
    await expect(tempo(page)).toHaveCount(0)
    await expectInside(pitchToggle(page), capsule(page))

    await loadADrill(page)
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(modes(page)).toBeVisible()
  })
})

test.describe('a song room on a tablet on its side', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

  test('leaves the timeline most of the row', async ({ page }) => {
    await openDrillRoom(page)
    await loadTheSong(page)
    // The preview-only note out, leaving the bar a real host has (see
    // jam-room-rows.spec.ts).
    await page.addStyleTag({
      content:
        '[data-testid="jam-transport-bar"] [role="note"] { display: none !important; }',
    })
    const buttons = await boxOf(capsule(page))
    const where = await boxOf(timeline(page))
    expect(where.x).toBeGreaterThanOrEqual(buttons.x + buttons.width)
    expect(where.y + where.height / 2).toBeGreaterThan(buttons.y)
    expect(where.y + where.height / 2).toBeLessThan(buttons.y + buttons.height)
    // The mode picker alone was 221px of this row. With the sidebar open
    // the timeline had 398px; it has over 600 now.
    expect(where.width).toBeGreaterThan(560)
    expect(where.width).toBeGreaterThan(buttons.width * 2)
    expect(await pageScrollsSideways(page)).toBe(false)
  })
})

test.describe('a drill room on a tablet held upright', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true })

  test('wraps what More opens onto a second line rather than off the screen', async ({
    page,
  }) => {
    await openDrillRoom(page)
    await more(page).click()
    await expect(modes(page)).toBeVisible()
    await settled(page)
    const bar = await boxOf(page.getByTestId('jam-transport-bar'))
    for (const opened of [modes(page), tempo(page)]) {
      const at = await boxOf(opened)
      expect(at.x).toBeGreaterThanOrEqual(bar.x - 1)
      expect(at.x + at.width).toBeLessThanOrEqual(bar.x + bar.width + 1)
    }
    expect(await pageScrollsSideways(page)).toBe(false)
  })
})

test.describe('a drill room on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('keeps More in the bar and leaves the live-pitch toggle to the room menu', async ({
    page,
  }) => {
    await openDrillRoom(page)
    await expect(pitchToggle(page)).toBeHidden()
    await expect(more(page)).toBeVisible()
    await more(page).click()
    await expect(modes(page)).toBeVisible()
    // The bar scrolls sideways on a phone; the page never does.
    expect(await pageScrollsSideways(page)).toBe(false)
  })
})
