// ============================================================
// Jam room — the guide vocal floats in a corner of the words
// ============================================================
//
// Owner report (2026-09-20): the vocal level was the first button of the
// playback row, ahead of play and stop. It is about what YOU hear, so it
// floats over the words now, the way the sing pill does on the karaoke
// stage -- in whichever bottom corner the words leave free, and never on
// the who-sings buttons that run down the right-hand edge.
//
// Only a browser can prove any of that: it is geometry, and the corner it
// picks is decided by a stylesheet and an alignment preference together.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const TONE_WAV = readFileSync(writeToneWav(440, 2))
const LYRICS = Array.from(
  { length: 24 },
  (_line, i) =>
    `[00:${String(i * 2).padStart(2, '0')}.00]Line ${i + 1} of a song with words enough to fill the column`,
).join('\n')

async function openSong(page: Page): Promise<void> {
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
  await expect(page.getByTestId('jam-split-handle')).toBeVisible()
}

const guide = (page: Page): Locator =>
  page.getByRole('button', { name: /^Guide vocal/ })

type Box = { x: number; y: number; width: number; height: number }

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

/** Every who-sings button that is on screen right now. */
async function whoSingsBoxes(page: Page): Promise<Box[]> {
  const buttons = page.getByRole('button', { name: /^Who sings line/ })
  const boxes: Box[] = []
  for (const button of await buttons.all()) {
    const box = await button.boundingBox()
    if (box !== null) boxes.push(box)
  }
  expect(boxes.length).toBeGreaterThan(3)
  return boxes
}

/** The alignment control is a radio group, named by where the words go. */
async function align(page: Page, to: 'Left' | 'Middle' | 'Right') {
  const choice = page
    .getByTestId('jam-lyrics-header')
    .getByRole('radio', { name: to, exact: true })
  await choice.click()
  await expect(choice).toHaveAttribute('aria-checked', 'true')
}

test.describe('the guide vocal on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('is over the words, not in the playback row @smoke', async ({
    page,
  }) => {
    await openSong(page)

    await expect(guide(page)).toHaveCount(1)
    const corner = page.getByTestId('jam-lyrics-corner')
    await expect(
      corner.getByRole('button', { name: /^Guide vocal/ }),
    ).toBeVisible()

    const pill = await boxOf(guide(page))
    const panel = await boxOf(
      page.getByTestId('jam-lyrics-header').locator('..'),
    )
    // Inside the lyric panel, at its foot.
    expect(pill.x).toBeGreaterThanOrEqual(panel.x)
    expect(pill.x + pill.width).toBeLessThanOrEqual(panel.x + panel.width)
    expect(panel.y + panel.height - (pill.y + pill.height)).toBeLessThan(24)
  })

  for (const to of ['Left', 'Middle'] as const) {
    test(`takes the right corner when the words are ${to}, inside the who-sings column @smoke`, async ({
      page,
    }) => {
      await openSong(page)
      await align(page, to)

      const pill = await boxOf(guide(page))
      const panel = await boxOf(
        page.getByTestId('jam-lyrics-header').locator('..'),
      )
      expect(pill.x + pill.width / 2).toBeGreaterThan(panel.x + panel.width / 2)
      for (const button of await whoSingsBoxes(page)) {
        expect(overlaps(pill, button), 'sits on a who-sings button').toBe(false)
      }
    })
  }

  test('takes the left corner when the words are on the right @smoke', async ({
    page,
  }) => {
    await openSong(page)
    await align(page, 'Right')

    const pill = await boxOf(guide(page))
    const panel = await boxOf(
      page.getByTestId('jam-lyrics-header').locator('..'),
    )
    expect(pill.x + pill.width / 2).toBeLessThan(panel.x + panel.width / 2)
    for (const button of await whoSingsBoxes(page)) {
      expect(overlaps(pill, button), 'sits on a who-sings button').toBe(false)
    }
  })

  test('still mutes and unmutes the original singer @smoke', async ({
    page,
  }) => {
    await openSong(page)
    const pill = guide(page)
    const before = await pill.getAttribute('aria-pressed')
    await pill.click()
    await expect(pill).not.toHaveAttribute('aria-pressed', before ?? '')
  })
})

test.describe('the guide vocal on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('stays docked above the tab bar, and only there @smoke', async ({
    page,
  }) => {
    await openSong(page)

    // One control, not two: the corner stands down at this width.
    await expect(guide(page)).toHaveCount(1)
    await expect(page.getByTestId('jam-lyrics-corner')).toBeHidden()
    const pill = await boxOf(guide(page))
    expect(pill.y).toBeGreaterThan(844 / 2)
  })
})

test.describe('the guide vocal on a phone held sideways', () => {
  // Wider than a phone, so no dock; and the words are a strip a line or two
  // tall, so no corner either -- the capsule opens 104px upward, and the
  // panel clips what does not fit. It was invisible here until it was given
  // the playback row back.
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true })

  test('goes back to the playback row, whole and on screen @smoke', async ({
    page,
  }) => {
    await openSong(page)

    await expect(guide(page)).toHaveCount(1)
    await expect(page.getByTestId('jam-lyrics-corner')).toBeHidden()

    const pill = await boxOf(guide(page))
    expect(pill.height).toBeGreaterThan(30)
    expect(pill.y).toBeGreaterThanOrEqual(0)
    expect(pill.y + pill.height).toBeLessThanOrEqual(390)

    // On the line the song picker's button is on: that IS the playback row.
    const picker = await boxOf(
      page.getByRole('button', { name: 'Choose a drill or a song' }),
    )
    const middle = pill.y + pill.height / 2
    expect(middle).toBeGreaterThan(picker.y)
    expect(middle).toBeLessThan(picker.y + picker.height)
  })
})
