// ============================================================
// Voice Mirror — URL fragment routing (#take-N deep links,
// #sing-the-universe) and back/forward across hash states.
//
// Regression coverage for: leaving a hash-addressed screen via
// Back must return the UI to the landing instead of leaving the
// old results mounted (URL and UI must agree). Runs against the
// prod build, so the dev-only demo lanes (#freddie) are out of
// scope here.
// ============================================================
import type { Page } from '@playwright/test'
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
function attempt(n: number, deltaLine: string): Record<string, unknown> {
  const lowMidi = 48
  const highMidi = 74
  return {
    n,
    savedAt: 1_700_000_000_000 + n,
    deltaLine,
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

async function seedTakes(page: Page): Promise<void> {
  await page.addInitScript(
    (json: string) => localStorage.setItem('mirror.attempts.v1', json),
    JSON.stringify([
      attempt(1, 'DELTA-TAKE-ONE'),
      attempt(2, 'DELTA-TAKE-TWO'),
    ]),
  )
}

const landing = '.mirror-landing'
const results = '.mirror-results'
const delta = '.mirror-delta'

test('restores a saved take from a #take-N deep link', async ({ page }) => {
  await seedTakes(page)
  await page.goto('/mirror#take-1')
  await expect(page.locator(results)).toBeVisible()
  await expect(page.locator(delta)).toHaveText('DELTA-TAKE-ONE')
})

test('Back walks take fragments and lands on the landing at /mirror', async ({
  page,
}) => {
  await seedTakes(page)
  await page.goto('/mirror')
  await expect(page.locator(landing)).toBeVisible()
  await page.evaluate(() => {
    window.location.hash = '#take-1'
  })
  await expect(page.locator(delta)).toHaveText('DELTA-TAKE-ONE')
  await page.evaluate(() => {
    window.location.hash = '#take-2'
  })
  await expect(page.locator(delta)).toHaveText('DELTA-TAKE-TWO')
  await page.goBack()
  await expect(page.locator(delta)).toHaveText('DELTA-TAKE-ONE')
  await page.goBack()
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  await expect(page.locator(landing)).toBeVisible()
  await expect(page.locator(results)).not.toBeVisible()
})

test('#sing-the-universe opens cosmic mode and Back returns to the landing', async ({
  page,
}) => {
  await page.goto('/mirror')
  await expect(page.locator(landing)).toBeVisible()
  await page.evaluate(() => {
    window.location.hash = '#sing-the-universe'
  })
  await expect(
    page.getByRole('heading', { name: 'Sing the Universe' }),
  ).toBeVisible()
  await page.goBack()
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  await expect(page.locator(landing)).toBeVisible()
})

test('a take missing on this device falls back to the landing', async ({
  page,
}) => {
  await page.goto('/mirror#take-7')
  await expect(page.locator(landing)).toBeVisible()
  await expect(page.locator(results)).not.toBeVisible()
})
