// Compiled campaign evidence — real host CSS, touch navigation and single-scene ownership.
import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.env.GLASS_INSPECTION_BUILD || '/tmp/glass-twin-ui-build'
const output = fileURLToPath(new URL('./campaign/', import.meta.url))
await mkdir(output, { recursive: true })
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}
const server = createServer(async (request, response) => {
  try {
    let path = resolve(
      root,
      `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`,
    )
    if (!path.startsWith(`${root}/`)) throw new Error('outside build')
    if ((await stat(path)).isDirectory()) path += '/index.html'
    response.setHeader(
      'Content-Type',
      mime[extname(path)] || 'application/octet-stream',
    )
    response.end(await readFile(path))
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 640 },
    hasTouch: true,
  })
  const page = await context.newPage()
  const errors = []
  const records = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    for (const method of [
      'clear',
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
    ])
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: () => undefined,
      })
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    localStorage.setItem(
      'beside-cue:glass-adventure:tutorial:glassworks-twin-galleries/twin-galleries:comfortable-pair:v1',
      'seen',
    )
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext()
      await audio.resume()
      const destination = audio.createMediaStreamDestination()
      const oscillator = audio.createOscillator()
      const silence = audio.createGain()
      silence.gain.value = 0
      oscillator.connect(silence).connect(destination)
      oscillator.start()
      const track = destination.stream.getAudioTracks()[0]
      const stop = track.stop.bind(track)
      track.stop = () => {
        stop()
        oscillator.stop()
        void audio.close()
      }
      return destination.stream
    }
  })
  await page.goto(
    `http://127.0.0.1:${server.address().port}/glass-game/?campaign=1`,
  )
  const lobby = page.getByTestId('glass-campaign')
  await expect(lobby).toBeVisible()
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await lobby
      .locator('img')
      .evaluateAll((elements) =>
        Promise.all(elements.map((element) => element.decode())),
      )
    const appearance = await lobby.evaluate((element) => {
      const card = element.querySelector(
        'button[aria-label="Enter Twin Galleries"]',
      )
      const style = getComputedStyle(card)
      return {
        width: element.clientWidth,
        overflow: element.scrollWidth > element.clientWidth,
        color: style.color,
        background: style.backgroundColor,
        radius: style.borderRadius,
        font: style.fontFamily,
      }
    })
    if (
      appearance.overflow ||
      appearance.color !== 'rgb(36, 73, 67)' ||
      !appearance.font.toLowerCase().includes('gabarito')
    )
      throw new Error(JSON.stringify(appearance))
    const file = `built-${viewport.width}-campaign.png`
    await page.screenshot({ path: `${output}/${file}`, fullPage: true })
    records.push({ viewport, appearance, file })
  }
  await page.setViewportSize({ width: 320, height: 640 })
  await lobby.getByRole('button', { name: 'Enter Twin Galleries' }).tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60000 })
  await page.keyboard.down('KeyW')
  try {
    await expect(
      page.getByRole('button', { name: 'Sing to the glass' }),
    ).toBeVisible({ timeout: 6000 })
  } finally {
    await page.keyboard.up('KeyW')
  }
  await page.getByRole('button', { name: 'Sing to the glass' }).tap()
  const panel = page.getByRole('region', { name: 'Voice challenge' })
  await expect(panel).toHaveAttribute('data-voice-mode', 'finding')
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    const bounds = await panel.boundingBox()
    if (
      !bounds ||
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.x + bounds.width > viewport.width ||
      bounds.y + bounds.height > viewport.height
    )
      throw new Error(`Panel outside viewport: ${JSON.stringify(bounds)}`)
    const file = `built-${viewport.width}-calibration.png`
    await page.screenshot({ path: `${output}/${file}` })
    records.push({ viewport, bounds, file })
  }
  await panel.getByRole('button', { name: 'Cancel', exact: true }).tap()
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(lobby).toBeVisible()
  await expect(game).toHaveCount(0)
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(
    `${output}/manifest.json`,
    `${JSON.stringify({ note: 'Compiled host and UI with scene raster suppressed; geometry has separate proofs. No physical-device/FPS claim.', errors, records }, null, 2)}\n`,
  )
  console.log(JSON.stringify({ records: records.length, errors }))
} finally {
  await browser.close()
  await new Promise((done) => server.close(done))
}
