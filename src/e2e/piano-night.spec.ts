// Piano Night smoke coverage protects the standalone route and responsive pilot shell.
// ============================================================

import { devices, expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

async function instrumentFirstPaint(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __pianoNightAudioContexts: number
      __pianoNightMidiRequests: number
      __pianoNightMicRequests: number
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    trackedWindow.__pianoNightAudioContexts = 0
    trackedWindow.__pianoNightMidiRequests = 0
    trackedWindow.__pianoNightMicRequests = 0

    const NativeAudioContext =
      trackedWindow.AudioContext ?? trackedWindow.webkitAudioContext
    if (NativeAudioContext !== undefined) {
      const TrackedAudioContext = new Proxy(NativeAudioContext, {
        construct(target, args, newTarget) {
          trackedWindow.__pianoNightAudioContexts += 1
          return Reflect.construct(target, args, newTarget)
        },
      })
      trackedWindow.AudioContext = TrackedAudioContext
      trackedWindow.webkitAudioContext = TrackedAudioContext
    }

    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: () => {
        trackedWindow.__pianoNightMidiRequests += 1
        return Promise.reject(new Error('Unexpected MIDI request'))
      },
    })
    if (navigator.mediaDevices !== undefined) {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => {
          trackedWindow.__pianoNightMicRequests += 1
          return Promise.reject(new Error('Unexpected microphone request'))
        },
      })
    }
  })
}

test('loads the standalone Performance Horizon silently @smoke', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentFirstPaint(page)

  const response = await page.goto('/piano-night', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(page).toHaveTitle(/Piano Night/)
  await expect(page.getByTestId('piano-night-shell')).toBeVisible()
  await expect(page.locator('#app-tabs')).toHaveCount(0)
  await expect(
    page.getByText('No project loaded · Nocturne Studio'),
  ).toBeVisible()
  await expect(page.getByTestId('piano-night-keyboard')).toBeVisible()
  await expect(
    page.getByTestId('piano-night-keyboard').locator('i'),
  ).toHaveCount(88)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )

  const firstPaintCalls = await page.evaluate(() => {
    const trackedWindow = window as unknown as {
      __pianoNightAudioContexts: number
      __pianoNightMidiRequests: number
      __pianoNightMicRequests: number
    }
    return {
      audio: trackedWindow.__pianoNightAudioContexts,
      midi: trackedWindow.__pianoNightMidiRequests,
      mic: trackedWindow.__pianoNightMicRequests,
    }
  })
  expect(firstPaintCalls).toEqual({ audio: 0, midi: 0, mic: 0 })

  const loadedResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('/assets/')),
  )
  expect(
    loadedResources.filter((name) =>
      /\/(?:library|local-song-library|pitch-core|vendor-db|vendor-media|vendor-vexflow|advanced)-/.test(
        name,
      ),
    ),
  ).toEqual([])

  const play = page.getByTestId('piano-night-play')
  await play.click()
  await expect(play).toHaveAttribute('aria-pressed', 'true')
  await expect(play).toHaveAccessibleName('Pause visual note preview')
  expect(pageErrors).toEqual([])
})

test('opens from the current desktop Piano tab @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
  })

  await page.goto('/#/piano')
  await expect(page.locator('#app-tabs')).toBeVisible()
  await dismissOverlays(page)

  const launcher = page.getByTestId('open-piano-night')
  await expect(launcher).toBeVisible()
  await expect(launcher).toHaveAttribute('href', '/piano-night')

  await launcher.click()
  await expect(page).toHaveURL(/\/piano-night$/)
  await expect(page.getByTestId('piano-night-shell')).toBeVisible()
})

test('recomposes for a phone without overflow or duplicate Play @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })

  try {
    const response = await page.goto('/piano-night', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.ok()).toBe(true)

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
    await expect(page.getByTestId('piano-night-play')).toHaveCount(1)

    const hud = page.getByLabel('Piano Night preview status')
    const hudBox = await hud.boundingBox()
    const viewBox = await hud
      .getByRole('button', { name: /Change performance preview/ })
      .boundingBox()
    expect(viewBox?.y).toBeGreaterThanOrEqual(hudBox?.y ?? 0)
    expect((viewBox?.y ?? 0) + (viewBox?.height ?? 0)).toBeLessThanOrEqual(
      (hudBox?.y ?? 0) + (hudBox?.height ?? 0) + 1,
    )

    const playBox = await page.getByTestId('piano-night-play').boundingBox()
    expect(playBox?.width).toBeGreaterThanOrEqual(44)
    expect(playBox?.height).toBeGreaterThanOrEqual(44)

    await page.getByRole('button', { name: 'Coach', exact: true }).click()
    const coach = page.getByRole('dialog', {
      name: 'Illustrative phrase coach',
    })
    await expect(coach).toBeVisible()
    await expect(
      coach.getByRole('button', { name: 'Close phrase coach' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(
      page.locator('[aria-label="Illustrative phrase coach"]'),
    ).toHaveAttribute('aria-hidden', 'true')

    await page.getByTestId('piano-night-play').click()
    const animatedNote = page.locator('[class*="fallNote"]').first()
    await expect(animatedNote).toHaveCSS('animation-name', 'none')
  } finally {
    await context.close()
  }
})
