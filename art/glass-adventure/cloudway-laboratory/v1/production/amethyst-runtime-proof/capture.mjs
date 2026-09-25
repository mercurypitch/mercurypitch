import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const sourceAssets = await realpath(resolve(proofRoot, '../../source-assets'))
const outputDirectory = resolve(
  sourceAssets,
  'proofs/runtime/amethyst-crackle-slow/runtime-v1',
)
const mirror = resolve(
  proofRoot,
  '../reports/amethyst-crackle-slow-runtime-v1-browser-proof.json',
)
const deliveryReportPath = resolve(
  proofRoot,
  '../reports/amethyst-crackle-slow-runtime-v1.json',
)
const fullDetailReportPath = resolve(
  proofRoot,
  '../reports/amethyst-crackle-slow-runtime-v1-full-detail.json',
)
const deliveryManifest = resolve(
  sourceAssets,
  'runtime/amethyst-crackle-slow/manifest.json',
)
const deliveryExternalReport = resolve(
  sourceAssets,
  'production/amethyst-crackle-slow/runtime-v1-report.json',
)
const external = resolve(
  sourceAssets,
  'production/amethyst-crackle-slow/runtime-v1-browser-proof.json',
)
const boundedGlb = resolve(
  sourceAssets,
  'runtime/amethyst-crackle-slow/amethyst-crackle-slow-runtime-v1.glb',
)
const fullDetailGlb = resolve(
  sourceAssets,
  'runtime/amethyst-crackle-slow/amethyst-crackle-slow-runtime-v1-full-detail.glb',
)
const baseUrl = process.env.AMETHYST_PROOF_URL ?? 'http://127.0.0.1:5635/'

function sha256(payload) {
  return createHash('sha256').update(payload).digest('hex')
}

function logicalProofPath(fileName) {
  return `source-assets/proofs/runtime/amethyst-crackle-slow/runtime-v1/${fileName}`
}

function bindingRows(source) {
  return source.reviewedBindings
    .map(({ mesh, kind, material }) => ({ mesh, kind, material }))
    .sort((left, right) => left.mesh.localeCompare(right.mesh))
}

await mkdir(outputDirectory, { recursive: true })
await mkdir(dirname(external), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
})

async function captureVariant({ query, variant, views }) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
  try {
    const url = new URL(baseUrl)
    url.searchParams.set('asset', query)
    const response = await page.goto(url.href, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    })
    if (response === null || !response.ok())
      throw new Error(`${variant} proof page failed: ${response?.status()}`)
    await page.waitForFunction(
      () => window.__amethystProof?.state !== 'loading',
      undefined,
      { timeout: 360_000 },
    )
    const initial = await page.evaluate(() => window.__amethystProof)
    if (initial.state !== 'ready')
      throw new Error(`${variant} proof failed: ${initial.error}`)

    const captures = []
    for (const view of views) {
      const state = await page.evaluate(
        (nextView) => window.__amethystProof.setView?.(nextView),
        view,
      )
      await page.evaluate(
        () =>
          new Promise((resolveFrame) =>
            requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
          ),
      )
      const fileName = `amethyst-crackle-slow-runtime-v1-${variant}-${view}.png`
      const file = resolve(outputDirectory, fileName)
      await page.screenshot({ path: file, fullPage: true })
      const payload = await readFile(file)
      captures.push({
        variant,
        view,
        file: logicalProofPath(fileName),
        absoluteFile: file,
        bytes: payload.length,
        sha256: sha256(payload),
        viewport: { width: 1440, height: 1000 },
        state,
      })
    }
    const final = await page.evaluate(() => ({
      source: window.__amethystProof.source,
      renderer: window.__amethystProof.renderer,
    }))
    return {
      variant,
      url: url.href,
      source: final.source,
      renderer: final.renderer,
      captures,
      consoleErrors,
      pageErrors,
    }
  } finally {
    await page.close()
  }
}

try {
  const full = await captureVariant({
    query: 'full',
    variant: 'full-detail',
    views: ['intact', 'close'],
  })
  const bounded = await captureVariant({
    query: 'bounded',
    variant: 'bounded-2k',
    views: ['intact', 'close', 'fractured'],
  })
  const captures = [...full.captures, ...bounded.captures]
  const deliveryReport = JSON.parse(await readFile(deliveryReportPath, 'utf8'))
  const fullDetailReport = JSON.parse(
    await readFile(fullDetailReportPath, 'utf8'),
  )
  const boundedPayload = await readFile(boundedGlb)
  const fullDetailPayload = await readFile(fullDetailGlb)
  const boundedSha256 = sha256(boundedPayload)
  const fullDetailSha256 = sha256(fullDetailPayload)
  const expectedBindings = Object.entries(deliveryReport.materialBindings)
    .map(([mesh, { kind, material }]) => ({ mesh, kind, material }))
    .sort((left, right) => left.mesh.localeCompare(right.mesh))
  const fullBindings = bindingRows(full.source)
  const boundedBindings = bindingRows(bounded.source)
  const fullTriangles = full.source.meshes.reduce(
    (sum, { triangles }) => sum + triangles,
    0,
  )
  const boundedTriangles = bounded.source.meshes.reduce(
    (sum, { triangles }) => sum + triangles,
    0,
  )
  const fractured = bounded.captures.find(({ view }) => view === 'fractured')
  const intactCaptures = captures.filter(({ view }) => view !== 'fractured')
  const report = {
    schema: 'cloudway-amethyst-runtime-delivery-browser-proof/v1',
    assetId: 'cloudway-lab-amethyst-crackle-v1',
    status: 'real-gltfloader-production-adapter-webgl-proof-accepted',
    runtimeGlbs: {
      fullDetail: {
        file: fullDetailReport.bundle.file,
        bytes: fullDetailPayload.length,
        sha256: fullDetailSha256,
      },
      bounded2k: {
        file: deliveryReport.bundle.file,
        bytes: boundedPayload.length,
        sha256: boundedSha256,
        resourceBudget: deliveryReport.inventory.resourceBudget,
      },
    },
    harness: {
      loader:
        'three/addons/loaders/GLTFLoader.js + three/addons/libs/meshopt_decoder.module.js',
      adapter: 'packages/glass-game/src/render/cloudway-crackle-adapter.ts',
      renderer: 'THREE.WebGLRenderer',
      rendererIdentity: {
        fullDetail: full.renderer,
        bounded2k: bounded.renderer,
      },
      urls: { fullDetail: full.url, bounded2k: bounded.url },
    },
    sourceAfterGlTfLoader: {
      fullDetail: full.source,
      bounded2k: bounded.source,
    },
    captures,
    matchedComparison: {
      gameplay: {
        fullDetail: full.captures.find(({ view }) => view === 'intact'),
        bounded2k: bounded.captures.find(({ view }) => view === 'intact'),
      },
      nearestInspection: {
        fullDetail: full.captures.find(({ view }) => view === 'close'),
        bounded2k: bounded.captures.find(({ view }) => view === 'close'),
      },
      fracturedBounded2k: fractured,
      texturePolicy: deliveryReport.textures.policy,
      review:
        'Root accepted the bounded delivery after matched gameplay and closest-inspection review preserved the source exterior and ornament, and the polished early-fracture view replaced the saturated blue interior with pale lavender glass.',
    },
    artReview: {
      status: 'accepted',
      date: '2026-09-25',
      scope:
        'Bounded 2K intact gameplay, nearest inspection, and polished early-fracture visual fidelity.',
      note: 'Source PBR exterior and ornament remain clear; restrained pale-lavender interior glass replaces the rejected saturated blue treatment.',
    },
    assertions: {
      fullDetailHashMatchesStaticAudit:
        fullDetailSha256 === fullDetailReport.bundle.sha256,
      boundedHashMatchesStaticAudit:
        boundedSha256 === deliveryReport.bundle.sha256,
      exactRootLoadedBoth:
        full.source.root === 'CloudwayLab_AmethystCrackleSlow' &&
        bounded.source.root === 'CloudwayLab_AmethystCrackleSlow',
      expectedVariantsLoaded:
        full.source.assetVariant === 'full-detail' &&
        bounded.source.assetVariant === 'bounded-2k',
      exactBindingsFull:
        JSON.stringify(fullBindings) === JSON.stringify(expectedBindings),
      exactBindingsBounded:
        JSON.stringify(boundedBindings) === JSON.stringify(expectedBindings),
      everyTriangleRetainedFull:
        fullTriangles === deliveryReport.geometry.triangles,
      everyTriangleRetainedBounded:
        boundedTriangles === deliveryReport.geometry.triangles,
      twoMatchedIntactViewsPerBundle:
        full.captures.length === 2 && intactCaptures.length === 4,
      boundedFractureRendered: fractured?.state.visibleShards === 18,
      boundedIntactHiddenOnRelease: fractured?.state.intactVisible === false,
      boundedSourceBodyHiddenOnRelease:
        fractured?.state.sourceBodyVisible === false,
      boundedPersistentVisibleOnRelease:
        fractured?.state.persistentVisible === true,
      intactStatesCorrect: intactCaptures.every(
        ({ state }) =>
          state.intactVisible === true &&
          state.visibleShards === 0 &&
          state.sourceBodyVisible === true &&
          state.persistentVisible === true,
      ),
      noRuntimeScale: captures.every(
        ({ state }) => JSON.stringify(state.rootScale) === '[1,1,1]',
      ),
      contactTopCentreOrigin: captures.every(
        ({ state }) => JSON.stringify(state.rootPosition) === '[0,0,0]',
      ),
      noConsoleErrors:
        full.consoleErrors.length === 0 && bounded.consoleErrors.length === 0,
      noPageErrors:
        full.pageErrors.length === 0 && bounded.pageErrors.length === 0,
    },
    consoleErrors: {
      fullDetail: full.consoleErrors,
      bounded2k: bounded.consoleErrors,
    },
    pageErrors: {
      fullDetail: full.pageErrors,
      bounded2k: bounded.pageErrors,
    },
    scope:
      'Actual GLTFLoader with MeshoptDecoder, the shared crackle adapter, and WebGLRenderer prove full-detail and bounded delivery loading, exact material binding, intact/released visibility, pivots, and matched visual comparison. Headless Chromium uses SwiftShader here, so this proof does not certify device performance.',
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
    status: 'bounded-runtime-real-renderer-proof-accepted',
    browserProof: {
      report: {
        file: 'art/glass-adventure/cloudway-laboratory/v1/production/reports/amethyst-crackle-slow-runtime-v1-browser-proof.json',
        externalFile:
          'source-assets/production/amethyst-crackle-slow/runtime-v1-browser-proof.json',
        absoluteExternalFile: external,
        bytes: Buffer.byteLength(encoded),
        sha256: sha256(Buffer.from(encoded)),
        status: report.status,
      },
      captures: captures.map(
        ({ variant, view, file, absoluteFile, bytes, sha256 }) => ({
          variant,
          view,
          file,
          absoluteFile,
          bytes,
          sha256,
        }),
      ),
      assertions: report.assertions,
      fullDetailGlbSha256: fullDetailSha256,
      boundedGlbSha256: boundedSha256,
    },
    remainingGate:
      'None for Amethyst asset fidelity; course registration, integrated lighting review, and target-device performance remain integration responsibilities.',
  }
  const completedEncoded = `${JSON.stringify(completedDeliveryReport, null, 2)}\n`
  await writeFile(deliveryManifest, completedEncoded)
  await writeFile(deliveryExternalReport, completedEncoded)
  await writeFile(deliveryReportPath, completedEncoded)
  process.stdout.write(encoded)
} finally {
  await browser.close()
}
