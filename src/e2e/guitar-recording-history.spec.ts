// Live history checks real canvas ink and first-note placement on desktop and phone.
import { expect, test } from '@playwright/test'
import { installSongAudioProbe } from './helpers/guitar-night-audio-probe'

interface HistoryFrame {
  labels: Array<{ text: string; x: number; y: number }>
  rect: { x: number; y: number; width: number; height: number }
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 850 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`paints a newly heard note near NOW and retains readable history on ${viewport.name} @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    })
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
      const labels: Array<{ text: string; x: number; y: number }> = []
      ;(window as unknown as { historyLabels: typeof labels }).historyLabels =
        labels
      const history = window as unknown as {
        firstHistoryFrame: HistoryFrame | null
      }
      history.firstHistoryFrame = null
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
        const isHighway = this.canvas.hasAttribute('data-tab-presentation')
        if (isHighway) labels.push({ text, x, y })
        const result = fill.call(this, text, x, y, maxWidth)
        // Capture the first actual note draw, not a later automation round trip
        // after that same note has correctly travelled down the history lane.
        if (isHighway && text === '0' && history.firstHistoryFrame === null) {
          const rect = this.canvas.getBoundingClientRect()
          history.firstHistoryFrame = {
            labels: labels.map((label) => ({ ...label })),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          }
        }
        return result
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
    await expect(canvas).toHaveAttribute(
      'aria-label',
      /[1-9]\d* recorded notes/,
    )
    // No image encoding or viewport resize while real audio capture is active.
    // Observe real draw calls now; capture page chrome only after explicit Stop.
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
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        }
      })
    await expect
      .poll(async () => (await read()).labels.map((label) => label.text))
      .toContain('NOW · You played')
    await expect
      .poll(async () => (await read()).labels.map((label) => label.text))
      .toContain('0')
    const first = await page.evaluate(
      () =>
        (window as unknown as { firstHistoryFrame: HistoryFrame })
          .firstHistoryFrame,
    )
    const now = first.labels.find((label) => label.text === 'NOW · You played')!
    const heard = first.labels.find((label) => label.text === '0')!
    expect(heard).toBeDefined()
    expect(now.y / first.rect.height).toBeGreaterThan(0.25)
    expect(now.y / first.rect.height).toBeLessThan(0.75)
    expect(heard.y).toBeGreaterThan(now.y)
    expect(heard.y - now.y).toBeLessThan(first.rect.height * 0.22)
    const strings = first.labels.filter((label) => label.text === 'E')
    expect(strings).toHaveLength(2)
    expect(
      strings.every((label) => label.x > 0 && label.x < first.rect.width),
    ).toBe(true)
    await test.info().attach(`${viewport.name}-first-note-geometry`, {
      body: JSON.stringify(first),
      contentType: 'application/json',
    })
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
      path: test.info().outputPath(`history-review-${viewport.name}.png`),
    })
  })
}
