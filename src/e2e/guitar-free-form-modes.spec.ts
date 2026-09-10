// Free-form modes retain one live route and stage while replay and accepted-note scoring stay explicit.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import type { GuitarScoreTakeSummary } from '../lib/guitar/guitar-score-history'
import { GUITAR_SCORE_HISTORY_STORAGE_KEY } from '../lib/guitar/guitar-score-history'
import { installSongAudioProbe } from './helpers/guitar-night-audio-probe'
import { enterRecording, RECORDING_ID } from './helpers/guitar-recording'

test.use({ viewport: { width: 1440, height: 900 } })

const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(browserErrors.get(page), 'No uncaught browser errors').toEqual([])
})

async function enterLive(page: Page): Promise<void> {
  await installSongAudioProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Free play', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-deck')).toBeVisible()
}

async function selectMode(page: Page, name: 'Live' | 'Replay' | 'Practice') {
  const button = page
    .getByRole('group', { name: 'Free-form mode' })
    .getByRole('button', { name, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

async function databaseState(page: Page) {
  return page.evaluate(async () => {
    const request = window.indexedDB.open('MercuryPitchDB')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const stores = [
      'guitarRecordings',
      'guitarRecordingChunks',
      'guitarPracticeScores',
    ]
    const transaction = database.transaction(stores, 'readonly')
    const read = (store: string) =>
      new Promise<Array<{ id: string; scoreId?: string | null }>>(
        (resolve, reject) => {
          const operation = transaction.objectStore(store).getAll()
          operation.onsuccess = () => resolve(operation.result)
          operation.onerror = () => reject(operation.error)
        },
      )
    try {
      const [recordings, chunks, scores] = await Promise.all(stores.map(read))
      return {
        recordings: recordings.map(({ id, scoreId }) => ({ id, scoreId })),
        chunks: chunks.length,
        scores: scores.map(({ id }) => id),
      }
    } finally {
      database.close()
    }
  })
}

async function enableDirectMonitor(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  await session
    .getByRole('region', { name: 'Listening input', exact: true })
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  await session
    .getByRole('button', {
      name: 'Start Listening and monitoring',
      exact: true,
    })
    .click()
  await expect(
    session.getByRole('button', { name: 'Turn monitoring off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  await session
    .getByRole('button', { name: 'Close Session', exact: true })
    .click()
  await expect(session).not.toBeVisible()
}

async function expectFreshMonitorAudio(page: Page): Promise<number> {
  const baseline = await page.evaluate(() => {
    const frame = window.__songAudioProbe.frames.at(-1)
    return { context: frame?.context ?? 0, time: frame?.time ?? 0 }
  })
  // Check fresh, genuinely rendered output: a retained track alone can be silent.
  await expect
    .poll(() =>
      page.evaluate(({ context, time }) => {
        const frames = window.__songAudioProbe.frames
          .filter(
            (frame) => frame.context === context && frame.time > time + 0.08,
          )
          .slice(-8)
        if (frames.length < 8) return 0
        const samples = frames.flatMap((frame) => frame.samples)
        return Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
            samples.length,
        )
      }, baseline),
    )
    .toBeGreaterThan(0.001)
  expect(
    await page.evaluate(() =>
      window.__songAudioProbe.micTracks.map((track) => track.readyState),
    ),
  ).toEqual(['live'])
  return baseline.context
}

async function scoreHistory(page: Page): Promise<GuitarScoreTakeSummary[]> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    GUITAR_SCORE_HISTORY_STORAGE_KEY,
  )
}

async function enterSixNoteRecording(page: Page): Promise<void> {
  await enterRecording(page)
  // Only the stored transcription changes. The real detector, target builder,
  // clock, scorer, accepted revision and output graph remain production code.
  await page.evaluate(async (id) => {
    const request = window.indexedDB.open('MercuryPitchDB')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(
      'guitarRecordingChunks',
      'readwrite',
    )
    const store = transaction.objectStore('guitarRecordingChunks')
    const ending = store.get(`${id}:ending`)
    ending.onsuccess = () =>
      store.put({
        ...ending.result,
        notes: Array.from({ length: 6 }, (_, index) => ({
          id: `practice-${index}`,
          midi: 45,
          startFrame: index * 48000,
          endFrame: (index + 0.75) * 48000,
          clarity: 0.96,
          onset: 'attack',
        })),
      })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  }, RECORDING_ID)
  await page.reload()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
}

async function dragSeek(
  page: Page,
  seek: Locator,
  fraction: number,
): Promise<void> {
  const original = await seek.elementHandle()
  const bounds = await seek.boundingBox()
  if (bounds === null || original === null)
    throw new Error('Seek rail has no mouse target')
  const maximum = Number(await seek.getAttribute('max'))
  const position = Number(await seek.inputValue()) / maximum
  // A marker at the current playhead legitimately owns that point. Start a
  // seek gesture on exposed rail, then test the A handle separately below.
  const start = await seek.evaluate((element, current) => {
    const rect = element.getBoundingClientRect()
    return (
      [current, 0.05, 0.95, 0.5].find(
        (part) =>
          document.elementFromPoint(
            rect.x + 8 + part * (rect.width - 16),
            rect.y + rect.height / 2,
          ) === element,
      ) ?? null
    )
  }, position)
  if (start === null) throw new Error('Seek rail has no uncovered mouse target')
  const x = (part: number) => bounds.x + 8 + part * (bounds.width - 16)
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x(start), y)
  await page.mouse.down()
  await page.mouse.move(x((start + fraction) / 2), y, { steps: 5 })
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await page.mouse.move(x(fraction), y, { steps: 5 })
  await page.mouse.up()
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await expect
    .poll(async () =>
      Math.abs(Number(await seek.inputValue()) - maximum * fraction),
    )
    .toBeLessThan(0.4)
}

async function practiceOption(page: Page, id: string): Promise<void> {
  await page
    .getByRole('button', { name: 'Practice tempo and loop', exact: true })
    .click()
  await page.getByTestId(`overflow-practice-${id}`).click()
}

test('starts Live silently and never records input without Record @smoke', async ({
  page,
}) => {
  await enterLive(page)
  await expect(
    page
      .getByRole('group', { name: 'Free-form mode' })
      .getByRole('button', { name: 'Live', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const deck = page.getByTestId('guitar-recorder-deck')
  await expect(deck).toHaveAttribute('data-recording', 'false')
  await expect(
    deck.getByRole('button', { name: 'Record a melody', exact: true }),
  ).toBeEnabled()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(await databaseState(page)).toEqual({
    recordings: [],
    chunks: 0,
    scores: [],
  })

  await enableDirectMonitor(page)
  await expectFreshMonitorAudio(page)
  await expect(
    page.getByRole('img', {
      name: /^Live input · you played\. [1-9]\d* heard notes\./,
    }),
  ).toBeVisible()
  await expect(deck).toHaveAttribute('data-recording', 'false')
  expect(await databaseState(page)).toEqual({
    recordings: [],
    chunks: 0,
    scores: [],
  })
  expect(await scoreHistory(page)).toEqual([])
})

test('parks Replay through Live without replacing the canvas, source or playhead @smoke', async ({
  page,
}) => {
  const deck = await enterRecording(page)
  const stage = page.getByTestId('guitar-night-stage').locator('canvas').first()
  await expect(stage).toBeVisible()
  const original = await stage.elementHandle()
  if (original === null) throw new Error('Shared stage has no canvas')
  const saved = await databaseState(page)
  await deck
    .getByRole('button', { name: 'Playback source', exact: true })
    .click()
  await page.getByRole('menuitemradio', { name: /^Notes/ }).click()
  const seek = page.getByTestId('guitar-recording-timeline')
  await dragSeek(page, seek, 0.4)
  const parked = Number(await seek.inputValue())
  await selectMode(page, 'Live')
  await expect(seek).toHaveCount(0)
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await selectMode(page, 'Replay')
  await expect(
    deck.getByRole('button', { name: 'Play recorded notes', exact: true }),
  ).toBeEnabled()
  expect(Math.abs(Number(await seek.inputValue()) - parked)).toBeLessThan(0.05)
  expect(
    await original.evaluate(
      (element) =>
        element ===
        document.querySelector('[data-testid="guitar-night-stage"] canvas'),
    ),
  ).toBe(true)
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(await databaseState(page)).toEqual(saved)
  expect(await scoreHistory(page)).toEqual([])
})

test('admits accepted notes explicitly and scores with the same opt-in DI monitor @smoke', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await enterSixNoteRecording(page)
  const before = await databaseState(page)
  expect(before.scores).toEqual([])
  const canvas = await page
    .getByTestId('guitar-night-stage')
    .locator('canvas')
    .first()
    .elementHandle()
  await selectMode(page, 'Practice')
  const deck = page.getByTestId('guitar-free-form-practice-deck')
  await expect(deck).toBeVisible()
  const admitted = await databaseState(page)
  expect(admitted.scores).toHaveLength(1)
  expect(admitted.recordings[0].scoreId).toBe(admitted.scores[0])
  expect(admitted.chunks).toBe(before.chunks)
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(
    await page.evaluate(() => window.__songAudioProbe.sources.length),
  ).toBe(0)
  await deck.getByRole('button', { name: 'Play practice', exact: true }).click()
  await expect(
    page.getByText(
      'Turn on Listening to score your playing against these notes.',
      { exact: true },
    ),
  ).toBeVisible()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  await expect(page.getByTestId('guitar-night-live-score')).toHaveAttribute(
    'data-state',
    'needs-input',
  )
  expect(
    await page.evaluate(() => window.__songAudioProbe.sources.length),
  ).toBe(0)
  expect(await scoreHistory(page)).toEqual([])

  await page
    .getByRole('dialog', { name: 'Enable Listening to practice', exact: true })
    .getByRole('button', { name: 'Close practice input', exact: true })
    .click()
  await enableDirectMonitor(page)
  const monitorContext = await expectFreshMonitorAudio(page)
  // Make the musical count-in observable independently of saved preferences.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page
      .getByRole('button', { name: 'Practice tempo and loop', exact: true })
      .click()
    const countIn = page.getByTestId('overflow-practice-count-in')
    const label = await countIn.textContent()
    if (label !== null && label.includes('2 beats')) {
      await page
        .getByRole('button', { name: 'Practice tempo and loop', exact: true })
        .click()
      break
    }
    await countIn.click()
  }
  await deck.getByRole('button', { name: 'Play practice', exact: true }).click()
  const liveScore = page.getByTestId('guitar-night-live-score')
  await expect(liveScore).toHaveAttribute('data-state', 'count-in')
  await expect(liveScore).toHaveAttribute('data-state', 'complete', {
    timeout: 30_000,
  })
  await expect.poll(async () => (await scoreHistory(page)).length).toBe(1)
  const [summary] = await scoreHistory(page)
  expect(summary.status).toBe('completed')
  expect(summary.inputKind).toBe('interface')
  expect(summary.counts.targetCount).toBe(6)
  expect(summary.counts.judgedTargets).toBeGreaterThanOrEqual(4)
  expect(summary.score).not.toBeNull()
  expect(summary.grade).not.toBeNull()
  await test.info().attach('Completed real-scorer summary', {
    body: Buffer.from(JSON.stringify(summary, null, 2)),
    contentType: 'application/json',
  })
  expect(await expectFreshMonitorAudio(page)).toBe(monitorContext)

  for (const mode of ['Live', 'Replay', 'Practice'] as const) {
    await selectMode(page, mode)
    if (mode === 'Replay') {
      await page
        .getByRole('button', { name: 'Play recording', exact: true })
        .click()
      await expect(
        page.getByRole('button', {
          name: 'Pause recording replay',
          exact: true,
        }),
      ).toBeVisible()
    }
    expect(await expectFreshMonitorAudio(page)).toBe(monitorContext)
  }
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true)
  const final = await databaseState(page)
  expect(final.recordings).toEqual(admitted.recordings)
  expect(final.chunks).toBe(admitted.chunks)
  expect(final.scores).toEqual(admitted.scores)
  expect(await scoreHistory(page)).toHaveLength(1)
})

test('commits held mouse scrubs and A/B drags without starting input or scoring @smoke', async ({
  page,
}) => {
  await enterRecording(page)
  await selectMode(page, 'Practice')
  const deck = page.getByTestId('guitar-free-form-practice-deck')
  const seek = deck.getByRole('slider', {
    name: 'Practice position',
    exact: true,
  })
  await dragSeek(page, seek, 0.2)
  await practiceOption(page, 'mark-a')
  await dragSeek(page, seek, 0.8)
  await practiceOption(page, 'mark-b')
  const marker = page.getByTestId('guitar-free-form-practice-loop-marker-a')
  const original = await marker.elementHandle()
  const markerBounds = await marker.boundingBox()
  const railBounds = await page
    .getByTestId('guitar-free-form-practice-loop-range')
    .boundingBox()
  if (original === null || markerBounds === null || railBounds === null)
    throw new Error('Loop has no mouse target')
  const before = Number(await marker.getAttribute('aria-valuenow'))
  const x = markerBounds.x + markerBounds.width / 2
  const y = markerBounds.y + markerBounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + railBounds.width * 0.1, y, { steps: 5 })
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await page.mouse.move(x + railBounds.width * 0.2, y, { steps: 5 })
  await page.mouse.up()
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await expect
    .poll(async () => Number(await marker.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before)
  await expect(
    deck.getByRole('button', { name: 'Play practice', exact: true }),
  ).toBeEnabled()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(await scoreHistory(page)).toEqual([])
})

for (const width of [320, 390, 1440]) {
  test(`keeps the Practice deck in two usable rows at ${width}px @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await enterRecording(page)
    await selectMode(page, 'Practice')
    const heading = page.getByTestId('guitar-session-heading')
    const modes = heading.getByRole('group', { name: 'Free-form mode' })
    await expect(modes).toBeVisible()
    const headerShape = await heading.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const title = element.querySelector('h1')!.getBoundingClientRect()
      const modes = element.querySelector('[aria-label="Free-form mode"]')!
      const modeBounds = modes.getBoundingClientRect()
      const tools = element
        .querySelector('[aria-label="Room tools"]')!
        .getBoundingClientRect()
      return {
        left: bounds.left,
        right: bounds.right,
        titleRight: title.right,
        modeLeft: modeBounds.left,
        modeRight: modeBounds.right,
        toolsLeft: tools.left,
        withinHeader:
          modeBounds.top >= bounds.top && modeBounds.bottom <= bounds.bottom,
        controls: [...modes.querySelectorAll('button')].map((button) => {
          const rect = button.getBoundingClientRect()
          return {
            width: rect.width,
            height: rect.height,
            receivesPointer: button.contains(
              document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              ),
            ),
          }
        }),
      }
    })
    expect(headerShape.withinHeader).toBe(true)
    expect(headerShape.modeLeft).toBeGreaterThanOrEqual(headerShape.left)
    expect(headerShape.modeRight).toBeLessThanOrEqual(headerShape.right)
    if (width > 900) {
      expect(headerShape.modeLeft).toBeGreaterThan(headerShape.titleRight)
      expect(headerShape.modeRight).toBeLessThan(headerShape.toolsLeft)
    }
    for (const control of headerShape.controls) {
      expect(control.width).toBeGreaterThanOrEqual(44)
      expect(control.height).toBeGreaterThanOrEqual(44)
      expect(control.receivesPointer).toBe(true)
    }
    const deck = page.getByTestId('guitar-free-form-practice-deck')
    const shape = await deck.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const controls = [
        ...element.querySelectorAll('button,input[type="range"]'),
      ]
        .filter((control) => control.getClientRects().length > 0)
        .map((control) => {
          const bounds = control.getBoundingClientRect()
          return {
            name: control.getAttribute('aria-label'),
            width: bounds.width,
            height: bounds.height,
            y: bounds.y + bounds.height / 2,
            receivesPointer: control.contains(
              document.elementFromPoint(
                bounds.x + bounds.width / 2,
                bounds.y + bounds.height / 2,
              ),
            ),
          }
        })
      return {
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        controls,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      }
    })
    const screenshot = test.info().outputPath(`free-form-practice-${width}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    await test.info().attach(`Practice ${width}px`, {
      path: screenshot,
      contentType: 'image/png',
    })
    expect(shape.left).toBeGreaterThanOrEqual(0)
    expect(shape.right).toBeLessThanOrEqual(width + 1)
    expect(shape.bottom).toBeLessThanOrEqual(901)
    expect(shape.overflow).toBeLessThanOrEqual(1)
    const rows: number[] = []
    for (const control of shape.controls) {
      expect(control.width, `${control.name} width`).toBeGreaterThanOrEqual(44)
      expect(control.height, `${control.name} height`).toBeGreaterThanOrEqual(
        44,
      )
      expect(control.receivesPointer, `${control.name} is not covered`).toBe(
        true,
      )
      if (!rows.some((row) => Math.abs(row - control.y) < 16))
        rows.push(control.y)
    }
    expect(rows).toHaveLength(2)
  })
}
