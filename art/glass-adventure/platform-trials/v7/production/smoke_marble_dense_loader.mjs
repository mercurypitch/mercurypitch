#!/usr/bin/env node
// Load the V7 dense marble delivery through the repository's actual Three GLTFLoader.

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const v7 = resolve(here, '..')
const threeRoot = join(repo, 'apps/beside-cue/node_modules/three')
const output = join(
  v7,
  'exports/delivery/cloudway-marble-v7-dense-baseline-delivery-2k.glb',
)
const reportPath = join(
  v7,
  'proofs/diagnostics/dense-baseline-browser-loader-smoke.json',
)
const expected = {
  root: 'Cloudway_Marble',
  triangles: 1_256_556,
  meshes: 1,
  textures: 3,
}

const mime = (path) =>
  ({
    '.glb': 'model/gltf-binary',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
  })[extname(path)] ?? 'application/octet-stream'

const sha256 = async (path) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

const html = `<!doctype html>
<meta charset="utf-8">
<script type="importmap">
{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}
</script>
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const expected = ${JSON.stringify(expected)}
const textureSlots = [
  'map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap',
  'clearcoatMap', 'clearcoatNormalMap',
]

try {
  const started = performance.now()
  const gltf = await new GLTFLoader().loadAsync('/asset.glb')
  const parsedMilliseconds = performance.now() - started
  const root = gltf.scene.getObjectByName(expected.root)
  if (!root) throw new Error('Missing root ' + expected.root)
  let triangles = 0
  let meshes = 0
  const textures = new Set()
  const geometry = []
  const materials = []
  root.traverse((object) => {
    if (!object.isMesh) return
    meshes += 1
    const item = object.geometry
    const triangleCount = item.index
      ? item.index.count / 3
      : item.getAttribute('position').count / 3
    triangles += triangleCount
    geometry.push({
      name: item.name,
      triangles: triangleCount,
      index: item.index
        ? {
            count: item.index.count,
            arrayType: item.index.array.constructor.name,
            bytes: item.index.array.byteLength,
          }
        : null,
      attributes: Object.fromEntries(
        Object.entries(item.attributes).map(([name, attribute]) => [
          name,
          {
            count: attribute.count,
            itemSize: attribute.itemSize,
            normalized: attribute.normalized,
            arrayType: attribute.array.constructor.name,
            bytes: attribute.array.byteLength,
          },
        ]),
      ),
    })
    const owned = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of owned) {
      materials.push({
        name: material.name,
        transparent: material.transparent,
        metalness: material.metalness,
        roughness: material.roughness,
        hasBaseColorMap: Boolean(material.map),
        hasNormalMap: Boolean(material.normalMap),
        hasMetalnessMap: Boolean(material.metalnessMap),
        hasRoughnessMap: Boolean(material.roughnessMap),
      })
      for (const slot of textureSlots) if (material[slot]) textures.add(material[slot])
    }
  })
  const decodedTextures = [...textures].map((texture) => {
    const image = texture.source?.data ?? texture.image
    return {
      name: texture.name,
      width: image?.width ?? null,
      height: image?.height ?? null,
      imageType: image?.constructor?.name ?? null,
      colorSpace: texture.colorSpace,
    }
  })
  const bounds = new THREE.Box3().setFromObject(root)
  window.__v7Result = {
    threeRevision: THREE.REVISION,
    parsedMilliseconds,
    root: root.name,
    meshes,
    triangles,
    geometry,
    materials,
    decodedTextures,
    boundsThreeYUpMetres: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
    },
  }
} catch (error) {
  window.__v7Error = error?.stack ?? String(error)
}
</script>`

const resolveRequest = (url) => {
  if (url === '/' || url === '/index.html')
    return { body: Buffer.from(html), type: 'text/html; charset=utf-8' }
  if (url === '/vendor/three.module.js')
    return { path: join(threeRoot, 'build/three.module.js') }
  if (url.startsWith('/vendor/addons/')) {
    const suffix = url.slice('/vendor/addons/'.length)
    if (suffix.includes('..')) return null
    return { path: join(threeRoot, 'examples/jsm', suffix) }
  }
  if (url.startsWith('/vendor/')) {
    const suffix = url.slice('/vendor/'.length)
    if (suffix.includes('..')) return null
    return { path: join(threeRoot, 'build', suffix) }
  }
  if (url === '/asset.glb') return { path: output }
  return null
}

const server = createServer(async (request, response) => {
  try {
    const resolved = resolveRequest(request.url ?? '/')
    if (!resolved) {
      response.writeHead(404).end('not found')
      return
    }
    if (resolved.body) {
      response.writeHead(200, {
        'content-type': resolved.type,
        'content-length': resolved.body.length,
        'cache-control': 'no-store',
      })
      response.end(resolved.body)
      return
    }
    const info = await stat(resolved.path)
    response.writeHead(200, {
      'content-type': mime(resolved.path),
      'content-length': info.size,
      'cache-control': 'no-store',
    })
    createReadStream(resolved.path).pipe(response)
  } catch (error) {
    response.writeHead(500).end(String(error))
  }
})

await new Promise((resolveListen, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolveListen)
})

const address = server.address()
if (!address || typeof address === 'string')
  throw new Error('Could not bind loader smoke server')
const baseUrl = `http://127.0.0.1:${address.port}`
const consoleErrors = []
const pageErrors = []
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
    process.stderr.write(`[browser:${message.type()}] ${message.text()}\n`)
  })
  page.on('pageerror', (error) => {
    const value = error.stack ?? String(error)
    pageErrors.push(value)
    process.stderr.write(`[browser:pageerror] ${value}\n`)
  })
  page.on('requestfailed', (request) => {
    process.stderr.write(
      `[browser:requestfailed] ${request.url()} ${request.failure()?.errorText}\n`,
    )
  })
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 })
  await page.waitForFunction(
    () => window.__v7Result !== undefined || window.__v7Error !== undefined,
    null,
    { timeout: 240_000 },
  )
  const browserResult = await page.evaluate(() => ({
    result: window.__v7Result,
    error: window.__v7Error,
    userAgent: navigator.userAgent,
    webpDecoded: document
      .createElement('canvas')
      .toDataURL('image/webp')
      .startsWith('data:image/webp'),
    resources: performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith('.glb'))
      .map((entry) => ({
        name: entry.name.split('/').at(-1),
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
        durationMilliseconds: entry.duration,
      })),
  }))
  if (browserResult.error) throw new Error(browserResult.error)
  if (consoleErrors.length || pageErrors.length)
    throw new Error(
      `Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
    )
  if (!browserResult.webpDecoded)
    throw new Error('Chromium did not advertise WebP decoding')
  const row = browserResult.result
  if (
    row.root !== expected.root ||
    row.triangles !== expected.triangles ||
    row.meshes !== expected.meshes
  )
    throw new Error('Browser topology/root contract changed')
  if (row.decodedTextures.length !== expected.textures)
    throw new Error(`Expected ${expected.textures} unique decoded textures`)
  if (
    row.decodedTextures.some(
      (texture) => texture.width !== 2048 || texture.height !== 2048,
    )
  )
    throw new Error('Browser texture decode or 2K limit failed')
  if (
    !row.materials.some(
      (material) =>
        material.hasBaseColorMap &&
        material.hasNormalMap &&
        material.hasMetalnessMap &&
        material.hasRoughnessMap &&
        !material.transparent,
    )
  )
    throw new Error(
      'Opaque mapped marble material did not survive browser load',
    )
  await mkdir(dirname(reportPath), { recursive: true })
  const report = {
    schema: 1,
    purpose:
      'Actual Chromium load smoke using repository Three GLTFLoader without KTX2, Draco, or meshopt decoder configuration.',
    status: 'passed',
    browser: {
      userAgent: browserResult.userAgent,
      webpDecoded: browserResult.webpDecoded,
      consoleErrors,
      pageErrors,
    },
    loader: {
      module:
        'apps/beside-cue/node_modules/three/examples/jsm/loaders/GLTFLoader.js',
      threeRevision: row.threeRevision,
      ktx2LoaderConfigured: false,
      meshoptDecoderConfigured: false,
      dracoLoaderConfigured: false,
    },
    artifact: {
      file: output.slice(repo.length + 1),
      bytes: (await stat(output)).size,
      sha256: await sha256(output),
    },
    asset: row,
    resources: browserResult.resources,
    command:
      'rtk proxy timeout 300 node art/glass-adventure/platform-trials/v7/production/smoke_marble_dense_loader.mjs',
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(
    `V7_MARBLE_BROWSER_LOADER_SMOKE=${JSON.stringify(report)}\n`,
  )
} finally {
  if (browser) await browser.close()
  await new Promise((resolveClose) => server.close(resolveClose))
}
