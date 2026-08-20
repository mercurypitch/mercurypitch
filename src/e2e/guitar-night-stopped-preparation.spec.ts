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
async function dropAudioThatStops(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.evaluate(() => {
    // On the drop zone itself: a drop dispatched on an ancestor bubbles the
    // wrong way and never reaches the handler.
    const zone = document.querySelector(
      '[data-testid="guitar-night-file-drop"]',
    )
    if (zone === null) throw new Error('no file drop on this screen')
    const file = new File([new Uint8Array(2048)], 'accident.wav', {
      type: 'audio/wav',
    })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    zone.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    )
  })
  // Decoding is attempted for real before it gives up, so this is slower than
  // the default expect window.
  await expect(
    page.getByText('Couldn’t prepare this song', { exact: false }),
  ).toBeVisible({ timeout: 15000 })
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
  await dropAudioThatStops(page)

  await page.getByRole('button', { name: 'Remove this file' }).click()

  // The file is gone, and so is the state that was blocking everything else.
  await expect(page.getByText('accident.wav')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Try again', exact: true }),
  ).toHaveCount(0)
})

test('the tab a stopped separation was blocking is still reachable', async ({
  page,
}) => {
  await openTheLobby(page, `stopped-rehearse-${Date.now()}`)
  await dropAudioThatStops(page)

  // This is the whole report: the tab was attached and unreachable.
  await page.getByRole('button', { name: 'Rehearse the tab' }).click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
})
