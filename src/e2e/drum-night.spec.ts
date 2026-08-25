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

async function scoreGeometry(page: import('@playwright/test').Page): Promise<{
  readonly panelWidth: number
  readonly scoreWidth: number
  readonly viewportWidth: number
}> {
  const viewport = page.getByLabel('Windowed percussion score')
  await expect(viewport).toBeVisible()
  return viewport.evaluate((element) => {
    const panel = element.closest('figure')
    const score = element.querySelector('svg')
    if (panel === null || score === null) {
      throw new Error('Score viewport is missing its figure or SVG')
    }
    return {
      panelWidth: panel.getBoundingClientRect().width,
      scoreWidth: score.getBoundingClientRect().width,
      viewportWidth: element.getBoundingClientRect().width,
    }
  })
}

async function rangePoint(
  slider: import('@playwright/test').Locator,
  fraction: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const bounds = await slider.boundingBox()
  if (bounds === null) throw new Error('Timeline slider has no pointer bounds')
  const thumbInset = Math.min(8, bounds.width / 4)
  return {
    x:
      bounds.x +
      thumbInset +
      Math.max(0, bounds.width - thumbInset * 2) * fraction,
    y: bounds.y + bounds.height / 2,
  }
}

test('pairs the Home rooms and opens Drum Night from the Play group @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', '1')
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'denied', at: Date.now(), implicit: false }),
    )
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/#/home', { waitUntil: 'domcontentloaded' })

  const destinationOrder = await page
    .locator('[data-destination]')
    .evaluateAll((destinations) =>
      destinations.map((destination) =>
        destination.getAttribute('data-destination'),
      ),
    )
  expect(destinationOrder).toEqual([
    'practice',
    'exercises',
    'karaoke',
    'drumNight',
    'pianoNight',
    'guitarNight',
    'analysis',
    'jam',
    'mystery',
  ])

  const destinationBoxes = await page
    .locator('[data-destination]')
    .evaluateAll((destinations) =>
      Object.fromEntries(
        destinations.map((destination) => {
          const box = destination.getBoundingClientRect()
          return [
            destination.getAttribute('data-destination'),
            { width: box.width, x: box.x, y: box.y },
          ]
        }),
      ),
    )
  for (const [left, right] of [
    ['practice', 'exercises'],
    ['karaoke', 'drumNight'],
    ['pianoNight', 'guitarNight'],
    ['jam', 'mystery'],
  ] as const) {
    expect(
      Math.abs(destinationBoxes[left]!.y - destinationBoxes[right]!.y),
    ).toBeLessThan(2)
    expect(destinationBoxes[left]!.width).toBeCloseTo(
      destinationBoxes[right]!.width,
      0,
    )
    expect(destinationBoxes[left]!.x).toBeLessThan(destinationBoxes[right]!.x)
  }
  expect(destinationBoxes.analysis!.width).toBeGreaterThan(
    destinationBoxes.pianoNight!.width * 1.9,
  )

  const drumCard = page.locator('[data-destination="drumNight"]')
  await expect(drumCard).toHaveAttribute('href', '/drum-night')
  await expect(drumCard.locator('img')).toHaveAttribute(
    'src',
    '/drum-night/pocket-console-landscape.webp',
  )

  const desktopDoor = page.getByRole('link', {
    name: 'Drums — open Drum Night room',
  })
  await expect(desktopDoor).toHaveAttribute('href', '/drum-night')
  await desktopDoor.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/drum-night')
  await expect(page.getByTestId('drum-night-shell')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/home', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'More tabs' }).click()
  const mobileDoor = page
    .getByRole('dialog', { name: 'More tabs' })
    .getByRole('link', { name: 'Drum Night — open standalone room' })
  await expect(mobileDoor).toBeVisible()
  await mobileDoor.click()
  await expect(page).toHaveURL(/\/drum-night$/)
  await expect(page.getByTestId('drum-night-shell')).toBeVisible()
})

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

test('switches and closes the desktop rail workbench with URL and aria state in sync @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const rail = page.getByRole('complementary', {
    name: 'Drum Night sections',
  })
  const learn = rail.getByRole('button', { name: 'Learn', exact: true })
  const songs = rail.getByRole('button', { name: 'Songs', exact: true })
  const workbench = page.locator('#drum-workbench')

  await expect(learn).toHaveAttribute('aria-expanded', 'false')
  await expect(songs).toHaveAttribute('aria-expanded', 'false')

  await learn.click()
  await expect(
    page.getByRole('region', { name: 'Build the first pocket' }),
  ).toBeVisible()
  await expect(workbench).toBeVisible()
  await expect(learn).toHaveAttribute('aria-expanded', 'true')
  await expect(songs).toHaveAttribute('aria-expanded', 'false')
  await expect(page).toHaveURL(/drawer=learn/)

  await songs.click()
  await expect(
    page.getByRole('region', { name: 'Bring a drum part' }),
  ).toBeVisible()
  await expect(workbench).toBeVisible()
  await expect(learn).toHaveAttribute('aria-expanded', 'false')
  await expect(songs).toHaveAttribute('aria-expanded', 'true')
  await expect(page).toHaveURL(/drawer=songs/)

  await songs.click()
  await expect(workbench).toHaveAttribute('aria-hidden', 'true')
  await expect(workbench).toHaveAttribute('inert', '')
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-drawer-open',
    'false',
  )
  await expect(songs).toHaveAttribute('aria-expanded', 'false')
  await expect(page).not.toHaveURL(/drawer=/)
})

test('plays all six photographed Pocket zones with a real pointer across room sizes @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  const padNames = [
    'Closed hi-hat',
    'Acoustic snare',
    'Bass drum',
    'Hi-mid tom',
    'Ride cymbal',
    'Crash cymbal',
  ] as const

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

    const touchKit = page.getByRole('group', { name: 'Touch drum pads' })
    if (viewport.width <= 720) {
      await expect(touchKit).toBeVisible()
      await expect(touchKit.getByRole('button')).toHaveCount(6)
    } else {
      await expect(touchKit).toHaveCount(0)
    }

    const photoKit = page.locator('[aria-label="Pocket Console drum kit"]')
    await expect(photoKit).toBeVisible()
    await expect(photoKit.getByRole('button')).toHaveCount(6)

    for (const padName of padNames) {
      const pad = photoKit.getByRole('button', {
        name: new RegExp(`^${padName}, key`),
      })
      const bounds = await pad.boundingBox()
      if (bounds === null) {
        throw new Error(
          `${padName} has no pointer bounds at ${viewport.width}px`,
        )
      }
      expect(
        bounds.width,
        `${padName} at ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(44)
      expect(
        bounds.height,
        `${padName} at ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(44)
      await page.mouse.click(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      )
      expect(await pad.getAttribute('class')).toContain('isHit')
    }

    await expect
      .poll(async () => (await boundaryCounts(page)).audio)
      .toBeGreaterThan(0)
    await page.getByRole('button', { name: /^Open drum input setup:/ }).click()
    const input = page.getByRole('dialog', { name: 'Drum input' })
    await expect(input.getByText(/Crash cymbal · \d+ · touch/)).toBeVisible()
    await input.getByRole('button', { name: 'Close input details' }).click()
  }
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
  const grooveDrawer = page.getByRole('region', { name: 'Shape the groove' })
  await grooveDrawer.getByRole('button', { name: 'Funk' }).click()
  await expect(
    grooveDrawer.getByRole('button', { name: 'Funk' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-enabled',
    'false',
  )
  expect((await boundaryCounts(page)).audio).toBe(0)
  await grooveDrawer.getByRole('button', { name: 'Close rack drawer' }).click()
  await expect(
    page.getByRole('button', {
      name: /^First Pocket — Funk Built-in groove/,
    }),
  ).toBeVisible()

  const countIn = page.getByRole('button', {
    name: 'Count-in: 4 audible beats',
  })
  await expect(countIn).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: 'Playback click: off' }),
  ).toHaveAttribute('aria-pressed', 'false')
  const pocketSnare = page
    .locator('[aria-label="Pocket Console drum kit"]')
    .getByRole('button', { name: /^Acoustic snare, key/i })
  const pocketSnareBounds = await pocketSnare.boundingBox()
  if (pocketSnareBounds === null) {
    throw new Error('Pocket snare cannot arm audio before the count-in test')
  }
  await page.mouse.click(
    pocketSnareBounds.x + pocketSnareBounds.width / 2,
    pocketSnareBounds.y + pocketSnareBounds.height / 2,
  )
  await expect
    .poll(async () => (await boundaryCounts(page)).oscillator)
    .toBeGreaterThan(0)
  const oscillatorBaseline = (await boundaryCounts(page)).oscillator
  await page
    .getByRole('button', { name: /^Play First Pocket — Funk take clock$/ })
    .filter({ visible: true })
    .click()

  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'true',
  )
  await expect
    .poll(async () => (await boundaryCounts(page)).oscillator)
    .toBeGreaterThan(oscillatorBaseline)
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-enabled',
    'false',
  )
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

  const drawer = page.getByRole('region', { name: 'Choose the room' })
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
  await expect
    .poll(async () => {
      const geometry = await scoreGeometry(page)
      return Math.min(
        geometry.viewportWidth / geometry.panelWidth,
        geometry.scoreWidth / geometry.viewportWidth,
      )
    })
    .toBeGreaterThanOrEqual(0.98)
  const preparedScoreGeometry = await scoreGeometry(page)
  expect(preparedScoreGeometry.viewportWidth).toBeGreaterThanOrEqual(
    preparedScoreGeometry.panelWidth * 0.98,
  )
  expect(preparedScoreGeometry.scoreWidth).toBeGreaterThanOrEqual(
    preparedScoreGeometry.viewportWidth * 0.98,
  )

  const songs = page
    .getByRole('button', { name: /Songs/ })
    .filter({ visible: true })
    .first()
  await songs.click()
  const songsDrawer = page.getByRole('region', { name: 'Bring a drum part' })
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
  await expect(
    page.getByText('Percussion score', { exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () => {
      const geometry = await scoreGeometry(page)
      return geometry.scoreWidth / geometry.viewportWidth
    })
    .toBeGreaterThanOrEqual(0.98)
  const importedScoreGeometry = await scoreGeometry(page)
  expect(importedScoreGeometry.viewportWidth).toBeGreaterThanOrEqual(
    importedScoreGeometry.panelWidth * 0.98,
  )

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
  await expect(
    page.getByRole('status').filter({
      hasText:
        'e2e-pocket is starting on the shared take clock with take events armed.',
    }),
  ).toBeAttached()

  const groove = page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
  await groove.click()
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  await expect(drawer).toBeVisible()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(groove).toBeFocused()
  await expect(groove).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(page).not.toHaveURL(/drawer=/)
  await expect(groove).toBeFocused()
})

test('sets, moves, clears, and scrubs the authored A B loop with a real pointer @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const shell = page.getByTestId('drum-night-shell')
  const timeline = page.getByTestId('drum-night-timeline')
  const seek = timeline.getByRole('slider', { name: 'Drum part position' })
  const markAControl = timeline.getByRole('button', {
    name: 'Set loop start A at the playhead',
  })
  const markBControl = timeline.getByRole('button', {
    name: 'Set loop end B at the playhead',
  })

  await expect(timeline).toHaveAttribute('data-loop-state', 'full')
  await expect(timeline.getByText('Full song')).toBeVisible()
  await markAControl.click()
  await expect(timeline).toHaveAttribute('data-loop-state', 'waiting')
  await expect(timeline.getByText('Set B to finish the loop')).toBeVisible()

  const laterPosition = await rangePoint(seek, 0.62)
  await page.mouse.click(laterPosition.x, laterPosition.y)
  await expect
    .poll(async () => Number(await seek.inputValue()))
    .toBeGreaterThan(Number(await seek.getAttribute('min')))
  await markBControl.click()

  await expect(timeline).toHaveAttribute('data-loop-state', 'active')
  const markerA = timeline.getByRole('slider', { name: 'Loop start marker' })
  const markerB = timeline.getByRole('slider', { name: 'Loop end marker' })
  await expect(markerA).toHaveAttribute('aria-valuenow', '0')
  await expect(markerB).toBeVisible()
  const initialA = Number(await markerA.getAttribute('aria-valuenow'))
  const markerBounds = await markerA.boundingBox()
  const railBounds = await page
    .getByTestId('drum-night-loop-range')
    .locator('input[type="range"]')
    .boundingBox()
  if (markerBounds === null || railBounds === null) {
    throw new Error('A B timeline marker is missing real pointer bounds')
  }

  await page.mouse.move(
    markerBounds.x + markerBounds.width / 2,
    markerBounds.y + markerBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    railBounds.x + railBounds.width * 0.24,
    markerBounds.y + markerBounds.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect
    .poll(async () => Number(await markerA.getAttribute('aria-valuenow')))
    .toBeGreaterThan(initialA)
  await expect(timeline).toHaveAttribute('data-loop-state', 'active')

  await timeline
    .getByRole('button', { name: 'Clear A B practice loop' })
    .click()
  await expect(timeline).toHaveAttribute('data-loop-state', 'full')
  await expect(markerA).toHaveCount(0)
  await expect(markerB).toHaveCount(0)

  await page.getByRole('button', { name: 'Count-in: 4 audible beats' }).click()
  await expect(
    page.getByRole('button', { name: 'Count-in: off' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Play First Pocket take clock' })
    .filter({ visible: true })
    .click()
  await expect(shell).toHaveAttribute('data-playing', 'true')

  await shell.evaluate((element) => {
    const trackedWindow = window as unknown as {
      __drumNightPlayingTransitions: string[]
      __drumNightPlayingObserver?: MutationObserver
    }
    trackedWindow.__drumNightPlayingTransitions = []
    trackedWindow.__drumNightPlayingObserver?.disconnect()
    trackedWindow.__drumNightPlayingObserver = new MutationObserver(() => {
      trackedWindow.__drumNightPlayingTransitions.push(
        element.getAttribute('data-playing') ?? '',
      )
    })
    trackedWindow.__drumNightPlayingObserver.observe(element, {
      attributeFilter: ['data-playing'],
    })
  })

  const scrubFrom = await rangePoint(seek, 0.72)
  const scrubTo = await rangePoint(seek, 0.41)
  await page.mouse.move(scrubFrom.x, scrubFrom.y)
  await page.mouse.down()
  await expect(shell).toHaveAttribute('data-playing', 'false')
  await page.mouse.move(scrubTo.x, scrubTo.y, { steps: 8 })
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-playing', 'true')
  await expect(page.getByText(/^Count in$/)).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __drumNightPlayingTransitions: string[]
            }
          ).__drumNightPlayingTransitions,
      ),
    )
    .toEqual(['false', 'true'])
})

test('keeps quarter-beat marks and end-boundary controls pointer-safe at 320px @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const timeline = page.getByTestId('drum-night-timeline')
  const seek = timeline.getByRole('slider', { name: 'Drum part position' })
  const setA = timeline.getByRole('button', {
    name: 'Set loop start A at the playhead',
  })
  const setB = timeline.getByRole('button', {
    name: 'Set loop end B at the playhead',
  })

  await setA.click()
  await seek.focus()
  await seek.press('Home')
  for (let step = 0; step < 4; step += 1) await seek.press('ArrowRight')
  await setB.click()

  const markerA = timeline.getByRole('slider', { name: 'Loop start marker' })
  const markerB = timeline.getByRole('slider', { name: 'Loop end marker' })
  await expect(markerA).toHaveAttribute('aria-valuenow', '0')
  await expect(markerA).toHaveAttribute('aria-valuetext', 'Beat 1')
  await expect(markerB).toHaveAttribute('aria-valuenow', '0.25')
  await expect(markerB).toHaveAttribute('aria-valuetext', 'Beat 1.25')

  const openFocus = timeline.getByRole('button', {
    name: 'Focus the A B loop',
  })
  await expect(openFocus).toBeVisible()
  const openFocusBounds = await openFocus.boundingBox()
  if (openFocusBounds === null) {
    throw new Error('Focused A B editor action has no pointer bounds')
  }
  await page.mouse.click(
    openFocusBounds.x + openFocusBounds.width / 2,
    openFocusBounds.y + openFocusBounds.height / 2,
  )
  await expect(page.getByTestId('drum-night-loop-precision-lens')).toBeVisible()
  await expect(
    timeline.getByRole('button', {
      name: 'Close the focused loop editor',
    }),
  ).toHaveAttribute('aria-pressed', 'true')

  await timeline
    .getByRole('button', { name: 'Clear A B practice loop' })
    .click()
  await seek.focus()
  await seek.press('End')
  await setB.click()
  const endBeat = await markerB.getAttribute('aria-valuenow')
  expect(Number(endBeat)).toBeGreaterThan(0.25)
  await seek.focus()
  for (let step = 0; step < 4; step += 1) await seek.press('ArrowLeft')
  await setA.click()
  await expect(timeline).toHaveAttribute('data-loop-state', 'active')
  await expect(markerB).toHaveAttribute('aria-valuenow', endBeat ?? '')

  const neighboringFocus = timeline.getByRole('button', {
    name: 'Focus the A B loop',
  })
  await expect(neighboringFocus).toBeVisible()
  const neighboringBounds = await neighboringFocus.boundingBox()
  if (neighboringBounds === null) {
    throw new Error('End-boundary focus action has no pointer bounds')
  }
  await page.mouse.click(
    neighboringBounds.x + neighboringBounds.width / 2,
    neighboringBounds.y + neighboringBounds.height / 2,
  )
  await expect(page.getByTestId('drum-night-loop-precision-lens')).toBeVisible()
})

test('keeps the full song timeline inside Pocket, Seat, and Score at phone and landscape sizes @smoke', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    for (const view of ['pocket', 'seat', 'score'] as const) {
      await page.goto(`/drum-night?view=${view}`, {
        waitUntil: 'domcontentloaded',
      })
      const timeline = page.getByTestId('drum-night-timeline')
      const seek = timeline.getByRole('slider', {
        name: 'Drum part position',
      })
      await expect(timeline).toBeVisible()
      await expect(timeline).toHaveAttribute('data-loop-state', 'full')
      await expect(seek).toBeVisible()

      const geometry = await timeline.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const visibleButtons = [...element.querySelectorAll('button')].filter(
          (button) => {
            const bounds = button.getBoundingClientRect()
            const style = getComputedStyle(button)
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden'
            )
          },
        )
        const undersizedButtons = visibleButtons.filter((button) => {
          const bounds = button.getBoundingClientRect()
          return bounds.width < 44 || bounds.height < 44
        })
        const slider = element.querySelector<HTMLInputElement>(
          'input[type="range"]',
        )
        const sliderRect = slider?.getBoundingClientRect()
        return {
          bottom: rect.bottom,
          left: rect.left,
          pageWidth: document.documentElement.scrollWidth,
          right: rect.right,
          sliderHeight: sliderRect?.height ?? 0,
          top: rect.top,
          undersizedButtons: undersizedButtons.length,
          viewportHeight: document.documentElement.clientHeight,
          viewportWidth: document.documentElement.clientWidth,
        }
      })

      expect(
        geometry.left,
        `${view} ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(0)
      expect(
        geometry.top,
        `${view} ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(0)
      expect(geometry.right, `${view} ${viewport.width}px`).toBeLessThanOrEqual(
        geometry.viewportWidth,
      )
      expect(
        geometry.bottom,
        `${view} ${viewport.width}px`,
      ).toBeLessThanOrEqual(geometry.viewportHeight)
      expect(
        geometry.pageWidth,
        `${view} ${viewport.width}px`,
      ).toBeLessThanOrEqual(geometry.viewportWidth)
      expect(
        geometry.sliderHeight,
        `${view} ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(44)
      expect(geometry.undersizedButtons, `${view} ${viewport.width}px`).toBe(0)
    }

    await page.screenshot({
      path: testInfo.outputPath(`drum-night-timeline-${viewport.width}.png`),
      fullPage: true,
    })
  }
})

test('plays the photographed Drummer Seat with a real pointer at desktop, landscape, and phone sizes @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night?view=seat', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('group', { name: 'Touch drum pads' }),
    ).toHaveCount(0)
    const seatKit = page.getByRole('group', {
      name: 'Playable photographed drum kit',
    })
    await expect(seatKit.getByRole('button')).toHaveCount(6)
    const snare = seatKit.getByRole('button', {
      name: /^Play Acoustic snare/i,
    })
    await expect(snare).toBeVisible()
    const bounds = await snare.boundingBox()
    if (bounds === null) {
      throw new Error(`Seat snare has no pointer bounds at ${viewport.width}px`)
    }
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)

    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )

    await expect(snare).toHaveAttribute('data-live-active', 'true')
    expect((await boundaryCounts(page)).audio).toBe(1)
  }
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
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  await drawer.getByRole('tab', { name: 'Mix' }).click()
  const mixDrawer = page.getByRole('region', { name: 'Balance the room' })

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

  const grooveTrigger = page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
  await grooveTrigger.click()
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  const grooveTab = drawer.getByRole('tab', { name: 'Groove' })
  await expect(grooveTrigger).toBeFocused()
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

test('recomposes for phone and short landscape without overflow or clipped primary controls @smoke', async ({
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
    if (viewport.width <= 720) {
      await expect(touchKit).toBeVisible()
      await expect(touchKit.getByRole('button')).toHaveCount(6)
      await expect(touchKit.getByRole('button').first()).toBeVisible()
      await expect(touchKit.getByRole('button').last()).toBeVisible()
    } else {
      await expect(touchKit).toHaveCount(0)
    }

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
        .find((button) =>
          /^(?:Play|Pause) .+ take clock$/.test(
            button.getAttribute('aria-label') ?? '',
          ),
        )
      const playRect = visiblePlay?.getBoundingClientRect()
      const consoleRect =
        visiblePlay?.parentElement?.parentElement?.getBoundingClientRect()
      const roomRect = document.querySelector('main')?.getBoundingClientRect()
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
        playCenterDelta:
          playRect === undefined || roomRect === undefined
            ? Number.POSITIVE_INFINITY
            : Math.abs(
                playRect.left +
                  playRect.width / 2 -
                  (roomRect.left + roomRect.width / 2),
              ),
        playHeight: playRect?.height ?? 0,
        playRight: playRect?.right ?? Number.POSITIVE_INFINITY,
        playWidth: playRect?.width ?? 0,
        consoleBottom: consoleRect?.bottom ?? Number.POSITIVE_INFINITY,
        consoleLeft: consoleRect?.left ?? Number.NEGATIVE_INFINITY,
        consoleRight: consoleRect?.right ?? Number.POSITIVE_INFINITY,
        roomWidth: roomRect?.width ?? 0,
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
    if (
      (viewport.width === 844 && viewport.height === 390) ||
      (viewport.width === 1440 && viewport.height === 900)
    ) {
      expect(
        geometry.playCenterDelta,
        JSON.stringify(viewport),
      ).toBeLessThanOrEqual(geometry.roomWidth * 0.06)
      expect(
        geometry.playWidth,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(54)
      expect(
        geometry.playHeight,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(54)
      expect(
        geometry.consoleLeft,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(0)
      expect(
        geometry.consoleRight,
        JSON.stringify(viewport),
      ).toBeLessThanOrEqual(viewport.width)
      expect(
        geometry.consoleBottom,
        JSON.stringify(viewport),
      ).toBeLessThanOrEqual(viewport.height)
    }
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

  await page.goto('/drum-night?view=score', {
    waitUntil: 'domcontentloaded',
  })
  const scoreTouchKit = page.getByRole('group', { name: 'Touch drum pads' })
  await expect(scoreTouchKit).toBeVisible()
  await expect(scoreTouchKit.getByRole('button')).toHaveCount(6)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/drum-night?drawer=groove', {
    waitUntil: 'domcontentloaded',
  })
  const landscapeDrawer = page.getByRole('region', {
    name: 'Shape the groove',
  })
  await expect(landscapeDrawer).toBeVisible()
  await landscapeDrawer.getByRole('tab', { name: 'Kit' }).click()
  const kitDrawer = page.getByRole('region', { name: 'Choose the kit' })
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
