// ============================================================
// Karaoke staging events — example vs own song, end to end
// ============================================================
//
// `karaoke_song_staged` is Campaign E's bid target and must mean "the
// visitor brought their OWN song". Examples are ordinary session rows,
// so before the split both staging paths fired the same event and a
// visitor could satisfy E's goal by tapping a built-in track. The unit
// tests pin the discriminator; this pins the wiring on a real page:
//
//   - the rail library (KaraokeRailPanels.singSession) staging a real
//     upload → karaoke_song_staged
//   - the on-stage song sheet (KaraokeStageHost.pickSession) staging a
//     LEGACY example row — demo-format id, no provider stamp — →
//     karaoke_example_staged. The sheet is the path that let examples
//     pollute the bid target in production: orderedLibrarySessions
//     excludes only the exact demo id, so `karaoke-night-demo:<slug>`
//     rows flow into it.
//
// Observation channel: the funnel logs `[kn-funnel] <event>` to the
// console unconditionally, while the network beacon is disabled in the
// e2e build (VITE_API_BASE_URL is empty). The console line is emitted by
// the same trackKaraoke call that chooses what production beacons.

import { expect, test } from '@playwright/test'

const OWN_SONG_ID = 'e2e-own-song-4abc-9def-000000000001'
const OWN_SONG_NAME = 'my-own-song.wav'
// Demo-format id, provider left unset: a row a device seeded under an
// older build, before the provider stamp existed. The id format alone
// must classify it.
const LEGACY_EXAMPLE_ID = 'karaoke-night-demo:e2e-legacy'
const LEGACY_EXAMPLE_NAME = 'E2E Legacy Example Song'

const WAV_SECONDS = 3

function createTestWav(frequencyHz: number): Buffer {
  const sampleRate = 8_000
  const sampleCount = sampleRate * WAV_SECONDS
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
    const fade = Math.min(1, seconds * 20, (WAV_SECONDS - seconds) * 20)
    const amplitude = Math.sin(seconds * frequencyHz * Math.PI * 2) * fade
    wav.writeInt16LE(Math.round(amplitude * 3_000), 44 + sample * 2)
  }
  return wav
}

/** Seed one completed two-stem session the way the app stores them. */
async function seedSession(
  page: import('@playwright/test').Page,
  options: {
    sessionId: string
    fileName: string
    provider?: string
  },
): Promise<void> {
  const vocalWav = createTestWav(330)
  const instrumentalWav = createTestWav(110)

  await page.evaluate(
    async ({
      fileName,
      instrumentalBase64,
      provider,
      sessionId,
      vocalBase64,
    }) => {
      const decodeBase64 = (encoded: string): ArrayBuffer =>
        Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
          .buffer
      const vocalData = decodeBase64(vocalBase64)
      const instrumentalData = decodeBase64(instrumentalBase64)
      const now = new Date().toISOString()
      const vocalStemId = `${sessionId}-vocal`
      const instrumentalStemId = `${sessionId}-instrumental`

      await new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open('MercuryPitchDB')
        openRequest.onerror = () => reject(openRequest.error)
        openRequest.onsuccess = () => {
          const database = openRequest.result
          const transaction = database.transaction(
            ['uvrSessions', 'uvrStemBlobs'],
            'readwrite',
          )
          transaction.objectStore('uvrSessions').put({
            id: `${sessionId}-record`,
            appSessionId: sessionId,
            userId: 'karaoke-e2e',
            status: 'completed',
            progress: 100,
            originalFileName: fileName,
            originalFileSize: instrumentalData.byteLength,
            originalFileType: 'audio/wav',
            processingMode: 'local',
            // A legacy example row predates the provider stamp — omit it.
            ...(provider === undefined ? {} : { provider }),
            vocalStemId,
            instrumentalStemId,
            stemMetaJson: JSON.stringify({
              vocal: { duration: 3, size: vocalData.byteLength },
              instrumental: { duration: 3, size: instrumentalData.byteLength },
            }),
            appCreatedAt: Date.now(),
            createdAt: now,
            updatedAt: now,
          })
          for (const [stemId, stemType, data, stemFile] of [
            [vocalStemId, 'vocal', vocalData, `${fileName}-vocal.wav`],
            [
              instrumentalStemId,
              'instrumental',
              instrumentalData,
              `${fileName}-instrumental.wav`,
            ],
          ] as const) {
            transaction.objectStore('uvrStemBlobs').put({
              id: stemId,
              sessionId,
              stemType,
              mimeType: 'audio/wav',
              data,
              size: data.byteLength,
              fileName: stemFile,
              createdAt: now,
              updatedAt: now,
            })
          }
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.onabort = () => {
            database.close()
            reject(transaction.error)
          }
        }
      })
    },
    {
      fileName: options.fileName,
      instrumentalBase64: instrumentalWav.toString('base64'),
      provider: options.provider,
      sessionId: options.sessionId,
      vocalBase64: vocalWav.toString('base64'),
    },
  )
}

test.describe('Karaoke Night staging funnel events', () => {
  test('own upload fires karaoke_song_staged; a legacy example fires karaoke_example_staged', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const funnelEvents: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (text.startsWith('[kn-funnel]')) {
        funnelEvents.push(text.replace('[kn-funnel]', '').trim())
      }
    })
    const staged = (event: string): number =>
      funnelEvents.filter((entry) => entry === event).length

    // First visit creates the database schema; then seed and reload so the
    // app boots with both rows already in its library.
    await page.goto('/karaoke-night', { waitUntil: 'domcontentloaded' })
    await seedSession(page, {
      sessionId: OWN_SONG_ID,
      fileName: OWN_SONG_NAME,
      provider: 'local',
    })
    await seedSession(page, {
      sessionId: LEGACY_EXAMPLE_ID,
      fileName: LEGACY_EXAMPLE_NAME,
      // No provider on purpose: only the id format identifies it.
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    // The rail library must show ONLY the upload — demo-format ids are
    // presented through the opener/demo UI, never as library rows. This
    // count is itself a regression assertion.
    const libraryRows = page.locator('button.kn-library-song')
    await expect(libraryRows).toHaveCount(1, { timeout: 20_000 })
    await expect(libraryRows.first()).toContainText(OWN_SONG_NAME)

    // Path 1 — the rail stages the visitor's own upload.
    await libraryRows.first().click()
    await expect
      .poll(() => staged('karaoke_song_staged'), { timeout: 15_000 })
      .toBe(1)
    expect(staged('karaoke_example_staged')).toBe(0)

    // Path 2 — the on-stage song sheet lists the legacy example row
    // (only the exact demo id is excluded there) and staging it must
    // fire the example event, not the bid target. The sheet lives in the
    // Zen stage view, so enter it first.
    await page.getByRole('button', { name: 'Zen', exact: true }).click()
    await page.getByRole('button', { name: 'Open the song list' }).click()
    await page
      .getByRole('button', { name: LEGACY_EXAMPLE_NAME, exact: true })
      .click()
    await expect
      .poll(() => staged('karaoke_example_staged'), { timeout: 15_000 })
      .toBe(1)

    // The bid target did not move when a built-in track was staged.
    expect(staged('karaoke_song_staged')).toBe(1)
  })
})
