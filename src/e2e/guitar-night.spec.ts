// Guitar Night smoke coverage protects the standalone boundary and first-viewport accessibility.
// ============================================================

import { devices, expect, test } from '@playwright/test'

async function instrumentMicrophoneRequests(
  page: import('@playwright/test').Page,
) {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __guitarNightMicCalls: number
    }
    trackedWindow.__guitarNightMicCalls = 0

    if (navigator.mediaDevices === undefined) return
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => {
        trackedWindow.__guitarNightMicCalls += 1
        return Promise.reject(new Error('Unexpected microphone request'))
      },
    })
  })
}

test('loads the standalone Guitar Night entry @smoke', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentMicrophoneRequests(page)

  const response = await page.goto('/guitar-night', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(page).toHaveTitle(/Guitar Night/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Guitar Night' }),
  ).toBeVisible()
  await expect(page.getByTestId('guitar-night-shell')).toBeVisible()
  await expect(page.locator('#app-tabs')).toHaveCount(0)
  await expect(page.getByTestId('guitar-night-backdrop')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  )
  await expect(page.locator('body')).not.toContainText(/\bAI\b/i)

  const actions = page.getByTestId('guitar-night-entry-actions')
  const buttons = actions.getByRole('button')
  await expect(buttons).toHaveCount(3)
  await expect(buttons.nth(0)).toHaveAccessibleName('Start')
  await expect(buttons.nth(1)).toHaveAccessibleName('Load a song')
  await expect(buttons.nth(2)).toHaveAccessibleName('I know my way around')

  await buttons.nth(0).focus()
  await page.keyboard.press('Tab')
  await expect(buttons.nth(1)).toBeFocused()
  const focusStyle = await buttons.nth(1).evaluate((element) => {
    const style = getComputedStyle(element)
    return { outline: style.outlineStyle, width: style.outlineWidth }
  })
  expect(focusStyle.outline).not.toBe('none')
  expect(focusStyle.width).not.toBe('0px')
  await page.keyboard.press('Tab')
  await expect(buttons.nth(2)).toBeFocused()

  const microphoneRequests = await page.evaluate(
    () =>
      (window as unknown as { __guitarNightMicCalls: number })
        .__guitarNightMicCalls,
  )
  expect(microphoneRequests).toBe(0)
  expect(pageErrors).toEqual([])
})

test('fits a phone and keeps every entry path touchable @smoke', async ({
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
    const response = await page.goto('/guitar-night', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.ok()).toBe(true)

    const shell = page.getByTestId('guitar-night-shell')
    await expect(shell).toBeVisible()
    const viewportMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(
      viewportMetrics.clientWidth + 2,
    )

    const shellBox = await shell.boundingBox()
    expect(shellBox).not.toBeNull()
    expect(shellBox?.height).toBeGreaterThanOrEqual(
      viewportMetrics.innerHeight - 1,
    )

    const buttons = page
      .getByTestId('guitar-night-entry-actions')
      .getByRole('button')
    await expect(buttons).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      const box = await buttons.nth(index).boundingBox()
      expect(box).not.toBeNull()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewportMetrics.clientWidth,
      )
    }

    const runningAnimations = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running').length,
    )
    expect(runningAnimations).toBe(0)
  } finally {
    await context.close()
  }
})

test('keeps the song actions reachable in a short desktop viewport @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()

  const chooseAudio = page.getByRole('button', {
    name: 'Choose audio',
    exact: true,
  })
  await chooseAudio.scrollIntoViewIfNeeded()
  const buttonBox = await chooseAudio.boundingBox()
  expect(buttonBox).not.toBeNull()
  expect((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0)).toBeLessThanOrEqual(
    720,
  )
  await expect(page.locator('main')).toHaveCSS('overflow-y', 'auto')
})

test('keeps the beginner preview and local song choice honest @smoke', async ({
  page,
}) => {
  await instrumentMicrophoneRequests(page)
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Start with one string.' }),
  ).toBeVisible()
  const rhythmButton = page.getByRole('button', {
    name: 'Tap each low E note',
  })
  for (let hit = 0; hit < 4; hit += 1) await rhythmButton.click()
  await expect(
    page.getByText('You just read your first bar of tab.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bring a song into the room.' }),
  ).toBeVisible()
  await expect(
    page.getByText('Nothing starts playing on its own.'),
  ).toBeVisible()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose audio', exact: true }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'practice-room.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF'),
  })

  await expect(page.getByText('practice-room.wav')).toBeVisible()
  await expect(
    page.getByText('Song preparation is not connected yet.'),
  ).toBeVisible()

  const microphoneRequests = await page.evaluate(
    () =>
      (window as unknown as { __guitarNightMicCalls: number })
        .__guitarNightMicCalls,
  )
  expect(microphoneRequests).toBe(0)
})
