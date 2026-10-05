// Museum memory gate — measure actual GPU texture storage through island navigation.

import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  deviceScaleFactor: 1,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

declare global {
  interface Window {
    museumTextureProbe: () => {
      contexts: number
      losses: number
      bytes: number
      peakBytes: number
      textures: number
    }
  }
}

test('phone map keeps a bounded texture working set across rapid island switches @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    const contexts = new Map<
      WebGL2RenderingContext,
      {
        unit: number
        bindings: Map<string, WebGLTexture | null>
        sizes: Map<WebGLTexture, number>
        peak: number
        losses: number
      }
    >()
    function state(gl: WebGL2RenderingContext) {
      const existing = contexts.get(gl)
      if (existing !== undefined) return existing
      const next = {
        unit: gl.TEXTURE0,
        bindings: new Map<string, WebGLTexture | null>(),
        sizes: new Map<WebGLTexture, number>(),
        peak: 0,
        losses: 0,
      }
      contexts.set(gl, next)
      gl.canvas.addEventListener('webglcontextlost', () => {
        next.losses++
      })
      return next
    }
    const prototype = WebGL2RenderingContext.prototype
    const activate = prototype.activeTexture
    prototype.activeTexture = function (unit) {
      state(this).unit = unit
      return activate.call(this, unit)
    }
    const bind = prototype.bindTexture
    prototype.bindTexture = function (target, texture) {
      const current = state(this)
      current.bindings.set(`${current.unit}:${target}`, texture)
      return bind.call(this, target, texture)
    }
    const allocate = prototype.texStorage2D
    prototype.texStorage2D = function (target, levels, format, width, height) {
      allocate.call(this, target, levels, format, width, height)
      const current = state(this)
      // Three uses immutable texStorage2D for the GLB images; preserve HDR storage sizes.
      const pixelBytes =
        format === this.RGBA16F ? 8 : format === this.RGBA32F ? 16 : 4
      let bytes = 0
      for (let level = 0; level < levels; level++)
        bytes +=
          Math.max(1, width >> level) *
          Math.max(1, height >> level) *
          pixelBytes
      const bound = current.bindings.get(`${current.unit}:${target}`)
      if (bound != null)
        current.sizes.set(
          bound,
          bytes * (target === this.TEXTURE_CUBE_MAP ? 6 : 1),
        )
      current.peak = Math.max(
        current.peak,
        [...current.sizes.values()].reduce((sum, size) => sum + size, 0),
      )
    }
    const release = prototype.deleteTexture
    prototype.deleteTexture = function (texture) {
      if (texture !== null) state(this).sizes.delete(texture)
      return release.call(this, texture)
    }
    window.museumTextureProbe = () => {
      const owners = [...contexts.values()]
      return {
        contexts: owners.length,
        losses: owners.reduce((sum, owner) => sum + owner.losses, 0),
        bytes: owners.reduce(
          (sum, owner) =>
            sum + [...owner.sizes.values()].reduce((n, size) => n + size, 0),
          0,
        ),
        peakBytes: owners.reduce((sum, owner) => sum + owner.peak, 0),
        textures: owners.reduce((sum, owner) => sum + owner.sizes.size, 0),
      }
    }
  })
  await page.goto('/glass-game/?campaign=1')
  const frame = page.locator('[data-map-state]')
  await expect(frame).toHaveAttribute('data-map-state', 'ready', {
    timeout: 60_000,
  })
  const buttons = page
    .getByRole('navigation', { name: 'Select a museum island' })
    .getByRole('button')
  const canvas = frame.locator('canvas')
  const originalCanvas = await canvas.elementHandle()
  expect(originalCanvas).not.toBeNull()
  for (const index of [3, 0, 2, 1, 3, 0, 2, 1]) {
    await buttons.nth(index).click()
    await expect(buttons.nth(index)).toHaveAttribute('aria-pressed', 'true')
  }
  // Let the selected view render, without inserting an arbitrary sleep.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await expect(frame).toHaveAttribute('data-map-state', 'ready')
  await expect(canvas).toHaveCount(1)
  expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(
    true,
  )
  const memory = await page.evaluate(() => window.museumTextureProbe())
  expect(memory.contexts).toBe(1)
  expect(memory.losses).toBe(0)
  // A phone map must stay below 128 MiB for sampled texture storage. Baseline was 267 MiB.
  expect(memory.peakBytes).toBeGreaterThan(20 * 1024 * 1024)
  expect(memory.peakBytes).toBeLessThan(128 * 1024 * 1024)
  expect(errors).toEqual([])
})
