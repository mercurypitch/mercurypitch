// Echo Curator browser proof — real PCM is fenced behind each reference and advances 3→5→7.

import { expect, test } from '@playwright/test'
import { ECHO_CURATOR_AUDITION } from '../../../packages/glass-game/src/content/echo-curator'
import { glassMelody } from '../../../packages/glass-game/src/content/melodies'
import { compileMelody } from '../../../packages/glass-game/src/core/melody-contour'
import { installThawingInput, singCompiledPhrase, } from './helpers/thawing-song-input'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.setTimeout(120_000)

const contours = ECHO_CURATOR_AUDITION.rounds.map((round) =>
  compileMelody(glassMelody(round.melodyId), {
    rootMidi: 60,
    pace: 1,
    allowedRange: { minimumMidi: 36, maximumMidi: 84 },
  }),
)

async function singCurrentRound(
  page: Parameters<typeof singCompiledPhrase>[0],
  roundIndex: number,
): Promise<void> {
  const practice = page.locator('section[data-mode]')
  await page.getByRole('button', { name: 'Sing the melody', exact: true }).tap()
  await expect(practice).toHaveAttribute('data-mode', 'reference', {
    timeout: 15_000,
  })
  await expect(practice).toHaveAttribute('data-mode', 'singing', {
    timeout: 20_000,
  })
  await expect(
    practice.getByRole('progressbar', { name: 'Melody progress' }),
  ).toHaveAttribute('aria-valuenow', '0')
  await singCompiledPhrase(page, contours[roundIndex]!)
  await expect(page.getByText('Echo answered', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
}

test('the optional curator fences capture, rejects a constant tone and completes all three echoes @smoke', async ({
  page,
}, testInfo) => {
  await installThawingInput(page)
  await page.goto('/glass-game/?lab=echo-curator')

  await expect(
    page.getByRole('heading', { name: 'The Echo Curator', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start the first round', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.thawingInput.streams.length)).toBe(0)
  await expect(
    page.getByText('No timer, lives, currency or campaign penalty.'),
  ).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: testInfo.outputPath('echo-curator-intro-phone.png'),
  })

  await page
    .getByRole('button', { name: 'Start the first round', exact: true })
    .tap()
  await expect(
    page.getByRole('heading', {
      name: 'First arc',
      exact: true,
      level: 2,
    }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.thawingInput.streams.length)).toBe(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: testInfo.outputPath('echo-curator-round-phone.png'),
  })

  const practice = page.locator('section[data-mode]')
  await page.getByRole('button', { name: 'Sing the melody', exact: true }).tap()
  await expect(practice).toHaveAttribute('data-mode', 'reference', {
    timeout: 15_000,
  })
  await expect(practice).toHaveAttribute('data-mode', 'singing', {
    timeout: 20_000,
  })
  expect(await page.evaluate(() => window.thawingInput.streams.length)).toBe(1)
  await expect(
    practice.getByRole('progressbar', { name: 'Melody progress' }),
  ).toHaveAttribute('aria-valuenow', '0')

  await page.evaluate(() => window.thawingInput.tone(67))
  await page.waitForTimeout(700)
  await expect(practice).toHaveAttribute('data-mode', 'singing')
  await page.evaluate(() => window.thawingInput.tone(60))
  await page.waitForTimeout(1600)
  await expect(practice).toHaveAttribute('data-mode', 'singing')
  await singCompiledPhrase(page, contours[0]!)
  await expect(page.getByText('Echo answered', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await page.evaluate(() => window.thawingInput.silent())

  await page
    .getByRole('button', { name: 'Meet the next echo', exact: true })
    .tap()
  await singCurrentRound(page, 1)
  await page.evaluate(() => window.thawingInput.silent())
  await page
    .getByRole('button', { name: 'Meet the next echo', exact: true })
    .tap()
  await singCurrentRound(page, 2)
  await page.evaluate(() => window.thawingInput.silent())
  await page
    .getByRole('button', { name: 'Finish the audition', exact: true })
    .tap()

  await expect(
    page.getByRole('heading', {
      name: 'The cabinet remembers all three lights.',
      exact: true,
    }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 900 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1280)
  await page.screenshot({
    path: testInfo.outputPath('echo-curator-complete-desktop.png'),
  })
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.thawingInput.streams.every((stream) =>
          stream
            .getAudioTracks()
            .every((track) => track.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true)
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.includes(':progress:')),
    ),
  ).toEqual([])
})
