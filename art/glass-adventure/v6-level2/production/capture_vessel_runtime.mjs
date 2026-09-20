// Vessel runtime proof — actual Twin Galleries renderer, material loading and authored fracture cost.
import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = fileURLToPath(new URL('../../../../', import.meta.url)).replace(
  /\/$/,
  '',
)
const base = process.env.GLASS_PROOF_BASE || 'https://localhost:5224'
const assetBase = process.env.GLASS_PROOF_ASSET_BASE || '/glass-game-assets/'
const assetId = process.env.GLASS_PROOF_ASSET || 'amber-v6'
const encounter = process.env.GLASS_PROOF_ENCOUNTER || '/warm/encounter/lower-urn'
const output = fileURLToPath(new URL(`../proofs/runtime-${assetId}/`, import.meta.url))
await mkdir(output, { recursive: true })

const publicManifest = JSON.parse(
  await readFile(
    `${root}/apps/beside-cue/public/games/adventure-v6/manifest.json`,
    'utf8',
  ),
)
const asset = publicManifest.models.find((model) => model.id === assetId)
if (!asset) throw new Error('Missing public Vessel V6 manifest entry')
const publicBytes = await readFile(
  `${root}/apps/beside-cue/public/games/adventure-v6/${asset.file}`,
)
const publicSha256 = createHash('sha256').update(publicBytes).digest('hex')
if (publicSha256 !== asset.sha256)
  throw new Error(`Vessel public hash mismatch: ${publicSha256}`)

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const viewport = { width: 1024, height: 768 }
const pageErrors = []
const files = {
  intact: `1024-${assetId}-intact.png`,
  shattering: `1024-${assetId}-shattering.png`,
}
let setup
let shattering
try {
  const context = await browser.newContext({
    viewport,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/__glass-vessel-inspection', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden;background:#071018}</style><div id="scene"></div>',
    }),
  )
  await page.goto(`${base}/__glass-vessel-inspection`)
  setup = await page.evaluate(
    async ({ root, assetId, encounter, assetBase }) => {
      const prefix = `/@fs${root}/packages/glass-game/src/`
      const { createGlassRenderer } = await import(
        prefix + 'render/glass-renderer.ts'
      )
      const { createGlassGame } = await import(prefix + 'core/game.ts')
      const { TWIN_GALLERIES: level } = await import(
        prefix + 'content/twin-galleries.ts'
      )
      const { glassGameAssetPath } = await import(prefix + 'browser/assets.ts')
      const problems = []
      const renderer = createGlassRenderer(
        document.querySelector('#scene'),
        level,
        (id) => assetBase + glassGameAssetPath(id),
        {
          onAssetError: (id, error) => problems.push(`${id}:${String(error)}`),
        },
      )
      await renderer.ready
      const target = level.breakables.find((item) =>
        item.id.endsWith(encounter),
      )
      if (!target || target.variant !== assetId)
        throw new Error('Missing authored Vessel court exhibit')
      const required = new Set()
      function includeRequirements(item) {
        for (const id of item.requiresCompleted || []) {
          if (required.has(id)) continue
          required.add(id)
          includeRequirements(level.breakables.find((candidate) => candidate.id === id))
        }
      }
      includeRequirements(target)
      const game = createGlassGame(level, {
        version: 1, levelId: level.id,
        checkpointId: level.checkpoints[0].id,
        completedBreakableIds: [...required], finished: false,
      })
      const snapshot = game.snapshot()
      snapshot.player.position = { ...target.anchor }
      snapshot.player.facingYaw = Math.atan2(
        -(target.position.x - target.anchor.x),
        -(target.position.z - target.anchor.z),
      )
      renderer.setMovementActive(false)
      renderer.cancelHeadingFollow()
      renderer.setOrbitActive(true)
      renderer.orbit(snapshot.player.facingYaw - renderer.getCameraYaw(), 0)
      renderer.orbit(0, -100)
      renderer.orbit(0, 0.14)
      renderer.zoom(-100)
      renderer.zoom(1.3)

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
      for (let frame = 0; frame < 4; frame++) renderer.render(snapshot, 1 / 60)
      gl.finish()
      window.vesselProof = { renderer, snapshot, target, gl, problems }
      return {
        levelId: level.id,
        target: {
          id: target.id,
          variant: target.variant,
          position: target.position,
          anchor: target.anchor,
        },
        player: snapshot.player,
        metrics: renderer.getMetrics(),
        errors: problems,
      }
    },
    { root, assetId, encounter, assetBase },
  )
  if (setup.errors.length > 0) throw new Error(setup.errors.join('\n'))
  await page.screenshot({ path: `${output}/${files.intact}`, timeout: 45_000 })

  shattering = await page.evaluate(() => {
    const { renderer, snapshot, target, gl, problems } = window.vesselProof
    const state = snapshot.breakables.find((item) => item.id === target.id)
    if (!state) throw new Error('Missing Vessel snapshot state')
    state.charge = 1
    state.phase = 'shattering'
    state.brokenAt = 0
    snapshot.elapsedSeconds = 0.35
    for (let frame = 0; frame < 4; frame++) renderer.render(snapshot, 1 / 60)
    gl.finish()
    return { metrics: renderer.getMetrics(), errors: problems }
  })
  if (shattering.errors.length > 0)
    throw new Error(shattering.errors.join('\n'))
  await page.screenshot({
    path: `${output}/${files.shattering}`,
    timeout: 45_000,
  })
  await page.evaluate(() => window.vesselProof.renderer.dispose())
  await context.close()
} finally {
  await browser.close()
}

const record = {
  scope:
    'Actual Twin Galleries renderer proof of the public vessel intact and authored-fracture states; not an FPS or gameplay acceptance result.',
  viewport,
  files,
  asset: {
    id: asset.id,
    file: asset.file,
    sha256: publicSha256,
    intactNode: asset.intactNode,
    shardPrefix: asset.shardPrefix,
    shardCount: asset.shardCount,
  },
  setup,
  shattering,
  pageErrors,
}
await writeFile(
  `${output}/manifest.json`,
  `${JSON.stringify(record, null, 2)}\n`,
)
console.log(JSON.stringify(record))
