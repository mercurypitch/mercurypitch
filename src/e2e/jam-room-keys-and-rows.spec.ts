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

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const TONE_WAV = readFileSync(writeToneWav(440, 4))
const LYRICS = [
  '[00:00.50]First line of the song',
  '[00:01.50]Second line of the song',
  '[00:02.50]Third line of the song',
  '',
].join('\n')

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

    // And the press still does what it is for.
    await second.click()
    await expect(page.getByLabel('Lyric position')).toHaveText('Line 2 / 3')
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
