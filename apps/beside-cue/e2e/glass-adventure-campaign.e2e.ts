// Campaign navigation — real host transitions preserve independent progress and teaching.
import { expect, test, type Page } from '@playwright/test'

test.use({
  viewport: { width: 320, height: 640 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

async function prepare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Keep real loaders, scene lifetime and inputs; rendering is checked separately.
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
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
  })
}

async function ready(page: Page, id: string): Promise<void> {
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveCount(1)
  await expect(game).toHaveAttribute('data-level-id', id)
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
}

test('phone, tablet and desktop map load only lobby models before gallery entry @smoke', async ({
  page,
}) => {
  await prepare(page)
  const models: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('.glb')) models.push(request.url())
  })
  await page.goto('/glass-game/?campaign=1')
  const lobby = page.getByTestId('glass-campaign')
  await expect(lobby).toBeVisible()
  await expect(
    lobby.getByRole('button', { name: /^(Enter|Continue|Replay) / }),
  ).toHaveCount(4)
  await expect(lobby.locator('[data-map-state]')).toHaveAttribute(
    'data-map-state',
    'ready',
    { timeout: 60_000 },
  )
  expect(models.map((url) => new URL(url).pathname).sort()).toEqual(
    [
      '/games/glass3d/merc.glb',
      '/games/journey-map-v1/floating-museum-map-kit-v1.glb',
      '/games/journey-map-v4/floating-museum-twin-finish-kit-v4.glb',
    ].sort(),
  )
  expect(models.some((url) => /\/games\/adventure-v\d+\//u.test(url))).toBe(
    false,
  )
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    const horizontalLayout = await lobby.evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }))
    expect(horizontalLayout.overflowX).toBe('hidden')
    expect(horizontalLayout.pageWidth).toBeLessThanOrEqual(
      horizontalLayout.viewportWidth,
    )
    const card = lobby.getByRole('button', {
      name: 'Enter First Light Gallery',
    })
    expect(
      await card.evaluate((element) => getComputedStyle(element).color),
    ).toBe('rgb(34, 73, 67)')
    await card.focus()
    await expect(card).toBeFocused()
  }
  await page.setViewportSize({ width: 320, height: 640 })
  await lobby.getByRole('button', { name: 'Enter First Light Gallery' }).tap()
  await ready(page, 'glassworks-chamber/chamber')
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(lobby).toBeVisible()
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
})

test('gallery swaps restore their own checkpoint and new lessons ignore the old global dismissal', async ({
  page,
}) => {
  await prepare(page)
  await page.addInitScript(() => {
    localStorage.setItem(
      'beside-cue:glass-adventure:progress:glassworks-journey/journey',
      JSON.stringify({
        version: 1,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/garden/checkpoint/entry',
        completedBreakableIds: [
          'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
        ],
      }),
    )
  })
  await page.goto('/glass-game/?campaign=1')
  await page.getByRole('button', { name: 'Continue Glassworks Journey' }).tap()
  await ready(page, 'glassworks-journey/journey')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await page.getByRole('button', { name: 'Enter Twin Galleries' }).tap()
  await ready(page, 'glassworks-twin-galleries/twin-galleries')
  const tutorial = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: 'Skip tutorial' }) })
  await expect(tutorial).toBeVisible()
  await tutorial.getByRole('button', { name: 'Skip tutorial' }).tap()
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await page.getByRole('button', { name: 'Enter First Light Gallery' }).tap()
  await ready(page, 'glassworks-chamber/chamber')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await page.getByRole('button', { name: 'Enter Twin Galleries' }).tap()
  await ready(page, 'glassworks-twin-galleries/twin-galleries')
  await expect(tutorial).toHaveCount(0)
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await page.getByRole('button', { name: 'Continue Glassworks Journey' }).tap()
  await ready(page, 'glassworks-journey/journey')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
})

test('leaving a loading gallery retires it before the next gallery mounts', async ({
  page,
}) => {
  await prepare(page)
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let first = true
  await page.route('**/games/glass3d/merc.glb', async (route) => {
    if (first) {
      first = false
      await held
    }
    await route.continue().catch(() => undefined)
  })
  try {
    await page.goto('/glass-game/?campaign=1')
    await page.getByRole('button', { name: 'Enter First Light Gallery' }).tap()
    await page
      .getByTestId('glass-loading-screen')
      .getByRole('button', { name: 'Leave museum' })
      .tap()
    await page.getByRole('button', { name: 'Enter Twin Galleries' }).tap()
    release()
    await ready(page, 'glassworks-twin-galleries/twin-galleries')
    await expect(
      page.getByRole('heading', { name: 'First Light Gallery', exact: true }),
    ).toHaveCount(0)
  } finally {
    release()
  }
})

test('a failed replay keeps the completed gallery save and can return to the chooser', async ({
  page,
}) => {
  await prepare(page)
  const levelId = 'glassworks-twin-galleries/twin-galleries'
  const key = `beside-cue:glass-adventure:progress:${levelId}`
  const saved = JSON.stringify({
    version: 1,
    levelId,
    checkpointId: `${levelId}/panorama/checkpoint/panorama`,
    completedBreakableIds: [
      `${levelId}/warm/encounter/lower-urn`,
      `${levelId}/cool/encounter/upper-decanter`,
      `${levelId}/court/encounter/bridge-pair`,
      `${levelId}/portrait/encounter/portrait-pair`,
    ],
    finished: true,
  })
  await page.addInitScript(
    ({ key, saved }) => localStorage.setItem(key, saved),
    { key, saved },
  )
  await page.route('**/games/glass3d/merc.glb', (route) =>
    route.abort('failed'),
  )
  await page.goto('/glass-game/?campaign=1')
  await page.getByRole('button', { name: 'Replay Twin Galleries' }).tap()
  const loader = page.getByTestId('glass-loading-screen')
  await expect(loader.getByRole('button', { name: 'Retry' })).toBeVisible({
    timeout: 60_000,
  })
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    saved,
  )
  await loader.getByRole('button', { name: 'Leave museum' }).tap()
  await expect(
    page.getByRole('button', { name: 'Replay Twin Galleries' }),
  ).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    saved,
  )
})
