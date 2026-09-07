// Guitar Night amp controls stay inert and preserve held gestures and saved preferences.
// ============================================================

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { enterSong } from './helpers/guitar-night-song'
import { seedAuthoredGuitarScore } from './helpers/guitar-night-score'

import { audioActivity, guardPassiveAudio, openSongAmp, reloadSongAmp, STORAGE_V1, storedAmp, } from './helpers/guitar-night-amp'

test('keeps Character connected through a held drag and saves it across reload @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const cabinetRequests = await guardPassiveAudio(page)
  await enterSong(page, 2)
  const baseline = await audioActivity(page)
  expect(baseline).toMatchObject({
    sourceStarts: 0,
    mediaPlays: 0,
    microphoneRequests: 0,
  })
  expect(cabinetRequests).toEqual([])
  const amp = await openSongAmp(page)
  const preset = amp.getByRole('combobox', {
    name: 'Guitar amp preset',
    exact: true,
  })
  await preset.selectOption('tight')
  const character = amp.getByRole('slider', {
    name: 'Guitar amp character',
    exact: true,
  })
  await expect(character).toHaveValue('1')
  await expect(
    amp.getByText('Articulate', { exact: true }).filter({ visible: true }),
  ).toBeVisible()
  await expect(
    amp.getByText('Tight', { exact: true }).filter({ visible: true }),
  ).toBeVisible()
  await character.scrollIntoViewIfNeeded()
  const original = await character.elementHandle()
  const bounds = await character.boundingBox()
  if (original === null || bounds === null)
    throw new Error('Character has no live pointer target')
  const y = bounds.y + bounds.height / 2
  const beforeDrag = await storedAmp(page)

  await page.mouse.move(bounds.x + bounds.width - 8, y)
  await page.mouse.down()
  try {
    await page.mouse.move(bounds.x + bounds.width * 0.25, y, { steps: 6 })
    await expect
      .poll(async () => Number(await character.inputValue()))
      .toBeLessThan(0.4)
    expect(await original.evaluate((element) => element.isConnected)).toBe(true)
    await expect(preset).toHaveValue('custom')
    // A store write during the gesture must not remount the native thumb.
    expect(await storedAmp(page)).toEqual(beforeDrag)
    await page.mouse.move(bounds.x + bounds.width * 0.7, y, { steps: 6 })
    await expect
      .poll(async () => Number(await character.inputValue()))
      .toBeGreaterThan(0.55)
    expect(await original.evaluate((element) => element.isConnected)).toBe(true)
  } finally {
    await page.mouse.up()
  }
  const chosen = await character.inputValue()
  await expect
    .poll(() => storedAmp(page))
    .toMatchObject({
      version: 2,
      presetId: 'custom',
      engine: 'studio',
      head: 'definition',
      character: Number(chosen),
    })
  expect(await audioActivity(page)).toEqual(baseline)
  expect(cabinetRequests).toEqual([])

  const restored = await reloadSongAmp(page)
  await expect(
    restored.getByRole('slider', { name: 'Guitar amp character', exact: true }),
  ).toHaveValue(chosen)
  await expect(
    restored.getByRole('combobox', { name: 'Guitar amp preset', exact: true }),
  ).toHaveValue('custom')
  await restored
    .getByRole('combobox', { name: 'Guitar amp preset', exact: true })
    .selectOption('heavy')
  await expect(
    restored.getByRole('slider', { name: 'Guitar amp character', exact: true }),
  ).toBeHidden()
  await expect
    .poll(() => storedAmp(page))
    .toMatchObject({ presetId: 'heavy', head: 'heavy' })
  expect(await audioActivity(page)).toMatchObject({
    sourceStarts: 0,
    mediaPlays: 0,
    microphoneRequests: 0,
  })
  expect(cabinetRequests).toEqual([])
})

test('migrates a bypassed V1 amp without enabling Studio or waking audio @smoke', async ({
  page,
}) => {
  const legacy = {
    version: 1,
    presetId: 'custom',
    enabled: false,
    drive: 0.31,
    bass: -0.2,
    mid: 0.1,
    treble: -0.12,
    presence: 0.08,
    output: 0.4,
    cabinet: 'dark',
    asymmetry: 0.2,
  }
  const cabinetRequests = await guardPassiveAudio(page)
  await page.addInitScript(
    ({ key, settings }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(settings))
    },
    { key: STORAGE_V1, settings: legacy },
  )
  await enterSong(page, 2)
  const amp = await openSongAmp(page)
  const baseline = await audioActivity(page)
  const power = amp.getByRole('button', {
    name: 'Turn guitar amp on',
    exact: true,
  })
  await expect(power).toHaveAttribute('aria-pressed', 'false')
  await expect(
    amp.getByRole('slider', { name: 'Guitar amp character', exact: true }),
  ).toBeHidden()
  await expect(
    amp.getByRole('slider', { name: 'Guitar amp drive', exact: true }),
  ).toHaveValue('0.31')
  expect(await storedAmp(page)).toBeNull()
  await amp
    .getByRole('slider', { name: 'Guitar amp drive', exact: true })
    .focus()
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => storedAmp(page))
    .toMatchObject({
      ...legacy,
      version: 2,
      engine: 'lite',
      head: 'definition',
      character: 1,
      drive: 0.32,
    })
  expect(await audioActivity(page)).toEqual(baseline)

  const restored = await reloadSongAmp(page)
  await expect(
    restored.getByRole('button', { name: 'Turn guitar amp on', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    restored.getByRole('slider', { name: 'Guitar amp drive', exact: true }),
  ).toHaveValue('0.32')
  await expect(
    restored.getByRole('slider', { name: 'Guitar amp character', exact: true }),
  ).toBeHidden()
  await restored
    .getByRole('combobox', { name: 'Guitar amp preset', exact: true })
    .selectOption('tight')
  await expect(
    restored.getByRole('button', { name: 'Turn guitar amp on', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    restored.getByRole('slider', { name: 'Guitar amp character', exact: true }),
  ).toHaveValue('1')
  await expect
    .poll(() => storedAmp(page))
    .toMatchObject({ presetId: 'tight', engine: 'studio', enabled: false })
  expect(await audioActivity(page)).toMatchObject({
    sourceStarts: 0,
    mediaPlays: 0,
    microphoneRequests: 0,
  })
  expect(cabinetRequests).toEqual([])
})

interface ScoreAmpProbe {
  contexts: AudioContext[]
  cabinets: ConvolverNode[]
  liveShapers: Set<WaveShaperNode>
  microphoneRequests: number
}

/** Keep the real audio graph and clock, observe its cabinet, never open hardware input. */
async function observeScoreAmp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tracked = window as unknown as {
      AudioContext: typeof AudioContext
      __scoreAmp: ScoreAmpProbe
    }
    const probe: ScoreAmpProbe = {
      contexts: [],
      cabinets: [],
      liveShapers: new Set(),
      microphoneRequests: 0,
    }
    tracked.__scoreAmp = probe
    const NativeContext = tracked.AudioContext
    tracked.AudioContext = new Proxy(NativeContext, {
      construct(target, args, newTarget) {
        const context = Reflect.construct(
          target,
          args,
          newTarget,
        ) as AudioContext
        probe.contexts.push(context)
        const createConvolver = context.createConvolver.bind(context)
        context.createConvolver = () => {
          const cabinet = createConvolver()
          probe.cabinets.push(cabinet)
          return cabinet
        }
        const createShaper = context.createWaveShaper.bind(context)
        context.createWaveShaper = () => {
          const shaper = createShaper()
          probe.liveShapers.add(shaper)
          shaper.disconnect = new Proxy(shaper.disconnect, {
            apply(target, thisArg, args) {
              if (args.length === 0) probe.liveShapers.delete(shaper)
              return Reflect.apply(target, thisArg, args)
            },
          })
          return shaper
        }
        return context
      },
    })
    navigator.mediaDevices.getUserMedia = async () => {
      probe.microphoneRequests += 1
      throw new Error('Score amp playback must not request a microphone')
    }
  })
}

for (const retryWhile of ['playing', 'paused'] as const) {
  test(`recovers the real Studio cabinet while ${retryWhile} without restarting the score @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let cabinetRequests = 0
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        return route.abort()
      if (
        /cookie-monster.*\.wav$/i.test(url.pathname) &&
        !url.searchParams.has('url') &&
        !url.searchParams.has('import')
      ) {
        cabinetRequests += 1
        if (cabinetRequests === 1)
          return route.fulfill({
            status: 503,
            body: 'Cabinet temporarily unavailable',
          })
      }
      return route.continue()
    })
    await observeScoreAmp(page)
    const songId = `studio-cabinet-${retryWhile}`
    const electricParts = retryWhile === 'playing' ? 2 : 1
    await seedAuthoredGuitarScore(page, songId, electricParts === 2, {
      electric: true,
      bpm: 60,
    })
    await page.goto(`/guitar-night?song=${songId}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page
      .getByRole('button', { name: 'Practice with tab', exact: true })
      .click()
    // The room contains two transports; use the score deck for its playhead.
    const room = page.getByTestId('guitar-night-score-room')
    const position = room.getByRole('slider', {
      name: 'Score position',
      exact: true,
    })
    await room.getByLabel('Session controls', { exact: true }).click()
    const session = room.locator('details[open]').filter({
      has: page.getByRole('region', { name: 'Guitar amp', exact: true }),
    })
    const amp = session.getByRole('region', { name: 'Guitar amp', exact: true })
    const preset = amp.getByRole('combobox', {
      name: 'Guitar amp preset',
      exact: true,
    })
    await preset.selectOption('tight')
    const countIn = session.getByRole('button', {
      name: /^Count-in .* before playback\. Change count-in$/,
    })
    for (let click = 0; click < 4; click += 1) {
      if ((await countIn.getAttribute('aria-label'))?.includes('Off')) break
      await countIn.click()
    }
    await expect(countIn).toHaveAccessibleName(
      'Count-in Off before playback. Change count-in',
    )
    expect(cabinetRequests).toBe(0)
    await room.getByLabel('Session controls', { exact: true }).click()
    await room
      .getByRole('button', { name: 'Start the count-in', exact: true })
      .click()
    await expect
      .poll(async () => Number(await position.inputValue()))
      .toBeGreaterThan(1)
    await room.getByLabel('Session controls', { exact: true }).click()
    await expect(amp.getByRole('status')).toHaveText(
      'Studio tone unavailable. Using Lite tone; try loading it again.',
    )
    expect(cabinetRequests).toBe(1)

    if (retryWhile === 'paused') {
      await room
        .getByRole('button', { name: 'Pause score', exact: true })
        .click()
      // Wait for a real pause, not the previous amp's short release tail.
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { __scoreAmp: ScoreAmpProbe }).__scoreAmp
                .liveShapers.size,
          ),
        )
        .toBe(0)
    }
    const beforeRetry = Number(await position.inputValue())
    await position.evaluate((element) => {
      const samples = [Number((element as HTMLInputElement).value)]
      ;(
        window as unknown as { __scoreClockSamples: number[] }
      ).__scoreClockSamples = samples
      const sample = () => {
        samples.push(Number((element as HTMLInputElement).value))
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await amp
      .getByRole('button', { name: 'Retry Studio tone', exact: true })
      .click()
    if (retryWhile === 'paused') {
      await expect(amp.getByRole('status')).toHaveText(
        'Cabinet loads when you play an electric part or monitor Direct input.',
      )
      expect(cabinetRequests).toBe(1)
      await expect(position).toHaveValue(String(beforeRetry))
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __scoreAmp: ScoreAmpProbe }).__scoreAmp
              .liveShapers.size,
        ),
      ).toBe(0)
      await room
        .getByRole('button', { name: 'Resume score', exact: true })
        .click()
    }
    await expect(amp.getByRole('status')).toHaveText('Cabinet IR ready.')
    expect(cabinetRequests).toBe(2)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const probe = (window as unknown as { __scoreAmp: ScoreAmpProbe })
            .__scoreAmp
          return probe.cabinets.filter(
            (cabinet) =>
              cabinet.buffer !== null &&
              !cabinet.normalize &&
              Math.abs(cabinet.buffer.duration - 1.19625) < 0.001,
          ).length
        }),
      )
      .toBe(electricParts)
    await expect
      .poll(async () => Number(await position.inputValue()))
      .toBeGreaterThan(beforeRetry)
    expect(
      await page.evaluate(() =>
        Math.min(
          ...(window as unknown as { __scoreClockSamples: number[] })
            .__scoreClockSamples,
        ),
      ),
    ).toBeGreaterThanOrEqual(beforeRetry)
    await expect(
      room.getByRole('button', { name: 'Pause score', exact: true }),
    ).toBeVisible()
    if (retryWhile === 'paused')
      await room
        .getByRole('button', { name: 'Pause score', exact: true })
        .click()

    const beforeBypass = Number(await position.inputValue())
    await position.evaluate((element) => {
      const samples = (window as unknown as { __scoreClockSamples: number[] })
        .__scoreClockSamples
      samples.length = 0
      samples.push(Number((element as HTMLInputElement).value))
    })
    await amp
      .getByRole('button', { name: 'Bypass guitar amp', exact: true })
      .click()
    await preset.selectOption('edge')
    await expect(
      amp.getByText('Lite amp · Filtered cabinet', { exact: true }),
    ).toBeVisible()
    await expect(
      amp.getByRole('button', { name: 'Turn guitar amp on', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    if (retryWhile === 'paused')
      await expect(position).toHaveValue(String(beforeBypass))
    else
      await expect
        .poll(async () => Number(await position.inputValue()))
        .toBeGreaterThan(beforeBypass)
    expect(
      await page.evaluate(() =>
        Math.min(
          ...(window as unknown as { __scoreClockSamples: number[] })
            .__scoreClockSamples,
        ),
      ),
    ).toBeGreaterThanOrEqual(beforeBypass)
    expect(cabinetRequests).toBe(2)
    expect(
      await page.evaluate(() => {
        const probe = (window as unknown as { __scoreAmp: ScoreAmpProbe })
          .__scoreAmp
        return {
          contexts: probe.contexts.length,
          microphoneRequests: probe.microphoneRequests,
        }
      }),
    ).toEqual({ contexts: 1, microphoneRequests: 0 })
    if (retryWhile === 'playing')
      await room
        .getByRole('button', { name: 'Pause score', exact: true })
        .click()
  })
}
