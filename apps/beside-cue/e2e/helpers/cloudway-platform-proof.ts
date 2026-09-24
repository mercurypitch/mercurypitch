// Cloudway platform browser proof helpers — submission receipts, bounded raster control and real input traversal.

import { expect, type Page } from '@playwright/test'

interface InstancedDraw {
  elements: number
  frameTime: number
  instances: number
  target: string
}

const PLATFORM_ELEMENT_COUNTS = new Set([
  42, 432, 564, 672, 6_744, 436_110, 1_896_768, 3_769_668,
])
export const MARBLE_ELEMENT_COUNT = 3_769_668

const RASTER_METHODS = [
  'clear',
  'drawArrays',
  'drawArraysInstanced',
  'drawElements',
  'drawElementsInstanced',
] as const

export async function installCloudwayVisit(
  page: Page,
  options: { readonly realRendering?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ realRendering, rasterMethods }) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
      localStorage.setItem(`${prefix}comfortable-note`, '57')
      navigator.mediaDevices.getUserMedia = async () => {
        const audio = new AudioContext()
        await audio.resume()
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        gain.gain.value = 0
        oscillator.frequency.value = 220
        const destination = audio.createMediaStreamDestination()
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        const track = destination.stream.getAudioTracks()[0]
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          void audio.close()
        }
        return destination.stream
      }
      const original = WebGL2RenderingContext.prototype.drawElementsInstanced
      if (!realRendering)
        for (const method of rasterMethods) {
          if (method === 'drawElementsInstanced') continue
          Object.defineProperty(WebGL2RenderingContext.prototype, method, {
            configurable: true,
            value: () => undefined,
          })
        }
      Object.defineProperty(
        WebGL2RenderingContext.prototype,
        'drawElementsInstanced',
        {
          configurable: true,
          value: function (
            this: WebGL2RenderingContext,
            ...args: Parameters<WebGL2RenderingContext['drawElementsInstanced']>
          ) {
            const state = window as Window & {
              __cloudwayPlatformInstancedDraws?: InstancedDraw[]
              __cloudwayFramebufferIds?: WeakMap<WebGLFramebuffer, number>
              __cloudwayNextFramebufferId?: number
            }
            state.__cloudwayPlatformInstancedDraws ??= []
            state.__cloudwayFramebufferIds ??= new WeakMap()
            state.__cloudwayNextFramebufferId ??= 1
            const framebuffer = this.getParameter(
              this.DRAW_FRAMEBUFFER_BINDING,
            ) as WebGLFramebuffer | null
            let target = 'screen'
            if (framebuffer !== null) {
              let id = state.__cloudwayFramebufferIds.get(framebuffer)
              if (id === undefined) {
                id = state.__cloudwayNextFramebufferId++
                state.__cloudwayFramebufferIds.set(framebuffer, id)
              }
              target = `offscreen-${id}`
            }
            state.__cloudwayPlatformInstancedDraws.push({
              elements: args[1],
              frameTime: performance.now(),
              instances: args[4],
              target,
            })
            return realRendering ? original.apply(this, args) : undefined
          },
        },
      )
    },
    {
      realRendering: options.realRendering ?? true,
      rasterMethods: RASTER_METHODS,
    },
  )
}

export async function captureInstancedFrame(page: Page): Promise<{
  camera: unknown
  draws: InstancedDraw[]
  platformPasses: Record<
    string,
    { drawCalls: number; triangles: number; marbleInstances: number[] }
  >
  wallMilliseconds: number
}> {
  await page.evaluate(() => {
    const state = window as Window & {
      __cloudwayPlatformInstancedDraws?: InstancedDraw[]
    }
    state.__cloudwayPlatformInstancedDraws = []
  })
  const startedAt = Date.now()
  await page.clock.runFor(17)
  const wallMilliseconds = Date.now() - startedAt
  const capturedDraws = await page.evaluate(
    () =>
      (
        window as Window & {
          __cloudwayPlatformInstancedDraws?: InstancedDraw[]
        }
      ).__cloudwayPlatformInstancedDraws ?? [],
  )
  const latestFrameTime = Math.max(
    ...capturedDraws.map((draw) => draw.frameTime),
  )
  const draws = capturedDraws.filter(
    (draw) => draw.frameTime === latestFrameTime,
  )
  const platformPasses: Record<
    string,
    { drawCalls: number; triangles: number; marbleInstances: number[] }
  > = {}
  for (const draw of draws) {
    if (!PLATFORM_ELEMENT_COUNTS.has(draw.elements)) continue
    const pass = (platformPasses[draw.target] ??= {
      drawCalls: 0,
      triangles: 0,
      marbleInstances: [],
    })
    pass.drawCalls++
    pass.triangles += (draw.elements / 3) * draw.instances
    if (draw.elements === MARBLE_ELEMENT_COUNT)
      pass.marbleInstances.push(draw.instances)
  }
  const camera = JSON.parse(
    (await page
      .getByTestId('glass-adventure')
      .getAttribute('data-challenge-camera')) ?? 'null',
  ) as unknown
  return { camera, draws, platformPasses, wallMilliseconds }
}

export async function measureNoRasterFrameTime(
  page: Page,
  frames = 30,
): Promise<{ frames: number; totalWallMilliseconds: number }> {
  await suspendRasterOutput(page)
  const startedAt = Date.now()
  await page.clock.runFor(frames * 17)
  const totalWallMilliseconds = Date.now() - startedAt
  await restoreRasterOutput(page)
  return { frames, totalWallMilliseconds }
}

export function submissionReceipt(
  frame: Awaited<ReturnType<typeof captureInstancedFrame>>,
) {
  return {
    camera: frame.camera,
    platformPasses: frame.platformPasses,
    wallMilliseconds: frame.wallMilliseconds,
  }
}

export async function metric(page: Page, name: string): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute(`data-${name}`),
  )
}

export async function advanceToCameraMode(
  page: Page,
  mode: 'exploration' | 'holding',
): Promise<void> {
  const adventure = page.getByTestId('glass-adventure')
  for (let frame = 0; frame < 180; frame++) {
    await page.clock.runFor(32)
    if ((await adventure.getAttribute('data-challenge-camera-mode')) === mode)
      return
  }
  expect(await adventure.getAttribute('data-challenge-camera-mode')).toBe(mode)
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export async function setHeading(page: Page, target: number): Promise<void> {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing Cloudway viewport.')
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await metric(page, 'camera-yaw')
    const remaining = shortestAngle(current, target)
    if (Math.abs(remaining) < 0.018) return
    const step = Math.max(-1.35, Math.min(1.35, remaining))
    const start = {
      x: bounds.x + bounds.width * 0.5,
      y: bounds.y + bounds.height * 0.42,
    }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x - step / 0.005, start.y, { steps: 4 })
    await page.mouse.up()
    await page.clock.runFor(32)
  }
  expect(
    Math.abs(shortestAngle(await metric(page, 'camera-yaw'), target)),
  ).toBeLessThan(0.03)
}

export async function suspendRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement, methods) => {
      const gl = canvas.getContext('webgl2')
      if (gl === null)
        throw new Error('The Cloudway WebGL2 context is missing.')
      const context = gl as WebGL2RenderingContext & {
        __cloudwayPlatformRasterMethods?: Record<
          string,
          (...args: unknown[]) => unknown
        >
      }
      context.__cloudwayPlatformRasterMethods = Object.fromEntries(
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

export async function restoreRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement, methods) => {
      const gl = canvas.getContext('webgl2') as
        | (WebGL2RenderingContext & {
            __cloudwayPlatformRasterMethods?: Record<
              string,
              (...args: unknown[]) => unknown
            >
          })
        | null
      if (gl?.__cloudwayPlatformRasterMethods === undefined)
        throw new Error('Cloudway raster methods were not suspended.')
      for (const name of methods)
        Object.defineProperty(gl, name, {
          configurable: true,
          value: gl.__cloudwayPlatformRasterMethods[name],
        })
      delete gl.__cloudwayPlatformRasterMethods
    }, RASTER_METHODS)
}

export async function suspendInstancedRaycasts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const modulePath = '/@id/three'
    const { InstancedMesh } = (await import(/* @vite-ignore */ modulePath)) as {
      InstancedMesh: {
        prototype: {
          raycast: (...args: unknown[]) => unknown
          __cloudwayRaycast?: (...args: unknown[]) => unknown
        }
      }
    }
    const prototype = InstancedMesh.prototype
    prototype.__cloudwayRaycast = prototype.raycast
    prototype.raycast = () => undefined
  })
}

export async function restoreInstancedRaycasts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const modulePath = '/@id/three'
    const { InstancedMesh } = (await import(/* @vite-ignore */ modulePath)) as {
      InstancedMesh: {
        prototype: {
          raycast: (...args: unknown[]) => unknown
          __cloudwayRaycast?: (...args: unknown[]) => unknown
        }
      }
    }
    const prototype = InstancedMesh.prototype
    if (prototype.__cloudwayRaycast === undefined)
      throw new Error('Cloudway instanced raycasts were not suspended.')
    prototype.raycast = prototype.__cloudwayRaycast
    delete prototype.__cloudwayRaycast
  })
}

export async function driveTo(
  page: Page,
  target: { readonly x: number; readonly z: number },
  options: { readonly jump: boolean; readonly tolerance?: number },
): Promise<void> {
  const start = {
    x: await metric(page, 'player-x'),
    z: await metric(page, 'player-z'),
  }
  await setHeading(
    page,
    Math.atan2(-(target.x - start.x), -(target.z - start.z)),
  )
  let jumped = false
  let reached = false
  await page.keyboard.down('KeyW')
  try {
    for (let frame = 0; frame < 360; frame++) {
      await page.clock.runFor(32)
      const x = await metric(page, 'player-x')
      const z = await metric(page, 'player-z')
      const distance = Math.hypot(target.x - x, target.z - z)
      if (options.jump && !jumped && distance < 1.6) {
        jumped = true
        await page.keyboard.down('Space')
        await page.clock.runFor(32)
        await page.keyboard.up('Space')
      }
      if (distance < (options.tolerance ?? 0.2)) {
        reached = true
        break
      }
    }
  } finally {
    await page.keyboard.up('KeyW')
    await page.keyboard.up('Space')
  }
  expect(
    reached,
    `Merc should reach ${JSON.stringify(target)} from ${JSON.stringify(start)}; ended at ${JSON.stringify({ x: await metric(page, 'player-x'), y: await metric(page, 'player-y'), z: await metric(page, 'player-z') })}`,
  ).toBe(true)
  for (let frame = 0; frame < 40; frame++) {
    await page.clock.runFor(32)
    if (Math.abs(await metric(page, 'player-y')) < 0.002) break
  }
}

export async function leapToward(
  page: Page,
  target: { readonly x: number; readonly z: number },
  reached: (position: { readonly x: number; readonly z: number }) => boolean,
  jumpAt: (position: {
    readonly x: number
    readonly z: number
  }) => boolean = () => true,
): Promise<boolean> {
  const start = {
    x: await metric(page, 'player-x'),
    z: await metric(page, 'player-z'),
  }
  await setHeading(
    page,
    Math.atan2(-(target.x - start.x), -(target.z - start.z)),
  )
  await page.keyboard.down('KeyW')
  let jumped = false
  let airborne = false
  try {
    for (let frame = 0; frame < 150; frame++) {
      await page.clock.runFor(32)
      const position = {
        x: await metric(page, 'player-x'),
        z: await metric(page, 'player-z'),
      }
      if (!jumped && jumpAt(position)) {
        jumped = true
        await page.keyboard.down('Space')
        await page.clock.runFor(32)
        await page.keyboard.up('Space')
      }
      const y = await metric(page, 'player-y')
      if (y > 0.05) airborne = true
      if (jumped && airborne && Math.abs(y) < 0.02 && reached(position))
        return true
      if (y < -1) return false
    }
    return false
  } finally {
    await page.keyboard.up('KeyW')
    await page.keyboard.up('Space')
  }
}

export async function settleWithin(
  page: Page,
  contains: (position: { readonly x: number; readonly z: number }) => boolean,
): Promise<boolean> {
  for (let frame = 0; frame < 120; frame++) {
    await page.clock.runFor(32)
    const position = {
      x: await metric(page, 'player-x'),
      z: await metric(page, 'player-z'),
    }
    if (contains(position) && Math.abs(await metric(page, 'player-y')) < 0.002)
      return true
  }
  return false
}
