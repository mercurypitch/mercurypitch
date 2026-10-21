// Test-only raster checkpoints retain real scene draws around real-time voice behavior on software GPUs.
import { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    museumRasterCheckpoints: {
      beginFrame(context: WebGL2RenderingContext): void
      finishFrame(context: WebGL2RenderingContext): void
      request(): number
      read(): {
        mode: 'continuous' | 'rasterizing' | 'omitted' | 'restored'
        requested: number
        completed: number
        forwardedDraws: number
        omittedDraws: number
        checkpointDraws: number
      }
      restore(): void
    }
  }
}

/** Keep the real renderer, scene and clocks; omit only raster calls between explicit frames. */
export async function installMuseumRasterCheckpoints(
  page: Page,
): Promise<void> {
  await page.addInitScript(
    ({ continuous }) => {
      const prototype = WebGL2RenderingContext.prototype
      const methods = [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ] as const
      const descriptors = new Map<string, PropertyDescriptor>()
      let enabled = true,
        restored = false,
        requested = 0,
        completed = -1
      let forwardedDraws = 0,
        omittedDraws = 0,
        checkpointDraws = 0
      let frameStart = 0,
        frameGeneration = -1
      let frameContext: WebGL2RenderingContext | null = null
      const owned = (context: WebGL2RenderingContext) =>
        context.canvas instanceof HTMLCanvasElement &&
        context.canvas.closest('[data-testid="glass-adventure"]') !== null
      for (const method of methods) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method)!
        descriptors.set(method, descriptor)
        const original = descriptor.value as (...args: unknown[]) => unknown
        Object.defineProperty(prototype, method, {
          ...descriptor,
          value(this: WebGL2RenderingContext, ...args: unknown[]) {
            if (!owned(this)) return original.apply(this, args)
            if (!enabled && !continuous) {
              if (method !== 'clear') omittedDraws++
              return undefined
            }
            const result = original.apply(this, args)
            if (method !== 'clear') forwardedDraws++
            return result
          },
        })
      }
      window.museumRasterCheckpoints = {
        beginFrame(context) {
          if (!owned(context) || (!enabled && !continuous)) return
          frameContext = context
          frameStart = forwardedDraws
          frameGeneration = requested
        },
        finishFrame(context) {
          if (context !== frameContext || frameGeneration < 0) return
          const draws = forwardedDraws - frameStart
          if (draws > 0) {
            checkpointDraws = draws
            completed = frameGeneration
            enabled = false
          }
          frameContext = null
          frameGeneration = -1
        },
        request() {
          if (restored)
            throw new Error('Museum raster fixture was already restored.')
          requested++
          enabled = true
          return requested
        },
        read: () => ({
          mode: restored
            ? 'restored'
            : continuous
              ? 'continuous'
              : enabled
                ? 'rasterizing'
                : 'omitted',
          requested,
          completed,
          forwardedDraws,
          omittedDraws,
          checkpointDraws,
        }),
        restore() {
          for (const [method, descriptor] of descriptors)
            Object.defineProperty(prototype, method, descriptor)
          enabled = true
          restored = true
          frameContext = null
          frameGeneration = -1
        },
      }
    },
    { continuous: process.env.GLASS_E2E_FULL_RASTER === '1' },
  )
}

/** Call only before capture starts or after its natural stop; the real watchdog remains active. */
export async function renderMuseumCheckpoint(page: Page): Promise<void> {
  const generation = await page.evaluate(() =>
    window.museumRasterCheckpoints.request(),
  )
  await expect
    .poll(
      async () => page.evaluate(() => window.museumRasterCheckpoints.read()),
      {
        timeout: 40_000,
      },
    )
    .toMatchObject({ completed: generation })
  expect(
    await page.evaluate(
      () => window.museumRasterCheckpoints.read().checkpointDraws,
    ),
  ).toBeGreaterThan(0)
}

export async function restoreMuseumRaster(page: Page): Promise<void> {
  if (!page.isClosed())
    await page.evaluate(() => window.museumRasterCheckpoints?.restore())
}
