// ============================================================
// Changing the scored part without leaving the room
// ============================================================
//
// Reported 2026-08-19: "the guitar night room, doesn't seem to have a easy way
// to change what is being scored against? what track?"
//
// It was changeable only from the lobby, so the fix is judged from inside the
// room: open the loaded-score details, pick another part, and see the room
// itself change what it is reading.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

/** A two-part file, which is the case the lobby's picker existed for. */
function seedTwoPartScore() {
  return (seededSongId: string) => {
    const lead = Array.from({ length: 12 }, (_, index) => ({
      midi: 64,
      startBeat: index,
      duration: 1,
      stringIndex: 0,
      fret: index % 5,
    }))
    const rhythm = Array.from({ length: 8 }, (_, index) => ({
      midi: 52,
      startBeat: index * 1.5,
      duration: 1,
      stringIndex: 4,
      fret: 2,
    }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Two Part Study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: lead.length,
              notes: lead,
            },
            {
              id: 'track-rhythm',
              name: 'Rhythm guitar',
              instrumentName: 'Clean Guitar',
              noteCount: rhythm.length,
              notes: rhythm,
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

test('changes the scored part from inside the tab room @smoke', async ({
  page,
}) => {
  const songId = `session-panel-${Date.now()}`
  await page.addInitScript(seedTwoPartScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Rehearse the tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  await expect(room).toBeVisible()
  // The room opens on the file's own scored part.
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()

  // THE REGRESSION: before this there was no way in from here at all.
  await page.getByTestId('guitar-night-session-trigger').click()
  const panel = page.getByTestId('guitar-night-session-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Two Part Study')).toBeVisible()

  const rhythm = panel.getByRole('button', { name: /Rhythm guitar/ })
  await expect(rhythm).toHaveAttribute('aria-pressed', 'false')
  await rhythm.click()

  // The room is reading the other part now, and says so where it always said it.
  await expect(panel).toHaveCount(0)
  await expect(room.getByText(/Tab rehearsal · Rhythm guitar/)).toBeVisible()

  // And the panel agrees on the way back in.
  await page.getByTestId('guitar-night-session-trigger').click()
  await expect(
    page
      .getByTestId('guitar-night-session-panel')
      .getByRole('button', { name: /Rhythm guitar/ }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('returns focus to the room when the panel is dismissed @smoke', async ({
  page,
}) => {
  const songId = `session-focus-${Date.now()}`
  await page.addInitScript(seedTwoPartScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Rehearse the tab', exact: true })
    .click()

  const trigger = page.getByTestId('guitar-night-session-trigger')
  await trigger.click()
  await expect(page.getByTestId('guitar-night-session-panel')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('guitar-night-session-panel')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
