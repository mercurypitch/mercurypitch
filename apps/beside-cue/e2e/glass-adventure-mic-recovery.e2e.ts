// Glassworks microphone recovery — real shared-manager handoff and truthful device-busy retry UI.

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { fileURLToPath } from 'node:url'

interface SyntheticMicrophoneFixture {
  activeTracks(): number
  stoppedTracks(): number
  dispose(): Promise<void>
}

declare global {
  interface Window {
    glassMicRecoveryFixture: SyntheticMicrophoneFixture
  }
}

const MIC_MANAGER_MODULE = `/@fs${fileURLToPath(
  new URL('../../../packages/pitch-engine/src/mic-manager.ts', import.meta.url),
)}`
const CAPTURE_PROOF = process.env.GLASS_MIC_RECOVERY_PROOF === '1'

test.use({
  viewport: { width: 1180, height: 760 },
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
test.setTimeout(90_000)

async function installSyntheticMicrophone(
  page: Page,
  options: { busyFailures?: number; staleClaim?: boolean } = {},
): Promise<void> {
  await page.addInitScript((setup) => {
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
    if (setup.staleClaim)
      localStorage.setItem(
        'mercurypitch_mic_holder',
        JSON.stringify({
          tabId: 'closed-glassworks-tab',
          label: 'Closed Glassworks tab',
          at: Date.now() - 7000,
        }),
      )

    let busyFailures = setup.busyFailures ?? 0
    let stoppedTracks = 0
    const resources: Array<{
      context: AudioContext
      oscillator: OscillatorNode
      track: MediaStreamTrack
    }> = []
    const getUserMedia = async (): Promise<MediaStream> => {
      if (busyFailures > 0) {
        busyFailures--
        throw new DOMException('Device is busy', 'NotReadableError')
      }
      const context = new AudioContext()
      await context.resume()
      const oscillator = context.createOscillator()
      const destination = context.createMediaStreamDestination()
      oscillator.frequency.value = 220
      oscillator.connect(destination)
      oscillator.start()
      const track = destination.stream.getAudioTracks()[0]!
      const stop = track.stop.bind(track)
      track.stop = () => {
        if (track.readyState === 'ended') return
        stoppedTracks++
        stop()
        oscillator.stop()
        oscillator.disconnect()
        void context.close()
      }
      resources.push({ context, oscillator, track })
      return destination.stream
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: getUserMedia,
    })
    window.glassMicRecoveryFixture = {
      activeTracks: () =>
        resources.filter((resource) => resource.track.readyState === 'live')
          .length,
      stoppedTracks: () => stoppedTracks,
      async dispose() {
        for (const resource of resources)
          if (resource.track.readyState === 'live') resource.track.stop()
        await Promise.all(
          resources.map((resource) =>
            resource.context.state === 'closed'
              ? Promise.resolve()
              : resource.context.close(),
          ),
        )
      },
    }
  }, options)
}

async function openGlassworks(page: Page): Promise<void> {
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
}

async function acquireInOwnerTab(page: Page): Promise<void> {
  await page.evaluate(async (modulePath) => {
    const module = (await import(
      modulePath
    )) as typeof import('@irchiinnuss/pitch-engine')
    await module.micManager.acquire('glassworks-e2e-owner')
  }, MIC_MANAGER_MODULE)
  await expect
    .poll(() =>
      page.evaluate(() => window.glassMicRecoveryFixture.activeTracks()),
    )
    .toBe(1)
}

async function captureProof(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (!CAPTURE_PROOF) return
  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    path: testInfo.outputPath(`${name}.png`),
  })
}

test.afterEach(async ({ page }) => {
  await page
    .evaluate(() => window.glassMicRecoveryFixture?.dispose())
    .catch(() => undefined)
})

test('moves a live app-tab microphone lease into Glassworks @smoke', async ({
  page,
  context,
}, testInfo) => {
  await installSyntheticMicrophone(page)
  await openGlassworks(page)

  const owner = await context.newPage()
  await installSyntheticMicrophone(owner)
  await owner.goto('/')
  await acquireInOwnerTab(owner)

  await page.bringToFront()
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Another tab for this app')
  await expect(alert.getByRole('button', { name: 'Use it here' })).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  await captureProof(page, testInfo, 'glassworks-mic-handoff-desktop')

  await page.setViewportSize({ width: 390, height: 844 })
  const action = alert.getByRole('button', { name: 'Use it here' })
  await expect(action).toBeInViewport()
  expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expect(action).toHaveCSS('color', 'rgb(255, 249, 230)')
  await expect(action).toHaveCSS('background-color', 'rgb(23, 76, 86)')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  for (const width of [320, 390, 540, 600]) {
    await page.setViewportSize({ width, height: 844 })
    const alertBox = await alert.boundingBox()
    const tuneBox = await page
      .getByRole('button', { name: 'Camera tuning' })
      .boundingBox()
    if (alertBox === null || tuneBox === null)
      throw new Error(
        'Recovery alert and tuning control must both be laid out.',
      )
    expect(
      alertBox.x < tuneBox.x + tuneBox.width &&
        alertBox.x + alertBox.width > tuneBox.x &&
        alertBox.y < tuneBox.y + tuneBox.height &&
        alertBox.y + alertBox.height > tuneBox.y,
    ).toBe(false)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await captureProof(page, testInfo, 'glassworks-mic-handoff-phone')

  await action.click()
  await expect(
    page.getByRole('heading', { name: 'Hum an easy note.' }),
  ).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() =>
      owner.evaluate(() => window.glassMicRecoveryFixture.activeTracks()),
    )
    .toBe(0)
  await expect
    .poll(() =>
      page.evaluate(() => window.glassMicRecoveryFixture.activeTracks()),
    )
    .toBe(1)
  expect(
    await owner.evaluate(() => window.glassMicRecoveryFixture.stoppedTracks()),
  ).toBe(1)
  await owner.close()
})

test('ignores a stale tab claim and labels an OS device lock as retryable', async ({
  page,
}) => {
  // MicManager retries a transient NotReadableError once, so two failures
  // represent one genuinely busy acquisition. The next explicit try succeeds.
  await installSyntheticMicrophone(page, {
    busyFailures: 2,
    staleClaim: true,
  })
  await openGlassworks(page)

  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText(
    'Another app or browser outside this Glassworks session',
  )
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Use it here' })).toHaveCount(
    0,
  )

  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum an easy note.' }),
  ).toBeVisible({ timeout: 15_000 })
  expect(
    await page.evaluate(() => window.glassMicRecoveryFixture.activeTracks()),
  ).toBe(1)
})
