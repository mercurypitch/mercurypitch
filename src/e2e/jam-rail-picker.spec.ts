// ============================================================
// Jam room — the song list in the sidebar
// ============================================================
//
// Changing song meant finding one button, opening a popup and reading it
// from the top, every time. The same list now sits in the room's sidebar,
// grouped and folding, and this drives it the way a host does: pick from
// the rail without ever opening the popup, see which row is running, and
// fold a group away.
//
// The stems are intercepted rather than fetched from R2 -- a spec must not
// depend on a bucket.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const TONE_WAV = readFileSync(writeToneWav(440, 2))
const LYRICS = ['[00:00.00]First line', '[00:02.00]Second line', ''].join('\n')

async function serveDemoStems(page: Page): Promise<void> {
  await page.route('**/demo/goodbye-to-spring/*.m4a', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: TONE_WAV }),
  )
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

const rail = (page: Page) => page.locator('[data-tour="jam.rail-picker"]')

test.describe('the song list in the room sidebar', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('loads a song without the popup ever opening @smoke', async ({
    page,
  }) => {
    await serveDemoStems(page)
    await openRoom(page)

    const list = rail(page)
    await expect(list).toBeVisible()
    // Grouped, so a long library does not bury the three things a room
    // actually reaches for.
    await expect(
      list.getByRole('button', { name: /^Example songs/ }),
    ).toBeVisible()
    await expect(list.getByRole('button', { name: /^Exercises/ })).toBeVisible()

    const row = list.getByRole('button', { name: /Goodbye to Spring/ })
    await expect(row).not.toHaveAttribute('aria-current', 'true')
    await row.click()

    await expect(page.getByTestId('jam-split-handle')).toBeVisible()
    // The rail says which row the room is on, which the popup never could:
    // it was closed by the time the song had loaded.
    await expect(row).toHaveAttribute('aria-current', 'true')
    await expect(row).toContainText('In the room')
    await expect(
      page
        .locator('#jam-panel button')
        .filter({ hasText: 'Goodbye to Spring' }),
    ).toHaveCount(0)
  })

  test('closes an open popup when the pick comes from the rail', async ({
    page,
  }) => {
    await serveDemoStems(page)
    await openRoom(page)

    await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
    const inPopup = page
      .locator('#jam-panel button')
      .filter({ hasText: 'Goodbye to Spring' })
    await expect(inPopup).toBeVisible()

    await rail(page)
      .getByRole('button', { name: /Goodbye to Spring/ })
      .click()
    // Two lists offering the song that is already loading is one too many.
    await expect(inPopup).toHaveCount(0)
    await expect(page.getByTestId('jam-split-handle')).toBeVisible()
  })

  test('folds a group away, and brings it back', async ({ page }) => {
    await openRoom(page)

    const examples = rail(page).getByRole('button', { name: /^Example songs/ })
    const row = rail(page).getByRole('button', { name: /Goodbye to Spring/ })
    await expect(examples).toHaveAttribute('aria-expanded', 'true')
    await expect(row).toBeVisible()

    await examples.click()
    await expect(examples).toHaveAttribute('aria-expanded', 'false')
    await expect(row).toHaveCount(0)

    // The long lists start folded, so the songs are what a host sees first.
    const drills = rail(page).getByRole('button', { name: /^Exercises/ })
    await expect(drills).toHaveAttribute('aria-expanded', 'false')
    await drills.click()
    await expect(
      rail(page).getByRole('button', { name: /Long Note/ }),
    ).toBeVisible()
    // That a fold survives a visit is pinned in jam-picker-list.test.tsx: a
    // reloaded preview room comes back as a guest, who has no list to fold.
  })
})

test.describe('the same list on a phone', () => {
  // hasTouch, because the 44px row is a rule for a coarse pointer and a
  // narrow desktop window is not one.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('arrives with the drawer and leaves with the pick @smoke', async ({
    page,
  }) => {
    await serveDemoStems(page)
    await openRoom(page)

    // A closed drawer slides off-screen rather than leaving the page. Its
    // rows must not come along: they would be a second set of song buttons
    // nobody can see, ahead of the sheet's for anything finding a song by
    // name -- which is how every other jam spec picks one.
    await expect(
      page.getByRole('button', { name: /Goodbye to Spring/ }),
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'Room controls' }).click()
    await page
      .getByRole('button', { name: 'Show the roster and the song list' })
      .click()

    const row = rail(page).getByRole('button', { name: /Goodbye to Spring/ })
    await expect(row).toBeVisible()
    await expect(row).toBeInViewport()
    const box = await row.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)

    await row.click()
    // The drawer covers the stage on a phone, so it gets out of the way.
    await expect(row).toHaveCount(0)
    await expect(page.getByTestId('jam-split-handle')).toBeVisible()
  })
})

test.describe('the same list on a tablet', () => {
  // Owner report (2026-09-20): on a tablet the songs were in the popup and
  // the sidebar had none. The list was mounted "unless this is a touch
  // device with its drawer shut" -- and a tablet is a touch device whose
  // sidebar is on the page at full width and never opens as a drawer. Wide
  // AND touch is the combination no other describe here has.
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

  test('is in the sidebar without anything being opened @smoke', async ({
    page,
  }) => {
    await serveDemoStems(page)
    await openRoom(page)

    const row = rail(page).getByRole('button', { name: /Goodbye to Spring/ })
    await expect(row).toBeVisible()
    await expect(row).toBeInViewport()

    await row.click()
    await expect(page.getByTestId('jam-split-handle')).toBeVisible()
    // The sidebar is part of the page here, so a pick leaves it where it is.
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-current', 'true')
  })

  test('sits clear of the listening pill above it @smoke', async ({ page }) => {
    await serveDemoStems(page)
    await openRoom(page)

    const pill = page.getByText('Listening...')
    const header = page.getByRole('button', { name: /^Songs and drills/ })
    await expect(pill).toBeVisible()
    await expect(header).toBeVisible()
    const above = await pill.locator('..').boundingBox()
    const below = await header.boundingBox()
    expect(above).not.toBeNull()
    expect(below).not.toBeNull()
    // The two sections share one sidebar panel, which spaces panels and not
    // what is inside them: the header used to start where the pill ended.
    expect(below!.y - (above!.y + above!.height)).toBeGreaterThanOrEqual(8)
  })
})
