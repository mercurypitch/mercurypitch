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
  await expect(runner).toHaveAttribute('data-movement-mode', 'continuous')
  await page.keyboard.down('KeyD')
  await expect
    .poll(async () => Number(await runner.getAttribute('data-lateral-x')))
    .toBeGreaterThan(1.2)
  await page.keyboard.up('KeyD')
  await expect
    .poll(async () =>
      Number(await runner.getAttribute('data-lateral-velocity')),
    )
    .toBe(0)
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

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 844, height: 310 },
  { width: 1440, height: 900 },
]) {
  test(`starting note and actions share the central focus at ${viewport.width} by ${viewport.height} @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await useRunnerControlsRenderer(page)
    await installRunnerVoice(page, false, { omitRaster: false })
    await page.goto('/glass-game/?layout=singing-current')
    await page.getByRole('slider', { name: 'Comfortable note' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.evaluate(() => window.runnerVoiceFixture.silent())
    await page.getByRole('button', { name: 'Start course' }).tap()
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-phase',
      'readiness',
    )
    const notation = page.getByLabel('Current melody')
    const noteBox = (await notation.boundingBox())!
    const actionBox = (await page
      .getByRole('button', { name: 'Change note', exact: true })
      .boundingBox())!
    await testInfo.attach('readiness-focus-layout', {
      body: JSON.stringify({ viewport, noteBox, actionBox }),
      contentType: 'application/json',
    })
    await page.screenshot({ path: testInfo.outputPath('readiness-focus.png') })
    expect((noteBox.y + noteBox.height / 2) / viewport.height).toBeGreaterThan(
      0.3,
    )
    expect((noteBox.y + noteBox.height / 2) / viewport.height).toBeLessThan(
      0.65,
    )
    expect((actionBox.y + actionBox.height / 2) / viewport.height).toBeLessThan(
      0.75,
    )
    await expect(notation).toContainText('Sing to start')
    await expect(
      notation.getByLabel('Notes and holds').locator('strong').first(),
    ).toHaveText('A#3')
    await expect(
      page.getByRole('progressbar', { name: 'Ready note' }),
    ).toHaveCount(1)
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })

  test(`starting hold progress matches the medallion fill at ${viewport.width} by ${viewport.height} @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await useRunnerControlsRenderer(page)
    await installRunnerVoice(page, false, { omitRaster: false })
    await page.goto('/glass-game/?layout=singing-current')
    await page.evaluate(() => window.runnerVoiceFixture.silent())
    await page.getByRole('button', { name: 'Start course' }).tap()
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-phase',
      'readiness',
    )
    const samples = await page.evaluate(
      () =>
        new Promise<{ value: number; displayed: number; visible: number }[]>(
          (resolve, reject) => {
            const recorded: {
              value: number
              displayed: number
              visible: number
            }[] = []
            const deadline = setTimeout(
              () => reject(new Error('Starting note did not finish its hold.')),
              5_000,
            )
            const sample = () => {
              if (
                document
                  .querySelector('[data-testid="song-runner"]')!
                  .getAttribute('data-phase') !== 'readiness'
              ) {
                clearTimeout(deadline)
                resolve(recorded)
                return
              }
              const meter = document.querySelector<HTMLElement>(
                '[aria-label="Current melody"] [role="progressbar"]',
              )!
              const fill = meter.querySelector<HTMLElement>('[data-note-fill]')!
              const value = Number(meter.getAttribute('aria-valuenow'))
              if (value > 0)
                recorded.push({
                  value,
                  displayed: Number.parseFloat(fill.style.height),
                  visible:
                    (fill.getBoundingClientRect().height / meter.clientHeight) *
                    100,
                })
              requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
            window.runnerVoiceFixture.tone(57)
          },
        ),
    )
    await testInfo.attach('readiness-meter-samples', {
      body: JSON.stringify(samples),
      contentType: 'application/json',
    })
    expect(samples.length).toBeGreaterThanOrEqual(8)
    expect(Math.max(...samples.map((sample) => sample.value))).toBeGreaterThan(
      90,
    )
    for (const sample of samples) {
      expect(sample.displayed).toBe(sample.value)
      expect(Math.abs(sample.visible - sample.value)).toBeLessThan(0.51)
    }
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test.describe(`stable pitch rail ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 1200 })

    test('note names and coaching text do not move the pitch rail @smoke', async ({
      page,
    }, testInfo) => {
      await useRunnerControlsRenderer(page)
      await installRunnerVoice(page, false, { omitRaster: false })
      await page.goto('/glass-game/?layout=singing-current')
      await page.evaluate(() => window.runnerVoiceFixture.tone(60))
      await page.getByRole('button', { name: 'Start course' }).click()
      const readout = page.getByLabel('Your voice and target')
      const rail = page
        .getByLabel('Notes and holds')
        .locator('[data-voice-track]')
      try {
        await expect(readout.locator('[data-pitch-observed]')).toHaveText('C4')
        const initial = await rail.boundingBox()
        expect(initial).not.toBeNull()
        for (const [midi, label] of [
          [61, 'C#4'],
          [54, 'F#3'],
          [null, null],
        ] as const) {
          await page.evaluate((value) => {
            if (value === null) window.runnerVoiceFixture.silent()
            else window.runnerVoiceFixture.tone(value)
          }, midi)
          if (label === null)
            await expect(readout.locator('[data-pitch-observed]')).toHaveCount(
              0,
            )
          else
            await expect(readout.locator('[data-pitch-observed]')).toHaveText(
              label,
            )
          const current = await rail.boundingBox()
          expect(current).not.toBeNull()
          expect(Math.abs(current!.x - initial!.x)).toBeLessThan(0.5)
          expect(Math.abs(current!.width - initial!.width)).toBeLessThan(0.5)
          expect(Math.abs(current!.y - initial!.y)).toBeLessThan(0.5)
          expect(
            await readout.evaluate(
              (element) => element.scrollWidth <= element.clientWidth,
            ),
          ).toBe(true)
        }
        await page.screenshot({
          path: testInfo.outputPath('stable-pitch-rail.png'),
        })
      } finally {
        await page.evaluate(() => window.runnerVoiceFixture.dispose())
      }
    })
  })
}
