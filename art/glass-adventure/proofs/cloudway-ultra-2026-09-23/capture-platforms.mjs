// Compare actual Cloudway platform art using loaded model bytes and repeatable mouse camera inputs.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const label = process.argv[2] ?? 'baseline-desktop'
assert.match(label, /^[a-z0-9-]+$/u)
const output = resolve(here, label)
const tablet = process.env.CLOUDWAY_VIEWPORT === 'tablet'
const viewport = tablet
  ? { width: 1024, height: 768 }
  : { width: 1440, height: 900 }
const url = new URL(
  '/glass-game/?layout=cloudway',
  process.env.CLOUDWAY_QA_URL ?? 'http://127.0.0.1:5341',
)
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
const candidate = process.env.CLOUDWAY_CANDIDATE_FILE
  ? resolve(repo, process.env.CLOUDWAY_CANDIDATE_FILE)
  : undefined
if (candidate) {
  assert.ok(candidate.startsWith(`${repo}${sep}`) && candidate.endsWith('.glb'))
}
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
})
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const errors = []
const assetWork = []
const screenshots = []
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  if (candidate) {
    await page.route(
      '**/games/cloudway-v*/cloudway-platform-kit-v*.glb',
      (route) =>
        route.fulfill({ path: candidate, contentType: 'model/gltf-binary' }),
    )
  }
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text())
  })
  const network = await page.context().newCDPSession(page)
  await network.send('Network.enable', {
    maxTotalBufferSize: 256 * 1024 * 1024,
    maxResourceBufferSize: 128 * 1024 * 1024,
  })
  const pending = new Map()
  network.on('Network.responseReceived', ({ requestId, response }) => {
    const path = new URL(response.url).pathname
    if (path.startsWith('/games/') && path.endsWith('.glb'))
      pending.set(requestId, { path, response })
  })
  network.on('Network.loadingFinished', ({ requestId }) => {
    const asset = pending.get(requestId)
    if (!asset) return
    pending.delete(requestId)
    assetWork.push(
      (async () => {
        const result = await network.send('Network.getResponseBody', {
          requestId,
        })
        const body = Buffer.from(
          result.body,
          result.base64Encoded ? 'base64' : 'utf8',
        )
        const file =
          candidate &&
          /\/cloudway-v\d+\/cloudway-platform-kit-v\d+\.glb$/u.test(asset.path)
            ? relative(repo, candidate)
            : `apps/beside-cue/public${asset.path}`
        assert.equal(asset.response.status, 200)
        assert.ok(body.equals(await readFile(resolve(repo, file))), file)
        return {
          file,
          bytes: body.length,
          sha256: hash(body),
          status: asset.response.status,
        }
      })().catch((error) => {
        errors.push(error.message)
        return { error: error.message }
      }),
    )
  })
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}tutorial:cloudway-glass-ribbon:cloudway-first-crossing:v1`,
      'seen',
    )
  })
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 90_000 })
  assert.equal(
    await game.getAttribute('data-checkpoint'),
    'cloudway-checkpoint-arrival',
  )
  const canvas = page.locator('canvas[aria-label="Floating glass museum"]')
  const area = page.getByLabel('Glass museum; drag to look around')
  const waitFrames = (count) =>
    page.evaluate(
      (remaining) =>
        new Promise((resolve) => {
          const step = () => {
            if (--remaining <= 0) resolve()
            else requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }),
      count,
    )
  const capture = async (id, action) => {
    await waitFrames(45)
    const file = `${id}.png`
    await page.screenshot({ path: resolve(output, file) })
    screenshots.push({
      file,
      sha256: hash(await readFile(resolve(output, file))),
      action,
      cameraYaw: await game.getAttribute('data-camera-yaw'),
    })
  }
  await capture(
    'arrival',
    'Unmodified arrival camera; no movement or seeded progress.',
  )
  const box = await area.boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4)
  await page.mouse.wheel(0, -2000)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width * 0.5 + 145,
    box.y + box.height * 0.4 + 34,
    { steps: 12 },
  )
  await page.mouse.up()
  await capture(
    'marble-close',
    'Real wheel zoom and mouse orbit; same inputs on each candidate.',
  )
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width * 0.5,
    box.y + box.height * 0.5 - 140,
    { steps: 12 },
  )
  await page.mouse.up()
  await capture(
    'marble-side',
    'Real upward mouse drag lowers the camera to inspect grazing top and edge shading.',
  )
  const cadence = await page.evaluate(async () => {
    const intervals = []
    let previous = await new Promise(requestAnimationFrame)
    for (let i = 0; i < 120; i++) {
      const next = await new Promise(requestAnimationFrame)
      intervals.push(next - previous)
      previous = next
    }
    intervals.sort((a, b) => a - b)
    return {
      medianMs: intervals[60],
      p95Ms: intervals[114],
      maximumMs: intervals[119],
    }
  })
  const renderer = await canvas.evaluate((element) => {
    const gl = element.getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : 'unavailable'
  })
  const assets = await Promise.all(assetWork)
  const report = {
    url: url.href,
    viewport,
    deviceScope: tablet
      ? 'Tablet-sized desktop; not physical tablet'
      : 'Local desktop hardware',
    renderer,
    rasterization: 'Actual WebGL, no suppressed draws',
    candidateOverride: candidate ? relative(repo, candidate) : null,
    screenshots,
    assets,
    cadence,
    cadenceMethod:
      '120 browser animation-frame intervals, not GPU time or physical-tablet performance',
    errors,
  }
  await writeFile(
    resolve(output, 'manifest.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(
    JSON.stringify({
      output,
      renderer,
      assets: assets.length,
      cadence,
      errors,
    }),
  )
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
