// Song loops and opt-in DI monitoring are checked against real rendered browser audio.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { enterSong, localStemWav, SONG_SECONDS, } from './helpers/guitar-night-song'
import { installSongAudioProbe, readSongAudio, } from './helpers/guitar-night-audio-probe'

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

/** Distinct stems expose both synchronization and accidental playback past B. */
function loopStem(index: number): Buffer {
  const wav = localStemWav()
  const rate = 8_000
  for (let sample = 0; sample < SONG_SECONDS * rate; sample += 1) {
    const time = sample / rate
    const inside = time >= 1 && time < 1.5
    const frequency = (inside ? 256 : 1024) * (index + 1)
    const gain = inside && time >= 1.25 ? 0.02 : 0.06
    wav.writeInt16LE(
      Math.round(Math.sin(time * frequency * Math.PI * 2) * gain * 32767),
      44 + sample * 2,
    )
  }
  return wav
}

async function seekSong(page: Page, seconds: number): Promise<void> {
  await page
    .getByRole('slider', { name: 'Song position', exact: true })
    .evaluate((element, value) => {
      const input = element as HTMLInputElement
      input.value = String(value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, seconds)
}

async function markLoop(page: Page): Promise<void> {
  await seekSong(page, 1)
  await page
    .getByRole('button', {
      name: 'A — start the loop at the playhead',
      exact: true,
    })
    .click()
  await seekSong(page, 1.5)
  await page
    .getByRole('button', {
      name: 'B — end the loop at the playhead',
      exact: true,
    })
    .click()
  await seekSong(page, 1)
}

async function captureSeconds(page: Page, seconds: number): Promise<void> {
  await page.evaluate(() => {
    window.__songAudioProbe.frames.length = 0
  })
  // The rendered audio clock, not a sleep or rAF, determines the capture length.
  await page.waitForFunction(
    (duration) => {
      const frames = window.__songAudioProbe.frames.filter(
        (frame) => frame.context === 0,
      )
      return (
        frames.length > 1 &&
        frames[frames.length - 1].time - frames[0].time >= duration
      )
    },
    seconds,
    { polling: 50, timeout: 12_000 },
  )
}

function risingEdges(
  frames: Awaited<ReturnType<typeof readSongAudio>>['frames'],
  minimumPeriod = 0,
) {
  const peak = Math.max(...frames.map((frame) => frame.rms))
  const edges: number[] = []
  let low = false
  for (const frame of frames) {
    if (frame.rms < peak * 0.45) low = true
    if (low && frame.rms > peak * 0.7) {
      if (
        edges.length === 0 ||
        frame.time - edges[edges.length - 1] >= minimumPeriod
      ) {
        edges.push(frame.time)
      }
      low = false
    }
  }
  return edges
}

function longestFrameRun(
  frames: Awaited<ReturnType<typeof readSongAudio>>['frames'],
  matches: (frame: (typeof frames)[number]) => boolean,
): number {
  const windowSeconds = frames[1].time - frames[0].time
  let current = 0
  let longest = 0
  for (const frame of frames) {
    current = matches(frame) ? current + windowSeconds : 0
    longest = Math.max(longest, current)
  }
  return longest
}

test('keeps buffered stems on one audible loop without animation frames @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await enterSong(page, 2, [loopStem(0), loopStem(1)])
  await markLoop(page)
  await page.getByRole('button', { name: 'Play backing', exact: true }).click()
  await expect(page.getByTestId('guitar-night-room')).toHaveAttribute(
    'data-playback-mode',
    'buffered',
  )
  await page.evaluate(() => {
    window.__songAudioProbe.blockAnimationFrames = true
  })
  await captureSeconds(page, 5)
  const audio = await readSongAudio(page)
  const frames = audio.frames.filter(
    (frame) => frame.time > audio.frames[0].time + 0.1,
  )
  const edges = risingEdges(frames)
  const evidencePath = test.info().outputPath('buffered-loop.json')
  await writeFile(evidencePath, JSON.stringify({ frames, edges }))
  await test.info().attach('buffered-loop.json', {
    path: evidencePath,
    contentType: 'application/json',
  })
  expect(edges.length).toBeGreaterThanOrEqual(8)
  for (let index = 1; index < edges.length; index += 1) {
    expect(edges[index] - edges[index - 1]).toBeCloseTo(0.5, 1)
  }
  expect(Math.min(...frames.map((frame) => frame.rms))).toBeGreaterThan(0.002)
  expect(
    Math.min(...frames.map((frame) => Math.min(frame.first, frame.second))),
  ).toBeGreaterThan(0.002)
  expect(
    Math.max(
      ...frames.map((frame) => frame.outside / (frame.first + frame.second)),
    ),
  ).toBeLessThan(0.1)
  const sources = await page.evaluate(() =>
    window.__songAudioProbe.sources.map(({ source, when }) => ({
      when,
      loop: source.loop,
      start: source.loopStart,
      end: source.loopEnd,
    })),
  )
  expect(sources).toHaveLength(2)
  expect(sources[0].when).toBe(sources[1].when)
  for (const source of sources)
    expect(source).toMatchObject({ loop: true, start: 1, end: 1.5 })
  expect(audio.micCalls).toBe(0)
})

test('keeps streamed loop output bounded across a rate change without animation frames @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await enterSong(page, 2, [loopStem(0), loopStem(1)])
  await markLoop(page)
  await page
    .getByRole('button', { name: 'Slow down from 1.00×', exact: true })
    .click()
  await page.getByRole('button', { name: 'Play backing', exact: true }).click()
  const room = page.getByTestId('guitar-night-room')
  await expect(room).toHaveAttribute('data-playback-mode', 'streamed')
  for (const rate of [0.95, 0.9]) {
    if (rate === 0.9) {
      await page.evaluate(() => {
        window.__songAudioProbe.blockAnimationFrames = false
      })
      await page
        .getByRole('button', { name: 'Slow down from 0.95×', exact: true })
        .click()
    }
    await page.evaluate(() => {
      window.__songAudioProbe.blockAnimationFrames = true
    })
    const firstSeek = await page.evaluate(
      () => window.__songAudioProbe.seeks.length,
    )
    await captureSeconds(page, 4)
    const audio = await readSongAudio(page)
    const frames = audio.frames.filter(
      (frame) => frame.time > audio.frames[0].time + 0.15,
    )
    // The short seam dip can add a second edge within the same half-second
    // phrase. Count distinct audible repetitions, not those dip recoveries.
    const edges = risingEdges(frames, 0.3)
    const state = await page.evaluate(
      (start) => ({
        media: window.__songAudioProbe.media.map((element) => ({
          currentTime: element.currentTime,
          paused: element.paused,
          readyState: element.readyState,
          rate: element.playbackRate,
        })),
        seeks: window.__songAudioProbe.seeks.slice(start),
      }),
      firstSeek,
    )
    const evidencePath = test.info().outputPath(`streamed-loop-${rate}.json`)
    await writeFile(
      evidencePath,
      JSON.stringify({
        frames,
        edges,
        state,
      }),
    )
    await test.info().attach(`streamed-loop-${rate}.json`, {
      contentType: 'application/json',
      path: evidencePath,
    })
    expect(edges.length).toBeGreaterThanOrEqual(5)
    expect(state.seeks.length).toBeGreaterThanOrEqual(10)
    expect(state.seeks.length % 2).toBe(0)
    for (let index = 0; index < state.seeks.length; index += 2) {
      expect(state.seeks[index].target).toBe(1)
      expect(state.seeks[index + 1].target).toBe(1)
      expect(
        state.seeks[index + 1].time - state.seeks[index].time,
      ).toBeLessThan(10)
    }
    const audible = frames.filter((frame) => frame.rms > 0.002)
    expect(audible.length / frames.length).toBeGreaterThan(0.7)
    expect(
      audible.filter((frame) => frame.first > 0.002 && frame.second > 0.002)
        .length / audible.length,
    ).toBeGreaterThan(0.85)
    // Fully local, ready media: the engine polls B at most every 100 ms.
    // One analyser window straddles each boundary. Occupancy percentage is
    // phase-dependent; bound each actual overrun instead of claiming gapless.
    const seamBound = 0.1 + frames[1].time - frames[0].time
    expect(
      longestFrameRun(
        frames,
        (frame) =>
          frame.rms > 0.002 &&
          frame.outside > (frame.first + frame.second) * 0.2,
      ),
    ).toBeLessThanOrEqual(seamBound)
    expect(
      longestFrameRun(frames, (frame) => frame.rms <= 0.002),
    ).toBeLessThanOrEqual(seamBound)
    const clocks = await page.evaluate(() =>
      window.__songAudioProbe.media.map((element) => element.currentTime),
    )
    expect(clocks).toHaveLength(2)
    expect(Math.max(...clocks) - Math.min(...clocks)).toBeLessThan(0.08)
  }
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
})

async function openSession(page: Page) {
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  return page.getByRole('dialog', { name: 'Session', exact: true })
}

async function chooseDirectInput(page: Page): Promise<void> {
  const session = await openSession(page)
  await session
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await expect(
    session.getByRole('button', { name: 'Direct input', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
}

async function toggleSessionListening(
  page: Page,
  active: boolean,
): Promise<void> {
  const session = await openSession(page)
  await session
    .getByRole('button', {
      name: active ? 'Stop Listening' : 'Turn on Listening',
      exact: true,
    })
    .click()
  await expect(
    session.getByRole('button', {
      name: active ? 'Turn on Listening' : 'Stop Listening',
      exact: true,
    }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
}

test('restarts monitoring explicitly after Session route and mono channel changes @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await installSongAudioProbe(page)
  await enterSong(page, 2)
  const session = await openSession(page)
  const input = session.getByRole('region', {
    name: 'Listening input',
    exact: true,
  })
  await input.getByRole('button', { name: 'Direct input', exact: true }).click()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  const startMonitor = session.getByRole('button', {
    name: 'Start Listening and monitoring',
    exact: true,
  })
  await startMonitor.click()
  await expect(
    session.getByRole('button', { name: 'Turn monitoring off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  const channel = session.getByRole('combobox', {
    name: 'Monitor input channel',
    exact: true,
  })
  await expect(channel.getByRole('option')).toHaveCount(2)
  await channel.selectOption('1')
  await expect(channel).toHaveValue('1')
  const monitor = session.getByRole('button', {
    name: 'Turn monitoring on',
    exact: true,
  })
  await expect(monitor).toHaveAttribute('aria-pressed', 'false')
  await monitor.scrollIntoViewIfNeeded()
  const path =
    process.env.GUITAR_SONG_LISTENING_ARTIFACTS === undefined
      ? test.info().outputPath('song-monitor-channel-off-390.png')
      : join(
          process.env.GUITAR_SONG_LISTENING_ARTIFACTS,
          'song-monitor-channel-off-390.png',
        )
  await page.screenshot({ path })
  await test.info().attach('song-monitor-channel-off-390.png', {
    path,
    contentType: 'image/png',
  })
  await monitor.click()
  await expect(
    session.getByRole('button', { name: 'Turn monitoring off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await input.getByRole('button', { name: 'Room mic', exact: true }).click()
  await expect(
    session.getByRole('button', { name: 'Turn on Listening', exact: true }),
  ).toBeVisible()
  // MicManager deliberately keeps a released stream warm for two seconds.
  // Wait for actual release so this checks a fresh restart, not a reused stream.
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__songAudioProbe.micTracks.every(
          (track) => track.readyState === 'ended',
        ),
      ),
    )
    .toBe(true)
  await input.getByRole('button', { name: 'Direct input', exact: true }).click()
  await expect(startMonitor).toBeEnabled()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  await startMonitor.click()
  await expect(
    session.getByRole('button', { name: 'Turn monitoring off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(2)
  await expect(session).toBeVisible()
})

test('one-click song mix independently mutes backing and your live input @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await enterSong(page, 2)
  await chooseDirectInput(page)
  await page.getByRole('button', { name: 'Play backing', exact: true }).click()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  const listening = page.getByTestId('guitar-night-listening-cycle')
  await listening.click({ button: 'right' })
  const quick = page.getByRole('group', { name: 'Direct input quick controls' })
  await quick
    .getByRole('button', { name: 'Turn on Listening', exact: true })
    .click()
  await expect(
    quick.getByRole('button', { name: 'Stop Listening', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByTestId('guitar-night-listening-cycle'),
  ).toHaveAttribute('data-state', 'interface')
  await page.keyboard.press('Escape')
  const mix = page.getByRole('group', {
    name: 'Song playback mix',
    exact: true,
  })
  await expect(
    page.getByRole('button', { name: 'Pause backing', exact: true }),
  ).toBeVisible()
  await captureSeconds(page, 0.6)
  const dry = await readSongAudio(page)
  expect(Math.max(...dry.frames.map((frame) => frame.backing))).toBeGreaterThan(
    0.005,
  )
  const unmonitored = Math.max(...dry.frames.map((frame) => frame.mic))
  const monitor = mix.getByRole('button', {
    name: 'Turn on your monitoring',
    exact: true,
  })
  await expect(monitor).toHaveAttribute('aria-pressed', 'false')
  await monitor.click()
  await expect(
    mix.getByRole('button', { name: 'Mute your monitoring', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await captureSeconds(page, 0.6)
  const wet = await readSongAudio(page)
  expect(Math.max(...wet.frames.map((frame) => frame.mic))).toBeGreaterThan(
    Math.max(0.005, unmonitored * 4),
  )
  await expect(
    page.getByRole('button', { name: 'Pause backing', exact: true }),
  ).toBeVisible()
  await mix.getByRole('button', { name: 'Mute backing', exact: true }).click()
  await captureSeconds(page, 0.6)
  const justMe = (await readSongAudio(page, 4)).frames.slice(8)
  expect(justMe.length).toBeGreaterThan(0)
  expect(Math.max(...justMe.map((frame) => frame.backing))).toBeLessThan(0.003)
  expect(Math.max(...justMe.map((frame) => frame.mic))).toBeGreaterThan(0.005)
  await mix.getByRole('button', { name: 'Unmute backing', exact: true }).click()
  await mix
    .getByRole('button', { name: 'Mute your monitoring', exact: true })
    .click()
  await captureSeconds(page, 0.6)
  const justBacking = (await readSongAudio(page, 4)).frames.slice(8)
  expect(justBacking.length).toBeGreaterThan(0)
  expect(
    Math.max(...justBacking.map((frame) => frame.backing)),
  ).toBeGreaterThan(0.005)
  expect(Math.max(...justBacking.map((frame) => frame.mic))).toBeLessThan(0.003)
  await listening.click({ button: 'right' })
  await expect(
    quick.getByRole('button', { name: 'Stop Listening', exact: true }),
  ).toBeEnabled()
  await quick
    .getByRole('button', { name: 'Stop Listening', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__songAudioProbe.micTracks.every(
          (track) => track.readyState === 'ended',
        ),
      ),
    )
    .toBe(true)
  await captureSeconds(page, 0.6)
  const stopped = await readSongAudio(page)
  expect(Math.max(...stopped.frames.map((frame) => frame.mic))).toBeLessThan(
    Math.max(0.003, unmonitored * 1.5),
  )
  expect(
    Math.max(...stopped.frames.map((frame) => frame.backing)),
  ).toBeGreaterThan(0.005)
})

test('preserves room-microphone exclusion while song backing is playing @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await enterSong(page, 2)
  await page.getByRole('button', { name: 'Play backing', exact: true }).click()
  await toggleSessionListening(page, false)
  await expect(
    page.getByTestId('guitar-night-listening-cycle'),
  ).toHaveAttribute('data-state', 'microphone')
  await expect(
    page.getByRole('button', { name: /^(Play|Resume) backing$/ }),
  ).toBeVisible()
  await captureSeconds(page, 0.4)
  const audio = await readSongAudio(page)
  expect(Math.max(...audio.frames.map((frame) => frame.rms))).toBeLessThan(
    0.001,
  )
  await page.getByRole('button', { name: /^(Play|Resume) backing$/ }).click()
  await expect(
    page.getByTestId('guitar-night-listening-cycle'),
  ).toHaveAttribute('data-state', 'off')
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__songAudioProbe.micTracks.every(
          (track) => track.readyState === 'ended',
        ),
      ),
    )
    .toBe(true)
})

for (const exit of ['tuner', 'songs'] as const) {
  test(`releases the DI monitor and backing when entering ${exit} @smoke`, async ({
    page,
  }) => {
    await installSongAudioProbe(page)
    await enterSong(page, 2)
    await chooseDirectInput(page)
    await page
      .getByRole('button', { name: 'Play backing', exact: true })
      .click()
    await toggleSessionListening(page, false)
    await expect(
      page.getByTestId('guitar-night-listening-cycle'),
    ).toHaveAttribute('data-state', 'interface')
    const session = await openSession(page)
    await session
      .getByRole('button', { name: 'Turn monitoring on', exact: true })
      .click()
    await expect(
      session.getByRole('button', { name: 'Turn monitoring off', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await captureSeconds(page, 0.4)
    const monitored = await readSongAudio(page)
    expect(
      Math.max(...monitored.frames.map((frame) => frame.mic)),
    ).toBeGreaterThan(0.005)

    await page
      .getByRole('button', {
        name: exit === 'tuner' ? 'Tune guitar' : 'Back to Songs',
        exact: true,
      })
      .click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__songAudioProbe.micTracks.length > 0 &&
            window.__songAudioProbe.micTracks.every(
              (track) => track.readyState === 'ended',
            ),
        ),
      )
      .toBe(true)
    if (exit === 'tuner') {
      const tuner = page.getByRole('dialog', {
        name: 'Tune before the room.',
        exact: true,
      })
      await expect(tuner).toBeVisible()
      await captureSeconds(page, 0.4)
      const quiet = await readSongAudio(page)
      expect(Math.max(...quiet.frames.map((frame) => frame.rms))).toBeLessThan(
        0.001,
      )
      await tuner.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(
        page.getByRole('button', { name: 'Resume backing', exact: true }),
      ).toBeVisible()
      const settings = await openSession(page)
      await expect(
        settings.getByRole('button', {
          name: 'Start Listening and monitoring',
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'false')
    } else {
      await expect(
        page.getByRole('heading', { name: 'Prepared songs', exact: true }),
      ).toBeVisible()
      await page
        .getByRole('button', { name: 'Enter room', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'Resume backing', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByTestId('guitar-night-listening-cycle'),
      ).toHaveAttribute('data-state', 'off')
      const settings = await openSession(page)
      await expect(
        settings.getByRole('button', {
          name: 'Start Listening and monitoring',
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'false')
    }
  })
}
