// Museum music integration — real playback fades before capture and native mix controls persist.
import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    museumMusicProbe: {
      starts: number
      active: Set<AudioBufferSourceNode>
    }
  }
}

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(90_000)

async function openMuseum(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}progress:glassworks`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'goblet',
        completedBreakableIds: [],
      }),
    )
    const probe = { starts: 0, active: new Set<AudioBufferSourceNode>() }
    window.museumMusicProbe = probe
    const originalStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.loop && (this.buffer?.duration ?? 0) > 5) {
        probe.starts++
        probe.active.add(this)
        this.addEventListener('ended', () => probe.active.delete(this), {
          once: true,
        })
      }
      originalStart.apply(this, args)
    }
    // Silence enters the real detector pipeline; no simulation completion seam.
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext()
      await context.resume()
      const source = context.createOscillator()
      const gain = context.createGain()
      gain.gain.value = 0
      const destination = context.createMediaStreamDestination()
      source.connect(gain).connect(destination)
      source.start()
      const track = destination.stream.getAudioTracks()[0]
      const originalStop = track.stop.bind(track)
      track.stop = () => {
        originalStop()
        source.stop()
        source.disconnect()
        gain.disconnect()
        void context.close()
      }
      return destination.stream
    }
  })
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 },
  )
}

test('exploration music stops before capture and stays stopped after background', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openMuseum(page)
  expect(await page.evaluate(() => window.museumMusicProbe.starts)).toBe(0)
  await page
    .getByLabel('Glass museum; drag to look around')
    .click({ position: { x: 310, y: 140 } })
  await expect
    .poll(() => page.evaluate(() => window.museumMusicProbe.active.size))
    .toBe(2)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.museumMusicProbe.active.size)).toBe(0)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => window.museumMusicProbe.active.size))
    .toBe(2)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  )
  await expect(page.getByRole('dialog')).toContainText('The microphone is off.')
  // On a short landscape viewport the larger mix panel must scroll from its
  // reachable top, rather than centering its heading above the scroll origin.
  const heading = await page
    .getByRole('heading', { name: 'Take a little breath.' })
    .boundingBox()
  expect(heading!.y).toBeGreaterThanOrEqual(0)
  await expect
    .poll(() => page.evaluate(() => window.museumMusicProbe.active.size))
    .toBe(0)
  const stoppedAt = await page.evaluate(() => window.museumMusicProbe.starts)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow')),
  )
  expect(await page.evaluate(() => window.museumMusicProbe.starts)).toBe(
    stoppedAt,
  )
  await page.getByRole('button', { name: 'Back to the museum' }).click()
  await expect
    .poll(() => page.evaluate(() => window.museumMusicProbe.active.size))
    .toBe(2)
  expect(errors).toEqual([])
})

for (const width of [390, 820, 1280]) {
  test(`sound controls fit and save at ${width}px @smoke`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openMuseum(page)
    await page.getByRole('button', { name: 'Pause game' }).click()
    const dialog = page.getByRole('dialog', { name: 'Take a little breath.' })
    const music = dialog.getByRole('slider', { name: /^Music / })
    const ambience = dialog.getByRole('slider', { name: /^Ambience / })
    await expect(music).toBeVisible()
    await dialog.getByRole('button', { name: 'Leave museum' }).focus()
    await page.keyboard.press('Tab')
    await expect(dialog.getByLabel('Mute music and ambience')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(music).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(ambience).toBeFocused()
    await dialog.getByLabel('Mute music and ambience').focus()
    await page.keyboard.press('Shift+Tab')
    await expect(
      dialog.getByRole('button', { name: 'Leave museum' }),
    ).toBeFocused()
    const box = await music.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width * 0.3, box!.y + box!.height / 2)
    const mouseValue = Number(await music.inputValue())
    expect(mouseValue).toBeGreaterThanOrEqual(20)
    expect(mouseValue).toBeLessThanOrEqual(40)
    await music.focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await expect(music).toHaveValue('1')
    await ambience.focus()
    await page.keyboard.press('End')
    await expect(ambience).toHaveValue('100')
    await dialog.getByLabel('Mute music and ambience').check()
    expect(await page.evaluate(() => window.museumMusicProbe.starts)).toBe(0)
    const overflow = await dialog.evaluate((node) => ({
      panel: node.scrollWidth > node.clientWidth,
      page: document.documentElement.scrollWidth > innerWidth,
      top: node.getBoundingClientRect().top,
      bottom: node.getBoundingClientRect().bottom,
    }))
    expect(overflow.panel).toBe(false)
    expect(overflow.page).toBe(false)
    expect(overflow.top).toBeGreaterThanOrEqual(0)
    expect(overflow.bottom).toBeLessThanOrEqual(844)
    const expected = { muted: true, musicVolume: 0.01, ambienceVolume: 1 }
    expect(
      await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('beside-cue:glass-adventure:museum-audio:v1')!,
        ),
      ),
    ).toEqual(expected)
    await page.reload()
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Pause game' }).click()
    await expect(dialog.getByLabel('Mute music and ambience')).toBeChecked()
    await expect(music).toHaveValue('1')
    await expect(ambience).toHaveValue('100')
  })
}
