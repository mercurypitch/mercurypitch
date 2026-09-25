// Glassworks microphone recovery — real shared-manager handoff and truthful device-busy retry UI.

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { fileURLToPath } from 'node:url'

interface SyntheticMicrophoneFixture {
  activeTracks(): number
  stoppedTracks(): number
  requestedDevices(): Array<string | null>
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
  options: {
    busyFailures?: number
    staleClaim?: boolean
    preferredInput?: string
    rejectDefault?: boolean
  } = {},
): Promise<void> {
  await page.addInitScript((setup) => {
    // This suite verifies microphone ownership and the DOM recovery UI. World
    // pixels have separate real-raster cases; software rendering every resize
    // here can stall screenshots without exercising the microphone boundary.
    if (typeof WebGL2RenderingContext !== 'undefined')
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
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    if (setup.preferredInput)
      localStorage.setItem('beside-cue:input-device', setup.preferredInput)
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
    const requestedDevices: Array<string | null> = []
    const resources: Array<{
      context: AudioContext
      oscillator: OscillatorNode
      track: MediaStreamTrack
    }> = []
    const getUserMedia = async (
      constraints: MediaStreamConstraints,
    ): Promise<MediaStream> => {
      const audio = constraints.audio as MediaTrackConstraints
      const deviceId = audio.deviceId as
        | ConstrainDOMStringParameters
        | undefined
      const requested =
        typeof deviceId?.exact === 'string' ? deviceId.exact : null
      requestedDevices.push(requested)
      if (setup.rejectDefault && requested !== 'scarlett')
        throw new DOMException(
          'Starting audio capture failed',
          'NotReadableError',
        )
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
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      configurable: true,
      value: async () => [
        {
          kind: 'audioinput',
          deviceId: 'default',
          groupId: 'default',
          label: 'Default input',
        },
        {
          kind: 'audioinput',
          deviceId: 'scarlett',
          groupId: 'scarlett',
          label: 'Scarlett microphone',
        },
      ],
    })
    window.glassMicRecoveryFixture = {
      requestedDevices: () => [...requestedDevices],
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

test('ignores a stale tab claim and makes browser startup failure retryable', async ({
  page,
}) => {
  // MicManager retries a transient NotReadableError once, so two failures
  // represent one failed acquisition. The next explicit try succeeds.
  await installSyntheticMicrophone(page, {
    busyFailures: 2,
    staleClaim: true,
  })
  await openGlassworks(page)

  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('The microphone could not start')
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

test('direct entry uses the saved microphone instead of a broken system default @smoke', async ({
  page,
}) => {
  await installSyntheticMicrophone(page, {
    preferredInput: 'scarlett',
    rejectDefault: true,
  })
  await openGlassworks(page)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum an easy note.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      window.glassMicRecoveryFixture.requestedDevices(),
    ),
  ).toEqual(['scarlett'])
})

test('a startup failure offers a named input and remembers the recovered route @smoke', async ({
  page,
}, testInfo) => {
  await installSyntheticMicrophone(page, { rejectDefault: true })
  await openGlassworks(page)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('The microphone could not start')
  await expect(alert).not.toContainText('Another app or browser')
  await alert.getByText('Technical details', { exact: true }).click()
  await expect(alert).toContainText('NotReadableError')
  await expect(alert).toContainText('Starting audio capture failed')
  const picker = alert.getByRole('combobox', {
    name: 'Microphone',
    exact: true,
  })
  await expect(picker).toBeVisible()
  await picker.focus()
  await picker.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Take a little breath.' }),
  ).toHaveCount(0)
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
  for (const [width, height] of [
    [320, 568],
    [844, 390],
    [320, 844],
    [390, 844],
    [768, 844],
    [1180, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await expect(picker).toBeInViewport()
    expect((await picker.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    const retry = alert.getByRole('button', { name: 'Try again' })
    const retryBox = await retry.boundingBox()
    if (!retryBox) throw new Error('The retry action must remain visible')
    expect(retryBox.y + retryBox.height).toBeLessThanOrEqual(height)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    const a = await alert.boundingBox()
    const b = await page
      .getByRole('button', { name: 'Camera tuning' })
      .boundingBox()
    if (!a || !b)
      throw new Error('Recovery and camera controls must be visible')
    expect(
      a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y,
    ).toBe(false)
    if (height < 600)
      await captureProof(
        page,
        testInfo,
        `microphone-recovery-${width}x${height}`,
      )
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await captureProof(page, testInfo, 'microphone-input-recovery-phone')
  await picker.selectOption('scarlett')
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('beside-cue:input-device')),
    )
    .toBe('scarlett')
  expect(
    await page.evaluate(() => window.glassMicRecoveryFixture.activeTracks()),
  ).toBe(0)
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum an easy note.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      window.glassMicRecoveryFixture.requestedDevices(),
    ),
  ).toEqual([null, null, 'scarlett'])
  await page.reload()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum an easy note.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      window.glassMicRecoveryFixture.requestedDevices(),
    ),
  ).toEqual(['scarlett'])
})
