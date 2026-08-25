// Drum Night smoke coverage protects silent first paint and the live-kit boundary.
// ============================================================

import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'

const DRUM_SESSION_MIDI = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x60, 0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x31, 0x00, 0xff, 0x03, 0x0a,
  0x45, 0x32, 0x45, 0x20, 0x50, 0x6f, 0x63, 0x6b, 0x65, 0x74, 0x00, 0xff, 0x51,
  0x03, 0x07, 0xa1, 0x20, 0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, 0x00,
  0x99, 0x24, 0x64, 0x60, 0x89, 0x24, 0x00, 0x60, 0x99, 0x26, 0x70, 0x60, 0x89,
  0x26, 0x00, 0x00, 0xff, 0x2f, 0x00,
])

async function instrumentFirstPaint(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __drumNightAudioContexts: number
      __drumNightDatabaseOpens: number
      __drumNightFetches: number
      __drumNightIntervals: number
      __drumNightMidiRequests: number
      __drumNightMicRequests: number
      __drumNightOscillators: number
      __drumNightAnimationFrames: number
      __drumNightTimeouts: number
      __drumNightWorkers: number
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    trackedWindow.__drumNightAudioContexts = 0
    trackedWindow.__drumNightDatabaseOpens = 0
    trackedWindow.__drumNightFetches = 0
    trackedWindow.__drumNightIntervals = 0
    trackedWindow.__drumNightMidiRequests = 0
    trackedWindow.__drumNightMicRequests = 0
    trackedWindow.__drumNightOscillators = 0
    trackedWindow.__drumNightAnimationFrames = 0
    trackedWindow.__drumNightTimeouts = 0
    trackedWindow.__drumNightWorkers = 0

    const nativeFetch = window.fetch.bind(window)
    window.fetch = ((...args: Parameters<typeof fetch>) => {
      trackedWindow.__drumNightFetches += 1
      return nativeFetch(...args)
    }) as typeof fetch

    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      trackedWindow.__drumNightTimeouts += 1
      return nativeSetTimeout(handler, timeout, ...args)
    }) as typeof window.setTimeout

    const nativeSetInterval = window.setInterval.bind(window)
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      trackedWindow.__drumNightIntervals += 1
      return nativeSetInterval(handler, timeout, ...args)
    }) as typeof window.setInterval

    const nativeRequestAnimationFrame =
      window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      trackedWindow.__drumNightAnimationFrames += 1
      return nativeRequestAnimationFrame(callback)
    }) as typeof window.requestAnimationFrame

    const NativeAudioContext =
      trackedWindow.AudioContext ?? trackedWindow.webkitAudioContext
    if (NativeAudioContext !== undefined) {
      const TrackedAudioContext = new Proxy(NativeAudioContext, {
        construct(target, args, newTarget) {
          trackedWindow.__drumNightAudioContexts += 1
          const context = Reflect.construct(
            target,
            args,
            newTarget,
          ) as AudioContext
          const nativeCreateOscillator = context.createOscillator.bind(context)
          context.createOscillator = () => {
            trackedWindow.__drumNightOscillators += 1
            return nativeCreateOscillator()
          }
          return context
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
      fetch: trackedWindow.__drumNightFetches,
      interval: trackedWindow.__drumNightIntervals,
      midi: trackedWindow.__drumNightMidiRequests,
      mic: trackedWindow.__drumNightMicRequests,
      oscillator: trackedWindow.__drumNightOscillators,
      raf: trackedWindow.__drumNightAnimationFrames,
      timeout: trackedWindow.__drumNightTimeouts,
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
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Audio, samples, and MIDI stay off' }),
  ).toBeVisible()
  await expect(page.getByText('MIDI not connected')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )
  expect(await boundaryCounts(page)).toEqual({
    audio: 0,
    database: 0,
    fetch: 0,
    interval: 0,
    midi: 0,
    mic: 0,
    oscillator: 0,
    raf: 0,
    timeout: 0,
    workers: 0,
  })
  expect(pageErrors).toEqual([])
})

test('plays a real prepared groove and changes its authored variation @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const grooveDrawer = page.getByRole('dialog', { name: 'Shape the groove' })
  await grooveDrawer.getByRole('button', { name: 'Tight' }).click()
  await expect(
    grooveDrawer.getByRole('button', { name: 'Tight' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await grooveDrawer.getByRole('tab', { name: 'Mix' }).click()
  const mixDrawer = page.getByRole('dialog', { name: 'Balance the room' })
  await mixDrawer.getByRole('button', { name: /Click/ }).click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-enabled',
    'true',
  )
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-status',
    'waiting-for-audio',
  )
  expect((await boundaryCounts(page)).audio).toBe(0)
  await mixDrawer.getByRole('button', { name: 'Close rack drawer' }).click()
  await expect(
    page.getByRole('button', {
      name: /^First Pocket — Tight Built-in groove/,
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: /^Count-in/ }).click()
  await page
    .getByRole('button', { name: /^Play First Pocket — Tight take clock$/ })
    .filter({ visible: true })
    .click()

  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'true',
  )
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-status',
    'playing',
  )
  await expect
    .poll(async () => (await boundaryCounts(page)).oscillator)
    .toBeGreaterThan(0)
  await expect(
    page.getByRole('button', { name: /Take events Armed/ }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('changes only the visual room and preserves the authored Seat scene @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const shell = page.getByTestId('drum-night-shell')
  await page
    .getByRole('button', {
      name: 'Change room, Pocket Console selected',
    })
    .click()

  const drawer = page.getByRole('dialog', { name: 'Choose the room' })
  const gallery = drawer.getByRole('region', {
    name: 'Choose your Drum Night room',
  })
  await expect(gallery).toBeVisible()
  await gallery.getByRole('button', { name: /Tape Room/i }).click()

  await expect(shell).toHaveAttribute('style', /tape-room-landscape\.webp/)
  await expect(
    page.getByRole('button', { name: 'Change room, Tape Room selected' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pitchperfect_drum_background'),
    ),
  ).toBe('drum-tape-room')
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Tape Room selected. Drum sound unchanged.' }),
  ).toBeAttached()

  await drawer.getByRole('button', { name: 'Close rack drawer' }).click()
  await expect(drawer).not.toBeVisible()
  await page.getByRole('button', { name: 'Drummer Seat view' }).click()
  await expect(shell).toHaveAttribute('data-view', 'seat')
  await expect(page.getByTestId('drummer-seat-backdrop')).toBeVisible()

  const boundaries = await boundaryCounts(page)
  expect(boundaries.audio).toBe(0)
  expect(boundaries.database).toBe(0)
  expect(boundaries.midi).toBe(0)
  expect(boundaries.mic).toBe(0)
  expect(boundaries.workers).toBe(0)
})

test('imports one drum document across Score, Seat, transport, and the rack drawer @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Score view' }).click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-view',
    'score',
  )
  await expect(
    page.getByRole('heading', { name: 'First Pocket' }),
  ).toBeVisible()

  const songs = page
    .getByRole('button', { name: /Songs/ })
    .filter({ visible: true })
    .first()
  await songs.click()
  const songsDrawer = page.getByRole('dialog', { name: 'Bring a drum part' })
  await expect(songsDrawer).toBeVisible()
  await songsDrawer.getByLabel('Choose a drum session file').setInputFiles({
    name: 'e2e-pocket.mid',
    mimeType: 'audio/midi',
    buffer: DRUM_SESSION_MIDI,
  })
  await expect(songsDrawer).not.toBeVisible()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-import-status',
    'ready',
  )
  await expect(page.getByText('Imported percussion score')).toBeVisible()

  await page.getByRole('button', { name: 'Drummer Seat view' }).click()
  await expect(
    page.getByRole('heading', { name: 'Playable drummer’s seat' }),
  ).toBeAttached()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-view',
    'seat',
  )

  const play = page
    .getByRole('button', { name: /^Play .* take clock$/ })
    .filter({ visible: true })
  await play.click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'true',
  )
  await expect(page.getByRole('status')).toContainText(
    'e2e-pocket is starting on the shared take clock with take events armed.',
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

test('plays the photographed Drummer Seat with a real pointer @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night?view=seat', { waitUntil: 'domcontentloaded' })

  const snare = page.getByRole('button', { name: /^Play Acoustic snare/i })
  await expect(snare).toBeVisible()
  const bounds = await snare.boundingBox()
  if (bounds === null) throw new Error('Seat snare has no pointer bounds')
  expect(bounds.width).toBeGreaterThanOrEqual(44)
  expect(bounds.height).toBeGreaterThanOrEqual(44)

  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )

  await expect(snare).toHaveAttribute('data-live-active', 'true')
  expect((await boundaryCounts(page)).audio).toBe(1)
})

test('moves the live kit level with a real pointer @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const drawer = page.getByRole('dialog', { name: 'Shape the groove' })
  await drawer.getByRole('tab', { name: 'Mix' }).click()
  const mixDrawer = page.getByRole('dialog', { name: 'Balance the room' })

  const kitLevel = mixDrawer.getByRole('slider', { name: 'Kit level' })
  const initialValue = await kitLevel.inputValue()
  const bounds = await kitLevel.boundingBox()
  if (bounds === null) throw new Error('Kit level slider has no pointer bounds')

  await page.mouse.move(
    bounds.x + bounds.width * 0.2,
    bounds.y + bounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width * 0.35,
    bounds.y + bounds.height / 2,
  )
  await page.mouse.up()

  await expect(kitLevel).not.toHaveValue(initialValue)
})

test('keeps URL history, selected rack tab, and focus in sync @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const drawer = page.getByRole('dialog', { name: 'Shape the groove' })
  const grooveTab = drawer.getByRole('tab', { name: 'Groove' })
  await expect(grooveTab).toBeFocused()
  await drawer.getByRole('tab', { name: 'Kit' }).click()
  await expect(page).toHaveURL(/drawer=kit/)

  await page.goBack()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(grooveTab).toHaveAttribute('aria-selected', 'true')
  await expect(grooveTab).toBeFocused()

  await page.goBack()
  await expect(page).not.toHaveURL(/drawer=/)
  await expect(drawer).not.toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(grooveTab).toBeFocused()
})

test('recomposes for phone and short landscape without overflow or clipped primary controls', async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('button', { name: /^Open drum input setup:/ }),
    ).toBeVisible()

    const touchKit = page.getByRole('group', { name: 'Touch drum pads' })
    await expect(touchKit).toBeVisible()
    await expect(touchKit.getByRole('button')).toHaveCount(6)
    await expect(touchKit.getByRole('button').first()).toBeVisible()
    await expect(touchKit.getByRole('button').last()).toBeVisible()

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
  await page.goto('/drum-night?drawer=learn', {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('button', { name: 'Play First Pocket at 84 BPM' })
    .click()
  const activeLoop = page.getByRole('button', {
    name: 'Clear active 8-beat loop',
  })
  await expect(activeLoop).toBeVisible()
  await activeLoop.click()
  await expect(activeLoop).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText('Practice loop cleared')

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
  const drawerPads = page.getByRole('group', {
    name: 'Rack drawer drum pads',
  })
  for (const pad of [
    'Closed hi-hat',
    'Acoustic snare',
    'Bass drum',
    'Hi-mid tom',
    'Ride cymbal',
    'Crash cymbal',
  ]) {
    await expect(
      drawerPads
        .getByRole('button', { name: new RegExp(`^${pad}, key`) })
        .filter({ visible: true }),
    ).toBeVisible()
  }

  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/drum-night?drawer=groove', {
    waitUntil: 'domcontentloaded',
  })
  const landscapeDrawer = page.getByRole('dialog', {
    name: 'Shape the groove',
  })
  await expect(landscapeDrawer).toBeVisible()
  await landscapeDrawer.getByRole('tab', { name: 'Kit' }).click()
  const kitDrawer = page.getByRole('dialog', { name: 'Choose the kit' })
  await expect(
    kitDrawer.getByRole('radio', { name: /Mercury Synth/i }),
  ).toBeVisible()
  const drawerGeometry = await kitDrawer.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
  })
  expect(drawerGeometry.top).toBeGreaterThanOrEqual(0)
  expect(drawerGeometry.left).toBeGreaterThanOrEqual(0)
  expect(drawerGeometry.right).toBeLessThanOrEqual(844)
  expect(drawerGeometry.bottom).toBeLessThanOrEqual(390)
  expect(drawerGeometry.width).toBeGreaterThan(0)
  expect(drawerGeometry.height).toBeGreaterThan(0)
})
