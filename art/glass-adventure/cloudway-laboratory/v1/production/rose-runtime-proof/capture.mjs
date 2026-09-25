import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const proofRoot = dirname(fileURLToPath(import.meta.url))
const sourceAssets = await realpath(resolve(proofRoot, '../../source-assets'))
const outputDirectory = resolve(
  sourceAssets,
  'proofs/runtime/rose-quartz-crackle-fast',
)
const reportDirectory = resolve(proofRoot, '../reports')
const mirror = resolve(
  reportDirectory,
  'rose-quartz-crackle-fast-runtime-v1-browser-proof.json',
)
const external = resolve(
  sourceAssets,
  'production/rose-quartz-crackle-fast/runtime-v1-browser-proof.json',
)
const boundedManifest = resolve(
  sourceAssets,
  'runtime/rose-quartz-crackle-fast/manifest.json',
)
const boundedExternalReport = resolve(
  sourceAssets,
  'production/rose-quartz-crackle-fast/runtime-v1-report.json',
)
const boundedMirrorReport = resolve(
  reportDirectory,
  'rose-quartz-crackle-fast-runtime-v1.json',
)
const fullMirrorReport = resolve(
  reportDirectory,
  'rose-quartz-crackle-fast-runtime-v1-full-detail.json',
)
const glbs = {
  full: resolve(
    sourceAssets,
    'runtime/rose-quartz-crackle-fast/rose-quartz-crackle-fast-runtime-v1-full-detail.glb',
  ),
  bounded: resolve(
    sourceAssets,
    'runtime/rose-quartz-crackle-fast/rose-quartz-crackle-fast-runtime-v1.glb',
  ),
}
const url = process.env.ROSE_PROOF_URL ?? 'http://127.0.0.1:5635/'

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

await mkdir(outputDirectory, { recursive: true })
await mkdir(dirname(external), { recursive: true })
const fullReport = JSON.parse(await readFile(fullMirrorReport, 'utf8'))
const boundedReport = JSON.parse(await readFile(boundedMirrorReport, 'utf8'))

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
})

async function captureBundle(bundle) {
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
    const response = await page.goto(`${url}?bundle=${bundle}`, {
      waitUntil: 'domcontentloaded',
      timeout: 180_000,
    })
    if (response === null || !response.ok())
      throw new Error(
        `${bundle} proof page response failed: ${response?.status()}`,
      )
    await page.waitForFunction(
      () => window.__roseProof?.state !== 'loading',
      undefined,
      { timeout: 300_000 },
    )
    const initialized = await page.evaluate(() => window.__roseProof)
    if (initialized.state !== 'ready')
      throw new Error(
        `${bundle} proof failed to initialize: ${initialized.error}`,
      )

    const captures = [
      {
        name: 'intact-gameplay',
        phase: 'intact',
        progress: 0,
        view: 'gameplay',
      },
      { name: 'intact-close', phase: 'intact', progress: 0, view: 'close' },
      {
        name: 'released-gameplay',
        phase: 'released',
        progress: 0.38,
        view: 'gameplay',
      },
      {
        name: 'released-early-fracture',
        phase: 'released',
        progress: 0.18,
        view: 'fracture',
      },
    ]
    const records = []
    for (const capture of captures) {
      const current = await page.evaluate(({ phase, progress, view }) => {
        window.__roseProof.setView?.(view)
        return window.__roseProof.setPhase?.(phase, progress)
      }, capture)
      await page.evaluate(
        () =>
          new Promise((resolveFrame) =>
            requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
          ),
      )
      const path = resolve(
        outputDirectory,
        `rose-quartz-crackle-fast-runtime-v1-${bundle}-${capture.name}.png`,
      )
      await page.screenshot({ path, fullPage: true })
      const payload = await readFile(path)
      records.push({
        ...capture,
        file: `source-assets/proofs/runtime/rose-quartz-crackle-fast/${path.split('/').at(-1)}`,
        bytes: payload.length,
        sha256: sha256(payload),
        viewport: { width: 1440, height: 1000 },
        adapterState: current,
      })
    }
    const final = await page.evaluate(() => ({
      source: window.__roseProof.source,
      renderer: window.__roseProof.renderer,
    }))
    return { bundle, ...final, captures: records, consoleErrors, pageErrors }
  } finally {
    await page.close()
  }
}

try {
  const full = await captureBundle('full')
  const bounded = await captureBundle('bounded')
  const payloads = {
    full: await readFile(glbs.full),
    bounded: await readFile(glbs.bounded),
  }
  const expectedMeshes = [
    'RoseRuntimeCrystalShell',
    'RoseRuntimeGoldFramework',
    'RoseRuntimeIvoryInlays',
    'RoseRuntimeProviderIntactExterior',
    'RoseRuntimeSourceCornerFiligree',
    ...Array.from(
      { length: 18 },
      (_, index) =>
        `RoseRuntimeShardGlass_${index.toString().padStart(3, '0')}`,
    ),
    ...Array.from(
      { length: 18 },
      (_, index) =>
        `RoseRuntimeShardSurfaceDetail_${index.toString().padStart(3, '0')}`,
    ),
  ].sort()
  const meshNames = (proof) =>
    proof.source.meshes.map(({ mesh }) => mesh).sort()
  const triangles = (proof) => proof.source.totalTriangles
  const report = {
    schema: 1,
    assetId: 'cloudway-lab-rose-crackle-v1',
    status: 'real-gltfloader-production-adapter-webgl-proof-accepted',
    bundles: {
      full: {
        ...fullReport.bundle,
        bytes: payloads.full.length,
        sha256: sha256(payloads.full),
      },
      bounded: {
        ...boundedReport.bundle,
        bytes: payloads.bounded.length,
        sha256: sha256(payloads.bounded),
        resourceBudget: boundedReport.inventory.resourceBudget,
      },
    },
    harness: {
      url,
      loader:
        'three/addons/loaders/GLTFLoader.js + three/addons/libs/meshopt_decoder.module.js',
      adapter: 'packages/glass-game/src/render/cloudway-crackle-adapter.ts',
      renderer: 'THREE.WebGLRenderer',
      fullRendererIdentity: full.renderer,
      boundedRendererIdentity: bounded.renderer,
    },
    sourceAfterGlTfLoader: {
      full: full.source,
      bounded: bounded.source,
    },
    captures: [...full.captures, ...bounded.captures],
    matchedComparison: {
      gameplay: {
        full: full.captures[0].file,
        bounded: bounded.captures[0].file,
      },
      closestInspection: {
        full: full.captures[1].file,
        bounded: bounded.captures[1].file,
      },
      earlyRelease: {
        full: full.captures[3].file,
        bounded: bounded.captures[3].file,
      },
      review:
        'Root accepted the bounded delivery after matched gameplay and closest-inspection review preserved the source exterior, gold lattice, corner filigree, and rosy finish.',
    },
    assertions: {
      exactRootLoaded:
        full.source.root === 'CloudwayLab_RoseQuartzCrackleFast' &&
        bounded.source.root === 'CloudwayLab_RoseQuartzCrackleFast',
      deliveryHashesMatchStaticAudits:
        sha256(payloads.full) === fullReport.bundle.sha256 &&
        sha256(payloads.bounded) === boundedReport.bundle.sha256,
      exactReviewedMeshSet:
        JSON.stringify(meshNames(full)) === JSON.stringify(expectedMeshes) &&
        JSON.stringify(meshNames(bounded)) === JSON.stringify(expectedMeshes),
      allTrianglesRetained:
        triangles(full) === fullReport.inventory.totalVisibleTriangles &&
        triangles(bounded) === fullReport.inventory.totalVisibleTriangles,
      fullResolutionLoaded: full.source.meshes.some(
        ({ textureChannels }) => textureChannels.baseColor?.[0] === 8192,
      ),
      bounded2kLoaded: bounded.source.meshes
        .flatMap(({ textureChannels }) => Object.values(textureChannels))
        .filter(Boolean)
        .every(([width, height]) => width === 2048 && height === 2048),
      intactOwnership: [full, bounded].every(
        ({ captures }) =>
          captures[0].adapterState.visibility.intact &&
          captures[0].adapterState.visibility.persistent &&
          !captures[0].adapterState.visibility.firstShard,
      ),
      releasedOwnership: [full, bounded].every(
        ({ captures }) =>
          !captures[2].adapterState.visibility.intact &&
          captures[2].adapterState.visibility.persistent &&
          captures[2].adapterState.visibility.firstShard,
      ),
      earlyReleaseOwnership: [full, bounded].every(
        ({ captures }) =>
          !captures[3].adapterState.visibility.intact &&
          captures[3].adapterState.visibility.persistent &&
          captures[3].adapterState.visibility.firstShard,
      ),
      shardRolesPresent: [full, bounded].every(({ captures }) =>
        captures.every(({ adapterState }) => adapterState.shardRootsPresent),
      ),
      noConsoleErrors:
        full.consoleErrors.length === 0 && bounded.consoleErrors.length === 0,
      noPageErrors:
        full.pageErrors.length === 0 && bounded.pageErrors.length === 0,
    },
    consoleErrors: { full: full.consoleErrors, bounded: bounded.consoleErrors },
    pageErrors: { full: full.pageErrors, bounded: bounded.pageErrors },
    scope:
      'Actual GLTFLoader, MeshoptDecoder, production crackle adapter, and WebGLRenderer proof. Headless Chromium uses SwiftShader here, so this proves decoding, material binding, phase ownership, and rendering rather than target-device performance.',
  }
  if (Object.values(report.assertions).some((value) => value !== true))
    throw new Error(
      `Rose runtime proof assertion failed: ${JSON.stringify(report.assertions)}`,
    )
  const encoded = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(external, encoded)
  await writeFile(mirror, encoded)
  const updatedBounded = {
    ...boundedReport,
    status: 'bounded-runtime-real-renderer-proof-accepted',
    browserProof: {
      file: 'art/glass-adventure/cloudway-laboratory/v1/production/reports/rose-quartz-crackle-fast-runtime-v1-browser-proof.json',
      bytes: Buffer.byteLength(encoded),
      sha256: sha256(Buffer.from(encoded)),
      status: report.status,
      runtimeGlbSha256: report.bundles.bounded.sha256,
    },
    remainingGate:
      'None for Rose asset fidelity; course registration and target-device performance remain integration responsibilities.',
  }
  const updatedEncoded = `${JSON.stringify(updatedBounded, null, 2)}\n`
  await writeFile(boundedManifest, updatedEncoded)
  await writeFile(boundedExternalReport, updatedEncoded)
  await writeFile(boundedMirrorReport, updatedEncoded)
  process.stdout.write(encoded)
} finally {
  await browser.close()
}
