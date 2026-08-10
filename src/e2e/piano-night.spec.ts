// Piano Night smoke coverage protects the standalone prepared-project room.
// ============================================================

import { devices, expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

const TWO_TRACK_MIDI = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x02, 0x01,
  0xe0, 0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x0d, 0x00, 0x90, 0x3c, 0x64,
  0x83, 0x60, 0x80, 0x3c, 0x20, 0x00, 0xff, 0x2f, 0x00, 0x4d, 0x54, 0x72, 0x6b,
  0x00, 0x00, 0x00, 0x0d, 0x00, 0x91, 0x40, 0x5a, 0x83, 0x60, 0x81, 0x40, 0x20,
  0x00, 0xff, 0x2f, 0x00,
])

async function instrumentFirstPaint(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __pianoNightAudioContexts: number
      __pianoNightDatabaseOpens: number
      __pianoNightMidiRequests: number
      __pianoNightMicRequests: number
      __pianoNightWorkers: number
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    trackedWindow.__pianoNightAudioContexts = 0
    trackedWindow.__pianoNightDatabaseOpens = 0
    trackedWindow.__pianoNightMidiRequests = 0
    trackedWindow.__pianoNightMicRequests = 0
    trackedWindow.__pianoNightWorkers = 0

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

    const NativeWorker = window.Worker
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        trackedWindow.__pianoNightWorkers += 1
        return Reflect.construct(target, args, newTarget)
      },
    })

    const nativeDatabaseOpen = indexedDB.open.bind(indexedDB)
    indexedDB.open = ((name: string, version?: number) => {
      trackedWindow.__pianoNightDatabaseOpens += 1
      return version === undefined
        ? nativeDatabaseOpen(name)
        : nativeDatabaseOpen(name, version)
    }) as IDBFactory['open']

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

test('loads the prepared standalone room with a silent first paint @smoke', async ({
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
    page.getByText('Afterglow Study in E-flat').first(),
  ).toBeVisible()
  await expect(page.getByText('Prepared project performance')).toBeVisible()
  await expect(page.getByText('bars 1–4 · Afterglow Studio')).toBeVisible()
  await expect(page.getByTestId('piano-night-keyboard')).toBeVisible()
  await expect(
    page.getByTestId('piano-night-keyboard').locator('button[data-midi]'),
  ).toHaveCount(88)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )

  const firstPaintCalls = await page.evaluate(() => {
    const trackedWindow = window as unknown as {
      __pianoNightAudioContexts: number
      __pianoNightDatabaseOpens: number
      __pianoNightMidiRequests: number
      __pianoNightMicRequests: number
      __pianoNightWorkers: number
    }
    return {
      audio: trackedWindow.__pianoNightAudioContexts,
      database: trackedWindow.__pianoNightDatabaseOpens,
      midi: trackedWindow.__pianoNightMidiRequests,
      mic: trackedWindow.__pianoNightMicRequests,
      workers: trackedWindow.__pianoNightWorkers,
    }
  })
  expect(firstPaintCalls).toEqual({
    audio: 0,
    database: 0,
    midi: 0,
    mic: 0,
    workers: 0,
  })

  const loadedResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('/assets/')),
  )
  expect(
    loadedResources.filter((name) =>
      /\/(?:library|local-song-library|piano-library|pitch-core|vendor-db|vendor-media|vendor-vexflow|advanced)-/.test(
        name,
      ),
    ),
  ).toEqual([])

  expect(pageErrors).toEqual([])
})

test('persists a free Piano room without crossing into sound state @smoke', async ({
  page,
}) => {
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Room' }).click()
  await page.getByRole('button', { name: /Morning Conservatory/ }).click()

  await expect(page.getByTestId('piano-night-shell')).toHaveAttribute(
    'data-room',
    'piano-morning-conservatory',
  )
  await expect(page.getByTestId('piano-night-shell')).toHaveAttribute(
    'data-room-treatment',
    'light',
  )
  await expect(page.getByRole('status').last()).toContainText(
    'Instrument sound unchanged.',
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('pitchperfect_piano_background'),
      ),
    )
    .toBe('piano-morning-conservatory')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('piano-night-shell')).toHaveAttribute(
    'data-room',
    'piano-morning-conservatory',
  )
})

test('plays a key and seeks the prepared project with a real pointer @smoke', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentFirstPaint(page)
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })

  const seek = page.getByRole('slider', {
    name: 'Seek prepared piano project',
  })
  await expect(seek).toBeVisible()
  const seekBox = await seek.boundingBox()
  if (seekBox === null) throw new Error('Piano Night seek has no bounding box')
  const beforeSeek = Number(await seek.inputValue())

  await page.mouse.move(
    seekBox.x + seekBox.width * 0.15,
    seekBox.y + seekBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    seekBox.x + seekBox.width * 0.64,
    seekBox.y + seekBox.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()

  await expect
    .poll(async () => Number(await seek.inputValue()))
    .toBeGreaterThan(beforeSeek)
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __pianoNightAudioContexts: number })
          .__pianoNightAudioContexts,
    ),
  ).toBe(0)

  const middleC = page.getByRole('button', { name: 'Play C4' })
  await expect(middleC).toBeVisible()
  const keyBox = await middleC.boundingBox()
  if (keyBox === null) throw new Error('Middle C has no bounding box')

  await page.mouse.move(
    keyBox.x + keyBox.width / 2,
    keyBox.y + keyBox.height * 0.82,
  )
  await page.mouse.down()
  try {
    await expect(middleC).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('status')).toContainText(
      'Playing 60 from the touch keyboard.',
    )
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __pianoNightAudioContexts: number })
              .__pianoNightAudioContexts,
        ),
      )
      .toBe(1)
  } finally {
    await page.mouse.up()
  }
  await expect(middleC).toHaveAttribute('aria-pressed', 'false')
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

test('imports and persists a canonical Piano project in the browser @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.removeItem('pitchperfect_guitar_songs')
  })

  await page.goto('/#/piano')
  await dismissOverlays(page)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import MIDI' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'worker-fixture.mid',
    mimeType: 'audio/midi',
    buffer: TWO_TRACK_MIDI,
  })

  const trackChooser = page.getByRole('heading', {
    name: 'Choose Tracks — worker-fixture',
  })
  await expect(trackChooser).toBeVisible()
  const trackModal = trackChooser.locator('..').locator('..')
  await trackModal.getByRole('radio').nth(1).check()
  await trackModal.getByRole('checkbox').nth(0).check()
  await trackModal.getByRole('button', { name: 'Load Song' }).click()

  const statusBar = page.getByTestId('fn-song-status-bar')
  await expect(statusBar).toContainText('Loaded: worker-fixture')

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<{
            backingTrackIds: string[]
            count: number
            fileName: string | null
            scoreTrackId: string | null
            sourceKind: string | null
            trackCount: number
          }>((resolve, reject) => {
            const open = indexedDB.open('MercuryPitchDB')
            open.onerror = () => reject(open.error)
            open.onsuccess = () => {
              const database = open.result
              const transaction = database.transaction(
                'pianoProjects',
                'readonly',
              )
              const request = transaction.objectStore('pianoProjects').getAll()
              request.onerror = () => reject(request.error)
              request.onsuccess = () => {
                const records = request.result as Array<{
                  project?: {
                    backingTrackIds?: unknown[]
                    scoreTrackId?: unknown
                    source?: { fileName?: unknown; kind?: unknown }
                    tracks?: unknown[]
                  }
                  sourceKind?: unknown
                }>
                const record = records[0]
                resolve({
                  backingTrackIds: Array.isArray(
                    record?.project?.backingTrackIds,
                  )
                    ? record.project.backingTrackIds.filter(
                        (value): value is string => typeof value === 'string',
                      )
                    : [],
                  count: records.length,
                  fileName:
                    typeof record?.project?.source?.fileName === 'string'
                      ? record.project.source.fileName
                      : null,
                  scoreTrackId:
                    typeof record?.project?.scoreTrackId === 'string'
                      ? record.project.scoreTrackId
                      : null,
                  sourceKind:
                    typeof record?.sourceKind === 'string'
                      ? record.sourceKind
                      : null,
                  trackCount: Array.isArray(record?.project?.tracks)
                    ? record.project.tracks.length
                    : 0,
                })
                database.close()
              }
            }
          }),
      ),
    )
    .toEqual({
      backingTrackIds: ['smf-t0-c0'],
      count: 1,
      fileName: 'worker-fixture.mid',
      scoreTrackId: 'smf-t1-c1',
      sourceKind: 'midi',
      trackCount: 2,
    })

  expect(
    await page.evaluate(() =>
      localStorage.getItem('pitchperfect_guitar_songs'),
    ),
  ).toBeNull()
})

const RESPONSIVE_VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'short desktop', width: 1440, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test(`recomposes the standalone room for a ${viewport.name} @smoke`, async ({
    browser,
  }) => {
    const baseURL = test.info().project.use.baseURL
    const context = await browser.newContext({
      ...(viewport.name === 'phone' ? devices['iPhone 12'] : {}),
      baseURL,
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })

    try {
      const response = await page.goto('/piano-night', {
        waitUntil: 'domcontentloaded',
      })
      expect(response?.ok()).toBe(true)

      const roomImage = await page
        .getByTestId('piano-night-room-art')
        .evaluate((element) => getComputedStyle(element).backgroundImage)
      expect(roomImage).toContain(
        viewport.height > viewport.width
          ? 'afterglow-studio-portrait.webp'
          : 'afterglow-studio-landscape.webp',
      )

      const metrics = await page.evaluate(() => ({
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 2)
      await expect(page.getByTestId('piano-night-play')).toHaveCount(1)
      await expect(
        page.getByTestId('piano-night-keyboard').locator('button[data-midi]'),
      ).toHaveCount(88)

      const hud = page.getByLabel('Piano Night session status')
      const hudBox = await hud.boundingBox()
      const viewBox = await hud
        .getByRole('button', { name: /Change performance view/ })
        .boundingBox()
      expect(viewBox?.y).toBeGreaterThanOrEqual(hudBox?.y ?? 0)
      expect((viewBox?.y ?? 0) + (viewBox?.height ?? 0)).toBeLessThanOrEqual(
        (hudBox?.y ?? 0) + (hudBox?.height ?? 0) + 1,
      )

      const playBox = await page.getByTestId('piano-night-play').boundingBox()
      expect(playBox?.width).toBeGreaterThanOrEqual(44)
      expect(playBox?.height).toBeGreaterThanOrEqual(44)

      if (viewport.width <= 680) {
        const range = page.getByLabel('Touch keyboard range')
        await expect(range).toBeVisible()
        for (const button of await range.getByRole('button').all()) {
          const target = await button.boundingBox()
          expect(target?.width).toBeGreaterThanOrEqual(44)
          expect(target?.height).toBeGreaterThanOrEqual(44)
        }
        await expect(
          page
            .getByTestId('piano-night-keyboard')
            .locator('button[data-in-range="true"]'),
        ).toHaveCount(25)
      }

      if (viewport.width <= 1180) {
        await page.getByRole('button', { name: 'Coach', exact: true }).click()
        const coach = page.getByRole('region', {
          name: 'Phrase practice prompt',
        })
        await expect(coach).toBeVisible()
        const coachBox = await coach.boundingBox()
        const keyboardBox = await page
          .getByTestId('piano-night-keyboard')
          .boundingBox()
        expect(
          (coachBox?.y ?? 0) + (coachBox?.height ?? 0),
        ).toBeLessThanOrEqual(keyboardBox?.y ?? Number.POSITIVE_INFINITY)
        await expect(
          coach.getByRole('button', {
            name: 'Close phrase practice prompt',
          }),
        ).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(
          page.locator('[aria-label="Phrase practice prompt"]'),
        ).toHaveAttribute('aria-hidden', 'true')
      } else {
        const coach = page.getByRole('complementary', {
          name: 'Phrase practice prompt',
        })
        await expect(coach).toBeVisible()
        const coachBox = await coach.boundingBox()
        const keyboardBox = await page
          .getByTestId('piano-night-keyboard')
          .boundingBox()
        expect(
          (coachBox?.y ?? 0) + (coachBox?.height ?? 0),
        ).toBeLessThanOrEqual(keyboardBox?.y ?? Number.POSITIVE_INFINITY)
      }
    } finally {
      await context.close()
    }
  })
}
