// Studio Add takes on a phone — the sticky Add takes button stays opaque while nothing is picked, so no kept take reads through it.
import { expect, type Page, test } from '@playwright/test'
import { audioFixture, studioRegion } from './helpers/dedicatedstudio-fixture'
import { dismissOverlays, waitForNav } from './helpers/ui'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

/** Kept takes from four rooms, as the take catalogue keeps them (voice-take-service.ts). */
async function seedKeptTakes(page: Page): Promise<void> {
  const wav = audioFixture(3).toString('base64')
  await page.evaluate(async (base64) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = database.transaction(
        ['voiceTakes', 'voiceTakeAudio'],
        'readwrite',
      )
      const now = new Date().toISOString()
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const takes = [
        ['seed-karaoke', 'karaoke', 'Window seat vocal'],
        ['seed-freeform', 'freeform', 'Morning hum'],
        ['guitar-take:seed-guitar', 'guitar-night', 'Strummed verse'],
        ['seed-piano', 'piano-night', 'Piano chords'],
      ]
      for (const [id, source, title] of takes) {
        transaction.objectStore('voiceTakes').put({
          id,
          source,
          comparisonKey: `seed:${id}`,
          contextVersion: 1,
          capturedAt: now,
          durationMs: 3000,
          mimeType: 'audio/wav',
          sizeBytes: bytes.byteLength,
          peaks: [],
          title,
          favorite: false,
          contextJson: '{}',
          createdAt: now,
          updatedAt: now,
        })
        transaction.objectStore('voiceTakeAudio').put({
          id: `audio:${id}`,
          takeId: id,
          mimeType: 'audio/wav',
          size: bytes.byteLength,
          data: bytes.buffer,
          createdAt: now,
          updatedAt: now,
        })
      }
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      database.close()
    }
  }, wav)
}

/** A new song on a phone, its Add takes sheet open on the kept takes. */
async function openAddTakes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const studio = studioRegion(page)
  const create = studio.getByRole('button', {
    name: 'Create project',
    exact: true,
  })
  // The Studio has opened the database by the time it offers a new song.
  await expect(create).toBeVisible()
  await seedKeptTakes(page)
  await create.click()
  await studio.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(studio.getByText('Strummed verse')).toBeVisible()
}

test.describe('Studio Add takes on a phone', () => {
  test('keeps the sticky Add takes button opaque while nothing is picked, so no take reads through it @smoke', async ({
    page,
  }) => {
    await openAddTakes(page)
    const add = studioRegion(page)
      .getByRole('dialog', { name: 'Add takes', exact: true })
      .getByRole('button', { name: /^Add\s+takes$/ })
    await expect(add).toBeDisabled()

    const painted = await add.evaluate((element) => {
      let opacity = 1
      for (let node: Element | null = element; node; node = node.parentElement)
        opacity *= Number(getComputedStyle(node).opacity)
      // An opaque fill: rgb(), or a colour whose alpha is 1.
      const fill = getComputedStyle(element).backgroundColor
      const alpha = /\/\s*([\d.]+)\)$|rgba\([^)]*,\s*([\d.]+)\)$/.exec(fill)
      return {
        opacity,
        fill,
        fillAlpha: alpha ? Number(alpha[1] ?? alpha[2]) : 1,
      }
    })

    expect(painted.opacity, 'the button and every box above it').toBe(1)
    expect(painted.fillAlpha, `its fill ${painted.fill}`).toBe(1)
  })
})
