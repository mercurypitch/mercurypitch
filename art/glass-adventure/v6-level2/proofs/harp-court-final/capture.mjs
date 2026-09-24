// Twin-Tone harp scene proof — actual museum renderer at the authored court placement.
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = fileURLToPath(new URL('../../../../../', import.meta.url)).replace(
  /\/$/,
  '',
)
const base = process.env.GLASS_PROOF_BASE || 'https://localhost:5193'
const output = fileURLToPath(new URL('.', import.meta.url))
await mkdir(output, { recursive: true })

const mapping = Object.fromEntries(
  [
    ...(
      await readFile(
        `${root}/apps/beside-cue/src/games/adventure/AdventureScreen.tsx`,
        'utf8',
      )
    ).matchAll(/^\s*(?:'([^']+)'|([\w-]+)):\s*'([^']+)',/gm),
  ].map((match) => [match[1] || match[2], match[3]]),
)
for (const material of [
  'warm-carrara',
  'verde-marble',
  'cream-limestone',
  'brushed-brass',
])
  for (const channel of ['basecolor', 'normal', 'roughness'])
    mapping[`${material}-${channel}`] =
      `adventure-v2/textures/${material}-${channel}.png`

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const viewport = { width: 800, height: 600 }
const errors = []
let record
try {
  const context = await browser.newContext({
    viewport,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/__glass-harp-inspection', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden;background:#071018}</style><div id="scene"></div>',
    }),
  )
  await page.goto(`${base}/__glass-harp-inspection`)
  const setup = await page.evaluate(
    async ({ root, mapping }) => {
      const prefix = `/@fs${root}/packages/glass-game/src/`
      const { createGlassRenderer } = await import(
        prefix + 'render/glass-renderer.ts'
      )
      const { createGlassGame } = await import(prefix + 'core/game.ts')
      const { TWIN_GALLERIES: level } = await import(
        prefix + 'content/twin-galleries.ts'
      )
      const problems = []
      const renderer = createGlassRenderer(
        document.querySelector('#scene'),
        level,
        (id) => '/games/' + (mapping[id] || 'adventure/' + id),
        {
          onAssetError: (id, error) => problems.push(`${id}:${String(error)}`),
        },
      )
      await renderer.ready
      const harp = level.presentation.decorations?.find(
        (decoration) => decoration.recipeId === 'twin-tone-harp-v6',
      )
      if (!harp) throw new Error('Missing authored Twin-Tone harp decoration')
      const game = createGlassGame(level, {
        version: 1,
        levelId: level.id,
        checkpointId:
          'glassworks-twin-galleries/twin-galleries/court/checkpoint/entry',
        completedBreakableIds: [
          'glassworks-twin-galleries/twin-galleries/warm/encounter/lower-urn',
          'glassworks-twin-galleries/twin-galleries/cool/encounter/upper-decanter',
        ],
        finished: false,
      })
      const snapshot = game.snapshot()
      snapshot.player.position = {
        x: harp.position.x - 2.45,
        y: 0,
        z: harp.position.z,
      }
      snapshot.player.facingYaw = -Math.PI / 2
      renderer.setMovementActive(false)
      renderer.cancelHeadingFollow()
      renderer.setOrbitActive(true)
      renderer.orbit(-Math.PI / 2 - renderer.getCameraYaw(), 0)
      renderer.zoom(-100)
      renderer.zoom(1.4)

      const canvas = document.querySelector('canvas')
      const gl = canvas.getContext('webgl2')
      const methods = [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ]
      const originals = Object.fromEntries(
        methods.map((method) => [method, gl[method].bind(gl)]),
      )
      for (const method of methods) gl[method] = () => {}
      for (let frame = 0; frame < 120; frame++)
        renderer.render(snapshot, 1 / 60)
      for (const method of methods) gl[method] = originals[method]
      renderer.render(snapshot, 1 / 60)
      gl.finish()
      window.harpProof = { renderer, problems }
      return {
        levelId: level.id,
        harp,
        player: snapshot.player,
        activeSolid: snapshot.activeSolidIds.find((id) =>
          id.endsWith('/solid/resonance-harp-base'),
        ),
        metrics: renderer.getMetrics(),
        errors: problems,
      }
    },
    { root, mapping },
  )
  if (setup.errors.length > 0) throw new Error(setup.errors.join('\n'))
  const file = '800-court-harp.png'
  await page.screenshot({ path: `${output}/${file}`, timeout: 45_000 })
  record = {
    scope:
      'Actual renderer scene proof at the authored court placement; not a gameplay or FPS acceptance result.',
    viewport,
    file,
    ...setup,
    pageErrors: errors,
  }
  await page.evaluate(() => window.harpProof.renderer.dispose())
  await context.close()
} finally {
  await browser.close()
}

await writeFile(
  `${output}/manifest.json`,
  `${JSON.stringify(record, null, 2)}\n`,
)
console.log(JSON.stringify(record))
