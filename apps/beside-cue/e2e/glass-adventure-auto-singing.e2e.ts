// Automatic museum singing — real host gesture, cancellation, exit and persisted manual mode.

import { expect, test, type Page } from '@playwright/test'
import { AUTOMATIC_SINGING_CONTACT_RADIUS, BREAKABLE_INTERACTION_RADIUS, } from '../../../packages/glass-game/src/core/exhibit-interaction'
import { omitRasterOutput } from './helpers/glass-adventure-controls'

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
  await omitRasterOutput(page)
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

test('@smoke museum circles engage at visible contact, rearm on exit and preserve manual mode', async ({
  page,
}) => {
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
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100)

  await cancelVoice(page)
  await page.clock.runFor(500)
  expect(await voiceRequests(page)).toBe(1)
  await expect(sing).toBeVisible()

  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await page.keyboard.down('KeyS')
  try {
    for (let frame = 0; frame < 60; frame++) {
      if (
        (await playerDistanceFromGoblet(page)) >
        AUTOMATIC_SINGING_CONTACT_RADIUS + 0.06
      )
        break
      await page.clock.runFor(64)
    }
    const distance = await playerDistanceFromGoblet(page)
    expect(distance).toBeGreaterThan(AUTOMATIC_SINGING_CONTACT_RADIUS + 0.06)
    expect(distance).toBeLessThan(BREAKABLE_INTERACTION_RADIUS)
  } finally {
    await page.keyboard.up('KeyS')
  }
  expect(await voiceRequests(page)).toBe(1)
  await expect(sing).toBeVisible()

  await page.keyboard.down('KeyW')
  let engagedDistance: number | null = null
  try {
    for (let frame = 0; frame < 60; frame++) {
      await page.clock.runFor(32)
      const distance = await playerDistanceFromGoblet(page)
      const challengeVisible =
        (await page.getByLabel('Voice challenge').count()) === 1
      if (challengeVisible) {
        engagedDistance = distance
        break
      }
    }
    if (engagedDistance === null)
      throw new Error('Automatic singing did not re-engage at the goblet ring.')
    expect(engagedDistance).toBeLessThanOrEqual(
      AUTOMATIC_SINGING_CONTACT_RADIUS,
    )
  } finally {
    await page.keyboard.up('KeyW')
  }
  await expect(page.getByLabel('Voice challenge')).toBeVisible()
  // Quick re-entry can reuse the mic manager's live stream during its linger
  // window. Assert resumed capture rather than a second getUserMedia call.
  await expect
    .poll(async () => {
      await page.clock.runFor(64)
      return page.getByLabel('Voice challenge').getAttribute('data-voice-mode')
    })
    .toBe('singing')
  expect(
    await page.evaluate(
      () =>
        window.automaticSingingFixture.sources.filter(
          (source) => source.track.readyState === 'live',
        ).length,
    ),
  ).toBe(1)
  await cancelVoice(page)

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('tab', { name: 'Play', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
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
  await page.getByRole('button', { name: 'Resume' }).click()

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
