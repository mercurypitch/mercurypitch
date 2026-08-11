// Piano Night smoke coverage protects the standalone, source-loading room.
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

async function browserBoundaryCounts(
  page: import('@playwright/test').Page,
): Promise<{
  audio: number
  database: number
  midi: number
  mic: number
  workers: number
}> {
  return page.evaluate(() => {
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

  const fallAlignment = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(
      '[data-testid="piano-night-fall-view"]',
    )
    const guide = document.querySelector<HTMLElement>(
      '[data-testid="piano-night-strike-guide"]',
    )
    const notes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-start-beat="0"]'),
    )
    if (stage === null || guide === null || notes.length === 0) return null
    const stageRect = stage.getBoundingClientRect()
    const guideRect = guide.getBoundingClientRect()
    return notes.map((note) => {
      const noteRect = note.getBoundingClientRect()
      const duration = Number(note.dataset.durationBeats)
      return {
        keyboardOffset: Math.abs(noteRect.bottom - stageRect.bottom),
        guideOffset: Math.abs(noteRect.bottom - guideRect.bottom),
        durationError: Math.abs(
          noteRect.height - stageRect.height * duration * 0.064,
        ),
        striking: note.dataset.striking,
      }
    })
  })
  expect(fallAlignment).not.toBeNull()
  for (const note of fallAlignment ?? []) {
    expect(note.keyboardOffset).toBeLessThanOrEqual(1)
    expect(note.guideOffset).toBeLessThanOrEqual(1)
    expect(note.durationError).toBeLessThanOrEqual(1)
    expect(note.striking).toBe('false')
  }

  const firstPaintCalls = await browserBoundaryCounts(page)
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
      /\/(?:PianoNightMusicPanel|library|local-song-library|piano-library|piano-composition-stage|piano-night-music-source|piano-project-import|pitch-core|vendor-db|vendor-media|vendor-vexflow|advanced)-/.test(
        name,
      ),
    ),
  ).toEqual([])

  expect(pageErrors).toEqual([])
})

test('imports, stages, and reloads a canonical MIDI from Piano Night @smoke', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentFirstPaint(page)
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })

  expect(await browserBoundaryCounts(page)).toEqual({
    audio: 0,
    database: 0,
    midi: 0,
    mic: 0,
    workers: 0,
  })

  await page
    .getByRole('button', { name: 'Choose music for Piano Night' })
    .filter({ visible: true })
    .click()
  const musicPanel = page.getByRole('tabpanel', { name: 'Music' })
  await expect(musicPanel).toBeVisible()
  await expect(musicPanel).toHaveAttribute('aria-busy', 'false')
  await expect
    .poll(async () => (await browserBoundaryCounts(page)).database)
    .toBeGreaterThan(0)
  expect(await browserBoundaryCounts(page)).toMatchObject({
    audio: 0,
    midi: 0,
    mic: 0,
    workers: 0,
  })

  const fileChooserPromise = page.waitForEvent('filechooser')
  await musicPanel.getByRole('button', { name: /Import MIDI/ }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'worker-fixture.mid',
    mimeType: 'audio/midi',
    buffer: TWO_TRACK_MIDI,
  })

  await expect(
    musicPanel.getByRole('heading', { name: 'Arrange worker-fixture' }),
  ).toBeVisible()
  await expect(
    musicPanel.getByRole('radio', { name: /Score Track 1, channel 1/ }),
  ).toBeChecked()
  const hearTrack = musicPanel.getByRole('checkbox', {
    name: /Hear Track 2, channel 2/,
  })
  await expect(hearTrack).toBeChecked()
  await hearTrack.focus()
  await page.keyboard.press('Space')
  await expect(hearTrack).not.toBeChecked()
  expect((await browserBoundaryCounts(page)).audio).toBe(0)
  await page.keyboard.press('Space')
  await expect(hearTrack).toBeChecked()

  const drawer = page.getByRole('dialog', { name: 'Piano Night controls' })
  const drawerClose = drawer.getByRole('button', {
    name: 'Close Piano Night controls',
  })
  const sessionTab = drawer.getByRole('tab', { name: 'Session' })
  await expect(drawerClose).toBeEnabled()
  await expect(sessionTab).toBeEnabled()

  const saveButton = musicPanel.getByRole('button', {
    name: 'Save and stage',
  })
  const pendingSaveState = await saveButton.evaluate((button) => {
    const saveControl = button as HTMLButtonElement
    saveControl.click()
    const panel = document.querySelector('#piano-night-panel-music')
    const controls = document.querySelector('#piano-night-settings')
    const close = controls?.querySelector<HTMLButtonElement>(
      'button[aria-label="Close Piano Night controls"]',
    )
    const session = controls?.querySelector<HTMLButtonElement>(
      '#piano-night-tab-session',
    )
    return {
      busy: panel?.getAttribute('aria-busy'),
      closeDisabled: close?.disabled,
      saveDisabled: saveControl.disabled,
      saveLabel: button.textContent?.trim(),
      sessionDisabled: session?.disabled,
    }
  })
  expect(pendingSaveState).toEqual({
    busy: 'true',
    closeDisabled: true,
    saveDisabled: true,
    saveLabel: 'Saving track choices…',
    sessionDisabled: true,
  })

  await expect(page.getByLabel('Piano Night session status')).toContainText(
    'worker-fixture',
  )
  await expect(page.getByRole('status').last()).toContainText(
    'worker-fixture is on stage.',
  )
  await expect(page.getByText('Loaded project performance')).toBeVisible()
  await expect(
    page.getByText('No authored coaching prompt exists for worker-fixture.'),
  ).toBeVisible()
  await expect(
    page.getByRole('img', {
      name: 'Crescendo from mezzo-piano to mezzo-forte',
    }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('slider', { name: 'Seek piano project' }),
  ).toHaveAttribute('max', '1')
  expect(await browserBoundaryCounts(page)).toMatchObject({
    audio: 0,
    midi: 0,
    mic: 0,
    workers: 1,
  })

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<{
            backingTrackIds: string[]
            count: number
            name: string | null
            sourceKind: string | null
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
                    name?: unknown
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
                  name:
                    typeof record?.project?.name === 'string'
                      ? record.project.name
                      : null,
                  sourceKind:
                    typeof record?.sourceKind === 'string'
                      ? record.sourceKind
                      : null,
                })
                database.close()
              }
            }
          }),
      ),
    )
    .toEqual({
      backingTrackIds: ['smf-t1-c1'],
      count: 1,
      name: 'worker-fixture',
      sourceKind: 'midi',
    })

  await page
    .getByRole('button', { name: 'Open Piano Night settings' })
    .filter({ visible: true })
    .click()
  const sessionPanel = page.getByRole('tabpanel', { name: 'Session' })
  await expect(sessionPanel).toContainText('Imported MIDI')
  await expect(sessionPanel).toContainText('1 pitched part')

  await page.reload({ waitUntil: 'domcontentloaded' })
  expect(await browserBoundaryCounts(page)).toEqual({
    audio: 0,
    database: 0,
    midi: 0,
    mic: 0,
    workers: 0,
  })
  await page
    .getByRole('button', { name: 'Choose music for Piano Night' })
    .filter({ visible: true })
    .click()
  const savedRow = page.getByRole('button', { name: /^worker-fixture/ })
  await expect(savedRow).toBeVisible()
  await savedRow.click()
  await expect(page.getByLabel('Piano Night session status')).toContainText(
    'worker-fixture',
  )
  expect(await browserBoundaryCounts(page)).toMatchObject({
    audio: 0,
    midi: 0,
    mic: 0,
    workers: 0,
  })
  expect(pageErrors).toEqual([])
})

test('moves one bounded fall track without rewriting every note style @smoke', async ({
  page,
}) => {
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })

  const mutations = await page.evaluate(async () => {
    const track = document.querySelector<HTMLElement>(
      '[data-testid="piano-night-fall-track"]',
    )
    const seek = document.querySelector<HTMLInputElement>(
      '[data-testid="piano-night-seek"]',
    )
    if (track === null || seek === null) return null

    let noteStyleMutations = 0
    let trackStyleMutations = 0
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === track) trackStyleMutations += 1
        else if (
          record.target instanceof HTMLElement &&
          record.target.matches('[data-note-id]')
        ) {
          noteStyleMutations += 1
        }
      }
    })
    observer.observe(track, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    })

    for (let index = 1; index <= 20; index += 1) {
      seek.value = String(index / 10)
      seek.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
    }
    observer.disconnect()

    return {
      noteCount: track.querySelectorAll('[data-note-id]').length,
      noteStyleMutations,
      trackStyleMutations,
    }
  })

  expect(mutations).not.toBeNull()
  expect(mutations?.noteCount).toBeGreaterThan(0)
  expect(mutations?.noteCount).toBeLessThan(128)
  expect(mutations?.noteStyleMutations).toBe(0)
  expect(mutations?.trackStyleMutations).toBeGreaterThan(5)
})

test('persists a free Piano room without crossing into sound state @smoke', async ({
  page,
}) => {
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })
  await page
    .getByRole('button', { name: 'Open Piano Night settings' })
    .filter({ visible: true })
    .click()
  await page.getByRole('tab', { name: 'Room' }).click()
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
    name: 'Seek piano project',
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
  const seekValue = Number(await seek.inputValue())
  await expect(seek).toHaveAttribute(
    'aria-valuetext',
    `Beat ${seekValue.toFixed(1)} of 64`,
  )
  await expect
    .poll(async () => {
      const markerBox = await page
        .getByTestId('piano-night-trace-playhead')
        .boundingBox()
      if (markerBox === null) return Number.POSITIVE_INFINITY
      const markerCentre = markerBox.x + markerBox.width / 2
      const expectedCentre = seekBox.x + seekBox.width * (seekValue / 64)
      return Math.abs(markerCentre - expectedCentre)
    })
    .toBeLessThanOrEqual(1)
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
  { name: 'phone landscape', width: 844, height: 390 },
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
      await expect(
        page.getByRole('button', { name: 'Open Piano Night settings' }),
      ).toHaveCount(1)
      await expect(
        page.getByRole('button', { name: 'Choose music for Piano Night' }),
      ).toHaveCount(1)
      const currentPianoLink = page.getByRole('link', {
        name: 'Open the current Piano workspace',
      })
      if (viewport.width <= 900) {
        await expect(currentPianoLink).toHaveCount(0)
        await page
          .getByRole('button', { name: 'Choose music for Piano Night' })
          .click()
        const drawer = page.getByRole('dialog', {
          name: 'Piano Night controls',
        })
        await expect(
          drawer.getByRole('link', {
            name: 'Open the current Piano workspace',
          }),
        ).toBeVisible()
        if (viewport.name === 'phone') {
          const musicPanel = drawer.getByRole('tabpanel', { name: 'Music' })
          await expect(musicPanel).toHaveAttribute('aria-busy', 'false')
          const fileChooserPromise = page.waitForEvent('filechooser')
          await musicPanel.getByRole('button', { name: /Import MIDI/ }).click()
          const fileChooser = await fileChooserPromise
          await fileChooser.setFiles({
            name: 'worker-fixture.mid',
            mimeType: 'audio/midi',
            buffer: TWO_TRACK_MIDI,
          })

          await expect(
            musicPanel.getByRole('heading', {
              name: 'Arrange worker-fixture',
            }),
          ).toBeVisible()
          await expect(
            musicPanel.getByRole('radio', {
              name: /Score Track 1, channel 1/,
            }),
          ).toBeVisible()
          await expect(
            musicPanel.getByRole('checkbox', {
              name: /Hear Track 2, channel 2/,
            }),
          ).toBeVisible()

          const editorMetrics = await drawer.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }))
          expect(editorMetrics.scrollWidth).toBeLessThanOrEqual(
            editorMetrics.clientWidth + 2,
          )
          const saveButton = musicPanel.getByRole('button', {
            name: 'Save and stage',
          })
          await saveButton.scrollIntoViewIfNeeded()
          const drawerBox = await drawer.boundingBox()
          const saveBox = await saveButton.boundingBox()
          expect(saveBox?.x).toBeGreaterThanOrEqual(drawerBox?.x ?? 0)
          expect((saveBox?.x ?? 0) + (saveBox?.width ?? 0)).toBeLessThanOrEqual(
            (drawerBox?.x ?? 0) + (drawerBox?.width ?? 0) + 1,
          )

          await musicPanel
            .getByRole('button', { name: 'Back to music' })
            .click()
          await expect(
            drawer.getByRole('link', {
              name: 'Open the current Piano workspace',
            }),
          ).toBeVisible()
        }
        await drawer
          .getByRole('button', { name: 'Close Piano Night controls' })
          .click()
      } else {
        await expect(currentPianoLink).toHaveCount(1)
      }

      if (viewport.name === 'tablet') {
        const settings = page.getByRole('button', {
          name: 'Open Piano Night settings',
        })
        await settings.focus()
        await settings.click()
        const close = page.getByRole('button', {
          name: 'Close Piano Night controls',
        })
        await expect(close).toBeFocused()
        await close.click()
        await expect(settings).toBeFocused()
      }

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

      const compactKeyboard =
        viewport.width <= 680 ||
        (viewport.width <= 900 && viewport.height <= 500)
      if (compactKeyboard) {
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
        await expect(
          page
            .getByTestId('piano-night-keyboard')
            .locator('button[data-in-range="false"]:visible'),
        ).toHaveCount(0)
      }

      if (viewport.name === 'phone landscape') {
        const fallBox = await page
          .getByTestId('piano-night-fall-view')
          .boundingBox()
        expect(fallBox?.height).toBeGreaterThanOrEqual(100)

        await page
          .getByRole('button', { name: 'Open Piano Night settings' })
          .filter({ visible: true })
          .click()
        const drawer = page.getByRole('dialog', {
          name: 'Piano Night controls',
        })
        await drawer.getByRole('tab', { name: 'Sound' }).click()
        const heading = drawer.getByRole('heading', {
          name: 'Mercury Felt Synth',
        })
        await expect(heading).toBeVisible()
        const drawerBox = await drawer.boundingBox()
        const headingBox = await heading.boundingBox()
        expect(headingBox?.y).toBeGreaterThanOrEqual(drawerBox?.y ?? 0)
        expect(
          (headingBox?.y ?? Number.POSITIVE_INFINITY) +
            (headingBox?.height ?? 0),
        ).toBeLessThanOrEqual(
          (drawerBox?.y ?? 0) + (drawerBox?.height ?? 0) + 1,
        )
        await drawer
          .getByRole('button', { name: 'Close Piano Night controls' })
          .click()
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
