// Test-only raster checkpoints retain real scene draws around real-time voice behavior on software GPUs.
import { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    hostRasterCheckpoints: {
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
export async function installHostRasterCheckpoints(
  page: Page,
  ownerSelector: string,
  blockActiveRunner = false,
): Promise<void> {
  await page.addInitScript(
    ({ continuous, ownerSelector, blockActiveRunner }) => {
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
        context.canvas.closest(ownerSelector) !== null
      const runnerCapturing = () =>
        ['preparing', 'readiness', 'count-in', 'running'].includes(
          document.querySelector<HTMLElement>('[data-testid="song-runner"]')
            ?.dataset.phase ?? '',
        )
      // The paused runner renders on demand after real Settings changes; keep
      // those draws intact instead of requesting a frame after it already ran.
      const forwarding = () =>
        continuous || (blockActiveRunner ? !runnerCapturing() : enabled)
      for (const method of methods) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method)!
        descriptors.set(method, descriptor)
        const original = descriptor.value as (...args: unknown[]) => unknown
        Object.defineProperty(prototype, method, {
          ...descriptor,
          value(this: WebGL2RenderingContext, ...args: unknown[]) {
            if (!owned(this)) return original.apply(this, args)
            if (!forwarding()) {
              if (method !== 'clear') omittedDraws++
              return undefined
            }
            const result = original.apply(this, args)
            if (method !== 'clear') forwardedDraws++
            return result
          },
        })
      }
      window.hostRasterCheckpoints = {
        beginFrame(context) {
          if (!owned(context) || !forwarding()) return
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
            throw new Error('Host raster fixture was already restored.')
          if (blockActiveRunner && runnerCapturing())
            throw new Error(
              'Raster checkpoints require an idle or paused runner.',
            )
          requested++
          enabled = true
          return requested
        },
        read: () => ({
          mode: restored
            ? 'restored'
            : continuous
              ? 'continuous'
              : forwarding()
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
    {
      continuous: process.env.GLASS_E2E_FULL_RASTER === '1',
      ownerSelector,
      blockActiveRunner,
    },
  )
}

/** Call only before capture starts or after its natural stop; the real watchdog remains active. */
export async function renderHostCheckpoint(page: Page): Promise<void> {
  const generation = await page.evaluate(() =>
    window.hostRasterCheckpoints.request(),
  )
  await expect
    .poll(
      async () => page.evaluate(() => window.hostRasterCheckpoints.read()),
      {
        timeout: 40_000,
      },
    )
    .toMatchObject({ completed: generation })
  expect(
    await page.evaluate(
      () => window.hostRasterCheckpoints.read().checkpointDraws,
    ),
  ).toBeGreaterThan(0)
}

export async function restoreHostRaster(page: Page): Promise<void> {
  if (!page.isClosed())
    await page.evaluate(() => window.hostRasterCheckpoints?.restore())
}
