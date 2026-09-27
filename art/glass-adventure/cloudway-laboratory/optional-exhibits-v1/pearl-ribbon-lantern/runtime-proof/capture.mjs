import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../',
)
const sourceRoot = path.resolve(
  process.env.GLASS_PEARL_LANTERN_SOURCE_ROOT ??
    path.join(
      process.env.HOME,
      'Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/optional-exhibits-v1/pearl-ribbon-lantern',
    ),
)
const proofDir = path.join(sourceRoot, 'proofs/browser')
const archivedLod0 = path.join(
  sourceRoot,
  'runtime/pearl-ribbon-lantern-lod0.glb',
)
const publicRuntimeRoot = path.join(
  repositoryRoot,
  'apps/beside-cue/public/games/cloudway-laboratory-v1/optional-exhibits/pearl-ribbon-lantern',
)
const publicLod0 = path.join(publicRuntimeRoot, 'pearl-ribbon-lantern-lod0.glb')
const publicLod1 = path.join(publicRuntimeRoot, 'pearl-ribbon-lantern-lod1.glb')
const url = process.env.PEARL_LANTERN_PROOF_URL ?? 'http://127.0.0.1:5681/'
const hash = (value) => createHash('sha256').update(value).digest('hex')

await mkdir(proofDir, { recursive: true })
const [archivedLod0Bytes, publicLod1Bytes] = await Promise.all([
  readFile(archivedLod0),
  readFile(publicLod1),
])
try {
  await access(publicLod0)
  throw new Error('LOD0 must not be present in the shipping public directory.')
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    // The high-detail comparison source belongs only in the creative archive.
  } else {
    throw error
  }
}
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
  const errors = []
  const servedDistributions = {}
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('response', (response) => {
    const match = response.url().match(/\/(lod[01])\.glb$/)
    if (match)
      servedDistributions[match[1]] =
        response.headers()['x-proof-asset-distribution']
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  try {
    await page.waitForFunction(
      () => window.__PEARL_LANTERN_PROOF__?.ready === true,
      undefined,
      { timeout: 30_000 },
    )
  } catch (error) {
    const pageError = await page.evaluate(() => document.body.dataset.error)
    throw new Error(
      `Lantern proof did not become ready: ${pageError ?? String(error)}\n${errors.join('\n')}`,
    )
  }
  if (errors.length > 0) throw new Error(errors.join('\n'))
  const runtime = await page.evaluate(() => window.__PEARL_LANTERN_PROOF__)
  if (
    servedDistributions.lod0 !== 'creative-archive' ||
    servedDistributions.lod1 !== 'shipping-runtime'
  )
    throw new Error('The proof server did not use the expected LOD sources.')
  const expected = { lod0: 120_000, lod1: 36_000 }
  for (const lod of runtime.lods) {
    if (lod.drawCalls !== 1 || lod.triangles !== expected[lod.lod])
      throw new Error(
        `${lod.lod} runtime cost does not match the production contract.`,
      )
    if (!lod.lightAnchor || !lod.supportAnchor)
      throw new Error(`${lod.lod} runtime anchors are missing.`)
    if (
      !lod.materials.every(
        (material) =>
          material.standard &&
          material.textureChannels.baseColor &&
          material.textureChannels.normal,
      )
    )
      throw new Error(`${lod.lod} did not load its reviewed PBR channels.`)
  }
  const output = path.join(proofDir, 'pearl-ribbon-lantern-lod-comparison.png')
  await page.screenshot({ path: output })
  const contents = await readFile(output)
  const report = {
    schema: 1,
    status: 'actual GLB WebGL runtime proof passed',
    url,
    viewport: [1100, 700],
    renderer: runtime.renderer,
    inputs: [
      {
        lod: 'lod0',
        distribution: 'creative-archive-proof-only',
        file: '<creative-archive>/glass-adventure/cloudway-laboratory/optional-exhibits-v1/pearl-ribbon-lantern/runtime/pearl-ribbon-lantern-lod0.glb',
        bytes: archivedLod0Bytes.length,
        sha256: hash(archivedLod0Bytes),
      },
      {
        lod: 'lod1',
        distribution: 'shipping-runtime',
        file: 'apps/beside-cue/public/games/cloudway-laboratory-v1/optional-exhibits/pearl-ribbon-lantern/pearl-ribbon-lantern-lod1.glb',
        bytes: publicLod1Bytes.length,
        sha256: hash(publicLod1Bytes),
      },
    ],
    publicLod0Absent: true,
    servedDistributions,
    lods: runtime.lods,
    screenshot: {
      file: 'proofs/browser/pearl-ribbon-lantern-lod-comparison.png',
      bytes: contents.length,
      sha256: hash(contents),
    },
  }
  await writeFile(
    path.join(sourceRoot, 'webgl-proof.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  process.stdout.write(`PEARL_LANTERN_WEBGL_PROOF=${JSON.stringify(report)}\n`)
} finally {
  await browser.close()
}
