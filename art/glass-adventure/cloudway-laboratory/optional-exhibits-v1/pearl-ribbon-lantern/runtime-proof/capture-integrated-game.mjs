import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const sourceRoot = path.resolve(
  process.env.GLASS_PEARL_LANTERN_SOURCE_ROOT ??
    path.join(
      process.env.HOME,
      'Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/optional-exhibits-v1/pearl-ribbon-lantern',
    ),
)
const proofDir = path.join(sourceRoot, 'proofs/integrated-game')
const url =
  process.env.PEARL_LANTERN_GAME_URL ??
  'http://127.0.0.1:5302/glass-game/?lab=creator-gallery'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const expectedAsset =
  '/games/cloudway-laboratory-v1/optional-exhibits/pearl-ribbon-lantern/pearl-ribbon-lantern-lod1.glb'

const diagnosticInstall = String.raw`
globalThis.__GLASS_RUNTIME_PROOF__ = {
  renderer,
  scene,
  camera: camera.camera,
  level,
  metrics: () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
  }),
  setVisible: (name, visible) => {
    const object = scene.getObjectByName(name)
    if (!object) return false
    object.visible = visible
    return true
  },
  measure: (name) => {
    const object = scene.getObjectByName(name)
    if (!object) return null
    const bounds = new Box3().setFromObject(object, true)
    const worldPosition = object.getWorldPosition(new Vector3())
    const worldScale = object.getWorldScale(new Vector3())
    const supportAnchor = scene.getObjectByName('PearlRibbonLanternSupportAnchor')
    const lightAnchor = scene.getObjectByName('PearlRibbonLanternLightAnchor')
    let meshes = 0
    let drawCalls = 0
    let triangles = 0
    let normalVertices = 0
    let invalidNormals = 0
    let shortestNormal = Infinity
    let longestNormal = 0
    const materials = []
    object.traverse((child) => {
      if (!child.isMesh) return
      meshes += 1
      const geometry = child.geometry
      const materialList = Array.isArray(child.material)
        ? child.material
        : [child.material]
      drawCalls += geometry.groups.length > 0
        ? geometry.groups.length
        : materialList.length
      const position = geometry.getAttribute('position')
      const normal = geometry.getAttribute('normal')
      triangles += geometry.index
        ? geometry.index.count / 3
        : (position?.count ?? 0) / 3
      if (normal) {
        normalVertices += normal.count
        for (let index = 0; index < normal.count; index += 1) {
          const x = normal.getX(index)
          const y = normal.getY(index)
          const z = normal.getZ(index)
          const length = Math.hypot(x, y, z)
          if (!Number.isFinite(length) || length < 0.5) invalidNormals += 1
          shortestNormal = Math.min(shortestNormal, length)
          longestNormal = Math.max(longestNormal, length)
        }
      } else {
        invalidNormals += position?.count ?? 1
      }
      for (const material of materialList)
        materials.push({
          name: material.name,
          type: material.type,
          transparent: material.transparent,
          baseColorMap: Boolean(material.map),
          normalMap: Boolean(material.normalMap),
          metalnessMap: Boolean(material.metalnessMap),
          roughnessMap: Boolean(material.roughnessMap),
        })
    })
    const point = (anchor) =>
      anchor ? anchor.getWorldPosition(new Vector3()).toArray() : null
    const platform = level.platforms.find(
      (candidate) => candidate.id === 'thaw-alcove-beacon-rest',
    )
    return {
      name: object.name,
      worldPosition: worldPosition.toArray(),
      worldScale: worldScale.toArray(),
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      supportAnchor: point(supportAnchor),
      lightAnchor: point(lightAnchor),
      platform: platform
        ? {
            id: platform.id,
            top: platform.top,
            minX: platform.minX,
            maxX: platform.maxX,
            minZ: platform.minZ,
            maxZ: platform.maxZ,
          }
        : null,
      meshes,
      drawCalls,
      triangles,
      normalVertices,
      invalidNormals,
      normalLengthRange: [
        Number.isFinite(shortestNormal) ? shortestNormal : null,
        longestNormal,
      ],
      materials,
    }
  },
}
`

const cameraOverride = String.raw`
const proofCamera = globalThis.__GLASS_PROOF_CAMERA__
if (proofCamera) {
  camera.camera.position.fromArray(proofCamera.position)
  camera.camera.up.set(0, 1, 0)
  camera.camera.lookAt(...proofCamera.target)
  camera.camera.updateMatrixWorld(true)
}
`

await mkdir(proofDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
const assetRequests = []
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('request', (request) => {
    if (request.url().includes('pearl-ribbon-lantern'))
      assetRequests.push(request.url())
  })
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (!requestUrl.pathname.endsWith('/glass-renderer.ts')) {
      await route.continue()
      return
    }
    const response = await route.fetch()
    let body = await response.text()
    const sceneMarker = 'scene.add(museum.root);'
    const cameraMarker =
      'camera.update(snapshot, cameraDt, presentationPaused);'
    if (!body.includes(sceneMarker) || !body.includes(cameraMarker))
      throw new Error(
        `The diagnostic renderer markers were absent from ${requestUrl}.`,
      )
    body = body
      .replace(sceneMarker, `${sceneMarker}\n${diagnosticInstall}`)
      .replace(cameraMarker, `${cameraMarker}\n${cameraOverride}`)
    await route.fulfill({ response, body })
  })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page
    .getByRole('button', { name: /The pearl alcove/ })
    .click({ timeout: 30_000 })
  const adventure = page.locator('[data-testid="glass-adventure"]')
  await adventure.waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="glass-adventure"]')
        ?.getAttribute('data-ready') === 'true',
    undefined,
    { timeout: 60_000 },
  )
  await page.waitForFunction(
    () =>
      globalThis.__GLASS_RUNTIME_PROOF__?.measure(
        'Cloudway_PearlRibbonLantern_OptionalExhibitV1',
      ) !== null,
    undefined,
    { timeout: 30_000 },
  )
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible())
    await page.addStyleTag({
      content:
        'div:has(> section[role="dialog"][aria-labelledby="glass-tutorial-title"]) { display: none !important; }',
    })

  await page.evaluate(() => {
    globalThis.__GLASS_PROOF_CAMERA__ = {
      position: [5.18, 1.48, 7.7],
      target: [3.51, 0.63, 9.55],
    }
  })
  await page.waitForTimeout(800)

  const canvas = page.locator('canvas[aria-label="Floating glass museum"]')
  await canvas.waitFor({ state: 'visible', timeout: 30_000 })
  const visibleMetrics = await page.evaluate(() =>
    globalThis.__GLASS_RUNTIME_PROOF__.metrics(),
  )
  const measurement = await page.evaluate(() =>
    globalThis.__GLASS_RUNTIME_PROOF__.measure(
      'Cloudway_PearlRibbonLantern_OptionalExhibitV1',
    ),
  )
  const hidden = await page.evaluate(() =>
    globalThis.__GLASS_RUNTIME_PROOF__.setVisible(
      'Cloudway_PearlRibbonLantern_OptionalExhibitV1',
      false,
    ),
  )
  if (!hidden)
    throw new Error('The installed lantern root could not be hidden.')
  await page.waitForTimeout(250)
  const hiddenMetrics = await page.evaluate(() =>
    globalThis.__GLASS_RUNTIME_PROOF__.metrics(),
  )
  await page.evaluate(() =>
    globalThis.__GLASS_RUNTIME_PROOF__.setVisible(
      'Cloudway_PearlRibbonLantern_OptionalExhibitV1',
      true,
    ),
  )
  await page.waitForTimeout(250)

  const output = path.join(proofDir, 'pearl-ribbon-lantern-creator-gallery.png')
  await page.screenshot({ path: output })
  const contents = await readFile(output)
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector(
      'canvas[aria-label="Floating glass museum"]',
    )
    const context = canvas?.getContext('webgl2')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    return {
      webgl2: Boolean(context),
      vendor:
        context && extension
          ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL)
          : null,
      renderer:
        context && extension
          ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
          : null,
      outputColorSpace:
        globalThis.__GLASS_RUNTIME_PROOF__.renderer.outputColorSpace,
      toneMapping: globalThis.__GLASS_RUNTIME_PROOF__.renderer.toneMapping,
      exposure: globalThis.__GLASS_RUNTIME_PROOF__.renderer.toneMappingExposure,
    }
  })
  const costDelta = {
    drawCalls: visibleMetrics.drawCalls - hiddenMetrics.drawCalls,
    triangles: visibleMetrics.triangles - hiddenMetrics.triangles,
    textures: visibleMetrics.textures - hiddenMetrics.textures,
    geometries: visibleMetrics.geometries - hiddenMetrics.geometries,
  }
  if (
    measurement.drawCalls !== 1 ||
    measurement.triangles !== 36_000 ||
    costDelta.drawCalls !== 3 ||
    costDelta.triangles !== 108_000
  )
    throw new Error(
      `Installed lantern cost mismatch: ${JSON.stringify({
        measurement,
        visibleMetrics,
        hiddenMetrics,
        costDelta,
      })}`,
    )
  if (
    measurement.invalidNormals !== 0 ||
    !measurement.materials.every(
      (material) =>
        material.normalMap &&
        material.baseColorMap &&
        material.metalnessMap &&
        material.roughnessMap,
    )
  )
    throw new Error(
      `Installed lantern material or normals failed: ${JSON.stringify(
        measurement,
      )}`,
    )
  if (
    Math.abs(measurement.worldPosition[0] - 3.51) > 0.001 ||
    Math.abs(measurement.worldPosition[1]) > 0.001 ||
    Math.abs(measurement.worldPosition[2] - 9.55) > 0.001 ||
    Math.abs(measurement.bounds.min[1] - measurement.platform.top) > 0.015 ||
    Math.abs(measurement.supportAnchor[1] - measurement.platform.top) > 0.001
  )
    throw new Error(
      `Installed lantern support mismatch: ${JSON.stringify(measurement)}`,
    )
  if (
    !assetRequests.some((requestUrl) => requestUrl.includes(expectedAsset)) ||
    assetRequests.some((requestUrl) => requestUrl.includes('lod0.glb'))
  )
    throw new Error(
      `The game did not load only the LOD1 runtime: ${assetRequests.join(
        '\n',
      )}`,
    )
  if (errors.length > 0)
    throw new Error(`The integrated game logged errors:\n${errors.join('\n')}`)

  const report = {
    schema: 1,
    status: 'installed creator-gallery runtime proof passed',
    url,
    viewport: [1280, 720],
    renderer,
    assetRequests,
    measurement,
    visibleMetrics,
    hiddenMetrics,
    surfacePrimitiveCost: {
      drawCalls: measurement.drawCalls,
      triangles: measurement.triangles,
    },
    installedCostDelta: costDelta,
    screenshot: {
      file: 'proofs/integrated-game/pearl-ribbon-lantern-creator-gallery.png',
      bytes: contents.length,
      sha256: hash(contents),
    },
  }
  await writeFile(
    path.join(sourceRoot, 'integrated-game-proof.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  process.stdout.write(
    `PEARL_LANTERN_INTEGRATED_GAME_PROOF=${JSON.stringify(report)}\n`,
  )
} finally {
  await browser.close()
}
