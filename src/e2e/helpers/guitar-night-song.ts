// Deterministic local stems exercise the real saved-song loader without uploads.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

export const SONG_TITLE = 'Song controls study.wav'
export const SONG_SECONDS = 20
/** Real, quiet local audio exercises the existing decode and transport path. */
export function localStemWav(): Buffer {
  const sampleRate = 8_000
  const samples = SONG_SECONDS * sampleRate
  const wav = Buffer.alloc(44 + samples * 2)
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
  wav.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index += 1) {
    const envelope = Math.min(1, index / 400, (samples - index) / 400)
    wav.writeInt16LE(
      Math.round(
        Math.sin((index / sampleRate) * 165 * Math.PI * 2) * 500 * envelope,
      ),
      44 + index * 2,
    )
  }
  return wav
}

/** Same persisted session shape as guitar-night.spec.ts, parameterized by stem count. */
export async function enterSong(
  page: Page,
  count: 2 | 6,
  stems?: readonly Buffer[],
): Promise<void> {
  await page.route('https://**/*', (route) => route.abort())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/on this device$/)).toBeVisible()
  const sessionId = `song-controls-${count}-${test.info().testId}`
  await page.evaluate(
    async ({ id, total, audio, title, duration }) => {
      const kinds =
        total === 2
          ? ['vocal', 'instrumental']
          : ['vocal', 'drums', 'bass', 'guitar', 'piano', 'other']
      const bytes = Uint8Array.from(atob(audio[0]), (value) =>
        value.charCodeAt(0),
      )
      const now = new Date().toISOString()
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(
            ['uvrSessions', 'uvrStemBlobs'],
            'readwrite',
          )
          transaction.objectStore('uvrSessions').put({
            id: `${id}-record`,
            appSessionId: id,
            userId: 'guitar-night-e2e',
            status: 'completed',
            progress: 100,
            originalFileName: title,
            originalFileSize: bytes.byteLength,
            originalFileType: 'audio/wav',
            processingMode: 'local',
            provider: 'local',
            ...(total === 2
              ? {
                  vocalStemId: `${id}-vocal`,
                  instrumentalStemId: `${id}-instrumental`,
                }
              : {}),
            stemMetaJson: JSON.stringify(
              Object.fromEntries(
                kinds.map((kind) => [
                  kind,
                  { duration, size: bytes.byteLength },
                ]),
              ),
            ),
            appCreatedAt: Date.now(),
            createdAt: now,
            updatedAt: now,
          })
          for (const kind of kinds) {
            transaction.objectStore('uvrStemBlobs').put({
              id: `${id}-${kind}`,
              sessionId: id,
              stemType: kind,
              mimeType: 'audio/wav',
              data: Uint8Array.from(
                atob(audio[kinds.indexOf(kind)] ?? audio[0]),
                (value) => value.charCodeAt(0),
              ).buffer,
              size: bytes.byteLength,
              fileName: `study-${kind}.wav`,
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
      id: sessionId,
      total: count,
      audio: (stems ?? [localStemWav()]).map((stem) => stem.toString('base64')),
      title: SONG_TITLE,
      duration: SONG_SECONDS,
    },
  )
  await page.goto(`/guitar-night?session=${encodeURIComponent(sessionId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Enter room', exact: true }).click()
  await expect(page.getByTestId('guitar-night-room')).toBeVisible()
}
