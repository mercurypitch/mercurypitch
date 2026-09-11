// Recorder transport retains a compact two-row layout and uninterrupted real-pointer seeking.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { DURATION, enterRecording, RECORDING_ID, } from './helpers/guitar-recording'

async function chooseSource(
  page: Page,
  deck: Locator,
  source: 'Recording' | 'Notes',
): Promise<void> {
  await deck
    .getByRole('button', { name: 'Playback source', exact: true })
    .click()
  await page
    .getByRole('menuitemradio', { name: new RegExp(`^${source}`) })
    .click()
}

async function chooseClean(page: Page, deck: Locator): Promise<void> {
  await deck.getByRole('button', { name: 'Playback tone', exact: true }).click()
  await page.getByRole('menuitemradio', { name: /^Clean/ }).click()
}

async function dragPosition(
  page: Page,
  timeline: Locator,
  fraction: number,
): Promise<number> {
  const original = await timeline.elementHandle()
  const bounds = await timeline.boundingBox()
  if (bounds === null || original === null)
    throw new Error('Take timeline has no pointer target')
  const min = Number(await timeline.getAttribute('min'))
  const max = Number(await timeline.getAttribute('max'))
  const start = (Number(await timeline.inputValue()) - min) / (max - min)
  const x = (part: number) => bounds.x + 8 + part * (bounds.width - 16)
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x(start), y)
  await page.mouse.down()
  await page.mouse.move(x((start + fraction) / 2), y, { steps: 5 })
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  await page.mouse.move(x(fraction), y, { steps: 5 })
  await page.mouse.up()
  expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  const target = min + fraction * (max - min)
  await expect
    .poll(async () => Number(await timeline.inputValue()))
    .toBeGreaterThan(target - 0.5)
  await expect
    .poll(async () => Number(await timeline.inputValue()))
    .toBeLessThan(target + 0.7)
  return target
}

async function expectFrequency(
  page: Page,
  wanted: number,
  absent: number,
): Promise<void> {
  // Read actual rendered PCM after the seek rather than accepting just a moving thumb.
  const start = await page.evaluate(
    () => window.__songAudioProbe.frames.at(-1)?.time ?? 0,
  )
  await expect
    .poll(() =>
      page.evaluate(
        ({ after, frequency, unwanted }) => {
          const frames = window.__songAudioProbe.frames
            .filter((frame) => frame.time > after + 0.08)
            .slice(-10)
          if (frames.length < 10) return 0
          const samples = frames.flatMap((frame) => frame.samples)
          const amplitude = (hz: number) => {
            let real = 0,
              imaginary = 0
            for (let index = 0; index < samples.length; index++) {
              const weight =
                0.5 -
                0.5 * Math.cos((2 * Math.PI * index) / (samples.length - 1))
              const phase = (2 * Math.PI * hz * index) / frames[0].rate
              real += samples[index] * weight * Math.cos(phase)
              imaginary += samples[index] * weight * Math.sin(phase)
            }
            return Math.hypot(real, imaginary) / samples.length
          }
          const signal = amplitude(frequency)
          return signal > 0.0001
            ? signal / Math.max(0.000001, amplitude(unwanted))
            : 0
        },
        { after: start, frequency: wanted, unwanted: absent },
      ),
    )
    .toBeGreaterThan(4)
    .catch(async (error: unknown) => {
      const diagnostics = await page.evaluate(() => ({
        micCalls: window.__songAudioProbe.micCalls,
        sources: window.__songAudioProbe.sources.map(({ source, when }) => ({
          when,
          clock: source.context.currentTime,
          state: source.context.state,
          duration: source.buffer?.duration,
          rate: source.playbackRate.value,
        })),
        frames: window.__songAudioProbe.frames.slice(-100).map((frame) => ({
          context: frame.context,
          time: frame.time,
          rate: frame.rate,
          rms: Math.sqrt(
            frame.samples.reduce((sum, sample) => sum + sample * sample, 0) /
              frame.samples.length,
          ),
          peak: Math.max(...frame.samples.map(Math.abs)),
        })),
      }))
      await test.info().attach(`seek-pcm-failure-${wanted}`, {
        body: JSON.stringify(
          { wanted, absent, start, ...diagnostics },
          null,
          2,
        ),
        contentType: 'application/json',
      })
      throw error
    })
}

for (const source of ['Recording', 'Notes'] as const) {
  test(`seeks ${source} before and during playback with a held mouse gesture @smoke`, async ({
    page,
  }) => {
    test.setTimeout(45000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const deck = await enterRecording(page)
    const timeline = page.getByTestId('guitar-recording-timeline')
    await expect(timeline).toBeVisible({ timeout: 3000 })
    await expect(timeline).toHaveAccessibleName('Take position')
    await expect(timeline).toHaveAttribute('max', String(DURATION))
    await chooseSource(page, deck, source)
    await chooseClean(page, deck)
    const playName =
      source === 'Recording' ? 'Play recording' : 'Play recorded notes'
    const pauseName =
      source === 'Recording' ? 'Pause recording replay' : 'Pause note playback'
    await dragPosition(page, timeline, 0.65)
    await expect(
      deck.getByRole('button', { name: playName, exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() =>
        window.__songAudioProbe.media.some((media) => !media.paused),
      ),
    ).toBe(false)
    expect(
      await page.evaluate(() => window.__songAudioProbe.sources.length),
    ).toBe(0)

    await deck.getByRole('button', { name: playName, exact: true }).click()
    await expect(
      deck.getByRole('button', { name: pauseName, exact: true }),
    ).toBeVisible()
    await expectFrequency(
      page,
      source === 'Recording' ? 220 : 329.6276,
      source === 'Recording' ? 110 : 220,
    )
    await dragPosition(page, timeline, 0.15)
    await expect(
      deck.getByRole('button', { name: pauseName, exact: true }),
    ).toBeVisible()
    await expectFrequency(
      page,
      source === 'Recording' ? 110 : 220,
      source === 'Recording' ? 220 : 329.6276,
    )
    const position = Number(await timeline.inputValue())
    await expect
      .poll(async () => Number(await timeline.inputValue()))
      .toBeGreaterThan(position + 0.1)

    await deck
      .getByRole('button', { name: 'Stop take playback', exact: true })
      .click()
    await expect(timeline).toHaveValue('0')
    await expect(
      deck.getByRole('button', { name: playName, exact: true }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__songAudioProbe.media.some((media) => !media.paused),
        ),
      )
      .toBe(false)
    expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
    expect(errors).toEqual([])
  })
}

for (const width of [320, 390, 1440]) {
  test(`keeps listening and take actions in two compact rows at ${width}px @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const deck = await enterRecording(page)
    await page
      .getByRole('button', { name: 'Session controls', exact: true })
      .click()
    const session = page.getByRole('dialog', { name: 'Session', exact: true })
    await session
      .getByRole('region', { name: 'Listening input', exact: true })
      .getByRole('button', { name: 'Direct input', exact: true })
      .click()
    await session
      .getByRole('button', { name: 'Close Session', exact: true })
      .click()
    if (width >= 390) {
      const heading = page.getByRole('heading', {
        name: 'Free form',
        exact: true,
      })
      await expect(heading).toBeVisible()
      expect(
        await heading.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
        'Room tools must leave enough space to read the room title',
      ).toBeLessThanOrEqual(1)
    }
    const image = test.info().outputPath(`recorder-transport-${width}.png`)
    await page.screenshot({ path: image })
    await test.info().attach(`recorder-transport-${width}`, {
      path: image,
      contentType: 'image/png',
    })
    // Measure the old deck too: the red run should expose its extra control
    // rows instead of failing only because the new compact wrapper is absent.
    const deckRows = await deck
      .locator('button, select, input')
      .evaluateAll((elements) => {
        const centers: number[] = []
        for (const element of elements) {
          const bounds = element.getBoundingClientRect()
          if (bounds.width === 0 || bounds.height === 0) continue
          const center = bounds.y + bounds.height / 2
          if (!centers.some((row) => Math.abs(row - center) < 16))
            centers.push(center)
        }
        return centers.sort((a, b) => a - b)
      })
    expect(
      deckRows,
      'The take deck should have a timeline row and one action row',
    ).toHaveLength(2)
    const actions = page.getByTestId('guitar-recorder-actions')
    await expect(actions).toBeVisible()
    const sizes = await actions.getByRole('button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          y: rect.y,
          bottom: rect.bottom,
        }
      }),
    )
    expect(sizes.length).toBeGreaterThanOrEqual(3)
    for (const size of sizes) {
      expect(size.width).toBeGreaterThanOrEqual(44)
      expect(size.height).toBeGreaterThanOrEqual(44)
      expect(Math.abs(size.y - sizes[0].y)).toBeLessThanOrEqual(2)
    }
    const column = page.getByTestId('guitar-night-listening-column')
    const listening = column.getByTestId('guitar-night-listening-cycle')
    const mix = column.getByRole('group', {
      name: 'Song playback mix',
      exact: true,
    })
    await expect(listening).toBeVisible()
    await expect(mix).toBeVisible()
    const listeningBounds = await listening.boundingBox()
    const mixBounds = await mix.boundingBox()
    const timelineBounds = await page
      .getByTestId('guitar-recording-timeline')
      .boundingBox()
    if (listeningBounds === null || mixBounds === null)
      throw new Error('Listening column has no layout')
    if (timelineBounds === null) throw new Error('Take timeline has no layout')
    expect(
      timelineBounds.x >= listeningBounds.x + listeningBounds.width ||
        timelineBounds.y >= listeningBounds.y + listeningBounds.height ||
        timelineBounds.y + timelineBounds.height <= listeningBounds.y,
      'Listening must not cover the seek target',
    ).toBe(true)
    expect(mixBounds.y).toBeGreaterThanOrEqual(
      listeningBounds.y + listeningBounds.height - 1,
    )
    expect(
      mixBounds.y - listeningBounds.y - listeningBounds.height,
    ).toBeLessThanOrEqual(16)
    expect(mixBounds.x).toBeGreaterThanOrEqual(listeningBounds.x - 1)
    expect(mixBounds.x + mixBounds.width).toBeLessThanOrEqual(
      listeningBounds.x + listeningBounds.width + 1,
    )
    for (const surface of [deck, column]) {
      const bounds = await surface.boundingBox()
      if (bounds === null) throw new Error('Transport surface has no bounds')
      expect(bounds.x).toBeGreaterThanOrEqual(-1)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(901)
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  })
}

async function savedRecordingState(page: Page) {
  return page.evaluate(async () => {
    const open = indexedDB.open('MercuryPitchDB')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const transaction = db.transaction(
      ['guitarRecordings', 'guitarRecordingChunks'],
      'readonly',
    )
    const all = (store: string) =>
      new Promise<Array<{ id: string; recordingId?: string }>>(
        (resolve, reject) => {
          const request = transaction.objectStore(store).getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        },
      )
    const [rows, chunks] = await Promise.all([
      all('guitarRecordings'),
      all('guitarRecordingChunks'),
    ])
    db.close()
    return rows
      .map((row) => ({
        id: row.id,
        chunks: chunks.filter((chunk) => chunk.recordingId === row.id).length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  })
}

test('quick-switches saved ideas, cancels removal and stops an active deleted take @smoke', async ({
  page,
}) => {
  test.setTimeout(45000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const deck = await enterRecording(page, true)
  await chooseClean(page, deck)
  const before = await savedRecordingState(page)
  expect(before).toHaveLength(2)
  const quick = page.getByRole('button', {
    name: 'Quick switch melody',
    exact: true,
  })
  await quick.click()
  const menu = page.getByRole('dialog', { name: 'Switch melody', exact: true })
  await expect(
    menu.getByRole('button', {
      name: 'Loaded Two-part transport proof',
      exact: true,
    }),
  ).toHaveAttribute('aria-current', 'true')
  await menu
    .getByRole('button', { name: 'Load Second saved idea', exact: true })
    .click()
  await expect(menu).toBeHidden()
  await expect(
    page.getByRole('dialog').filter({ hasText: 'Recorded melody' }),
  ).toBeHidden()
  await expect(
    deck.getByRole('button', { name: 'Play recording', exact: true }),
  ).toBeEnabled()
  expect(
    await page.evaluate(() =>
      window.__songAudioProbe.media.some((media) => !media.paused),
    ),
  ).toBe(false)

  await quick.click()
  await expect(
    menu.getByRole('button', { name: 'Loaded Second saved idea', exact: true }),
  ).toHaveAttribute('aria-current', 'true')
  await menu
    .getByRole('button', { name: 'Remove Second saved idea', exact: true })
    .click()
  const confirmation = page.getByRole('alertdialog', {
    name: 'Remove this melody?',
    exact: true,
  })
  await expect(confirmation).toContainText('Second saved idea')
  await confirmation
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await expect(confirmation).toBeHidden()
  expect(await savedRecordingState(page)).toEqual(before)
  await menu
    .getByRole('button', { name: 'Close melody switcher', exact: true })
    .click()

  await deck
    .getByRole('button', { name: 'Play recording', exact: true })
    .click()
  await expect(
    deck.getByRole('button', { name: 'Pause recording replay', exact: true }),
  ).toBeVisible()
  await expectFrequency(page, 110, 220)
  await quick.click()
  await menu
    .getByRole('button', { name: 'Remove Second saved idea', exact: true })
    .click()
  await confirmation
    .getByRole('button', { name: 'Remove melody', exact: true })
    .click()
  await expect(confirmation).toBeHidden()
  await expect(
    menu.getByRole('button', { name: 'Remove Second saved idea', exact: true }),
  ).toHaveCount(0)
  await expect
    .poll(() => savedRecordingState(page))
    .toEqual(before.filter((row) => row.id === RECORDING_ID))
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__songAudioProbe.media.some((media) => !media.paused),
      ),
    )
    .toBe(false)
  await expect(
    deck.getByRole('button', { name: 'Pause recording replay', exact: true }),
  ).toHaveCount(0)
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
})

test.describe('touch melody switching', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })

  test('opens the quick switcher on a real held touch without opening the gallery @smoke', async ({
    page,
  }) => {
    await enterRecording(page, true)
    const trigger = page.getByRole('button', {
      name: 'My melodies, 2 recordings',
      exact: true,
    })
    const bounds = await trigger.boundingBox()
    if (bounds === null) throw new Error('My melodies has no touch target')
    const client = await page.context().newCDPSession(page)
    const menu = page.getByRole('dialog', {
      name: 'Switch melody',
      exact: true,
    })
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
            id: 1,
          },
        ],
      })
      // The real browser touch remains held until the UI's long-press timer
      // opens its drawer; there is no synthetic pointer event or fixed sleep.
      await expect(menu).toBeVisible({ timeout: 3000 })
    } finally {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await client.detach()
    }
    await expect(menu).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'My melodies', exact: true }),
    ).toBeHidden()
    await expect(
      menu.getByRole('button', { name: 'Load Second saved idea', exact: true }),
    ).toBeVisible()
    await menu
      .getByRole('button', { name: 'Close melody switcher', exact: true })
      .tap()
    // A completed long-press must not consume the next separate intentional tap.
    await trigger.tap()
    const gallery = page.getByRole('dialog', {
      name: 'My melodies',
      exact: true,
    })
    await expect(gallery).toBeVisible()
    expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
    const image = test.info().outputPath('melody-gallery-after-long-press.png')
    await page.screenshot({ path: image })
    await test.info().attach('melody-gallery-after-long-press', {
      path: image,
      contentType: 'image/png',
    })
  })
})
