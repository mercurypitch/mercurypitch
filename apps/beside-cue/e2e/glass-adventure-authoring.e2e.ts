// Authored museum proofs — CSP texture loading and real-control room traversal.

import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

test.use({
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(180_000)

test('the main app CSP permits embedded GLTF texture blobs @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const violations: string[] = []
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective}:${event.blockedURI}`)
    })
    Object.defineProperty(window, '__besideCueCspViolations', {
      configurable: true,
      value: violations,
    })
  })

  const response = await page.goto('/?devSeed')
  expect(response?.status()).toBe(200)

  const texturePixels = await page.evaluate(async () => {
    // Vite's stable dependency resolver works on a cold CI cache too; avoid
    // naming the optimizer's generated file.
    const modulePath = '/@id/three/addons/loaders/GLTFLoader.js'
    const { GLTFLoader } = (await import(/* @vite-ignore */ modulePath)) as {
      GLTFLoader: new () => {
        loadAsync(url: string): Promise<{
          scene: {
            traverse: (
              visit: (node: {
                material?:
                  | { map?: { image?: { width?: number; height?: number } } }
                  | readonly {
                      map?: {
                        image?: { width?: number; height?: number }
                      }
                    }[]
              }) => void,
            ) => void
          }
        }>
      }
    }
    const asset = await new GLTFLoader().loadAsync(
      '/games/adventure/platform-kit.glb',
    )
    let pixels = 0
    asset.scene.traverse((node) => {
      const materials = Array.isArray(node.material)
        ? node.material
        : node.material === undefined
          ? []
          : [node.material]
      for (const material of materials) {
        const width = material.map?.image?.width ?? 0
        const height = material.map?.image?.height ?? 0
        if (width > 0 && height > 0) pixels += width * height
      }
    })
    return pixels
  })

  expect(texturePixels).toBeGreaterThan(0)
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & { __besideCueCspViolations?: string[] }
        ).__besideCueCspViolations?.filter((value) =>
          value.includes('blob:'),
        ) ?? [],
    ),
  ).toEqual([])
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(policy).toMatch(/connect-src [^;]*blob:/u)
  expect(policy).toMatch(/img-src [^;]*blob:/u)
})

type Axis = 'x' | 'z'
type MovementKey = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD'

interface ProofRoute {
  readonly layout: 'straight' | 'quarter-turn'
  readonly proofSlug: 'straight' | 'quarter'
  readonly levelId: string
  readonly firstEncounterId: string
  readonly arrivalCheckpointId: string
  readonly galleryCheckpointId: string
  readonly gateProofYaw: number
  readonly finalYaw: number
}

const ROUTES: readonly ProofRoute[] = [
  {
    layout: 'straight',
    proofSlug: 'straight',
    levelId: 'glass-foundation/straight',
    firstEncounterId:
      'glass-foundation/straight/arrival/encounter/arrival-goblet',
    arrivalCheckpointId: 'glass-foundation/straight/arrival/checkpoint/entry',
    galleryCheckpointId: 'glass-foundation/straight/gallery/checkpoint/entry',
    gateProofYaw: Math.PI - 0.18,
    // Deliberately face the exit wall to exercise the lifted obstruction boom.
    finalYaw: 0,
  },
  {
    layout: 'quarter-turn',
    proofSlug: 'quarter',
    levelId: 'glass-foundation/quarter-turn',
    firstEncounterId:
      'glass-foundation/quarter-turn/arrival/encounter/arrival-goblet',
    arrivalCheckpointId:
      'glass-foundation/quarter-turn/arrival/checkpoint/entry',
    galleryCheckpointId:
      'glass-foundation/quarter-turn/gallery/checkpoint/entry',
    // From the arrival checkpoint, look diagonally at the east connection.
    gateProofYaw: Math.atan2(-3, -2),
    // Look across the room so the decanter does not hide Merc in the proof.
    finalYaw: 0,
  },
]

const MOVEMENT_KEYS = {
  east: 'KeyA',
  north: 'KeyW',
  south: 'KeyS',
  west: 'KeyD',
} as const

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

async function metric(page: Page, name: string): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute(`data-${name}`),
  )
}

async function waitForLevel(page: Page, route: ProofRoute): Promise<void> {
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 45_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    route.arrivalCheckpointId,
  )
}

async function pauseClock(page: Page): Promise<void> {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
}

async function setHeading(page: Page, target: number): Promise<void> {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  expect(bounds).not.toBeNull()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await metric(page, 'camera-yaw')
    const remaining = shortestAngle(current, target)
    if (Math.abs(remaining) < 0.015) return
    const step = Math.max(-1.5, Math.min(1.5, remaining))
    const start = {
      x: bounds!.x + bounds!.width / 2,
      y: bounds!.y + bounds!.height / 2,
    }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x - step / 0.005, start.y, { steps: 4 })
    await page.mouse.up()
    await page.clock.runFor(32)
  }
  expect(
    Math.abs(shortestAngle(await metric(page, 'camera-yaw'), target)),
  ).toBeLessThanOrEqual(0.02)
}

async function coordinate(page: Page, axis: Axis): Promise<number> {
  return metric(page, `player-${axis}`)
}

async function recenterForMovement(page: Page): Promise<void> {
  await page.keyboard.press('KeyR')
  await page.clock.runFor(32)
  expect(
    Math.abs(shortestAngle(await metric(page, 'camera-yaw'), Math.PI)),
  ).toBeLessThan(0.02)
}

async function frameGateProof(page: Page, route: ProofRoute): Promise<void> {
  await suspendRasterOutput(page)
  try {
    await recenterForMovement(page)
    // The entry checkpoint is intentionally close to its back wall. Step into
    // the room so this proof frames the gate rather than the obstruction lift.
    await moveTo(page, 'z', -1, MOVEMENT_KEYS.north)
    await setHeading(page, route.gateProofYaw)
    await page.clock.runFor(400)
  } finally {
    await restoreRasterOutput(page)
  }
  await page.clock.runFor(32)
}

async function moveTo(
  page: Page,
  axis: Axis,
  target: number,
  key: MovementKey,
): Promise<void> {
  const direction = Math.sign(target - (await coordinate(page, axis)))
  expect(direction).not.toBe(0)
  let reached = false
  await page.keyboard.down(key)
  try {
    // Observe often enough to release near the target before normal braking
    // carries Merc past the doorway centre. Keep the same eight-second cap.
    for (let step = 0; step < 250; step += 1) {
      await page.clock.runFor(32)
      if (direction * ((await coordinate(page, axis)) - target) >= -0.025) {
        reached = true
        break
      }
    }
  } finally {
    await page.keyboard.up(key)
  }
  await page.clock.runFor(180)
  expect(reached, `Merc should reach ${axis}=${String(target)}`).toBe(true)
}

async function driveIntoClosedGate(
  page: Page,
  key: MovementKey,
): Promise<void> {
  await page.keyboard.down(key)
  await page.clock.runFor(3_000)
  await page.keyboard.up(key)
  await page.clock.runFor(180)
}

const RASTER_METHODS = [
  'clear',
  'drawArrays',
  'drawArraysInstanced',
  'drawElements',
  'drawElementsInstanced',
] as const

async function suspendRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement, methods) => {
      const gl = canvas.getContext('webgl2')
      if (gl === null)
        throw new Error('The museum WebGL2 context is unavailable')
      const context = gl as WebGL2RenderingContext & {
        __proofRasterMethods?: Record<string, (...args: unknown[]) => unknown>
      }
      context.__proofRasterMethods = Object.fromEntries(
        methods.map((name) => [
          name,
          (context[name] as (...args: unknown[]) => unknown).bind(context),
        ]),
      )
      for (const name of methods)
        Object.defineProperty(context, name, {
          configurable: true,
          value: () => undefined,
        })
    }, RASTER_METHODS)
}

async function restoreRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement, methods) => {
      const gl = canvas.getContext('webgl2') as
        | (WebGL2RenderingContext & {
            __proofRasterMethods?: Record<
              string,
              (...args: unknown[]) => unknown
            >
          })
        | null
      if (gl === null || gl.__proofRasterMethods === undefined)
        throw new Error('The museum raster output was not suspended')
      for (const name of methods)
        Object.defineProperty(gl, name, {
          configurable: true,
          value: gl.__proofRasterMethods[name],
        })
      delete gl.__proofRasterMethods
    }, RASTER_METHODS)
}

async function captureViewport(page: Page, path: string): Promise<Buffer> {
  const clip = await page
    .getByLabel('Glass museum; drag to look around')
    .boundingBox()
  expect(clip).not.toBeNull()
  // Complete the real frame, then retain it while Chromium captures. Resuming
  // the synthetic clock with full raster output can queue more SwiftShader
  // work faster than the screenshot can finish (even <11s into the CI test).
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2')
      if (gl === null)
        throw new Error('The museum WebGL2 context is unavailable')
      gl.finish()
    })
  await suspendRasterOutput(page)
  await page.clock.resume()
  try {
    return await page.screenshot({ path, clip: clip!, timeout: 45_000 })
  } finally {
    await pauseClock(page)
    await restoreRasterOutput(page)
  }
}

async function changedPixelFraction(
  closed: Buffer,
  open: Buffer,
): Promise<number> {
  const metadata = await sharp(closed).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  expect(width).toBeGreaterThan(0)
  expect(height).toBeGreaterThan(0)
  const region = {
    left: Math.floor(width * 0.25),
    top: Math.floor(height * 0.18),
    width: Math.floor(width * 0.5),
    height: Math.floor(height * 0.58),
  }
  const [before, after] = await Promise.all([
    sharp(closed).extract(region).removeAlpha().raw().toBuffer(),
    sharp(open).extract(region).removeAlpha().raw().toBuffer(),
  ])
  expect(after.byteLength).toBe(before.byteLength)
  let changed = 0
  for (let offset = 0; offset < before.byteLength; offset += 3) {
    const delta =
      Math.abs(before[offset] - after[offset]) +
      Math.abs(before[offset + 1] - after[offset + 1]) +
      Math.abs(before[offset + 2] - after[offset + 2])
    if (delta > 36) changed += 1
  }
  return changed / (before.byteLength / 3)
}

async function reachClosedGate(page: Page, route: ProofRoute): Promise<void> {
  if (route.layout === 'straight') {
    await moveTo(page, 'x', 0.85, MOVEMENT_KEYS.east)
    await moveTo(page, 'z', 2.1, MOVEMENT_KEYS.north)
    await moveTo(page, 'x', 0, MOVEMENT_KEYS.west)
    await driveIntoClosedGate(page, MOVEMENT_KEYS.north)
    expect(Math.abs(await coordinate(page, 'x'))).toBeLessThan(0.12)
    expect(await coordinate(page, 'z')).toBeGreaterThan(2.7)
    expect(await coordinate(page, 'z')).toBeLessThan(2.82)
    return
  }
  await moveTo(page, 'z', 0, MOVEMENT_KEYS.north)
  await driveIntoClosedGate(page, MOVEMENT_KEYS.east)
  expect(Math.abs(await coordinate(page, 'z'))).toBeLessThan(0.12)
  expect(await coordinate(page, 'x')).toBeGreaterThan(2.7)
  expect(await coordinate(page, 'x')).toBeLessThan(2.82)
}

async function crossOpenGate(page: Page, route: ProofRoute): Promise<void> {
  if (route.layout === 'straight') {
    await moveTo(page, 'x', 0.85, MOVEMENT_KEYS.east)
    await moveTo(page, 'z', 2.1, MOVEMENT_KEYS.north)
    await moveTo(page, 'x', 0, MOVEMENT_KEYS.west)
    await moveTo(page, 'z', 4.1, MOVEMENT_KEYS.north)
  } else {
    await moveTo(page, 'z', 0, MOVEMENT_KEYS.north)
    await moveTo(page, 'x', 4.1, MOVEMENT_KEYS.east)
  }
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    route.galleryCheckpointId,
  )
}

async function visitOptionalThenBlockedExit(
  page: Page,
  route: ProofRoute,
): Promise<void> {
  if (route.layout === 'straight') {
    await moveTo(page, 'z', 6.25, MOVEMENT_KEYS.north)
    await moveTo(page, 'x', -1.25, MOVEMENT_KEYS.west)
    await expect(page.getByText('Just for the joy of it')).toBeVisible()
    await moveTo(page, 'x', 0, MOVEMENT_KEYS.east)
    await moveTo(page, 'z', 8.3, MOVEMENT_KEYS.north)
  } else {
    await moveTo(page, 'x', 6.25, MOVEMENT_KEYS.east)
    await moveTo(page, 'z', -1.25, MOVEMENT_KEYS.south)
    await expect(page.getByText('Just for the joy of it')).toBeVisible()
    await moveTo(page, 'z', -2, MOVEMENT_KEYS.south)
    await moveTo(page, 'x', 8.3, MOVEMENT_KEYS.east)
    await moveTo(page, 'z', 0, MOVEMENT_KEYS.north)
  }
  await expect(
    page.getByRole('dialog', { name: 'You made the museum sing.' }),
  ).toHaveCount(0)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
}

for (const route of ROUTES) {
  test(`${route.layout} authored rooms keep their gate, turn and exit contract @smoke`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
    })
    await page.clock.install()
    const response = await page.goto(`/glass-game/?layout=${route.layout}`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(200)
    await waitForLevel(page, route)
    const otherLevelId =
      route.layout === 'straight'
        ? 'glass-foundation/quarter-turn'
        : 'glass-foundation/straight'
    const originalProgress = {
      version: 1,
      levelId: 'glassworks',
      checkpointId: 'goblet',
      completedBreakableIds: [],
      finished: false,
    }
    const otherLayoutProgress = {
      version: 1,
      levelId: otherLevelId,
      checkpointId: `${otherLevelId}/arrival/checkpoint/entry`,
      completedBreakableIds: [],
      finished: false,
    }
    await page.evaluate(
      ({ originalProgress, otherLayoutProgress }) => {
        const prefix = 'beside-cue:glass-adventure:progress:'
        localStorage.setItem(
          `${prefix}${originalProgress.levelId}`,
          JSON.stringify(originalProgress),
        )
        localStorage.setItem(
          `${prefix}${otherLayoutProgress.levelId}`,
          JSON.stringify(otherLayoutProgress),
        )
      },
      { originalProgress, otherLayoutProgress },
    )
    await pauseClock(page)
    await frameGateProof(page, route)
    const closedRaster = await captureViewport(
      page,
      `/tmp/glass-gate-${route.layout}-closed.png`,
    )

    await recenterForMovement(page)
    await suspendRasterOutput(page)
    await reachClosedGate(page, route)

    const progressKey = `beside-cue:glass-adventure:progress:${route.levelId}`
    await page.evaluate(
      ({ firstEncounterId, levelId, checkpointId, progressKey }) => {
        localStorage.setItem(
          progressKey,
          JSON.stringify({
            version: 1,
            levelId,
            checkpointId,
            completedBreakableIds: [firstEncounterId],
            // Deliberately inconsistent: restore must keep the second required
            // exhibit authoritative instead of trusting a stale finished bit.
            finished: true,
          }),
        )
      },
      {
        firstEncounterId: route.firstEncounterId,
        levelId: route.levelId,
        checkpointId: route.arrivalCheckpointId,
        progressKey,
      },
    )
    await page.clock.resume()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForLevel(page, route)
    await pauseClock(page)
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-completed',
      '1',
    )
    await expect(
      page.getByRole('dialog', { name: 'You made the museum sing.' }),
    ).toHaveCount(0)
    await frameGateProof(page, route)
    const openRaster = await captureViewport(
      page,
      `/tmp/glass-gate-${route.layout}-open.png`,
    )
    expect(
      await changedPixelFraction(closedRaster, openRaster),
    ).toBeGreaterThan(0.002)

    await recenterForMovement(page)
    await suspendRasterOutput(page)
    await crossOpenGate(page, route)
    await visitOptionalThenBlockedExit(page, route)
    const stored = await page.evaluate((key) => {
      const value = localStorage.getItem(key)
      return value === null ? null : (JSON.parse(value) as unknown)
    }, progressKey)
    expect(stored).toMatchObject({
      levelId: route.levelId,
      finished: false,
      completedBreakableIds: [route.firstEncounterId],
    })
    const preserved = await page.evaluate(
      ({ originalLevelId, otherLevelId }) => {
        const prefix = 'beside-cue:glass-adventure:progress:'
        return [originalLevelId, otherLevelId].map((levelId) => {
          const value = localStorage.getItem(`${prefix}${levelId}`)
          return value === null ? null : (JSON.parse(value) as unknown)
        })
      },
      { originalLevelId: originalProgress.levelId, otherLevelId },
    )
    expect(preserved).toEqual([originalProgress, otherLayoutProgress])

    await setHeading(page, route.finalYaw)
    // Let the obstruction boom settle before drawing the end-wall view. A
    // screenshot during its initial close-up can flood software raster work.
    await page.clock.runFor(800)
    await restoreRasterOutput(page)
    await page.clock.runFor(32)
    const proof = await captureViewport(
      page,
      `/tmp/glass-proof-${route.proofSlug}.png`,
    )
    expect(proof.byteLength).toBeGreaterThan(20_000)
  })
}
