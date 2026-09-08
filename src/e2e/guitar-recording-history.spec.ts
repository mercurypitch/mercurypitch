// Live history checks real canvas ink and first-note placement on desktop and phone.
import { expect, test } from '@playwright/test'
import { installSongAudioProbe } from './helpers/guitar-night-audio-probe'

test('paints a newly heard note near NOW and retains readable history @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 850 })
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    const labels: Array<{ text: string; x: number; y: number }> = []
    ;(window as unknown as { historyLabels: typeof labels }).historyLabels =
      labels
    const clear = CanvasRenderingContext2D.prototype.clearRect
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.hasAttribute('data-tab-presentation')) labels.length = 0
      return clear.apply(this, args)
    }
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      if (this.canvas.hasAttribute('data-tab-presentation'))
        labels.push({ text, x, y })
      return fill.call(this, text, x, y, maxWidth)
    }
  })
  await installSongAudioProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Play free form', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Record a melody', exact: true })
    .click()
  const canvas = page.locator('canvas[data-tab-presentation]')
  await expect(canvas).toHaveAttribute('aria-label', /[1-9]\d* recorded notes/)
  // Read the already-painted bitmap without a full-page compositor capture.
  // CI screenshots stalled long enough to exhaust the real recorder's bounded
  // PCM pool. Keep the audio guard intact; inspect page chrome after capture.
  const attachCanvas = async (name: string) => {
    const png = await canvas.evaluate((element: HTMLCanvasElement) =>
      element.toDataURL('image/png'),
    )
    await test.info().attach(name, {
      body: Buffer.from(png.split(',')[1], 'base64'),
      contentType: 'image/png',
    })
  }
  const read = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        'canvas[data-tab-presentation]',
      )!
      const rect = canvas.getBoundingClientRect()
      return {
        labels: (
          window as unknown as {
            historyLabels: Array<{ text: string; x: number; y: number }>
          }
        ).historyLabels,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      }
    })
  await expect
    .poll(async () => (await read()).labels.map((label) => label.text))
    .toContain('NOW · You played')
  await expect
    .poll(async () => (await read()).labels.map((label) => label.text))
    .toContain('0')
  const first = await read()
  const now = first.labels.find((label) => label.text === 'NOW · You played')!
  const heard = first.labels.find((label) => label.text === '0')!
  expect(heard).toBeDefined()
  expect(now.y / first.rect.height).toBeGreaterThan(0.25)
  expect(now.y / first.rect.height).toBeLessThan(0.75)
  expect(heard.y).toBeGreaterThan(now.y)
  expect(heard.y - now.y).toBeLessThan(first.rect.height * 0.22)
  await test.info().attach('desktop-geometry', {
    body: JSON.stringify(await read()),
    contentType: 'application/json',
  })
  await attachCanvas('history-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  // Wait for the existing responsive camera tween, not just resized DOM bounds.
  await expect
    .poll(async () => {
      const frame = await read()
      const strings = frame.labels.filter((label) => label.text === 'E')
      return (
        strings.length === 2 &&
        strings.every((label) => label.x > 0 && label.x < frame.rect.width)
      )
    })
    .toBe(true)
  await test.info().attach('phone-geometry', {
    body: JSON.stringify(await read()),
    contentType: 'application/json',
  })
  await attachCanvas('history-phone')
  await expect
    .poll(
      async () => {
        const duration = await page
          .getByRole('status', { name: 'Recording duration', exact: true })
          .innerText()
        return duration
          .split(':')
          .reduce((total, value) => total * 60 + Number(value), 0)
      },
      { timeout: 12000 },
    )
    .toBeGreaterThanOrEqual(6)
  await expect(
    page.getByRole('button', { name: 'Stop recording', exact: true }),
  ).toBeEnabled()
  const sustained = await read()
  expect(sustained.labels.map((label) => label.text)).toContain('0')
  await test.info().attach('sustain-geometry', {
    body: JSON.stringify(await read()),
    contentType: 'application/json',
  })
  await attachCanvas('history-sustain')
  await page.getByRole('button', { name: 'Tab', exact: true }).click()
  await expect(page.getByTestId('guitar-night-moving-tab')).toHaveAttribute(
    'data-tab-timeline',
    'recording-history',
  )
  await expect(page.getByTestId('guitar-night-tab-now')).toHaveText('NOW')
  await page
    .getByRole('button', { name: 'Stop recording', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').filter({ hasText: 'Recorded melody' }),
  ).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('history-review-phone.png'),
  })
})
