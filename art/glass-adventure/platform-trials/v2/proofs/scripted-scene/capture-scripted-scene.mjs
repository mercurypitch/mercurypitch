import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const origin = process.env.CLOUDWAY_PROOF_ORIGIN ?? 'http://127.0.0.1:5340'
const output = dirname(fileURLToPath(import.meta.url))
const repoRoot = process.cwd()
await mkdir(output, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
  ],
})
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
})
page.setDefaultTimeout(90_000)
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error.stack ?? error)))
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push('console: ' + message.text())
})
await page.route(origin + '/cloudway-proof.html', async (route) => {
  await route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="proof"></main></body></html>',
  })
})
await page.goto(origin + '/cloudway-proof.html')
await page.evaluate(async (repoRoot) => {
  const repo = `/@fs${repoRoot}/packages/glass-game/src`
  const [rendererModule, contentModule, gameModule, assetModule] =
    await Promise.all([
      import(repo + '/render/glass-renderer.ts'),
      import(repo + '/content/cloudway-trial.ts'),
      import(repo + '/core/game.ts'),
      import(repo + '/browser/assets.ts'),
    ])
  document.documentElement.style.cssText =
    'width:100%;height:100%;background:#dfeaf0'
  document.body.style.cssText =
    'margin:0;width:100%;height:100%;overflow:hidden;background:#dfeaf0'
  const container = document.getElementById('proof')
  container.style.cssText = 'width:100vw;height:100vh;overflow:hidden'
  const assetErrors = []
  const renderer = rendererModule.createGlassRenderer(
    container,
    contentModule.CLOUDWAY_GLASS_RIBBON,
    (id) => assetModule.glassGameAssetUrl(id, location.origin + '/games/'),
    {
      onAssetError: (id, error) => {
        assetErrors.push(id + ': ' + String(error))
      },
    },
  )
  await renderer.ready
  renderer.resize()
  window.__cloudwayProof = {
    assetErrors,
    renderer,
    game: gameModule.createGlassGame(contentModule.CLOUDWAY_GLASS_RIBBON),
    level: contentModule.CLOUDWAY_GLASS_RIBBON,
  }
}, repoRoot)

const scenarios = [
  {
    name: 'scripted-glide-midroute',
    player: { x: 0.7, y: 0, z: 12.25 },
    supportPlatformId: 'cloudway-glide-dock-west',
    states: {
      'cloudway-glide-raft': {
        phase: 'moving',
        phaseProgress: 0.5,
        offset: { x: 0, y: 0, z: 0.95 },
        collisionEnabled: true,
      },
    },
  },
  {
    name: 'scripted-crackle-warning',
    player: { x: 0.8, y: 0, z: 24.15 },
    supportPlatformId: 'cloudway-crackle-recovery',
    states: {
      'cloudway-crackle-two': {
        phase: 'warning',
        phaseProgress: 0.375,
        offset: { x: 0, y: 0, z: 0 },
        collisionEnabled: true,
      },
    },
  },
  {
    name: 'scripted-crackle-release',
    player: { x: 0.8, y: 0, z: 24.15 },
    supportPlatformId: 'cloudway-crackle-recovery',
    states: {
      'cloudway-crackle-two': {
        phase: 'released',
        phaseProgress: 0.52,
        offset: { x: 0, y: 0, z: 0 },
        collisionEnabled: false,
      },
    },
  },
]

const reports = []
for (const scenario of scenarios) {
  const report = await page.evaluate((scenario) => {
    const { renderer, game, level, assetErrors } = window.__cloudwayProof
    const base = game.snapshot()
    const platformIds = level.platforms.map((platform) => platform.id)
    const platformStates = (base.platformStates ?? []).map((state) => ({
      ...state,
      ...(scenario.states[state.id] ?? {}),
    }))
    const snapshot = {
      ...base,
      player: {
        position: scenario.player,
        velocity: { x: 0, y: 0, z: 0 },
        grounded: true,
        supportPlatformId: scenario.supportPlatformId,
        facingYaw: Math.PI,
      },
      platformStates,
      enabledPlatformIds: platformIds,
      activeSolidIds: [
        ...new Set([...(base.activeSolidIds ?? []), ...platformIds]),
      ],
      paused: false,
    }
    renderer.recenter()
    for (let frame = 0; frame < 150; frame += 1)
      renderer.render(snapshot, 1 / 60, {
        challengeEncounterId: null,
        paused: false,
      })
    return {
      assetErrors: [...assetErrors],
      metrics: renderer.getMetrics(),
      platformStates: platformStates.filter((state) =>
        Object.hasOwn(scenario.states, state.id),
      ),
      image: document.querySelector('canvas').toDataURL('image/png'),
    }
  }, scenario)
  await writeFile(
    output + '/' + scenario.name + '.png',
    report.image.slice(report.image.indexOf(',') + 1),
    'base64',
  )
  delete report.image
  reports.push({ scenario: scenario.name, ...report })
}

await page.evaluate(() => window.__cloudwayProof.renderer.dispose())
await browser.close()
await writeFile(
  output + '/report.json',
  JSON.stringify(
    {
      assetSha256:
        '05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e',
      kind: 'scripted fixed-state renderer proof; traversal was validated separately without teleportation',
      pageErrors,
      reports,
    },
    null,
    2,
  ),
)
if (
  pageErrors.length > 0 ||
  reports.some((report) => report.assetErrors.length > 0)
) {
  console.error(JSON.stringify({ pageErrors, reports }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify(reports, null, 2))
}
