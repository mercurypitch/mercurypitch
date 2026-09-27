import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const sourceRoot = path.resolve(
  process.env.GLASS_CRYSTAL_INTERIOR_SOURCE_ROOT ??
    path.join(
      process.env.HOME,
      'Documents/root/5-Creative/besidecue/assets/glass-adventure/crystal-interiors/v1',
    ),
)
const proofDir = path.join(sourceRoot, 'proofs/integrated-game')
const url =
  process.env.CRYSTAL_INTERIOR_GALLERY_URL ??
  'http://127.0.0.1:5302/glass-game/?lab=creator-gallery'
const preset = 'frost-roots'
const rootName = `crystal-interior__${preset}`
const hash = (value) => createHash('sha256').update(value).digest('hex')

const diagnosticInstall = String.raw`
globalThis.__CRYSTAL_GALLERY_PROOF__ = {
  renderer,
  scene,
  camera: camera.camera,
  level,
  deckVisibility: new Map(),
  effectVisibility: new Map(),
  measure: (name) => {
    const object = scene.getObjectByName(name)
    if (!object) return null
    const bounds = new Box3().setFromObject(object, true)
    const center = bounds.getCenter(new Vector3())
    const projectedCenter = center.clone().project(camera.camera)
    let ancestorsVisible = true
    let ancestor = object
    while (ancestor) {
      ancestorsVisible = ancestorsVisible && ancestor.visible
      ancestor = ancestor.parent
    }
    let drawCalls = 0
    let triangles = 0
    let points = 0
    const renderObjects = []
    object.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return
      const geometry = child.geometry
      const position = geometry.getAttribute('position')
      const materialList = Array.isArray(child.material)
        ? child.material
        : [child.material]
      drawCalls += geometry.groups.length > 0
        ? geometry.groups.length
        : materialList.length
      if (child.isMesh)
        triangles += geometry.index
          ? geometry.index.count / 3
          : (position?.count ?? 0) / 3
      else points += position?.count ?? 0
      renderObjects.push({
        name: child.name,
        kind: child.isMesh ? 'mesh' : 'points',
        materials: materialList.map((material) => ({
          name: material.name,
          type: material.type,
          transparent: material.transparent,
          depthTest: material.depthTest,
          depthWrite: material.depthWrite,
          toneMapped: material.toneMapped,
        })),
      })
    })
    return {
      name: object.name,
      ancestorsVisible,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      center: center.toArray(),
      projectedCenter: projectedCenter.toArray(),
      drawCalls,
      triangles,
      points,
      renderObjects,
      levelId: level.id,
      presentation: level.presentation?.crystalInteriors ?? [],
      frameMetrics: {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
      },
      camera: {
        position: camera.camera.position.toArray(),
        target: globalThis.__CRYSTAL_PROOF_CAMERA__?.target ?? null,
      },
    }
  },
  inspect: (name) => {
    const object = scene.getObjectByName(name)
    if (!object) return null
    const adapter = object.parent
    const effectMaterials = []
    const deckMaterials = []
    const seenDeckMaterials = new Set()
    const serialiseUniform = (value) => {
      if (typeof value === 'number' || typeof value === 'boolean') return value
      if (value?.isColor) return value.toArray()
      if (value?.toArray) return value.toArray()
      return null
    }
    object.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      for (const material of materials)
        effectMaterials.push({
          object: child.name,
          name: material.name,
          type: material.type,
          renderOrder: child.renderOrder,
          transparent: material.transparent,
          depthTest: material.depthTest,
          depthWrite: material.depthWrite,
          toneMapped: material.toneMapped,
          fog: material.fog ?? false,
          uniforms: Object.fromEntries(
            Object.entries(material.uniforms ?? {}).map(([key, uniform]) => [
              key,
              serialiseUniform(uniform.value),
            ]),
          ),
        })
    })
    adapter?.traverse((child) => {
      if ((!child.isMesh && !child.isPoints) || object.getObjectById(child.id))
        return
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      for (const material of materials) {
        if (seenDeckMaterials.has(material.uuid)) continue
        seenDeckMaterials.add(material.uuid)
        deckMaterials.push({
          object: child.name,
          name: material.name,
          type: material.type,
          transparent: material.transparent,
          opacity: material.opacity,
          depthTest: material.depthTest,
          depthWrite: material.depthWrite,
          toneMapped: material.toneMapped,
          fog: material.fog,
          transmission: material.transmission ?? 0,
          thickness: material.thickness ?? 0,
          attenuationDistance: material.attenuationDistance ?? null,
          attenuationColor: material.attenuationColor?.toArray() ?? null,
          color: material.color?.toArray() ?? null,
          emissive: material.emissive?.toArray() ?? null,
          emissiveIntensity: material.emissiveIntensity ?? null,
          roughness: material.roughness ?? null,
          metalness: material.metalness ?? null,
          backdropFogInstalled: material
            .customProgramCacheKey()
            .includes('backdrop-fog-v1'),
        })
      }
    })
    const bounds = new Box3().setFromObject(object, true)
    const center = bounds.getCenter(new Vector3())
    const cameraDistance = camera.camera.position.distanceTo(center)
    const fogNear = scene.fog?.near ?? null
    const fogFar = scene.fog?.far ?? null
    let fogFactor = null
    if (fogNear !== null && fogFar !== null) {
      const progress = Math.max(
        0,
        Math.min(1, (cameraDistance - fogNear) / (fogFar - fogNear)),
      )
      fogFactor = progress * progress * (3 - 2 * progress)
    }
    return {
      adapter: adapter?.name ?? null,
      adapterWorldPosition: adapter?.getWorldPosition(new Vector3()).toArray() ?? null,
      effectLocalPosition: object.position.toArray(),
      effectWorldCenter: center.toArray(),
      cameraDistance,
      sceneFog: {
        type: scene.fog?.type ?? null,
        near: fogNear,
        far: fogFar,
        color: scene.fog?.color?.toArray() ?? null,
        factorAtEffectCenter: fogFactor,
      },
      effectMaterials,
      deckMaterials,
    }
  },
  setEffectVisible: (name, visible) => {
    const proof = globalThis.__CRYSTAL_GALLERY_PROOF__
    const object = scene.getObjectByName(name)
    if (!object) throw new Error('Missing effect ' + name)
    object.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return
      if (!proof.effectVisibility.has(child))
        proof.effectVisibility.set(child, child.visible)
      child.visible = visible ? proof.effectVisibility.get(child) : false
    })
  },
  setDeckVisible: (name, visible) => {
    const proof = globalThis.__CRYSTAL_GALLERY_PROOF__
    const object = scene.getObjectByName(name)
    if (!object) throw new Error('Missing effect ' + name)
    const adapter = object.parent
    if (!adapter) throw new Error('Effect has no scroll adapter parent.')
    adapter.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return
      let ancestor = child
      while (ancestor) {
        if (ancestor === object) return
        ancestor = ancestor.parent
      }
      if (!proof.deckVisibility.has(child))
        proof.deckVisibility.set(child, child.visible)
      child.visible = visible ? proof.deckVisibility.get(child) : false
    })
  },
}
`

const cameraOverride = String.raw`
const proofCamera = globalThis.__CRYSTAL_PROOF_CAMERA__
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
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  page.setDefaultTimeout(90_000)
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
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
  await page.getByRole('button', { name: /Frost roots/ }).click()
  await page.waitForFunction(
    (expectedRoot) =>
      document
        .querySelector('[data-testid="glass-adventure"]')
        ?.getAttribute('data-ready') === 'true' &&
      globalThis.__CRYSTAL_GALLERY_PROOF__?.measure(expectedRoot) !== null,
    rootName,
    { timeout: 90_000 },
  )
  await page.addStyleTag({
    content:
      'div:has(> section[role="dialog"][aria-labelledby="glass-tutorial-title"]) { display: none !important; }',
  })
  await page.evaluate(() => {
    globalThis.__CRYSTAL_PROOF_CAMERA__ = {
      position: [2.0, 2.05, -7.65],
      target: [0.15, -0.03, -6.098017956],
    }
  })
  await page.waitForTimeout(1_200)

  const measurement = await page.evaluate(
    (expectedRoot) =>
      globalThis.__CRYSTAL_GALLERY_PROOF__.measure(expectedRoot),
    rootName,
  )
  if (
    measurement.levelId !== 'cloudway-crystal-interior-frost-roots' ||
    measurement.presentation.length !== 1 ||
    measurement.presentation[0]?.preset !== preset ||
    measurement.presentation[0]?.platformId !== 'scroll-deck'
  )
    throw new Error(
      `The Creator Gallery mounted the wrong study: ${JSON.stringify(
        measurement,
      )}`,
    )
  if (
    !measurement.ancestorsVisible ||
    Math.abs(measurement.projectedCenter[0]) > 1 ||
    Math.abs(measurement.projectedCenter[1]) > 1 ||
    measurement.projectedCenter[2] < -1 ||
    measurement.projectedCenter[2] > 1
  )
    throw new Error(
      `The installed Frost roots effect is outside the proof view: ${JSON.stringify(
        measurement,
      )}`,
    )
  if (
    measurement.drawCalls !== 2 ||
    measurement.triangles !== 980 ||
    !measurement.renderObjects.some(
      (object) =>
        object.kind === 'mesh' &&
        object.materials.every(
          (material) =>
            material.transparent === false &&
            material.depthTest === true &&
            material.depthWrite === true &&
            material.toneMapped === true,
        ),
    )
  )
    throw new Error(
      `The installed Frost roots runtime contract changed: ${JSON.stringify(
        measurement,
      )}`,
    )
  if (errors.length > 0)
    throw new Error(`The Creator Gallery logged errors:\n${errors.join('\n')}`)

  const diagnostic = await page.evaluate(
    (expectedRoot) =>
      globalThis.__CRYSTAL_GALLERY_PROOF__.inspect(expectedRoot),
    rootName,
  )
  const outputOn = path.join(proofDir, 'frost-roots-creator-gallery.png')
  const outputOff = path.join(
    proofDir,
    'frost-roots-creator-gallery-effect-off.png',
  )
  const outputIsolated = path.join(
    proofDir,
    'frost-roots-creator-gallery-effect-only.png',
  )
  await page.screenshot({ path: outputOn, timeout: 90_000 })
  await page.evaluate(
    (expectedRoot) =>
      globalThis.__CRYSTAL_GALLERY_PROOF__.setEffectVisible(
        expectedRoot,
        false,
      ),
    rootName,
  )
  await page.waitForTimeout(100)
  await page.screenshot({ path: outputOff, timeout: 90_000 })
  await page.evaluate((expectedRoot) => {
    globalThis.__CRYSTAL_GALLERY_PROOF__.setEffectVisible(expectedRoot, true)
    globalThis.__CRYSTAL_GALLERY_PROOF__.setDeckVisible(expectedRoot, false)
  }, rootName)
  await page.waitForTimeout(100)
  await page.screenshot({ path: outputIsolated, timeout: 90_000 })
  await page.evaluate(
    (expectedRoot) =>
      globalThis.__CRYSTAL_GALLERY_PROOF__.setDeckVisible(expectedRoot, true),
    rootName,
  )
  const [contentsOn, contentsOff, contentsIsolated] = await Promise.all([
    readFile(outputOn),
    readFile(outputOff),
    readFile(outputIsolated),
  ])
  const report = {
    schema: 1,
    status: 'Creator Gallery Frost roots integration A/B diagnostic captured',
    url,
    selectedCard: 'Frost roots',
    viewport: [1280, 720],
    measurement,
    diagnostic,
    screenshots: {
      installed: {
        file: 'proofs/integrated-game/frost-roots-creator-gallery.png',
        bytes: contentsOn.length,
        sha256: hash(contentsOn),
      },
      effectOff: {
        file: 'proofs/integrated-game/frost-roots-creator-gallery-effect-off.png',
        bytes: contentsOff.length,
        sha256: hash(contentsOff),
      },
      effectOnly: {
        file: 'proofs/integrated-game/frost-roots-creator-gallery-effect-only.png',
        bytes: contentsIsolated.length,
        sha256: hash(contentsIsolated),
      },
    },
    scope:
      'Browser-only camera framing; the real game renderer, accepted scroll GLB, installed effect, materials, animation loop, and presentation data are unchanged.',
  }
  await writeFile(
    path.join(sourceRoot, 'creator-gallery-proof.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  process.stdout.write(
    `CRYSTAL_INTERIOR_GALLERY_PROOF=${JSON.stringify(report)}\n`,
  )
} finally {
  await browser.close()
}
