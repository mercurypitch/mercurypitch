// Verify emitted artwork UI styles in the real host; scene raster proofs are separate.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root =
  process.env.GLASS_INSPECTION_BUILD || '/tmp/glass-gallery-inspection-build'
const output = fileURLToPath(new URL('./polish-sept20/', import.meta.url))
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
const records = []
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 640 },
    hasTouch: true,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    for (const name of [
      'clear',
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
    ])
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        configurable: true,
        value: () => undefined,
      })
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}progress:glassworks-journey/journey`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/garden/checkpoint/entry',
        completedBreakableIds: [
          'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
        ],
      }),
    )
  })
  await page.goto(
    `http://127.0.0.1:${server.address().port}/glass-game/?layout=journey`,
  )
  await page
    .getByRole('button', { name: 'View nearby artwork' })
    .waitFor({ timeout: 60_000 })
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'View nearby artwork' }).tap()
    const dialog = page.getByRole('dialog', {
      name: 'The garden between notes',
    })
    await dialog.getByRole('img').evaluate((element) => element.decode())
    const appearance = await dialog.evaluate((element) => {
      const button = element.querySelector('button')
      const style = getComputedStyle(button)
      return {
        color: style.color,
        background: style.backgroundColor,
        radius: style.borderRadius,
        font: style.fontFamily,
        buttonHeight: button.getBoundingClientRect().height,
        overflow: element.scrollWidth > element.clientWidth,
      }
    })
    if (
      appearance.color !== 'rgb(255, 249, 232)' ||
      appearance.background !== 'rgb(37, 78, 71)' ||
      appearance.buttonHeight < 44 ||
      appearance.overflow ||
      !appearance.font.toLowerCase().includes('gabarito')
    )
      throw new Error(
        `Built artwork styles failed: ${JSON.stringify(appearance)}`,
      )
    const file = `built-${viewport.width}-artwork.png`
    await page.screenshot({ path: `${output}/${file}` })
    records.push({ viewport, appearance, file })
    await dialog.getByRole('button', { name: 'Back to the gallery' }).tap()
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(
    `${output}/built-ui.json`,
    `${JSON.stringify({ note: 'Production pipeline, test-only journey selection; no scene raster/FPS claim.', errors, records }, null, 2)}\n`,
  )
  console.log(JSON.stringify(records))
} finally {
  await browser.close()
  await new Promise((done) => server.close(done))
}
