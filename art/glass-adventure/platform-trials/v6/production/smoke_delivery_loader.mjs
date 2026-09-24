#!/usr/bin/env node
// Load the V6 delivery GLBs through the repository's actual Three GLTFLoader in Chromium.

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const v6 = resolve(here, '..')
const threeRoot = join(repo, 'apps/beside-cue/node_modules/three')
const outputs = {
  frost: join(v6, 'exports/delivery/cloudway-frost-v6-delivery-2k.glb'),
  glide: join(v6, 'exports/delivery/cloudway-glide-v6-delivery-2k.glb'),
}
const expected = {
  frost: { root: 'Cloudway_Frost', triangles: 634_512, meshes: 13 },
  glide: { root: 'Cloudway_Glide', triangles: 147_250, meshes: 11 },
}
const reportPath = join(
  v6,
  'proofs/diagnostics/delivery-browser-loader-smoke.json',
)

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

const assets = ${JSON.stringify(expected)}
const result = { threeRevision: THREE.REVISION, assets: [] }
const textureSlots = [
  'map', 'normalMap', 'metalnessMap', 'roughnessMap', 'transmissionMap',
  'alphaMap', 'aoMap', 'clearcoatMap', 'clearcoatNormalMap',
]

try {
  for (const [asset, contract] of Object.entries(assets)) {
    console.log('V6 loader start', asset)
    const gltf = await new GLTFLoader().loadAsync('/assets/' + asset + '.glb')
    console.log('V6 loader parsed', asset)
    const root = gltf.scene.getObjectByName(contract.root)
    if (!root) throw new Error(asset + ': missing root ' + contract.root)
    let triangles = 0
    let meshes = 0
    let transmissiveMaterials = 0
    let metallicMaterials = 0
    const textures = new Set()
    root.traverse((object) => {
      if (!object.isMesh) return
      meshes += 1
      const geometry = object.geometry
      triangles += geometry.index
        ? geometry.index.count / 3
        : geometry.getAttribute('position').count / 3
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if ((material.transmission ?? 0) > 0) transmissiveMaterials += 1
        if ((material.metalness ?? 0) > 0.5) metallicMaterials += 1
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
      }
    })
    const bounds = new THREE.Box3().setFromObject(root)
    result.assets.push({
      asset,
      root: root.name,
      meshes,
      triangles,
      transmissiveMaterials,
      metallicMaterials,
      decodedTextures,
      boundsThreeYUpMetres: {
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
      },
    })
    console.log('V6 loader audited', asset)
  }
  window.__v6Result = result
} catch (error) {
  window.__v6Error = error?.stack ?? String(error)
}
</script>`

const resolveRequest = (url) => {
  if (url === '/' || url === '/index.html') {
    return { body: Buffer.from(html), type: 'text/html; charset=utf-8' }
  }
  if (url === '/vendor/three.module.js') {
    return { path: join(threeRoot, 'build/three.module.js') }
  }
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
  const match = /^\/assets\/(frost|glide)\.glb$/.exec(url)
  if (match) return { path: outputs[match[1]] }
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
  page.on('response', (response) => {
    if (response.status() >= 400) {
      process.stderr.write(
        `[browser:response] ${response.status()} ${response.url()}\n`,
      )
    }
  })
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 })
  await page.waitForFunction(
    () => window.__v6Result !== undefined || window.__v6Error !== undefined,
    null,
    { timeout: 240_000 },
  )
  const browserResult = await page.evaluate(() => ({
    result: window.__v6Result,
    error: window.__v6Error,
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
      })),
  }))
  if (browserResult.error) throw new Error(browserResult.error)
  if (consoleErrors.length || pageErrors.length) {
    throw new Error(
      `Browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
    )
  }
  if (!browserResult.webpDecoded)
    throw new Error('Chromium did not advertise WebP decoding')
  for (const row of browserResult.result.assets) {
    const contract = expected[row.asset]
    if (
      row.root !== contract.root ||
      row.triangles !== contract.triangles ||
      row.meshes !== contract.meshes
    ) {
      throw new Error(`${row.asset}: browser topology/root contract changed`)
    }
    if (row.transmissiveMaterials < 1 || row.metallicMaterials < 1) {
      throw new Error(
        `${row.asset}: browser material extensions did not survive loading`,
      )
    }
    if (row.decodedTextures.length < 6)
      throw new Error(`${row.asset}: expected six decoded textures`)
    if (
      row.decodedTextures.some(
        (texture) =>
          !texture.width ||
          !texture.height ||
          texture.width > 2048 ||
          texture.height > 2048,
      )
    ) {
      throw new Error(`${row.asset}: texture decoding or 2K limit failed`)
    }
  }
  const artifactRows = await Promise.all(
    Object.entries(outputs).map(async ([asset, path]) => ({
      asset,
      file: path.slice(repo.length + 1),
      bytes: (await stat(path)).size,
      sha256: await sha256(path),
    })),
  )
  const report = {
    schema: 1,
    purpose:
      'Actual Chromium load smoke using the repository Three 0.185.1 GLTFLoader without KTX2, Draco, or meshopt decoder configuration.',
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
      threeRevision: browserResult.result.threeRevision,
      ktx2LoaderConfigured: false,
      meshoptDecoderConfigured: false,
      dracoLoaderConfigured: false,
    },
    artifacts: artifactRows,
    assets: browserResult.result.assets,
    resources: browserResult.resources,
    command:
      'rtk proxy timeout 300 node art/glass-adventure/platform-trials/v6/production/smoke_delivery_loader.mjs',
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`V6_BROWSER_LOADER_SMOKE=${JSON.stringify(report)}\n`)
} finally {
  if (browser) await browser.close()
  await new Promise((resolveClose) => server.close(resolveClose))
}
