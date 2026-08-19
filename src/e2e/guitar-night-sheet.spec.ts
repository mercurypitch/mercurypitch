// ============================================================
// Reading every part of a score at once
// ============================================================
//
// Asked for 2026-08-19: "a way to see multiple tracks at the same time even if
// not playing them... a sort of selector to show hide multiple stacked
// instruments tabs/notes per bar, few bars that fit on one horizontal page
// listing, and then they scroll down."
//
// The room could show one part. This judges the sheet from the room: stack the
// parts, take one off the page, and score another by reading its name.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

/** Three parts on three necks, which is what stacking is for. */
function seedBandScore() {
  return (seededSongId: string) => {
    const part = (midi: number, count: number, spacing: number) =>
      Array.from({ length: count }, (_, index) => ({
        midi,
        startBeat: index * spacing,
        duration: 1,
      }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Band Study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: 12,
              notes: part(64, 12, 1),
            },
            {
              id: 'track-rhythm',
              name: 'Rhythm guitar',
              instrumentName: 'Clean Guitar',
              noteCount: 8,
              notes: part(52, 8, 1.5),
            },
            {
              id: 'track-bass',
              name: 'Bass',
              instrumentName: 'Electric Bass',
              noteCount: 6,
              notes: part(33, 6, 2),
            },
          ],
          scoreTrackId: 'track-lead',
          backingTrackIds: [],
          importedAt: Date.now(),
        },
      ]),
    )
  }
}

async function openTheRoom(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript(seedBandScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Rehearse the tab', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
}

test('stacks every part of the file on one sheet @smoke', async ({ page }) => {
  await openTheRoom(page, `sheet-stack-${Date.now()}`)

  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await expect(sheet).toBeVisible()

  // The scored part is read first, then the rest in the order they were written.
  await expect(
    sheet.getByRole('button', { name: 'Lead guitar' }).first(),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Rhythm guitar' }).first(),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Bass' }).first(),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Lead guitar' }).first(),
  ).toHaveAttribute('aria-pressed', 'true')

  // Bars are drawn, and the line that follows the music is on the page.
  await expect(sheet.locator('canvas').first()).toBeVisible()
  await expect(page.getByTestId('guitar-night-sheet-playhead')).toBeVisible()
})

test('takes a part off the sheet from the loaded-score panel', async ({
  page,
}) => {
  await openTheRoom(page, `sheet-hide-${Date.now()}`)
  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await expect(
    sheet.getByRole('button', { name: 'Bass' }).first(),
  ).toBeVisible()

  await page.getByTestId('guitar-night-session-trigger').click()
  const panel = page.getByTestId('guitar-night-session-panel')
  await panel.getByLabel('Hide Bass on the sheet').click()
  await page.keyboard.press('Escape')

  await expect(sheet.getByRole('button', { name: 'Bass' })).toHaveCount(0)
  await expect(
    sheet.getByRole('button', { name: 'Rhythm guitar' }).first(),
  ).toBeVisible()

  // The part being scored cannot be taken off the page it is scored from.
  await page.getByTestId('guitar-night-session-trigger').click()
  await expect(
    page
      .getByTestId('guitar-night-session-panel')
      .getByLabel('Hide Lead guitar on the sheet'),
  ).toBeDisabled()
})

test('scores another part by reading its name on the sheet', async ({
  page,
}) => {
  await openTheRoom(page, `sheet-score-${Date.now()}`)
  const room = page.getByTestId('guitar-night-score-room')
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()

  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await sheet.getByRole('button', { name: 'Rhythm guitar' }).first().click()

  await expect(room.getByText(/Tab rehearsal · Rhythm guitar/)).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Rhythm guitar' }).first(),
  ).toHaveAttribute('aria-pressed', 'true')
})
