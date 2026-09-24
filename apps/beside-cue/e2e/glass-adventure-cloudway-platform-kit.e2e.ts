// Current Cloudway kit proof — exact public bytes load in the real game with authored PBR maps, instancing and collision.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { CLOUDWAY_CURRENT_TRIAL, CLOUDWAY_LAYOUT_AUDITIONS, } from '../../../packages/glass-game/src/content/cloudway-layouts'
import { MARBLE_ELEMENT_COUNT, advanceToCameraMode, captureInstancedFrame, driveTo, installCloudwayVisit as installVisit, leapToward, measureNoRasterFrameTime, metric, restoreInstancedRaycasts, restoreRasterOutput, setHeading, settleWithin, submissionReceipt, suspendInstancedRaycasts, suspendRasterOutput, } from './helpers/cloudway-platform-proof'

test.use({
  viewport: { width: 1024, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(600_000)

const MANIFEST = JSON.parse(
  readFileSync(
    new URL('../public/games/cloudway-v7/manifest.json', import.meta.url),
    'utf8',
  ),
) as {
  bundle: { bytes: number; sha256: string }
}
const KIT_URL = '/games/cloudway-v7/cloudway-platform-kit-v7.glb'
const CRESCENT = CLOUDWAY_LAYOUT_AUDITIONS.crescent
const COMPARISON_KIT = process.env.CLOUDWAY_V7_COMPARISON_KIT
const RENDER_PROOF = process.env.CLOUDWAY_V7_RENDER_PROOF === '1'

test('the real renderer submits only near V7/V6 platforms and crosses the first recovery @smoke', async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await installVisit(page, { realRendering: false })
  await page.clock.install()
  const publicKit = await request.get(KIT_URL)
  expect(publicKit.status()).toBe(200)
  const publicBytes = await publicKit.body()
  expect(publicBytes.byteLength).toBe(MANIFEST.bundle.bytes)
  expect(createHash('sha256').update(publicBytes).digest('hex')).toBe(
    MANIFEST.bundle.sha256,
  )
  const kitResponse = page.waitForResponse((response) =>
    response.url().endsWith(KIT_URL),
  )
  const response = await page.goto('/glass-game/?layout=cloudway-crescent', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  const loadedKit = await kitResponse
  expect(loadedKit.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 90_000 },
  )
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible()) await skipTutorial.click()
  expect(errors).toEqual([])
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  const marbleInstances = CRESCENT.level.platforms.filter(
    (platform) => platform.renderId === 'cloudway-marble',
  ).length
  expect(marbleInstances).toBe(6)
  const submissionProof: Record<string, unknown> = {}
  const arrivalDefault = await captureInstancedFrame(page)
  submissionProof.arrivalDefault = submissionReceipt(arrivalDefault)
  submissionProof.arrivalNoRasterFrameTime =
    await measureNoRasterFrameTime(page)
  const arrivalScreenMarble = arrivalDefault.draws.filter(
    (draw) =>
      draw.target === 'screen' && draw.elements === MARBLE_ELEMENT_COUNT,
  )
  expect(arrivalScreenMarble).toHaveLength(1)
  expect(arrivalScreenMarble[0]!.instances).toBeGreaterThan(0)
  expect(arrivalScreenMarble[0]!.instances).toBeLessThan(marbleInstances)
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const viewportBounds = await viewport.boundingBox()
  if (viewportBounds === null) throw new Error('Missing Cloudway viewport.')
  await page.mouse.move(
    viewportBounds.x + viewportBounds.width * 0.5,
    viewportBounds.y + viewportBounds.height * 0.45,
  )
  await page.mouse.wheel(0, -5_000)
  await page.clock.runFor(600)
  submissionProof.arrivalZoomedIn = submissionReceipt(
    await captureInstancedFrame(page),
  )
  submissionProof.arrivalZoomedInNoRasterFrameTime =
    await measureNoRasterFrameTime(page)
  await page.mouse.wheel(0, 5_000)
  await page.clock.runFor(600)
  submissionProof.arrivalZoomedOut = submissionReceipt(
    await captureInstancedFrame(page),
  )
  submissionProof.arrivalZoomedOutNoRasterFrameTime =
    await measureNoRasterFrameTime(page)
  await page.mouse.wheel(0, -1_250)
  await page.clock.runFor(600)

  const arrivalExhibit = CRESCENT.level.breakables[0]!
  await driveTo(page, arrivalExhibit.anchor, {
    jump: false,
    tolerance: 0.12,
  })
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
  await page.keyboard.press('KeyF')
  await expect(
    page.getByLabel('Voice challenge', { exact: true }),
  ).toHaveAttribute('data-voice-mode', /permission|reference|singing/, {
    timeout: 20_000,
  })
  await advanceToCameraMode(page, 'holding')
  submissionProof.arrivalChallenge = submissionReceipt(
    await captureInstancedFrame(page),
  )
  submissionProof.arrivalChallengeNoRasterFrameTime =
    await measureNoRasterFrameTime(page)
  await suspendInstancedRaycasts(page)
  submissionProof.arrivalChallengeWithoutInstancedRaycastsFrameTime =
    await measureNoRasterFrameTime(page)
  await restoreInstancedRaycasts(page)
  await page
    .getByLabel('Voice challenge', { exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await advanceToCameraMode(page, 'exploration')
  const submissionPath = testInfo.outputPath(
    'cloudway-v7-platform-submissions.json',
  )
  writeFileSync(submissionPath, `${JSON.stringify(submissionProof, null, 2)}\n`)
  await testInfo.attach('cloudway-v7-platform-submissions', {
    path: submissionPath,
    contentType: 'application/json',
  })

  const arrivalWaypoint = CRESCENT.route.waypoints[0]!
  const arrivalPlatform = CRESCENT.level.platforms.find(
    (platform) => platform.id === arrivalWaypoint.platformId,
  )!
  const frostOne = CRESCENT.route.waypoints[1]!
  const frostTwo = CRESCENT.route.waypoints[2]!
  const frostCatch = CRESCENT.route.waypoints[3]!
  expect(
    await leapToward(
      page,
      {
        x: arrivalWaypoint.x,
        z:
          arrivalPlatform.minZ +
          (arrivalPlatform.maxZ - arrivalPlatform.minZ) * 0.72,
      },
      (position) =>
        position.x >= arrivalPlatform.minX &&
        position.x <= arrivalPlatform.maxX &&
        position.z >= arrivalPlatform.minZ &&
        position.z <= arrivalPlatform.maxZ,
    ),
    'Merc should jump and settle back onto the V7 Marble arrival surface.',
  ).toBe(true)
  await setHeading(
    page,
    Math.atan2(
      -(frostOne.x - arrivalWaypoint.x),
      -(frostOne.z - arrivalWaypoint.z),
    ),
  )
  await page.clock.runFor(64)
  await driveTo(page, frostOne, { jump: true, tolerance: 0.3 })
  expect(await metric(page, 'player-y')).toBeGreaterThanOrEqual(0)
  await setHeading(
    page,
    Math.atan2(-(frostTwo.x - frostOne.x), -(frostTwo.z - frostOne.z)),
  )
  await page.clock.runFor(64)
  await driveTo(page, frostTwo, { jump: true, tolerance: 0.3 })
  await driveTo(page, frostCatch, { jump: true, tolerance: 0.3 })
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    'cloudway-checkpoint-frost-catch',
  )
  await setHeading(
    page,
    Math.atan2(
      -(CRESCENT.route.waypoints[4]!.x - frostCatch.x),
      -(CRESCENT.route.waypoints[4]!.z - frostCatch.z),
    ),
  )
  await page.clock.runFor(64)
  expect(errors).toEqual([])
})

test('renders the 1K Marble at the overview and closest supported zoom', async ({
  page,
}, testInfo) => {
  test.skip(
    !RENDER_PROOF,
    'Set CLOUDWAY_V7_RENDER_PROOF=1 for the one-off real-pixel proof.',
  )
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await installVisit(page, { realRendering: RENDER_PROOF })
  await page.clock.install()
  const response = await page.goto('/glass-game/?layout=cloudway-current', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 90_000,
  })
  await expect(adventure).toHaveAttribute(
    'data-level-id',
    CLOUDWAY_CURRENT_TRIAL.id,
  )
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible()) await skipTutorial.click()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  await captureInstancedFrame(page)
  await page.screenshot({
    path: testInfo.outputPath('cloudway-v7-route-overview.png'),
  })

  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing Cloudway viewport.')
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.45,
  )
  if (RENDER_PROOF) await suspendRasterOutput(page)
  await page.mouse.wheel(0, -5_000)
  await page.clock.runFor(600)
  await restoreRasterOutput(page)
  await captureInstancedFrame(page)
  await page.screenshot({
    path: testInfo.outputPath('cloudway-v7-arrival-zoomed-in.png'),
  })
  expect(errors).toEqual([])
})

test('captures the source-equivalent 2K Marble at the same gameplay cameras', async ({
  page,
}, testInfo) => {
  test.skip(
    COMPARISON_KIT === undefined,
    'Set CLOUDWAY_V7_COMPARISON_KIT for the one-off 1K/2K visual proof.',
  )
  if (COMPARISON_KIT === undefined) return
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await installVisit(page)
  await page.route(`**${KIT_URL}`, (route) => {
    if (COMPARISON_KIT.startsWith('/'))
      return route.continue({
        url: new URL(COMPARISON_KIT, route.request().url()).href,
      })
    return route.fulfill({
      path: COMPARISON_KIT,
      contentType: 'model/gltf-binary',
    })
  })
  await page.clock.install()
  const response = await page.goto('/glass-game/?layout=cloudway-crescent', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 90_000 },
  )
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible()) await skipTutorial.click()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  await captureInstancedFrame(page)
  await page.screenshot({
    path: testInfo.outputPath('cloudway-v7-2k-route-overview.png'),
  })
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing Cloudway viewport.')
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.45,
  )
  await suspendRasterOutput(page)
  await page.mouse.wheel(0, -5_000)
  await page.clock.runFor(600)
  await restoreRasterOutput(page)
  await captureInstancedFrame(page)
  await page.screenshot({
    path: testInfo.outputPath('cloudway-v7-2k-arrival-zoomed-in.png'),
  })
  expect(errors).toEqual([])
})

test('live input boards and rides the preserved V6 Glide surface to its safe rest @smoke', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await installVisit(page, { realRendering: RENDER_PROOF })
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    {
      key: `beside-cue:glass-adventure:progress:${CRESCENT.saveId}`,
      value: {
        version: 2,
        levelId: CRESCENT.saveId,
        checkpointId: 'cloudway-checkpoint-frost-catch',
        completedBreakableIds: [],
        finished: false,
      },
    },
  )
  await page.clock.install()
  const response = await page.goto('/glass-game/?layout=cloudway-crescent', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute(
    'data-loading-phase',
    'awaiting-first-frame',
    { timeout: 90_000 },
  )
  for (let frame = 0; frame < 120; frame++) {
    if ((await adventure.getAttribute('data-ready')) === 'true') break
    await page.clock.runFor(32)
  }
  await expect(adventure).toHaveAttribute('data-ready', 'true')
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible()) await skipTutorial.click()
  const platformEpoch = await page.evaluate(() => performance.now())
  await expect(adventure).toHaveAttribute(
    'data-checkpoint',
    'cloudway-checkpoint-frost-catch',
  )
  if (RENDER_PROOF) await suspendRasterOutput(page)
  const glideDockWest = CRESCENT.route.waypoints[4]!
  const glideRaft = CRESCENT.route.waypoints[5]!
  const glideDockEast = CRESCENT.route.waypoints[6]!
  const glideDockWestPlatform = CRESCENT.level.platforms.find(
    (platform) => platform.id === glideDockWest.platformId,
  )!
  const glideEastGap = CRESCENT.level.intentionalGaps!.find(
    (gap) => gap.id === 'cloudway-gap-raft-dock-east',
  )!
  const glideRunUp = {
    x: glideDockWest.x,
    z: glideDockWestPlatform.minZ + 0.75,
  }
  await driveTo(page, glideDockWest, { jump: false, tolerance: 0.22 })
  if (RENDER_PROOF) {
    await restoreRasterOutput(page)
    await setHeading(
      page,
      Math.atan2(
        -(glideRaft.x - glideDockWest.x),
        -(glideRaft.z - glideDockWest.z),
      ),
    )
    await page.clock.runFor(64)
    await page.screenshot({
      path: testInfo.outputPath('cloudway-v7-glide-gameplay-close.png'),
    })
    await suspendRasterOutput(page)
  }

  let boardedGlide = false
  const glideAttempts: {
    crossedGap: boolean
    settled: boolean
    x: number
    y: number
    z: number
  }[] = []
  for (let attempt = 0; attempt < 2 && !boardedGlide; attempt++) {
    await driveTo(page, glideDockWest, { jump: false, tolerance: 0.22 })
    const elapsed =
      (await page.evaluate(() => performance.now())) - platformEpoch
    const glideCycleMs = 2 * (1_350 + 2_600)
    const phase = ((elapsed % glideCycleMs) + glideCycleMs) % glideCycleMs
    await page.clock.runFor(phase < 200 ? 40 : glideCycleMs - phase + 40)
    await driveTo(page, glideRunUp, { jump: false, tolerance: 0.14 })
    const crossedGap = await leapToward(
      page,
      glideRaft,
      (position) => position.z >= 13.48,
      (position) => position.z >= glideDockWestPlatform.maxZ - 0.22,
    )
    if (crossedGap)
      boardedGlide = await settleWithin(
        page,
        (position) => position.z >= 13.5 && position.z <= 17.25,
      )
    glideAttempts.push({
      crossedGap,
      settled: boardedGlide,
      x: await metric(page, 'player-x'),
      y: await metric(page, 'player-y'),
      z: await metric(page, 'player-z'),
    })
    if (!boardedGlide) {
      await settleWithin(
        page,
        (position) => position.z >= 8.5 && position.z <= 13,
      )
    }
  }
  expect(
    boardedGlide,
    `Merc should board the moving V6 Glide surface: ${JSON.stringify(glideAttempts)}`,
  ).toBe(true)

  let raftReachedEast = false
  for (let frame = 0; frame < 300; frame++) {
    await page.clock.runFor(32)
    if ((await metric(page, 'player-z')) >= 15.55) {
      raftReachedEast = true
      break
    }
  }
  expect(raftReachedEast, 'The V6 Glide surface should carry Merc east.').toBe(
    true,
  )
  expect(
    await leapToward(
      page,
      glideDockEast,
      (position) => position.z >= 17.82,
      (position) => position.z >= glideEastGap.minZ - 0.23,
    ),
    'Merc should jump from the V6 Glide surface to the east rest.',
  ).toBe(true)
  expect(
    await settleWithin(
      page,
      (position) => position.z >= 17.65 && position.z <= 20.45,
    ),
    'Merc should settle on the east rest after the Glide crossing.',
  ).toBe(true)
  await driveTo(page, glideDockEast, { jump: false, tolerance: 0.28 })
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    'cloudway-checkpoint-glide-east',
  )
  if (RENDER_PROOF) {
    await restoreRasterOutput(page)
    await setHeading(
      page,
      Math.atan2(
        -(glideRaft.x - glideDockEast.x),
        -(glideRaft.z - glideDockEast.z),
      ),
    )
    await page.clock.runFor(64)
    await page.screenshot({
      path: testInfo.outputPath('cloudway-v7-glide-crossed.png'),
    })
  }
  expect(errors).toEqual([])
})

test('plain GLTFLoader retains the current PBR channels and exact collider roots', async ({
  page,
}) => {
  await page.goto('/?devSeed', { waitUntil: 'domcontentloaded' })
  const audit = await page.evaluate(async (url) => {
    const modulePath = '/@id/three/addons/loaders/GLTFLoader.js'
    const { GLTFLoader } = (await import(/* @vite-ignore */ modulePath)) as {
      GLTFLoader: new () => {
        loadAsync(assetUrl: string): Promise<{
          scene: {
            children: readonly {
              name: string
              userData: Record<string, unknown>
            }[]
            traverse(visit: (node: Record<string, unknown>) => void): void
          }
        }>
      }
    }
    const asset = await new GLTFLoader().loadAsync(url)
    const materialRecords: {
      node: string
      material: string
      baseColorMap: boolean
      normalMap: boolean
      metallicRoughnessMap: boolean
      transmissionMap: boolean
    }[] = []
    asset.scene.traverse((candidate) => {
      const node = candidate as {
        isMesh?: boolean
        name?: string
        material?: Record<string, unknown> | readonly Record<string, unknown>[]
      }
      if (node.isMesh !== true) return
      const materials = Array.isArray(node.material)
        ? node.material
        : node.material === undefined
          ? []
          : [node.material]
      for (const material of materials) {
        const record = material as {
          name?: string
          map?: unknown
          normalMap?: unknown
          roughnessMap?: unknown
          metalnessMap?: unknown
          transmissionMap?: unknown
        }
        materialRecords.push({
          node: node.name ?? '',
          material: record.name ?? '',
          baseColorMap: record.map !== null && record.map !== undefined,
          normalMap:
            record.normalMap !== null && record.normalMap !== undefined,
          metallicRoughnessMap:
            record.roughnessMap !== null &&
            record.roughnessMap !== undefined &&
            record.metalnessMap !== null &&
            record.metalnessMap !== undefined,
          transmissionMap:
            record.transmissionMap !== null &&
            record.transmissionMap !== undefined,
        })
      }
    })
    return {
      roots: asset.scene.children.map((root) => ({
        name: root.name,
        assetRevision: root.userData.assetRevision,
        collider:
          typeof root.userData.collider_json === 'string'
            ? JSON.parse(root.userData.collider_json)
            : null,
      })),
      materialRecords,
    }
  }, KIT_URL)

  expect(audit.roots.map((root) => root.name).sort()).toEqual([
    'Cloudway_Crackle_Intact',
    'Cloudway_Crackle_Release',
    'Cloudway_Crackle_Warning',
    'Cloudway_Frost',
    'Cloudway_Glide',
    'Cloudway_Marble',
  ])
  for (const root of audit.roots)
    expect(root.collider).toMatchObject({
      width: 1.7,
      depth: 1.3,
      height: 0.24,
      topY: 0,
    })
  for (const family of ['frost', 'glide'])
    expect(
      audit.materialRecords.some(
        (record) =>
          record.material === `${family}_glass_ice_gold` &&
          record.baseColorMap &&
          record.normalMap &&
          record.metallicRoughnessMap &&
          record.transmissionMap,
      ),
    ).toBe(true)
  expect(
    audit.materialRecords.some(
      (record) =>
        record.material === 'Cloudway Marble V7 Runtime 1K' &&
        record.baseColorMap &&
        record.normalMap &&
        record.metallicRoughnessMap,
    ),
  ).toBe(true)
  expect(
    audit.roots.find((root) => root.name === 'Cloudway_Marble')?.assetRevision,
  ).toBe(7)
})
