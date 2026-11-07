// Studio storage quality — the first import on a device asks how its audio is kept; Save space keeps a 16-bit copy, exact for a 16-bit WAV, and is remembered across a reload.
import { expect, type Page, test } from '@playwright/test'
import { audioFixture, studioRegion } from './helpers/dedicatedstudio-fixture'
import { dismissOverlays, waitForNav } from './helpers/ui'

const KEY = 'mercurypitch.studio.storage'

async function openStudio(page: Page): Promise<void> {
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
}

/** A 16-bit WAV of `seconds`: other lengths are other audio, which the Studio does not store as one. */
async function upload(page: Page, name: string, seconds = 2): Promise<void> {
  await studioRegion(page)
    .getByLabel('Upload audio', { exact: true })
    .setInputFiles({
      name: `${name}.wav`,
      mimeType: 'audio/wav',
      buffer: audioFixture(seconds),
    })
}

/** Every stored take's format and its canonical copy's 16-bit values, read from IndexedDB. */
async function storedTakes(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const all = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = db
          .transaction(store, 'readonly')
          .objectStore(store)
          .getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error)
      })
    try {
      const assets = await all<{
        asset: {
          originalName?: string
          canonicalPcmId: string
          canonicalPcmFormat?: string
          canonicalPcmByteLength: number
        }
      }>('studioAssets')
      const blobs = await all<{ id: string; data: ArrayBuffer }>(
        'studioAssetBlobs',
      )
      return assets.map(({ asset }) => {
        const data = blobs.find((row) => row.id === asset.canonicalPcmId)!.data
        return {
          name: asset.originalName,
          format: asset.canonicalPcmFormat ?? 'float32',
          bytes: asset.canonicalPcmByteLength,
          steps:
            asset.canonicalPcmFormat === 'int16'
              ? Array.from(new Int16Array(data, 32))
              : [],
        }
      })
    } finally {
      db.close()
    }
  })
}

/** The 16-bit values the fixture WAV holds. */
function wavValues(seconds = 2): number[] {
  const wav = audioFixture(seconds)
  return Array.from({ length: (wav.length - 44) / 2 }, (_, i) =>
    wav.readInt16LE(44 + i * 2),
  )
}

test.describe('Studio storage quality', () => {
  test('asks on the first import, keeps Save space as an exact 16-bit copy, and remembers it after a reload @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openStudio(page)
    await page.evaluate((key) => localStorage.removeItem(key), KEY)
    const studio = studioRegion(page)
    await studio
      .getByRole('button', { name: 'Create project', exact: true })
      .click()
    const ask = page.getByRole('alertdialog', {
      name: 'How should Studio keep your audio?',
    })
    const full = ask.getByRole('radio', { name: /^Full quality/ })

    // Escape cancels the import, and says nothing.
    await upload(page, 'Phrase')
    await expect(ask).toBeVisible()
    await expect(full).toBeChecked()
    await expect(full).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(ask).toBeHidden()
    await expect(
      studio.getByRole('button', { name: 'Phrase details', exact: true }),
    ).toHaveCount(0)
    await expect(studio.getByRole('alert')).toHaveCount(0)

    // Save space, remembered.
    await upload(page, 'Phrase')
    await ask.getByRole('radio', { name: /^Save space/ }).check()
    await ask.getByText('Remember my choice', { exact: true }).click()
    await expect(
      ask.getByRole('checkbox', { name: 'Remember my choice' }),
    ).toBeChecked()
    await ask.getByRole('button', { name: 'Add audio' }).click()
    await expect(
      studio.getByRole('button', { name: 'Phrase details', exact: true }),
    ).toBeVisible()
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
    // The save lands after the clip shows: wait for its row.
    await expect.poll(async () => (await storedTakes(page)).length).toBe(1)
    const [kept] = await storedTakes(page)
    expect(kept).toMatchObject({
      name: 'Phrase.wav',
      format: 'int16',
      bytes: 32 + 96_000 * 2,
    })
    // The browser decoded the WAV onto its 16-bit grid; the copy kept every value.
    expect(kept.steps).toEqual(wavValues())

    // After a reload the next import is not asked, and Song options says why.
    await page.reload()
    await waitForNav(page, 30_000)
    await dismissOverlays(page)
    await studio
      .getByRole('navigation', { name: 'Studio projects' })
      .getByRole('button')
      .first()
      .click()
    await upload(page, 'Second', 3)
    await expect(
      studio.getByRole('button', { name: 'Second details', exact: true }),
    ).toBeVisible()
    await expect(ask).toHaveCount(0)
    await expect
      .poll(async () => (await storedTakes(page)).map((take) => take.format))
      .toEqual(['int16', 'int16'])
    const second = (await storedTakes(page)).find(
      (take) => take.name === 'Second.wav',
    )
    expect(second?.steps).toEqual(wavValues(3))
    await studio.getByRole('button', { name: 'Song options' }).click()
    await expect(
      studio.getByRole('radio', { name: /^Save space/ }),
    ).toBeChecked()
    expect(errors).toEqual([])
  })
})
