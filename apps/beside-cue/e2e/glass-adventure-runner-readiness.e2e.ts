// Runner readiness — real PCM must guide the singer before a course or checkpoint can start.
import { expect, test } from '@playwright/test'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

test('an acquired microphone without detector frames is distinguishable from captured silence', async ({
  page,
}) => {
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page, false, { omitRaster: false })
  // Keep actual microphone acquisition and PCM detection. Suppress only
  // delivery until the test releases this boundary, as during detector startup.
  await page.route(/\/browser\/voice-session\.ts(?:\?.*)?$/, (route) => {
    const original = new URL(route.request().url())
    if (original.searchParams.has('readiness-source')) return route.continue()
    original.searchParams.set('readiness-source', '1')
    return route.fulfill({
      contentType: 'application/javascript',
      body: `
        import { createBrowserVoice as createVoice } from ${JSON.stringify(original.href)};
        export { prepareBrowserVoiceGesture } from ${JSON.stringify(original.href)};
        export function createBrowserVoice(options) {
          const voice = createVoice(options);
          return { ...voice, subscribe(listener, stopped) {
            return voice.subscribe((value, now) => {
              if (document.documentElement.dataset.releaseCapture === 'true') listener(value, now);
            }, stopped);
          }};
        }
      `,
    })
  })
  await page.goto('/glass-game/?layout=singing-current')
  await page.evaluate(() => window.runnerVoiceFixture.silent())
  await page.getByRole('button', { name: 'Start course' }).tap()
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-phase', 'readiness')
  await expect(runner).toHaveAttribute('data-microphone', 'ready')
  const input = page.getByTestId('runner-readiness-input')
  await expect(input).toHaveAttribute('data-receiving', 'false')
  await expect(input).toHaveText('Waiting for microphone input')
  await page.evaluate(() => {
    document.documentElement.dataset.releaseCapture = 'true'
  })
  await expect(input).toHaveAttribute('data-receiving', 'true')
  await expect(input).toHaveText('Microphone responding')
  await expect(page.getByLabel('Your voice and target')).toHaveAttribute(
    'data-pitch-state',
    'neutral',
  )
  await page.evaluate(() => window.runnerVoiceFixture.tone(60))
  await expect(page.getByLabel('Your voice and target')).toHaveAttribute(
    'data-pitch-state',
    'wrong',
  )
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('starting note shows live wrong-pitch guidance before accepting the note @smoke', async ({
  page,
}) => {
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page, false, { omitRaster: false })
  await page.goto('/glass-game/?layout=singing-current')
  await page.evaluate(() => window.runnerVoiceFixture.tone(60))
  await page.getByRole('button', { name: 'Start course' }).tap()
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-phase', 'readiness')
  const feedback = page.getByLabel('Your voice and target')
  await expect(feedback).toHaveAttribute('data-pitch-state', 'wrong')
  await expect(feedback.locator('[data-pitch-target]')).toHaveText('A3')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveText('C4')
  await expect(feedback).toContainText('Sing lower')
  await expect(page.getByTestId('runner-readiness-input')).toHaveAttribute(
    'data-receiving',
    'true',
  )
  await expect(
    page.getByRole('progressbar', { name: 'Ready note' }),
  ).toHaveAttribute('aria-valuenow', '0')
  await page.evaluate(() => window.runnerVoiceFixture.silent())
  await expect(feedback).toHaveAttribute('data-pitch-state', 'neutral')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveCount(0)
  await expect(runner).toHaveAttribute('data-phase', 'readiness')
  await page.evaluate(() => window.runnerVoiceFixture.tone(57))
  await expect(runner).toHaveAttribute('data-phase', 'count-in')
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 10_000,
  })
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('a fall with no broken walls resumes and a changed starting note stays usable @smoke', async ({
  page,
}) => {
  test.setTimeout(65_000)
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page, false, { omitRaster: false })
  await page.goto('/glass-game/?layout=singing-current')
  await page.getByRole('button', { name: 'Start course' }).tap()
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 10_000,
  })
  await page.evaluate(() => window.runnerVoiceFixture.tone(65))
  // Avoid the first blocker but deliberately miss the gap, with no glass hits.
  await page.getByRole('button', { name: 'Right lane' }).tap()
  await expect(runner).toHaveAttribute('data-phase', 'recovering', {
    timeout: 25_000,
  })
  await expect(runner).toHaveAttribute('data-recovery-reason', 'fall')
  await expect(runner).toHaveAttribute('data-hit-targets', '0')
  await page.getByRole('button', { name: 'Resume from checkpoint' }).tap()
  await expect(runner).toHaveAttribute('data-phase', 'readiness')
  await expect(runner).toHaveAttribute('data-player-grounded', 'true')
  await expect(runner).toHaveAttribute('data-course-seconds', '0.000')
  const feedback = page.getByLabel('Your voice and target')
  await expect(feedback.locator('[data-pitch-target]')).toHaveText('A3')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveText('F4')
  await expect(feedback).toContainText('Sing lower')
  await page.evaluate(() => window.runnerVoiceFixture.tone(57))
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 10_000,
  })
  await expect(runner).toHaveAttribute('data-player-grounded', 'true')
  expect(Number(await runner.getAttribute('data-course-seconds'))).toBeLessThan(
    2,
  )

  await page.getByRole('button', { name: 'Pause course' }).tap()
  await page.getByRole('slider', { name: 'Comfortable note' }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab')
  // A changed comfortable note owns a fresh visit and a fresh audio gesture.
  await expect(page.getByRole('button', { name: 'Start course' })).toBeVisible()
  await page.evaluate(() => window.runnerVoiceFixture.tone(65))
  await page.getByRole('button', { name: 'Start course' }).tap()
  await expect(runner).toHaveAttribute('data-phase', 'readiness')
  await expect(feedback.locator('[data-pitch-target]')).toHaveText('A#3')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveText('F4')
  await page.evaluate(() => window.runnerVoiceFixture.tone(58))
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 10_000,
  })
  await expect(runner).toHaveAttribute('data-player-grounded', 'true')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`readiness pitch and actions fit ${viewport.width} by ${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await useRunnerControlsRenderer(page)
    await installRunnerVoice(page, false, { omitRaster: false })
    await page.goto('/glass-game/?layout=singing-current')
    await page.evaluate(() => window.runnerVoiceFixture.tone(60))
    await page.getByRole('button', { name: 'Start course' }).tap()
    const feedback = page.getByLabel('Your voice and target')
    await expect(feedback).toHaveAttribute('data-pitch-state', 'wrong')
    const notation = await page.getByLabel('Current melody').boundingBox()
    const actions = await page
      .getByRole('button', { name: 'Change note', exact: true })
      .boundingBox()
    expect(notation).not.toBeNull()
    expect(actions).not.toBeNull()
    const separated =
      notation!.y + notation!.height <= actions!.y ||
      notation!.x + notation!.width <= actions!.x
    expect(separated).toBe(true)
    expect(notation!.x).toBeGreaterThanOrEqual(0)
    expect(notation!.x + notation!.width).toBeLessThanOrEqual(viewport.width)
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(viewport.height)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('readiness.png') })
    await page.getByRole('button', { name: 'Change note', exact: true }).tap()
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-phase',
      'paused',
    )
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}
