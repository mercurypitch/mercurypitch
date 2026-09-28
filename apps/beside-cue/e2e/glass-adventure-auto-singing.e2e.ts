// Automatic museum singing — real host gesture, cancellation, exit and persisted manual mode.

import { expect, test, type Page } from '@playwright/test'

interface VoiceSource {
  context: AudioContext
  oscillator: OscillatorNode
  track: MediaStreamTrack
}

declare global {
  interface Window {
    automaticSingingFixture: {
      readonly requests: number
      readonly gestureUnlocks: number
      readonly sources: VoiceSource[]
      dispose(): Promise<void>
    }
  }
}

const STORAGE_PREFIX = 'beside-cue:glass-adventure:'
const GOBLET_ANCHOR = { x: 1.2, z: 3.65 }

test.use({
  viewport: { width: 640, height: 640 },
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
test.setTimeout(180_000)

async function openRestoredCircle(page: Page): Promise<void> {
  await page.addInitScript(
    ({ prefix }) => {
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(`${prefix}comfortable-note`, '57')
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
      localStorage.setItem(
        `${prefix}merc-narration:v1`,
        JSON.stringify({ enabled: false }),
      )
      if (localStorage.getItem(`${prefix}progress:glassworks`) === null)
        localStorage.setItem(
          `${prefix}progress:glassworks`,
          JSON.stringify({
            version: 1,
            levelId: 'glassworks',
            checkpointId: 'goblet',
            completedBreakableIds: [],
          }),
        )

      let requests = 0
      let gestureUnlocks = 0
      let gestureActive = false
      const markGesture = (): void => {
        gestureActive = true
        setTimeout(() => {
          gestureActive = false
        }, 0)
      }
      document.addEventListener('pointerdown', markGesture, true)
      document.addEventListener('keydown', markGesture, true)
      const resume = AudioContext.prototype.resume
      AudioContext.prototype.resume = function () {
        if (gestureActive && requests === 0) gestureUnlocks++
        return resume.call(this)
      }
      const sources: VoiceSource[] = []
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!constraints?.audio) return new MediaStream()
        requests++
        const context = new AudioContext()
        await context.resume()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        gain.gain.value = 0
        const destination = context.createMediaStreamDestination()
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        const track = destination.stream.getAudioTracks()[0]!
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
          void context.close()
        }
        sources.push({ context, oscillator, track })
        return destination.stream
      }
      window.automaticSingingFixture = {
        get requests() {
          return requests
        },
        get gestureUnlocks() {
          return gestureUnlocks
        },
        sources,
        async dispose() {
          for (const source of sources)
            if (source.track.readyState === 'live') source.track.stop()
          await Promise.all(
            sources.map((source) =>
              source.context.state === 'closed'
                ? Promise.resolve()
                : source.context.close(),
            ),
          )
        },
      }
    },
    { prefix: STORAGE_PREFIX },
  )

  await page.clock.install()
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    'goblet',
  )
}

async function animationFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        let remaining = frameCount
        const advance = () => {
          remaining--
          if (remaining === 0) resolve()
          else requestAnimationFrame(advance)
        }
        requestAnimationFrame(advance)
      }),
    count,
  )
}

async function voiceRequests(page: Page): Promise<number> {
  return page.evaluate(() => window.automaticSingingFixture.requests)
}

async function armWithCameraDrag(page: Page): Promise<void> {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Museum viewport is unavailable.')
  const x = bounds.x + bounds.width * 0.5
  const y = bounds.y + bounds.height * 0.45
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 24, y + 4, { steps: 3 })
  await page.mouse.up()
}

async function omitRasterOutputAfterProof(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const method of [
      'clear',
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
    ])
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: () => undefined,
      })
  })
}

async function playerDistanceFromGoblet(page: Page): Promise<number> {
  return page
    .getByTestId('glass-adventure')
    .evaluate(
      (element, anchor) =>
        Math.hypot(
          Number(element.dataset.playerX) - anchor.x,
          Number(element.dataset.playerZ) - anchor.z,
        ),
      GOBLET_ANCHOR,
    )
}

async function cancelVoice(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Voice challenge')).toHaveCount(0)
  for (let frame = 0; frame < 60; frame++) {
    if (
      (await page
        .getByTestId('glass-adventure')
        .getAttribute('data-challenge-camera-mode')) === 'exploration'
    )
      break
    await page.clock.runFor(64)
  }
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
  )
}

test('@smoke museum circles engage once, rearm on physical exit and preserve manual mode', async ({
  page,
}, testInfo) => {
  await openRestoredCircle(page)
  const adventure = page.getByTestId('glass-adventure')
  const sing = page.getByRole('button', { name: 'Sing to the glass' })

  await animationFrames(page, 6)
  expect(await voiceRequests(page)).toBe(0)
  await expect(sing).toBeVisible()
  await expect(adventure).toHaveAttribute('data-automatic-singing', 'true')

  await armWithCameraDrag(page)
  await expect(page.getByLabel('Voice challenge')).toBeVisible()
  await expect.poll(() => voiceRequests(page)).toBe(1)
  expect(
    await page.evaluate(() => window.automaticSingingFixture.gestureUnlocks),
  ).toBeGreaterThan(0)
  await page.screenshot({
    path: testInfo.outputPath('automatic-entry.png'),
    fullPage: true,
  })
  // The default-on prompt above is full WebGL proof. The remaining lifecycle
  // assertions keep the actual host, renderer updates, controls and audio while
  // avoiding unrelated SwiftShader raster cost.
  await omitRasterOutputAfterProof(page)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)

  await cancelVoice(page)
  await page.clock.runFor(500)
  expect(await voiceRequests(page)).toBe(1)
  await expect(sing).toBeVisible()

  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await page.keyboard.down('KeyS')
  try {
    for (let frame = 0; frame < 60; frame++) {
      if ((await playerDistanceFromGoblet(page)) > 1.12) break
      await page.clock.runFor(64)
    }
    expect(await playerDistanceFromGoblet(page)).toBeGreaterThan(1.12)
  } finally {
    await page.keyboard.up('KeyS')
  }
  expect(await voiceRequests(page)).toBe(1)

  await page.keyboard.down('KeyW')
  try {
    for (let frame = 0; frame < 60; frame++) {
      if ((await voiceRequests(page)) === 2) break
      await page.clock.runFor(64)
    }
    expect(await voiceRequests(page)).toBe(2)
  } finally {
    await page.keyboard.up('KeyW')
  }
  await expect(page.getByLabel('Voice challenge')).toBeVisible()
  await cancelVoice(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Pause game' }).click()
  const automatic = page.getByRole('checkbox', {
    name: 'Automatic singing',
  })
  await expect(automatic).toBeChecked()
  const pauseLayout = await page.getByRole('dialog').evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: bounds.left,
      right: bounds.right,
      viewportWidth: window.innerWidth,
      documentOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  expect(pauseLayout.left).toBeGreaterThanOrEqual(0)
  expect(pauseLayout.right).toBeLessThanOrEqual(pauseLayout.viewportWidth)
  expect(pauseLayout.documentOverflow).toBeLessThanOrEqual(0)
  await automatic.uncheck()
  await expect(adventure).toHaveAttribute('data-automatic-singing', 'false')
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `${STORAGE_PREFIX}automatic-singing`,
    ),
  ).toBe('off')
  await page.getByRole('dialog').screenshot({
    path: testInfo.outputPath('automatic-setting-mobile.png'),
  })
  await page.getByRole('button', { name: 'Back to the museum' }).click()

  await page.clock.resume()
  await page.reload()
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 40_000,
  })
  await expect(adventure).toHaveAttribute('data-automatic-singing', 'false')
  await animationFrames(page, 12)
  expect(await voiceRequests(page)).toBe(0)
  await armWithCameraDrag(page)
  await animationFrames(page, 18)
  expect(await voiceRequests(page)).toBe(0)
  await expect(sing).toBeVisible()

  await sing.click()
  await expect(page.getByLabel('Voice challenge')).toBeVisible()
  await expect.poll(() => voiceRequests(page)).toBe(1)
  await page.evaluate(() => window.automaticSingingFixture.dispose())
})
