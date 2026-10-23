// bench_capture.mjs — shots of the glass look bench (apps/beside-cue/glass-bench.html), on the
// game's renderer settings, into a folder with a shots.json for bench_sheet.py.
//
// node bench_capture.mjs --config bench.json [--out dir]
//
// bench.json:
// {
//   "heroes": {
//     "urn-shipped": "/games/adventure-v6/amber-cadence-urn-qa-v2.glb",
//     "urn-rebuild": "/abs/path/amber-cadence-urn.glb"
//   },
//   "masks": true,
//   "shots": [
//     { "name": "urn-rebuild-kit-studio", "hero": "urn-rebuild", "environment": "kit",
//       "look": "studio-amber", "toneMapping": "neutral" }
//   ]
// }
//
// A hero given as a file path is served from disk at /__bench/<name>.glb; a URL
// path is served by the dev server. Shot fields are BenchShot's
// (packages/glass-game/src/bench/glass-bench.ts). With "masks", every shot also
// gets <name>.mask.png: the hero alone, white on black.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { acquirePortLock, cleanUpOnExit, launchSoftwareChromium, startGameServer, } from './game_server.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, []),
)
const config = JSON.parse(readFileSync(args.config, 'utf8'))
const out = resolve(args.out ?? 'bench-capture')
mkdirSync(out, { recursive: true })
const port = Number(process.env.PROOF_PORT ?? 5391)

const heroes = Object.fromEntries(
  Object.entries(config.heroes ?? {}).map(([name, source]) => {
    const onDisk = existsSync(source)
    return [
      name,
      { source, url: onDisk ? `/__bench/${name}.glb` : source, onDisk },
    ]
  }),
)

const release = await acquirePortLock(port)
const server = startGameServer(port)
cleanUpOnExit(release, server)
await server.waitUntilUp('/glass-bench.html')

const browser = await launchSoftwareChromium()
const errors = []
const results = []
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1100 },
    deviceScaleFactor: 1,
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  for (const [name, hero] of Object.entries(heroes))
    if (hero.onDisk)
      await page.route(`**/__bench/${name}.glb`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'model/gltf-binary',
          body: readFileSync(hero.source),
        }),
      )
  const first = config.shots[0]
  const firstHero = heroes[first?.hero]?.url
  // A cold Vite cache transforms three and the game's modules on first load.
  await page.goto(
    `${server.base}/glass-bench.html?scale=${config.scale ?? 2}${firstHero ? `&hero=${encodeURIComponent(firstHero)}` : ''}`,
    { waitUntil: 'domcontentloaded', timeout: 300_000 },
  )
  await page.waitForFunction(
    () => document.body.dataset.ready !== undefined,
    undefined,
    { timeout: 600_000 },
  )
  if ((await page.evaluate(() => document.body.dataset.ready)) !== 'true')
    throw new Error(
      `the bench did not start: ${await page.locator('#hud').textContent()} ${errors.join(' | ')}`,
    )
  const canvas = page.locator('canvas')
  for (const shot of config.shots) {
    const { name, hero, ...fields } = shot
    const params = {
      ...fields,
      ...(hero ? { hero: heroes[hero]?.url ?? hero } : {}),
      mask: false,
    }
    const applied = await page.evaluate((p) => window.glassBench.set(p), params)
    const file = join(out, `${name}.png`)
    await canvas.screenshot({ path: file, timeout: 600_000 })
    const result = { name, hero: hero ?? null, shot: applied, file }
    if (config.masks) {
      await page.evaluate(
        (p) => window.glassBench.set({ ...p, mask: true }),
        params,
      )
      result.mask = join(out, `${name}.mask.png`)
      await canvas.screenshot({ path: result.mask, timeout: 600_000 })
    }
    results.push(result)
    console.log(`shot ${name}`)
  }
} finally {
  await browser.close()
  server.stop()
}
writeFileSync(
  join(out, 'shots.json'),
  JSON.stringify({ shots: results, errors }, null, 2),
)
console.log(`${results.length} shots in ${out}; ${errors.length} errors`)
if (errors.length) console.error(errors.slice(0, 8).join('\n'))
process.exit(errors.length ? 1 : 0)
