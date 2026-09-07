// A deterministic local take seeds only IndexedDB; capture, replay and UI remain real.
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { installSongAudioProbe } from './guitar-night-audio-probe'

export const RECORDING_ID = 'e2e-recorder-transport'
export const SECOND_RECORDING_ID = `${RECORDING_ID}-second`
export const DURATION = 12

export async function enterRecording(
  page: Page,
  second = false,
): Promise<Locator> {
  await installSongAudioProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Play free form', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-deck')).toBeVisible()
  // Seed only the persistence boundary after the app initializes its schema.
  // Actual PCM decoding, transcribed-note scheduling and UI state stay real.
  await page.evaluate(
    async ({ id, seconds, secondId }) => {
      const request = indexedDB.open('MercuryPitchDB')
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const sampleRate = 48000
      const frames = sampleRate * seconds
      const chunkSize = 8192
      const chunks = Math.ceil(frames / chunkSize)
      const now = '2026-09-07T12:00:00.000Z'
      const transaction = db.transaction(
        ['guitarRecordings', 'guitarRecordingChunks'],
        'readwrite',
      )
      const put = (store: string, row: Record<string, unknown>) => {
        transaction.objectStore(store).put(row)
        if (secondId !== null) {
          transaction.objectStore(store).put({
            ...row,
            id: String(row.id).replace(id, secondId),
            ...(store === 'guitarRecordings'
              ? { title: 'Second saved idea' }
              : { recordingId: secondId }),
          })
        }
      }
      put('guitarRecordings', {
        id,
        version: 1,
        detectorVersion: 'guitar-melody-1.1',
        title: 'Two-part transport proof',
        createdAt: now,
        updatedAt: now,
        state: 'draft',
        sampleRate,
        inputChannel: 0,
        inputKind: 'interface',
        tuning: {
          instrument: 'guitar',
          stringCount: 6,
          openMidi: [64, 59, 55, 50, 45, 40],
          labels: ['E', 'B', 'G', 'D', 'A', 'E'],
          capo: 0,
        },
        frames,
        chunks,
        audioStartFrame: 0,
        clockAnomalies: 0,
        interruption: null,
        amp: null,
        backing: null,
        takeId: null,
        scoreId: null,
      })
      for (let sequence = 0; sequence < chunks; sequence++) {
        const firstFrame = sequence * chunkSize
        const count = Math.min(chunkSize, frames - firstFrame)
        const pcm = new ArrayBuffer(count * 2)
        const view = new DataView(pcm)
        for (let index = 0; index < count; index++) {
          const frame = firstFrame + index
          const frequency = frame < frames / 2 ? 110 : 220
          view.setInt16(
            index * 2,
            Math.round(
              2600 * Math.sin((2 * Math.PI * frequency * frame) / sampleRate),
            ),
            true,
          )
        }
        put('guitarRecordingChunks', {
          id: `${id}:${sequence}`,
          createdAt: now,
          updatedAt: now,
          kind: 'audio',
          recordingId: id,
          sequence,
          firstFrame,
          frames: count,
          pcm,
          pitches: [],
          attacks: [],
          notes: [],
          peak: 0.08,
        })
      }
      put('guitarRecordingChunks', {
        id: `${id}:ending`,
        createdAt: now,
        updatedAt: now,
        kind: 'ending',
        recordingId: id,
        sequence: chunks,
        firstFrame: frames,
        frames: 0,
        pcm: null,
        pitches: [],
        attacks: [],
        peak: 0,
        notes: [
          {
            id: 'first',
            midi: 57,
            startFrame: 0,
            endFrame: frames / 2,
            clarity: 0.96,
            onset: 'attack',
          },
          {
            id: 'second',
            midi: 64,
            startFrame: frames / 2,
            endFrame: frames,
            clarity: 0.96,
            onset: 'attack',
          },
        ],
      })
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
      db.close()
    },
    {
      id: RECORDING_ID,
      seconds: DURATION,
      secondId: second ? SECOND_RECORDING_ID : null,
    },
  )
  await page.goto(`/guitar-night?recording=${RECORDING_ID}`)
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
  return page.getByTestId('guitar-recorder-deck')
}
