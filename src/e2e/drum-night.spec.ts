// Drum Night smoke coverage protects the standalone visual-pilot boundary.
// ============================================================

import { expect, test } from '@playwright/test'

async function instrumentFirstPaint(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __drumNightAudioContexts: number
      __drumNightDatabaseOpens: number
      __drumNightMidiRequests: number
      __drumNightMicRequests: number
      __drumNightWorkers: number
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    trackedWindow.__drumNightAudioContexts = 0
    trackedWindow.__drumNightDatabaseOpens = 0
    trackedWindow.__drumNightMidiRequests = 0
    trackedWindow.__drumNightMicRequests = 0
    trackedWindow.__drumNightWorkers = 0

    const NativeAudioContext =
      trackedWindow.AudioContext ?? trackedWindow.webkitAudioContext
    if (NativeAudioContext !== undefined) {
      const TrackedAudioContext = new Proxy(NativeAudioContext, {
        construct(target, args, newTarget) {
          trackedWindow.__drumNightAudioContexts += 1
          return Reflect.construct(target, args, newTarget)
        },
      })
      trackedWindow.AudioContext = TrackedAudioContext
      trackedWindow.webkitAudioContext = TrackedAudioContext
    }

    const NativeWorker = window.Worker
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        trackedWindow.__drumNightWorkers += 1
        return Reflect.construct(target, args, newTarget)
      },
    })

    const nativeDatabaseOpen = indexedDB.open.bind(indexedDB)
    indexedDB.open = ((name: string, version?: number) => {
      trackedWindow.__drumNightDatabaseOpens += 1
      return version === undefined
        ? nativeDatabaseOpen(name)
        : nativeDatabaseOpen(name, version)
    }) as IDBFactory['open']

    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: () => {
        trackedWindow.__drumNightMidiRequests += 1
        return Promise.reject(new Error('Unexpected MIDI request'))
      },
    })
    if (navigator.mediaDevices !== undefined) {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => {
          trackedWindow.__drumNightMicRequests += 1
          return Promise.reject(new Error('Unexpected microphone request'))
        },
      })
    }
  })
}

async function boundaryCounts(
  page: import('@playwright/test').Page,
): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const trackedWindow = window as unknown as Record<string, number>
    return {
      audio: trackedWindow.__drumNightAudioContexts,
      database: trackedWindow.__drumNightDatabaseOpens,
      midi: trackedWindow.__drumNightMidiRequests,
      mic: trackedWindow.__drumNightMicRequests,
      workers: trackedWindow.__drumNightWorkers,
    }
  })
}

test('opens the standalone Pocket Console without activating runtime capabilities @smoke', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentFirstPaint(page)

  const response = await page.goto('/drum-night', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(page).toHaveTitle(/Drum Night/)
  await expect(page.getByTestId('drum-night-shell')).toBeVisible()
  await expect(page.getByTestId('drum-night-pocket-view')).toBeVisible()
  await expect(page.locator('#app-tabs')).toHaveCount(0)
  await expect(page.getByText('Synthetic performance preview')).toBeVisible()
  await expect(page.getByText('MIDI not connected')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )
  expect(await boundaryCounts(page)).toEqual({
    audio: 0,
    database: 0,
    midi: 0,
    mic: 0,
    workers: 0,
  })
  expect(pageErrors).toEqual([])
})

test('keeps views, preview transport, and rack drawer on one staged session @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Score', exact: true }).click()
  await expect(page.getByTestId('drum-night-score-view')).toBeVisible()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-view',
    'score',
  )

  await page
    .getByRole('group', { name: 'Drum view' })
    .getByRole('button', { name: 'Kit', exact: true })
    .click()
  await expect(page.getByTestId('drum-night-kit-view')).toBeVisible()

  const play = page
    .getByRole('button', { name: 'Play Midnight Pocket' })
    .filter({ visible: true })
  await play.click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'true',
  )
  await expect(page.getByRole('status')).toContainText(
    'This preview does not load a soundbank.',
  )

  const groove = page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
  await groove.click()
  const drawer = page.getByRole('dialog', { name: 'Shape the groove' })
  await expect(drawer).toBeVisible()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(drawer.getByRole('tab', { name: 'Groove' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(page).not.toHaveURL(/drawer=/)
  await expect(groove).toBeFocused()
})

test('recomposes for phone and short landscape without overflow or clipped primary controls', async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

    const geometry = await page.evaluate(() => {
      const visible = (element: Element): boolean => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < innerHeight &&
          rect.left < innerWidth &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        )
      }
      const visiblePlay = [...document.querySelectorAll<HTMLElement>('button')]
        .filter(visible)
        .find((button) => button.getAttribute('aria-label')?.startsWith('Play'))
      const playRect = visiblePlay?.getBoundingClientRect()
      const undersized = [...document.querySelectorAll('button')]
        .filter(visible)
        .map((button) => button.getBoundingClientRect())
        .filter((rect) => rect.width < 44 || rect.height < 44)
      return {
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        verticalOverflow:
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight,
        playBottom: playRect?.bottom ?? Number.POSITIVE_INFINITY,
        playRight: playRect?.right ?? Number.POSITIVE_INFINITY,
        undersized: undersized.length,
      }
    })

    expect(geometry.horizontalOverflow, JSON.stringify(viewport)).toBe(0)
    expect(geometry.verticalOverflow, JSON.stringify(viewport)).toBe(0)
    expect(geometry.playBottom, JSON.stringify(viewport)).toBeLessThanOrEqual(
      viewport.height,
    )
    expect(geometry.playRight, JSON.stringify(viewport)).toBeLessThanOrEqual(
      viewport.width,
    )
    expect(geometry.undersized, JSON.stringify(viewport)).toBe(0)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Shape the groove' }),
  ).toBeVisible()
  for (const pad of [
    'Closed hi-hat',
    'Snare',
    'Kick',
    'Mid tom',
    'Ride',
    'Crash',
  ]) {
    await expect(
      page
        .getByRole('button', { name: new RegExp(`^${pad}, key`) })
        .filter({ visible: true }),
    ).toBeVisible()
  }
})
