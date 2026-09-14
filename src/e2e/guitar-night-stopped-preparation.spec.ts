// ============================================================
// A separation that stopped must be able to be put down
// ============================================================
//
// Reported 2026-08-20:
//
//   "When I accidently added a song mp3/wav to separate, and cancelled it, I
//    cannot remove that added item, then I added gpx tab, and all I have from
//    options is 'try again' to separate, but cannot rehearse and close that
//    loaded song for separation?"
//
// The cancelled and failed branches sit above every branch that offers a room,
// and they offered retrying and nothing else. So the file could not be put
// down, and the tab it was blocking could not be reached.
// Audio now queues in Add music first. After an explicit preparation fails,
// closing that sheet must still leave the previously staged tab reachable.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

function tabSeed() {
  return (seededSongId: string) => {
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Velvet pointer study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: 4,
              notes: [
                { midi: 64, startBeat: 0, duration: 1 },
                { midi: 67, startBeat: 1, duration: 1 },
                { midi: 64, startBeat: 2, duration: 1 },
                { midi: 67, startBeat: 3, duration: 1 },
              ],
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

/** Audio that cannot be decoded, which is how a separation stops on its own. */
async function chooseAudioThatStops(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.getByTestId('guitar-night-file-input').setInputFiles({
    name: 'accident.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.alloc(2048),
  })
  const dialog = page.getByTestId('night-music-import')
  await expect(dialog.getByRole('progressbar')).toHaveCount(0)
  await dialog.getByRole('button', { name: /^Prepare vocals/ }).click()
  // Decoding is attempted for real before it gives up, so this is slower than
  // the default expect window.
  await expect(dialog.getByRole('alert')).toContainText(/decode.*audio/i, {
    timeout: 15000,
  })
}

async function openTheLobby(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript(tabSeed(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
}

test('a stopped separation can be put down @smoke', async ({ page }) => {
  await openTheLobby(page, `stopped-remove-${Date.now()}`)
  await chooseAudioThatStops(page)

  await page.getByRole('button', { name: 'Back to session' }).click()

  // A failed preparation no longer holds the lobby hostage. Keep the file
  // available for an explicit retry, but never retry just by reopening it.
  await expect(page.getByTestId('night-music-import')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Practice with tab' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Add music', exact: true }).click()
  const dialog = page.getByTestId('night-music-import')
  await expect(dialog.getByText('accident.wav', { exact: true })).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: /^Prepare vocals/ }),
  ).toBeEnabled()
  await expect(dialog.getByRole('progressbar')).toHaveCount(0)
})

test('the tab a stopped separation was blocking is still reachable', async ({
  page,
}) => {
  await openTheLobby(page, `stopped-rehearse-${Date.now()}`)
  await chooseAudioThatStops(page)

  // This is the whole report: the tab was attached and unreachable.
  await page.getByRole('button', { name: 'Back to session' }).click()
  await page.getByRole('button', { name: 'Practice with tab' }).click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
})
