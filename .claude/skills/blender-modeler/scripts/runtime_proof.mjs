// runtime_proof.mjs — screenshots of a candidate GLB inside the real Glassworks renderer.
//
// node runtime_proof.mjs --config proof.json [--candidate path.glb] [--out dir]
//
// Starts the Beside Cue Vite dev server, opens the game with software WebGL
// (SwiftShader, the same path CI uses), and when --candidate is given answers
// the game's request for `replace` with the candidate's bytes. Nothing in the
// repository changes. The run fails unless the game actually requested the
// replaced URL: a proof that intercepts a file the renderer never loads proves
// nothing (docs/agent/MISTAKES.md records exactly that).
//
// proof.json:
// {
//   "layout": "twin-galleries",
//   "replace": "adventure-v6/opaline-echo-amphora-qa-v2.glb",
//   "progress": { "version": 2, "levelId": "...", "checkpointId": "...", "completedBreakableIds": [] },
//   "viewports": [{ "name": "phone", "width": 390, "height": 844, "scale": 2, "quality": "balanced" },
//                 { "name": "desktop", "width": 1440, "height": 900, "scale": 1, "quality": "high" }],
//   "shots": [{ "name": "entry", "settle": 6000 },
//             { "name": "turn-left", "drag": [-220, 0], "settle": 2500 }]
// }

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { acquirePortLock, cleanUpOnExit, launchSoftwareChromium, startGameServer, } from './game_server.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, []),
)
const config = JSON.parse(readFileSync(args.config, 'utf8'))
const out = resolve(args.out ?? 'runtime-proof')
const candidate = args.candidate ? resolve(args.candidate) : undefined
if (candidate && !existsSync(candidate))
  throw new Error(`no candidate at ${candidate}`)
mkdirSync(out, { recursive: true })
const port = Number(process.env.PROOF_PORT ?? 5391)
const release = await acquirePortLock(port)
const server = startGameServer(port)
const base = server.base
cleanUpOnExit(release, server)

const summary = {
  candidate: candidate ?? null,
  replace: config.replace ?? null,
  viewports: [],
}
let browser
try {
  await server.waitUntilUp('/glass-game/')
  browser = await launchSoftwareChromium()
  for (const viewport of config.viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale ?? 1,
      hasTouch: viewport.width < 800,
    })
    const page = await context.newPage()
    const errors = []
    const served = []
    const pointers = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })
    page.on('response', async (response) => {
      const url = response.url()
      if (!/\.(glb|bin|gltf|ktx2|webp|png|jpg)(\?|$)/.test(url)) return
      try {
        const body = await response.body()
        if (
          body
            .subarray(0, 40)
            .toString('latin1')
            .startsWith('version https://git-lfs')
        )
          pointers.push(url)
      } catch {
        // body unavailable for redirects or aborted requests
      }
    })
    if (candidate && config.replace) {
      const bytes = readFileSync(candidate)
      await page.route(`**/${config.replace}`, async (route) => {
        served.push(route.request().url())
        await route.fulfill({
          status: 200,
          contentType: 'model/gltf-binary',
          body: bytes,
        })
      })
    }
    await page.addInitScript(
      ({ progress, quality }) => {
        const prefix = 'beside-cue:glass-adventure:'
        localStorage.setItem(`${prefix}tutorial`, 'seen')
        localStorage.setItem(`${prefix}comfortable-note`, '60')
        localStorage.setItem(`${prefix}camera-mode:v1`, 'third-person')
        localStorage.setItem(
          `${prefix}museum-audio:v1`,
          JSON.stringify({ muted: true }),
        )
        localStorage.setItem(`${prefix}automatic-singing`, 'off')
        if (quality) localStorage.setItem(`${prefix}render-quality:v1`, quality)
        if (progress)
          localStorage.setItem(
            `${prefix}progress:${progress.levelId}`,
            JSON.stringify(progress),
          )
        // Every gallery's tutorial key carries its level and lesson revision; report them all seen.
        const getItem = Storage.prototype.getItem
        Storage.prototype.getItem = function (key) {
          if (typeof key === 'string' && key.startsWith(`${prefix}tutorial:`))
            return 'seen'
          return getItem.call(this, key)
        }
      },
      { progress: config.progress, quality: viewport.quality ?? null },
    )
    await page.goto(`${base}/glass-game/?layout=${config.layout}`)
    const game = page.getByTestId('glass-adventure')
    await game.waitFor({ state: 'attached', timeout: 90_000 })
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="glass-adventure"]')
            ?.getAttribute('data-ready') === 'true',
        undefined,
        { timeout: 120_000 },
      )
    } catch (error) {
      await page.screenshot({
        path: join(out, `${viewport.name}-not-ready.png`),
        timeout: 180_000,
      })
      summary.viewports.push({
        name: viewport.name,
        served: served.length,
        errors,
        pointers,
        shots: [],
      })
      writeFileSync(
        join(out, 'runtime-proof.json'),
        JSON.stringify(summary, null, 2),
      )
      throw new Error(
        `game never became ready; LFS pointers served: ${pointers.length} (run \`git lfs pull --include="apps/beside-cue/public/games/**"\`); errors: ${errors.slice(0, 5).join(' | ')}`,
      )
    }
    for (const name of config.dismiss ?? []) {
      const button = page.getByRole('button', { name, exact: true })
      try {
        await button.first().click({ timeout: 8000 })
      } catch {
        // not shown this run
      }
    }
    const shots = []
    for (const shot of config.shots) {
      if (shot.drag) {
        const box = await page.locator('canvas').first().boundingBox()
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + shot.drag[0], y + shot.drag[1], { steps: 12 })
        await page.mouse.up()
      }
      for (const key of shot.keys ?? []) {
        await page.keyboard.down(key.key)
        await sleep(key.ms)
        await page.keyboard.up(key.key)
      }
      await sleep(shot.settle ?? 2000)
      // Software WebGL can take many seconds per frame; wait for two real frames first.
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      )
      const file = join(out, `${viewport.name}-${shot.name}.png`)
      await page.screenshot({ path: file, timeout: 180_000 })
      shots.push(file)
    }
    summary.viewports.push({
      name: viewport.name,
      served: served.length,
      errors,
      pointers,
      shots,
    })
    await context.close()
  }
} finally {
  if (browser) await browser.close()
  server.stop()
}
writeFileSync(join(out, 'runtime-proof.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (candidate && summary.viewports.some((v) => v.served === 0)) {
  console.error(
    'FAIL: the game never requested the replaced asset; these screenshots do not show the candidate',
  )
  process.exit(1)
}
if (summary.viewports.some((v) => v.errors.length)) process.exit(1)
