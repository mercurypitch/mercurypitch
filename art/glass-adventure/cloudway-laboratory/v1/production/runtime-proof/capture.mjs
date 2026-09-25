import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const sourceAssets = await realpath(resolve(proofRoot, '../../source-assets'))
const outputDirectory = resolve(
  sourceAssets,
  'proofs/runtime/gilt-scroll-bridge',
)
const mirror = resolve(
  proofRoot,
  '../reports/gilt-scroll-bridge-runtime-v1-browser-proof.json',
)
const deliveryReportPath = resolve(
  proofRoot,
  '../reports/gilt-scroll-bridge-runtime-v1.json',
)
const deliveryManifest = resolve(
  sourceAssets,
  'runtime/gilt-scroll-bridge/manifest.json',
)
const deliveryExternalReport = resolve(
  sourceAssets,
  'production/gilt-scroll-bridge/scroll-runtime-v1-report.json',
)
const external = resolve(
  sourceAssets,
  'production/gilt-scroll-bridge/scroll-runtime-v1-browser-proof.json',
)
const glb = resolve(
  sourceAssets,
  'runtime/gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1.glb',
)
const fullDetailClose = resolve(
  outputDirectory,
  'gilt-scroll-bridge-runtime-v1-full-detail-retracted-close.png',
)
const url = process.env.SCROLL_PROOF_URL ?? 'http://127.0.0.1:5634/'

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

await mkdir(outputDirectory, { recursive: true })
await mkdir(dirname(external), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
const pageErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))

try {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  })
  if (response === null || !response.ok())
    throw new Error(`Proof page response failed: ${response?.status()}`)
  await page.waitForFunction(
    () => window.__scrollProof?.state !== 'loading',
    undefined,
    { timeout: 180_000 },
  )
  const state = await page.evaluate(() => window.__scrollProof)
  if (state.state !== 'ready')
    throw new Error(`Runtime proof failed to initialize: ${state.error}`)

  const captures = [
    { name: 'full-play', ratio: 1, view: 'normal-play' },
    { name: 'half-play', ratio: 0.625, view: 'normal-play' },
    { name: 'retracted-close', ratio: 0.25, view: 'close-retracted' },
  ]
  const records = []
  for (const capture of captures) {
    const current = await page.evaluate(({ ratio, view }) => {
      window.__scrollProof.setView?.(view)
      return window.__scrollProof.setRatio?.(ratio)
    }, capture)
    await page.evaluate(
      () =>
        new Promise((resolveFrame) =>
          requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
        ),
    )
    const path = resolve(
      outputDirectory,
      `gilt-scroll-bridge-runtime-v1-${capture.name}.png`,
    )
    await page.screenshot({ path, fullPage: true })
    const payload = await readFile(path)
    records.push({
      ...capture,
      file: `source-assets/proofs/runtime/gilt-scroll-bridge/${path.split('/').at(-1)}`,
      bytes: payload.length,
      sha256: sha256(payload),
      viewport: { width: 1440, height: 1000 },
      adapterState: current,
    })
  }

  const finalState = await page.evaluate(() => ({
    source: window.__scrollProof.source,
    renderer: window.__scrollProof.renderer,
  }))
  const glbPayload = await readFile(glb)
  const deliveryReport = JSON.parse(await readFile(deliveryReportPath, 'utf8'))
  const fullDetailClosePayload = await readFile(fullDetailClose)
  const runtimeSha256 = sha256(glbPayload)
  const expectedMeshes = [
    'ScrollDeckFrostEtchDetailLayer',
    'ScrollDeckGeometry',
    'ScrollDeckGoldStarDetailLayer',
    'ScrollRollerNegativeGeometry',
    'ScrollRollerPositiveGeometry',
  ]
  const loadedMeshes = finalState.source.meshes.map(({ mesh }) => mesh).sort()
  const widths = records.map(
    ({ adapterState }) => adapterState.liveBounds.size[0],
  )
  const depths = records.map(
    ({ adapterState }) => adapterState.liveBounds.size[2],
  )
  const report = {
    schema: 1,
    assetId: 'gilt-scroll-bridge-runtime-v1',
    status: 'real-gltfloader-adapter-webgl-proof-passed',
    runtimeGlb: {
      file: 'source-assets/runtime/gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1.glb',
      bytes: glbPayload.length,
      sha256: runtimeSha256,
      resourceBudget: deliveryReport.glbInventory.resourceBudget,
    },
    harness: {
      url,
      loader:
        'three/addons/loaders/GLTFLoader.js + three/addons/libs/meshopt_decoder.module.js',
      adapter: 'packages/glass-game/src/render/cloudway-scroll-adapter.ts',
      renderer: 'THREE.WebGLRenderer',
      rendererIdentity: finalState.renderer,
    },
    sourceAfterGlTfLoader: finalState.source,
    captures: records,
    closeComparison: {
      fullDetailReference: {
        file: 'source-assets/proofs/runtime/gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1-full-detail-retracted-close.png',
        bytes: fullDetailClosePayload.length,
        sha256: sha256(fullDetailClosePayload),
      },
      boundedDelivery: {
        file: records[2].file,
        bytes: records[2].bytes,
        sha256: records[2].sha256,
      },
      selectedTexturePolicy: deliveryReport.textures.policy,
      review:
        'Matched close-play inspection retains continuous ivory veining and source-quality gold ornament with the selected 2K data maps. The rejected 1K data-map diagnostic showed visible ivory mottling.',
    },
    assertions: {
      exactCertifiedRootLoaded:
        finalState.source.root === 'Cloudway_GiltScrollBridge_RuntimeV1',
      deliveryHashMatchesStaticAudit:
        runtimeSha256 === deliveryReport.bundle.sha256,
      exactCertifiedMeshSet:
        JSON.stringify(loadedMeshes) === JSON.stringify(expectedMeshes),
      threeScrollStatesRendered: records.length === 3,
      fullRatio: records[0].adapterState.lengthRatio === 1,
      intermediateRatio: records[1].adapterState.lengthRatio === 0.625,
      minimumRatio: records[2].adapterState.lengthRatio === 0.25,
      deckRetracts:
        Math.abs(records[2].adapterState.transforms.deckScale[0] - 0.25) < 1e-6,
      liveWidthContracts: widths[0] > widths[1] && widths[1] > widths[2],
      perpendicularDepthStable: depths.every(
        (depth) => Math.abs(depth - depths[0]) < 1e-6,
      ),
      negativeRollerRigid: records.every((item) =>
        item.adapterState.transforms.negativeRollerScale.every(
          (value) => Math.abs(value - 1) < 1e-6,
        ),
      ),
      positiveRollerRigid: records.every((item) =>
        item.adapterState.transforms.positiveRollerScale.every(
          (value) => Math.abs(value - 1) < 1e-6,
        ),
      ),
      noConsoleErrors: consoleErrors.length === 0,
      noPageErrors: pageErrors.length === 0,
    },
    consoleErrors,
    pageErrors,
    scope:
      'Actual GLTFLoader with MeshoptDecoder, production scroll adapter, and WebGLRenderer proof. It validates bounded delivery decoding, render installation, and authoritative full/intermediate/minimum transforms. Gameplay collision remains owned by the simulation contract. Headless Chromium uses SwiftShader here, so this proof does not certify device performance.',
  }
  if (Object.values(report.assertions).some((value) => value !== true))
    throw new Error(
      `Runtime proof assertion failed: ${JSON.stringify(report.assertions)}`,
    )
  const encoded = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(external, encoded)
  await writeFile(mirror, encoded)
  const completedDeliveryReport = {
    ...deliveryReport,
    status: 'bounded-runtime-delivery-real-renderer-proof-passed',
    browserProof: {
      file: 'art/glass-adventure/cloudway-laboratory/v1/production/reports/gilt-scroll-bridge-runtime-v1-browser-proof.json',
      bytes: Buffer.byteLength(encoded),
      sha256: sha256(Buffer.from(encoded)),
      status: report.status,
      runtimeGlbSha256: runtimeSha256,
    },
    remainingGate:
      'Playable course integration must still validate landing and collision alignment, and target-device performance remains unmeasured. Those gates are outside this asset delivery proof.',
  }
  const completedEncoded = `${JSON.stringify(completedDeliveryReport, null, 2)}\n`
  await writeFile(deliveryManifest, completedEncoded)
  await writeFile(deliveryExternalReport, completedEncoded)
  await writeFile(deliveryReportPath, completedEncoded)
  process.stdout.write(encoded)
} finally {
  await browser.close()
}
