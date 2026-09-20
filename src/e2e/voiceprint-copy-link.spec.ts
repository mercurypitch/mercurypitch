// ============================================================
// Voice Mirror — the link leaves the page on a desktop too
// ============================================================
//
// A desktop browser has no share sheet. "Share" there saved the picture and
// dropped the text, so the link that opens a voiceprint — the whole point of
// sharing one — had no way out of the page. These run the real share path in
// a browser with no share sheet (headless Chromium on Linux is one) and look
// at the two things that leave: the clipboard, and the card sent to the
// store so the link can unfurl as itself.
import type { Page, Request } from '@playwright/test'
import { expect, test } from '@playwright/test'

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function glideFrames(
  fromMidi: number,
  toMidi: number,
): Array<{ t: number; f0: number; conf: number }> {
  const frames: Array<{ t: number; f0: number; conf: number }> = []
  for (let i = 0; i <= 24; i++) {
    const midi = fromMidi + ((toMidi - fromMidi) * i) / 24
    frames.push({ t: i * 0.32, f0: midiToFreq(midi), conf: 0.95 })
  }
  return frames
}

/** Minimal valid StoredAttempt (schema: src/lib/mirror/attempts.ts). */
function attempt(): Record<string, unknown> {
  const lowMidi = 48
  const highMidi = 74
  return {
    n: 1,
    savedAt: 1_700_000_000_001,
    deltaLine: 'FIRST TAKE',
    glides: [glideFrames(lowMidi, highMidi), glideFrames(highMidi, lowMidi)],
    result: {
      range: {
        lowMidi,
        highMidi,
        lowNote: 'C3',
        highNote: 'D5',
        semitones: highMidi - lowMidi,
        qualifyingMidis: Array.from(
          { length: highMidi - lowMidi + 1 },
          (_, i) => lowMidi + i,
        ),
        voiceHint: 'Tenor',
      },
      accuracy: {
        score: 66,
        scoopMedianMs: 150,
        takes: [60, 62, 64, 65, 67].map((targetMidi) => ({
          targetMidi,
          locked: true,
          deviationCents: 20,
          band: 'hit',
          score: 80,
          onsetMs: 150,
        })),
      },
      steadiness: {
        referenceCents: 6000,
        referenceNote: 'C4',
        driftCentsPerSec: -2,
        wobbleSdCents: 15,
        vibrato: null,
        score: 75,
        voicedSeconds: 5,
      },
    },
  }
}

/** Open the results of a saved take, and catch what is sent to the store. */
async function openResults(page: Page): Promise<Request[]> {
  const uploads: Request[] = []
  await page.route('**/api/og/card/*', async (route) => {
    uploads.push(route.request())
    await route.fulfill({ status: 204 })
  })
  await page.addInitScript(
    (json: string) => localStorage.setItem('mirror.attempts.v1', json),
    JSON.stringify([attempt()]),
  )
  await page.goto('/mirror#take-1')
  await expect(page.locator('.mirror-results')).toBeVisible()
  return uploads
}

function decode(link: string): { t: string; d: Record<string, unknown> } {
  const v = new URL(link).searchParams.get('v') ?? ''
  const json = Buffer.from(v, 'base64url').toString('utf8')
  return JSON.parse(json) as { t: string; d: Record<string, unknown> }
}

test.describe('a voiceprint link on a desktop', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('Copy link puts this take on the clipboard and stores its card', async ({
    page,
  }) => {
    const uploads = await openResults(page)

    await page.getByTestId('mirror-copy-link').click()
    await expect(page.locator('.mirror-sharestatus')).toContainText(
      'Link copied',
    )

    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(link).toMatch(/\/mirror\?v=/)
    expect(link).toContain('utm_source=voiceprint&utm_medium=share')
    const payload = decode(link)
    expect(payload.t).toBe('voiceprint')
    // The take's own numbers: its range, and its two scores as scores.
    expect(payload.d).toMatchObject({ lo: 48, hi: 74, ac: 66, sd: 75 })

    // The card the link names is the card that was stored, as a JPEG.
    const id = new URL(link).searchParams.get('og')
    expect(id).toMatch(/^[0-9A-Za-z]{10}$/)
    await expect.poll(() => uploads.length).toBe(1)
    expect(uploads[0].method()).toBe('PUT')
    expect(new URL(uploads[0].url()).pathname).toBe(`/api/og/card/${id}`)
    expect(uploads[0].headers()['content-type']).toBe('image/jpeg')
    const body = uploads[0].postDataBuffer()
    expect(body?.subarray(0, 2).toString('hex')).toBe('ffd8')
    // A square data card is tens of kilobytes; a megabyte would be the PNG.
    expect(body?.byteLength ?? 0).toBeGreaterThan(5_000)
    expect(body?.byteLength ?? 0).toBeLessThan(1024 * 1024)
  })

  test('the copied link opens on the take it was copied from', async ({
    page,
  }) => {
    await openResults(page)
    await page.getByTestId('mirror-copy-link').click()
    await expect(page.locator('.mirror-sharestatus')).toContainText(
      'Link copied',
    )
    const link = await page.evaluate(() => navigator.clipboard.readText())

    // Same build, whatever host the link was written for.
    const copied = new URL(link)
    await page.goto(`/mirror${copied.search}`)
    await expect(page.getByText('Someone sent you this')).toBeVisible()
  })

  test('Share saves the picture AND copies the link, and says so', async ({
    page,
  }) => {
    const uploads = await openResults(page)
    expect(
      await page.evaluate(() => typeof navigator.share),
      'this spec needs a browser with no share sheet',
    ).toBe('undefined')

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Share voiceprint' }).click()
    expect((await download).suggestedFilename()).toMatch(/\.png$/)

    await expect(page.locator('.mirror-sharestatus')).toContainText(
      'link is copied',
    )
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(decode(link).t).toBe('voiceprint')
    await expect.poll(() => uploads.length).toBe(1)
    expect(uploads[0].headers()['content-type']).toBe('image/jpeg')
  })
})

test('stores nothing when the clipboard is refused', async ({ page }) => {
  // No clipboard permission: the write is rejected, so no link left the page
  // and no card may leave the device on its behalf.
  const uploads = await openResults(page)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    })
  })
  await page.getByTestId('mirror-copy-link').click()
  await expect(page.locator('.mirror-sharestatus')).toContainText(
    'could not be copied',
  )
  expect(uploads).toHaveLength(0)
})
