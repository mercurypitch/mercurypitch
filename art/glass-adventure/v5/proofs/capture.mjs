// Glassworks decorated-room inspection — actual renderer at fixed poses, not a gameplay acceptance test.
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const root = fileURLToPath(new URL('../../../../', import.meta.url)).replace(
  /\/$/,
  '',
)
const base = process.env.GLASS_PROOF_BASE || 'https://localhost:5187'
const moduleName = process.env.GLASS_PROOF_MODULE || 'glassworks-journey.ts'
const exportName = process.env.GLASS_PROOF_EXPORT || 'GLASSWORKS_JOURNEY'
const output =
  process.env.GLASS_PROOF_OUTPUT || fileURLToPath(new URL('.', import.meta.url))
const posesPath =
  process.env.GLASS_PROOF_POSES || new URL('./poses.json', import.meta.url)
const allRoomsVisible = process.env.GLASS_PROOF_ALL_ROOMS === '1'
if (!moduleName || !exportName)
  throw new Error('Pass content module filename and exported level constant')
await mkdir(output, { recursive: true })
const mapping = Object.fromEntries(
  [
    ...(
      await readFile(
        `${root}/apps/beside-cue/src/games/adventure/AdventureScreen.tsx`,
        'utf8',
      )
    ).matchAll(/^\s*(?:'([^']+)'|([\w-]+)):\s*'([^']+)',/gm),
  ].map((m) => [m[1] || m[2], m[3]]),
)
for (const mat of [
  'warm-carrara',
  'verde-marble',
  'cream-limestone',
  'brushed-brass',
])
  for (const channel of ['basecolor', 'normal', 'roughness'])
    mapping[`${mat}-${channel}`] = `adventure-v2/textures/${mat}-${channel}.png`
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const records = []
try {
  for (const viewport of process.env.GLASS_PROOF_VIEWPORTS
    ? JSON.parse(process.env.GLASS_PROOF_VIEWPORTS)
    : [
        { width: 800, height: 600 },
        { width: 390, height: 740 },
      ]) {
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(120000)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (allRoomsVisible) {
      // Controlled comparison only: identical content/camera, visibility disabled
      // in the served module. No application or production switch is introduced.
      await page.route('**/render/room-visibility.ts', async (route) => {
        const response = await route.fetch()
        const source = await response.text()
        const needle = 'select(player, camera) {'
        if (source.split(needle).length !== 2)
          throw new Error('Visibility comparison seam changed')
        await route.fulfill({
          response,
          body: source.replace(
            needle,
            needle +
              '\nreturn { visibleRoomIds: allRoomIds, fallbackAllVisible: true };',
          ),
        })
      })
    }
    await page.route('**/__glass-n2-inspection', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="scene"></div>',
      }),
    )
    await page.goto(`${base}/__glass-n2-inspection`)
    const summary = await page.evaluate(
      async ({ root, moduleName, exportName, mapping }) => {
        const prefix = `/@fs${root}/packages/glass-game/src/`
        const { createGlassRenderer } = await import(
          prefix + 'render/glass-renderer.ts'
        )
        const { createGlassGame } = await import(prefix + 'core/game.ts')
        const level = (await import(prefix + 'content/' + moduleName))[
          exportName
        ]
        if (!level) throw new Error('Missing level export ' + exportName)
        const problems = []
        const renderer = createGlassRenderer(
          document.querySelector('#scene'),
          level,
          (id) => '/games/' + (mapping[id] || 'adventure/' + id),
          { onAssetError: (id, e) => problems.push(id + ':' + String(e)) },
        )
        const game = createGlassGame(level)
        await renderer.ready
        window.proof = { level, renderer, createGlassGame, problems }
        return {
          id: level.id,
          rooms: level.presentation.rooms,
          spawn: level.spawn,
          breakables: level.breakables.map((x) => ({
            id: x.id,
            position: x.position,
            anchor: x.anchor,
          })),
          exit: level.exit,
          errors: problems,
        }
      },
      { root, moduleName, exportName, mapping },
    )
    console.log(
      JSON.stringify({
        viewport,
        levelId: summary.id,
        rooms: summary.rooms.length,
        errors: summary.errors,
        allRoomsVisible,
      }),
    )
    if (summary.errors.length) throw new Error(summary.errors.join('\n'))
    const poses = JSON.parse(await readFile(posesPath, 'utf8'))
    for (const pose of poses) {
      const data = await page.evaluate(
        ({ pose }) => {
          const { level, renderer, createGlassGame } = window.proof
          const game = createGlassGame(level, {
            version: 1,
            levelId: level.id,
            checkpointId: level.checkpoints[0].id,
            completedBreakableIds: pose.completed || [],
            finished: false,
          })
          const snap = game.snapshot()
          snap.player.position = { x: pose.x, y: 0, z: pose.z }
          snap.player.facingYaw = pose.yaw
          renderer.setMovementActive(false)
          renderer.cancelHeadingFollow()
          renderer.setOrbitActive(true)
          renderer.orbit(pose.yaw - renderer.getCameraYaw(), 0)
          renderer.orbit(0, -100)
          renderer.orbit(0, (pose.pitch ?? 0.36) - 0.14)
          // Zoom reset to the known lower bound before assigning a requested reach.
          renderer.zoom(-100)
          renderer.zoom((pose.distance || 4) - 1.8)
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
            methods.map((m) => [m, gl[m].bind(gl)]),
          )
          for (const m of methods) gl[m] = () => {}
          for (let i = 0; i < 120; i++) renderer.render(snap, 1 / 60)
          if (pose.celebrate) {
            snap.complete = true
            renderer.render(snap, 0)
            for (let i = 0; i < 30; i++) renderer.render(snap, 1 / 60)
          }
          for (const m of methods) gl[m] = originals[m]
          renderer.render(snap, 1 / 60)
          gl.finish()
          return {
            metrics: renderer.getMetrics(),
            yaw: renderer.getCameraYaw(),
            errors: window.proof.problems,
          }
        },
        { pose },
      )
      const filename = `${viewport.width}-${pose.name}.png`
      await page.screenshot({ path: `${output}/${filename}`, timeout: 45000 })
      records.push({ viewport, pose, file: filename, allRoomsVisible, ...data })
      console.log(JSON.stringify({ file: filename, ...data }))
    }
    await page.evaluate(() => window.proof.renderer.dispose())
    records.push({ viewport, pageErrors: errors })
    await context.close()
  }
} finally {
  await browser.close()
}
await writeFile(
  `${output}/manifest.json`,
  JSON.stringify(records, null, 2) + '\n',
)
