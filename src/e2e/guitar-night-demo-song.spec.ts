// ============================================================
// Guitar Night opens the demo song, once, even after Karaoke Night
// ============================================================
//
// Karaoke Night's examples seeder writes every demo into the session
// store as an ordinary "Examples" row, under the same id the demo port
// uses — carrying the R2 URLs and no local stem blobs at all. So a
// visitor who has opened Karaoke Night arrives here with a device row
// that names the demo and cannot produce a single byte of it.
//
// That shipped as two rows for one song, neither of which opened: the
// device answered "no audio on this device", and the composed library
// took that for the last word. This is that visitor.

import { expect, test } from '@playwright/test'

const DEMO_SESSION_ID = 'karaoke-night-demo'
const DEMO_TITLE = 'Goodbye to Spring'
const R2_PREFIX = 'https://pub-2aafe9bb91454abb998beb378a16d44a.r2.dev/**'
const SILENT_M4A = Buffer.from([])

/** A minimal 8kHz mono WAV, which is what the stems are replaced with. */
function createTestWav(frequencyHz: number, durationSeconds: number): Buffer {
  const sampleRate = 8_000
  const sampleCount = sampleRate * durationSeconds
  const wav = Buffer.alloc(44 + sampleCount * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(sampleCount * 2, 40)
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const seconds = sample / sampleRate
    const amplitude = Math.sin(seconds * frequencyHz * Math.PI * 2)
    wav.writeInt16LE(Math.round(amplitude * 3_000), 44 + sample * 2)
  }
  return wav
}

/**
 * The Examples row: a completed session with the demo's id and nothing
 * behind it. `uvrStemBlobs` is deliberately left untouched — that
 * emptiness is the whole bug.
 */
async function seedExampleRowWithoutAudio(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.evaluate(async (sessionId) => {
    await new Promise<void>((resolve, reject) => {
      const openRequest = indexedDB.open('MercuryPitchDB')
      openRequest.onerror = () => reject(openRequest.error)
      openRequest.onsuccess = () => {
        const database = openRequest.result
        const transaction = database.transaction(['uvrSessions'], 'readwrite')
        transaction.objectStore('uvrSessions').put({
          id: `${sessionId}-record`,
          appSessionId: sessionId,
          userId: 'guitar-night-e2e',
          status: 'completed',
          progress: 100,
          originalFileName: 'Josh Woodward — Goodbye to Spring',
          originalFileSize: 0,
          originalFileType: 'audio/mpeg',
          provider: 'examples',
          appCreatedAt: Date.UTC(2020, 0, 1),
          createdAt: new Date(Date.UTC(2020, 0, 1)).toISOString(),
          updatedAt: new Date(Date.UTC(2020, 0, 1)).toISOString(),
        })
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }
    })
  }, DEMO_SESSION_ID)
}

test.beforeEach(async ({ page }) => {
  // The demo's audio lives on R2, and e2e runs offline. Serve it locally
  // so the room's own decode path is exercised rather than stubbed.
  const stem = createTestWav(196, 2)
  await page.route(R2_PREFIX, async (route) => {
    const url = route.request().url()
    if (url.endsWith('.m4a')) {
      await route.fulfill({ body: stem, contentType: 'audio/wav', status: 200 })
      return
    }
    await route.fulfill({ body: SILENT_M4A, status: 404 })
  })

  // Open the room once so the local database exists to seed into.
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/on this device$/)).toBeVisible()
  await seedExampleRowWithoutAudio(page)
})

test('offers the demo once and opens it, even with a device row for it @smoke', async ({
  page,
}) => {
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()

  const rows = page.getByRole('button', { name: new RegExp(DEMO_TITLE) })
  await expect(rows).toHaveCount(1)
  // The row that survived is the demo's, and it says so instead of
  // showing a prepared date it never had.
  await expect(page.getByTestId('guitar-night-demo-kicker')).toBeVisible()
  await expect(rows.first()).toContainText('Demo song')

  await rows.first().click()

  // The lease opened: this button only exists once a backing is staged.
  await expect(
    page.getByRole('button', { name: 'Enter room', exact: true }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByText('That prepared song is not available on this device.'),
  ).toHaveCount(0)
})
