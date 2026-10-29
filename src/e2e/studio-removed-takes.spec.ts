// Studio removed takes — a take deleted from the song stops using this browser's storage once the song opens again.
//
// A deleted clip's take stays saved for the rest of the session, so undo can
// bring the clip back. Opening the song again lets go of the takes no clip
// uses, so they stop counting against its 128-take, 480 MiB limit, but only
// in the one tab that has the song loaded. This walks it in a real browser,
// whose Web Locks are what prove the tab is alone with the song.
import { expect, test, type Page } from '@playwright/test'
import { importStudioAudio, openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'

/**
 * How many takes, how many of their stored files and how many waveform
 * peaks (kept beside a take's two files) this browser keeps for Studio.
 */
async function storedTakes(
  page: Page,
): Promise<{ takes: number; files: number; peaks: number }> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = (store: string) =>
      new Promise<number>((resolve, reject) => {
        const request = database
          .transaction(store, 'readonly')
          .objectStore(store)
          .count()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    const kinds = () =>
      new Promise<string[]>((resolve, reject) => {
        const request = database
          .transaction('studioAssetBlobs', 'readonly')
          .objectStore('studioAssetBlobs')
          .getAll()
        request.onsuccess = () =>
          resolve(request.result.map((row: { kind: string }) => row.kind))
        request.onerror = () => reject(request.error)
      })
    try {
      const rows = await kinds()
      return {
        takes: await count('studioAssets'),
        files: rows.filter((kind) => kind !== 'peaks').length,
        peaks: rows.filter((kind) => kind === 'peaks').length,
      }
    } finally {
      database.close()
    }
  })
}

test('a take deleted from the song is let go once the song opens again, and the take in use stays @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openArrangement(page)
  await importStudioAudio(page, 'Second', 2)
  const studio = studioRegion(page)
  const saved = studio.getByText('Saved in this browser', { exact: true })
  await expect(saved).toBeVisible()
  // Each take's peaks are kept once its waveform is drawn.
  await expect
    .poll(() => storedTakes(page))
    .toEqual({ takes: 2, files: 4, peaks: 2 })

  await studioClip(page, 'Second').click()
  await studio
    .locator('[aria-label="Selected clip"]')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(studioClip(page, 'Second')).toHaveCount(0)
  await expect(saved).toBeVisible()
  // Undo can still bring the clip back in this session, so its take stays.
  expect(await storedTakes(page)).toEqual({ takes: 2, files: 4, peaks: 2 })

  await page.reload()
  await studio.getByRole('button', { name: /^Untitled song/ }).click()
  await expect(studioClip(page, 'Phrase')).toBeVisible()
  await expect
    .poll(() => storedTakes(page))
    .toEqual({ takes: 1, files: 2, peaks: 1 })
  await expect(studioClip(page, 'Second')).toHaveCount(0)
})
