// Museum loading — opaque concealment, blocked input, recoverable failures and tutorial entry.
import { expect, test, type Page } from '@playwright/test'

test.use({
  viewport: { width: 640, height: 480 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

async function prepare(page: Page, tutorialSeen = true): Promise<void> {
  // These assertions concern DOM, readiness and input, not scene pixels. Keep
  // loaders, the real scene graph and RAF; visual acceptance renders separately.
  await page.addInitScript((seen) => {
    for (const method of [
      'clear',
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
    ])
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: () => undefined,
      })
    if (seen)
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
  }, tutorialSeen)
}

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  await expect(page.getByTestId('glass-loading-screen')).toHaveCount(0)
}

test('a slow asset keeps an opaque phone cover and cannot collect movement or camera input @smoke', async ({
  page,
}) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 740 })
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/games/glass3d/merc.glb', async (route) => {
    await held
    await route.continue()
  })
  try {
    await page.goto('/glass-game/')
    const cover = page.getByTestId('glass-loading-screen')
    await expect(cover).toBeVisible()
    await expect(
      cover.getByRole('button', { name: 'Leave museum' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause game' })).toHaveCount(
      0,
    )
    await expect(
      page.getByLabel('Glass museum; drag to look around'),
    ).toHaveAttribute('aria-hidden', 'true')
    await expect(
      page.getByLabel('Glass museum; drag to look around'),
    ).toHaveAttribute('tabindex', '-1')
    const state = page.getByTestId('glass-adventure')
    const start = await state.evaluate((element) => [
      element.getAttribute('data-player-x'),
      element.getAttribute('data-player-z'),
      element.getAttribute('data-camera-yaw'),
    ])
    await page.keyboard.down('KeyW')
    await page.keyboard.press('KeyQ')
    await page.keyboard.press('Space')
    await page.mouse.move(200, 240)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(2100)
    expect(
      await state.evaluate((element) => [
        element.getAttribute('data-player-x'),
        element.getAttribute('data-player-z'),
        element.getAttribute('data-camera-yaw'),
      ]),
    ).toEqual(start)
    await expect(state).toHaveAttribute('data-ready', 'false')
    const appearance = await cover.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return {
        background: getComputedStyle(element).backgroundColor,
        width: box.width,
        height: box.height,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }
    })
    expect(appearance.background).toBe('rgb(244, 239, 220)')
    expect(appearance.width).toBe(390)
    expect(appearance.height).toBeGreaterThanOrEqual(740)
    expect(appearance.scrollWidth).toBe(appearance.clientWidth)
    await page.keyboard.press('Tab')
    await expect(
      cover.getByRole('button', { name: 'Leave museum' }),
    ).toBeFocused()
    release()
    await ready(page)
    await page.keyboard.up('KeyW')
    await expect(
      page.getByLabel('Glass museum; drag to look around'),
    ).toBeFocused()
    await page.waitForTimeout(200)
    expect(await state.getAttribute('data-player-z')).toBe(start[1])
  } finally {
    release()
  }
})

test('required texture failure retries without resetting progress; context loss is covered too', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 740 })
  await page.addInitScript(() =>
    localStorage.setItem(
      'beside-cue:glass-adventure:progress:glassworks',
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'goblet',
        completedBreakableIds: ['glassworks.first-goblet'],
      }),
    ),
  )
  let fail = true
  let releaseRetry!: () => void
  const heldRetry = new Promise<void>((resolve) => {
    releaseRetry = resolve
  })
  await page.route(
    '**/games/adventure-v2/textures/warm-carrara-normal.png',
    async (route) => {
      if (fail) {
        fail = false
        await route.abort('failed')
      } else {
        await heldRetry
        await route.continue()
      }
    },
  )
  try {
    await page.goto('/glass-game/')
    const cover = page.getByTestId('glass-loading-screen')
    await expect(cover).toHaveAttribute('data-phase', 'error', {
      timeout: 30_000,
    })
    await expect(
      cover.getByRole('button', { name: 'Retry', exact: true }),
    ).toBeFocused()
    await expect(page.getByRole('button', { name: 'Pause game' })).toHaveCount(
      0,
    )
    const progress = cover.getByRole('progressbar', {
      name: 'Gallery preparation',
    })
    const failedUnits = await progress.getAttribute('aria-valuenow')
    const previousCanvas = await cover.locator('canvas').elementHandle()
    await page.waitForTimeout(250)
    await expect(progress).toHaveAttribute('aria-valuenow', failedUnits!)
    expect(pageErrors).toEqual([])
    await cover.getByRole('button', { name: 'Retry', exact: true }).tap()
    await expect(cover).toHaveAttribute('data-phase', 'loading-assets')
    await expect(cover.getByTestId('glass-loading-merc')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 },
    )
    expect(
      await previousCanvas!.evaluate((element) => element.isConnected),
    ).toBe(false)
    await expect(progress).not.toHaveAttribute(
      'aria-valuenow',
      (await progress.getAttribute('aria-valuemax')) ?? '',
    )
    releaseRetry()
    await ready(page)
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-completed',
      '1',
    )
    expect(pageErrors).toEqual([])
    await page
      .getByLabel('Floating glass museum')
      .evaluate((element: HTMLCanvasElement) => {
        const extension = element
          .getContext('webgl2')
          ?.getExtension('WEBGL_lose_context')
        if (!extension) throw new Error('Context-loss extension unavailable')
        extension.loseContext()
      })
    await expect(cover).toHaveAttribute('data-phase', 'error')
    await cover.getByRole('button', { name: 'Retry', exact: true }).tap()
    await ready(page)
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-completed',
      '1',
    )
  } finally {
    releaseRetry()
  }
})

test('installed assets advance the track; a held asset keeps it still while the real Merc is visible', async ({
  page,
}) => {
  await prepare(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    '**/games/adventure-v2/textures/warm-carrara-normal.png',
    async (route) => {
      await held
      if (!page.isClosed()) await route.continue().catch(() => undefined)
    },
  )
  try {
    // An intentionally held image can delay the browser's load event itself.
    // Inspect the live cover after DOM startup, before that image is released.
    await page.goto('/glass-game/', { waitUntil: 'domcontentloaded' })
    const cover = page.getByTestId('glass-loading-screen')
    const progress = cover.getByRole('progressbar', {
      name: 'Gallery preparation',
    })
    const merc = cover.getByTestId('glass-loading-merc')
    await expect(merc).toHaveAttribute('data-ready', 'true', {
      timeout: 30_000,
    })
    await expect(merc).toHaveAttribute('data-reduced-motion', 'true')
    await expect
      .poll(async () => Number(await progress.getAttribute('aria-valuenow')))
      .toBeGreaterThan(0)
    const total = Number(await progress.getAttribute('aria-valuemax'))
    // Allow every unblocked task to settle, then prove time alone cannot fill it.
    await page.waitForTimeout(2000)
    const installed = Number(await progress.getAttribute('aria-valuenow'))
    expect(installed).toBeLessThan(total)
    await page.waitForTimeout(1000)
    await expect(progress).toHaveAttribute('aria-valuenow', String(installed))
    expect(await cover.innerText()).not.toMatch(/\d+\s*%/)
    const bar = await progress.evaluate((element) => ({
      track: getComputedStyle(element).backgroundColor,
      fill: getComputedStyle(element.firstElementChild!).backgroundImage,
      transition: getComputedStyle(element.firstElementChild!)
        .transitionDuration,
      width: element.getBoundingClientRect().width,
    }))
    expect(bar.width).toBeGreaterThan(150)
    expect(bar.track).not.toBe('rgba(0, 0, 0, 0)')
    expect(bar.fill).toContain('linear-gradient')
    expect(bar.transition).toBe('0s')
    release()
    await ready(page)
    await expect(page.getByTestId('glass-loading-merc')).toHaveCount(0)
  } finally {
    release()
  }
})

test('a pending visit can be left; late downloads never reopen it', async ({
  page,
}) => {
  await prepare(page)
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/games/glass3d/merc.glb', async (route) => {
    await held
    if (!page.isClosed()) await route.continue().catch(() => undefined)
  })
  try {
    await page.goto('/glass-game/')
    await page
      .getByTestId('glass-loading-screen')
      .getByRole('button', { name: 'Leave museum' })
      .click()
    await expect(page).toHaveURL(/\/$/)
    expect(new URL(page.url()).pathname).toBe('/')
    release()
    await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
  } finally {
    release()
  }
})

test('First Light teaching appears after loading and is skippable and replayable', async ({
  page,
}) => {
  await prepare(page, false)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/glass-game/?layout=tutorial')
  await ready(page)
  await expect(
    page.getByRole('heading', { name: 'First Light Gallery' }),
  ).toBeVisible()
  const tutorial = page.getByRole('dialog', {
    name: 'Meet Merc. Make yourself at home.',
  })
  await expect(tutorial).toBeVisible()
  await tutorial.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Your first beautiful mess.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Enter the museum' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(tutorial).toBeVisible()
  await tutorial.getByRole('button', { name: 'Skip tutorial' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
