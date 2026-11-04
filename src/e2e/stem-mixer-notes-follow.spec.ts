// ============================================================
// The MIDI Melody panel's Notes view keeps the cursor's system in sight
// ============================================================
//
// At 1280 x 816 the panel's body is about 90 px tall over a 220 px score, so
// the staff scrolls inside the score and the score inside the body. The
// follow scrolled the staff with a glide and then, on most frames, wrote its
// scrollLeft; Chromium stops a glide on any write to the scroller, even of
// the value it already has, so the staff stayed where it was. Measured on
// the built app: opened paused and played, the staff never moved; opened
// while playing, it moved once.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { seek, toneWavBase64 } from './helpers/mixer-song'
import { dismissOverlays } from './helpers/ui'

const SESSION_ID = 'e2e-notes-follow'
const SONG_SECONDS = 40
const NOTE_COUNT = SONG_SECONDS * 2

test.use({ viewport: { width: 1280, height: 816 } })

/**
 * A forty-second song with a sung scale on it, a note every half second,
 * opened from its stems page with the vocal and its MIDI track.
 */
async function openSong(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(() => window.__pp?.appStore !== undefined)
  await page.evaluate(
    async ({ wav, sessionId, noteCount }) => {
      const audioUrl = `data:audio/wav;base64,${wav}`
      const store = window.__pp?.appStore as unknown as {
        initSessionStore: () => Promise<void>
        importUvrSessionDurable: (session: unknown) => Promise<boolean>
      }
      await store.initSessionStore()
      await store.importUvrSessionDurable({
        sessionId,
        status: 'completed',
        progress: 100,
        originalFile: {
          name: 'Notes follow.wav',
          size: 1,
          mimeType: 'audio/wav',
        },
        outputs: { vocal: audioUrl, instrumental: audioUrl },
        createdAt: Date.now(),
      })
      const audioData = await fetch(audioUrl).then((response) =>
        response.arrayBuffer(),
      )
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const now = new Date().toISOString()
      // A completed session needs its vocal and instrumental on disk, or
      // the boot-time prune takes it for a ghost (stem-mixer-controls.spec).
      const blobs = db.transaction('uvrStemBlobs', 'readwrite')
      for (const stemType of ['vocal', 'instrumental']) {
        blobs.objectStore('uvrStemBlobs').add({
          id: crypto.randomUUID(),
          sessionId,
          stemType,
          derivedFrom: 'instrumental',
          producedBy: 'e2e-full-band',
          mimeType: 'audio/wav',
          data: audioData,
          size: audioData.byteLength,
          fileName: `${stemType}.wav`,
          createdAt: now,
          updatedAt: now,
        })
      }
      await new Promise<void>((resolve, reject) => {
        blobs.oncomplete = () => resolve()
        blobs.onerror = () => reject(blobs.error)
        blobs.onabort = () => reject(blobs.error)
      })
      const steps = [0, 2, 4, 5, 7, 9, 11]
      const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
      const notes = Array.from({ length: noteCount }, (_, index) => ({
        midi: 60 + steps[index % 7],
        noteName: `${names[index % 7]}4`,
        startSec: index * 0.5,
        endSec: index * 0.5 + 0.4,
      }))
      const readings = notes.flatMap((note) =>
        [note.startSec, note.endSec].map((time) => ({
          time,
          noteName: note.noteName,
          frequency: 440 * Math.pow(2, (note.midi - 69) / 12),
          octave: 4,
        })),
      )
      const analysis = db.transaction('offlinePitchAnalysis', 'readwrite')
      analysis.objectStore('offlinePitchAnalysis').put({
        id: `${sessionId}-pitch`,
        fileHash: `session:${sessionId}`,
        analysisResultsJson: JSON.stringify(notes),
        lrcLinesJson: JSON.stringify(readings),
        segmentedNotesJson: JSON.stringify(notes),
        createdAt: now,
        updatedAt: now,
      })
      await new Promise<void>((resolve, reject) => {
        analysis.oncomplete = () => resolve()
        analysis.onerror = () => reject(analysis.error)
        analysis.onabort = () => reject(analysis.error)
      })
      db.close()
      localStorage.setItem('pitchperfect_mixer_strip_view', 'compact')
    },
    {
      wav: toneWavBase64(SONG_SECONDS, 220),
      sessionId: SESSION_ID,
      noteCount: NOTE_COUNT,
    },
  )

  await page.goto(`/#/karaoke/session/${SESSION_ID}`)
  await dismissOverlays(page)
  const viewer = page.locator('.uvr-result-viewer')
  await expect(viewer).toBeVisible({ timeout: 15_000 })
  for (const name of ['Vocal', 'Vocal MIDI']) {
    await viewer
      .locator('.rv-stem-card', { has: page.getByText(name, { exact: true }) })
      .click()
  }
  await page.getByRole('button', { name: 'Mix these stems' }).click()
  await expect(page.locator('.stem-mixer')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      async () =>
        (
          (await page
            .locator('canvas[data-canvas-id="midi"]')
            .getAttribute('data-note-pitches')) ?? ''
        )
          .split(' ')
          .filter(Boolean).length,
      { timeout: 30_000 },
    )
    .toBe(NOTE_COUNT)
}

const midiView = (page: Page, view: 'Roll' | 'Notes') =>
  page
    .getByRole('group', { name: 'MIDI Melody view' })
    .getByRole('button', { name: view, exact: true })

async function openNotes(page: Page): Promise<void> {
  await midiView(page, 'Notes').click()
  await expect(
    page.getByTestId('stem-mixer-midi-notes').locator('.vf-stavenote').first(),
  ).toBeAttached({ timeout: 5_000 })
  await expect(page.getByTestId('sheet-play-cursor')).toBeAttached()
}

/** The cursor's system, as the row the cursor stands on. */
const cursorRow = (page: Page): Promise<string> =>
  page.getByTestId('sheet-play-cursor').evaluate((el) => el.style.top)

/**
 * Whether the cursor shows whole: inside the Notes view's body and inside
 * the staff's own scroller, the two boxes that clip it.
 */
const cursorInView = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const body = document.querySelector('[data-testid="stem-mixer-midi-notes"]')
    const cursor = document.querySelector('[data-testid="sheet-play-cursor"]')
    const staff = cursor?.parentElement?.parentElement
    if (!body || !cursor || !staff) return false
    const c = cursor.getBoundingClientRect()
    const b = body.getBoundingClientRect()
    const s = staff.getBoundingClientRect()
    const top = Math.max(b.top, s.top)
    const bottom = Math.min(b.bottom, s.bottom)
    return c.height > 0 && c.top >= top - 1 && c.bottom <= bottom + 1
  })

/**
 * The last whole second, from `from`, before the cursor moves to the next
 * system: found by seeking, a second at a time, while paused.
 */
async function lastSecondOfSystem(page: Page, from: number): Promise<number> {
  await seek(page, from)
  const row = await cursorRow(page)
  for (let second = from + 1; second < SONG_SECONDS - 2; second += 1) {
    await seek(page, second)
    if ((await cursorRow(page)) !== row) return second - 1
  }
  throw new Error('The cursor never left its first system')
}

/** Plays on into the next system, and expects to be shown it there. */
async function playIntoNextSystem(page: Page): Promise<void> {
  const row = await cursorRow(page)
  await expect.poll(() => cursorRow(page), { timeout: 5_000 }).not.toBe(row)
  await expect.poll(() => cursorInView(page), { timeout: 2_000 }).toBe(true)
}

test('keeps the cursor’s system in view when Notes opens paused and the song plays @smoke', async ({
  page,
}) => {
  await openSong(page)
  await seek(page, 3)
  await openNotes(page)
  // Open, it shows where the song is.
  await expect.poll(() => cursorInView(page)).toBe(true)

  const last = await lastSecondOfSystem(page, 3)
  await seek(page, last)
  await expect.poll(() => cursorInView(page)).toBe(true)

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await playIntoNextSystem(page)
})

test('keeps the cursor’s system in view when Notes opens during playback @smoke', async ({
  page,
}) => {
  await openSong(page)
  await seek(page, 3)
  await openNotes(page)
  const last = await lastSecondOfSystem(page, 3)
  await midiView(page, 'Roll').click()
  await seek(page, Math.max(0, last - 1))

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await openNotes(page)
  await expect.poll(() => cursorInView(page)).toBe(true)
  await playIntoNextSystem(page)
})
