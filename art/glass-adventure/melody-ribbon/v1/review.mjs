// Exercise the reference audition with real mouse, keyboard and touch controls at three viewport sizes.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(here, 'proofs')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const reports = []
try {
  for (const [name, viewport, touch] of [
    ['desktop', { width: 1440, height: 1000 }, false],
    ['tablet', { width: 820, height: 1180 }, true],
    ['phone', { width: 320, height: 780 }, true],
  ]) {
    const page = await browser.newPage({
      viewport,
      hasTouch: touch,
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:5341/@fs${here}/index.html`)
    await expect(
      page.getByRole('heading', { name: 'First arc', exact: true }),
    ).toBeVisible()
    const activate = (locator) => (touch ? locator.tap() : locator.click())
    await activate(
      page.getByRole('button', { name: 'Hear melody', exact: true }),
    )
    await expect(
      page.getByRole('button', { name: 'Stop', exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => page.locator('#fills path').first().getAttribute('d'))
      .not.toBe('')
    await page.screenshot({
      path: resolve(output, `${name}-playing.png`),
      fullPage: true,
    })
    await activate(
      page.getByRole('radio', { name: 'Two windows 10 notes', exact: true }),
    )
    await expect(
      page.getByRole('button', { name: 'Hear melody', exact: true }),
    ).toBeVisible()
    await expect(page.locator('#fills path').first()).toHaveAttribute('d', '')
    await expect(page.locator('.breath')).toHaveText('Breathe')
    await page.locator('#root').selectOption('60')
    await page.locator('#pace').selectOption('0.82')
    await activate(
      page.getByRole('button', { name: 'Hear melody', exact: true }),
    )
    await expect(page.getByRole('status')).toHaveText(
      'Your turn to imagine it',
      { timeout: 15_000 },
    )
    await expect(
      page.getByRole('button', { name: 'Hear melody', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: resolve(output, `${name}-complete.png`),
      fullPage: true,
    })
    await page.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('details')).toHaveAttribute('open', '')
    const measurements = await page.evaluate(() => ({
      viewport: innerWidth,
      contentWidth: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll('button, select')].map(
        (element) => ({
          label: element.textContent.trim(),
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }),
      ),
    }))
    assert.ok(measurements.contentWidth <= measurements.viewport)
    assert.ok(
      measurements.controls.every(
        (control) => control.height >= 44 && control.width >= 44,
      ),
    )
    assert.deepEqual(errors, [])
    reports.push({
      name,
      viewport,
      input: touch
        ? 'Chromium emulated touch and keyboard'
        : 'Real mouse and keyboard',
      measurements,
      errors,
    })
    await page.close()
  }
} finally {
  await browser.close()
}
await writeFile(
  resolve(output, 'review.json'),
  `${JSON.stringify({ scope: 'Local reference audition, not live microphone judging or physical-device validation', reports }, null, 2)}\n`,
)
console.log(JSON.stringify({ passed: reports.length, output }))
