// Verify the separate review page loads real models and responds to pointer navigation.
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const origin = process.env.STUDY_ORIGIN ?? 'https://localhost:5187'
const base = `${origin}/@fs${here}`
const browser = await chromium.launch({ headless: true })
const results = []
try {
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 960 },
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const asset of ['window', 'screen', 'room']) {
    await page.goto(`${base}viewer.html?asset=${asset}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    const canvas = page.locator('canvas[data-ready="true"]')
    await canvas.waitFor({ state: 'visible', timeout: 90000 })
    const before = await canvas.screenshot()
    const box = await canvas.boundingBox()
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.52, {
      steps: 6,
    })
    await page.mouse.up()
    const orbit = await canvas.screenshot()
    if (before.equals(orbit))
      throw new Error(`${asset}: orbit did not change rendered pixels`)
    await page.keyboard.down('Shift')
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.54, box.y + box.height * 0.53, {
      steps: 4,
    })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    const pan = await canvas.screenshot()
    if (orbit.equals(pan))
      throw new Error(`${asset}: pan did not change rendered pixels`)
    await page.locator('#reset').click()
    if (asset === 'room') {
      await page.locator('#overview').click()
      await page.screenshot({ path: `${here}proofs/browser-overview.png` })
      await page.locator('#interior').click()
      await page.screenshot({ path: `${here}proofs/browser-interior.png` })
    }
    results.push({
      asset,
      loaded: true,
      orbitChangedPixels: true,
      panChangedPixels: true,
      status: await page.locator('#status').innerText(),
    })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(
    `${here}browser-check.json`,
    JSON.stringify({ origin, results, errors }, null, 2) + '\n',
  )
  console.log(JSON.stringify({ results, errors }))
} finally {
  await browser.close()
}
