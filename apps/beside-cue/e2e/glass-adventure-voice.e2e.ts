// Adventure voice regression — real PCM, YIN capture, lifecycle and saved success.
import { expect, test, type Page } from '@playwright/test'

interface VoiceSource {
  context: AudioContext
  gain: GainNode
  track: MediaStreamTrack
}
interface PendingPermission {
  resolve(stream: MediaStream): void
  reject(cause: unknown): void
}
declare global {
  interface Window {
    glassVoiceFixture: {
      sources: VoiceSource[]
      deferNextPermission(): void
      grantPermission(): Promise<void>
      denyPermission(): void
      pendingPermissionCount(): number
      setAmplitude(value: number): void
      dispose(): Promise<void>
    }
  }
}

test.use({
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
// A full voice success includes two SwiftShader scene boots: the initial
// museum and a reload that proves saved progress restores. Shared CI runners
// can spend more than 20 seconds releasing and rebuilding the WebGL scene.
test.setTimeout(120_000)

async function openMuseum(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    // A legitimate reached checkpoint shortens traversal covered by controls tests.
    // This grants no break, bridge or target note; all singing below is real PCM.
    if (localStorage.getItem(`${prefix}progress:glassworks`) === null) {
      localStorage.setItem(
        `${prefix}progress:glassworks`,
        JSON.stringify({
          version: 1,
          levelId: 'glassworks',
          checkpointId: 'goblet',
          completedBreakableIds: [],
        }),
      )
    }
    let amplitude = 0
    let nextPermission: 'grant' | 'defer' = 'grant'
    const sources: VoiceSource[] = []
    const pendingPermissions: PendingPermission[] = []
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    )
    const createStream = async (): Promise<MediaStream> => {
      const context = new AudioContext()
      await context.resume()
      const oscillator = context.createOscillator()
      oscillator.frequency.value = 220
      const gain = context.createGain()
      gain.gain.value = amplitude
      const destination = context.createMediaStreamDestination()
      oscillator.connect(gain).connect(destination)
      oscillator.start()
      const track = destination.stream.getAudioTracks()[0]
      const stop = track.stop.bind(track)
      track.stop = () => {
        stop()
        oscillator.stop()
        oscillator.disconnect()
        gain.disconnect()
        void context.close()
      }
      sources.push({ context, gain, track })
      return destination.stream
    }
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints?.audio) return original(constraints)
      const permission = nextPermission
      nextPermission = 'grant'
      if (permission === 'defer')
        return new Promise<MediaStream>((resolve, reject) => {
          pendingPermissions.push({ resolve, reject })
        })
      return createStream()
    }
    window.glassVoiceFixture = {
      sources,
      deferNextPermission() {
        nextPermission = 'defer'
      },
      async grantPermission() {
        const pending = pendingPermissions.shift()
        if (!pending) throw new Error('No microphone permission is pending.')
        try {
          pending.resolve(await createStream())
        } catch (cause) {
          pending.reject(cause)
        }
      },
      denyPermission() {
        const pending = pendingPermissions.shift()
        if (!pending) throw new Error('No microphone permission is pending.')
        pending.reject(new DOMException('Permission denied', 'NotAllowedError'))
      },
      pendingPermissionCount: () => pendingPermissions.length,
      setAmplitude(value) {
        amplitude = value
        for (const source of sources)
          if (source.track.readyState === 'live')
            source.gain.gain.setValueAtTime(value, source.context.currentTime)
      },
      async dispose() {
        for (const pending of pendingPermissions.splice(0))
          pending.reject(new DOMException('Test ended', 'AbortError'))
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
  })
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

async function expectMicrophoneOff(page: Page): Promise<void> {
  // MicManager intentionally retains an unowned stream for a two-second handoff.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.glassVoiceFixture.sources.every(
            (source) => source.track.readyState === 'ended',
          ),
        ),
      { timeout: 6000 },
    )
    .toBe(true)
}

async function playerPosition(page: Page): Promise<{ x: number; z: number }> {
  const adventure = page.getByTestId('glass-adventure')
  return {
    x: Number(await adventure.getAttribute('data-player-x')),
    z: Number(await adventure.getAttribute('data-player-z')),
  }
}

async function cameraYaw(page: Page): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute('data-camera-yaw'),
  )
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.glassVoiceFixture?.dispose())
})

test('silence cannot earn progress; a fresh comfortable hold breaks and survives reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openMuseum(page)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  const startedAt = await page.evaluate(
    () => window.glassVoiceFixture.sources[0].context.currentTime,
  )
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.glassVoiceFixture.sources[0].context.currentTime,
        ),
      { timeout: 6000 },
    )
    .toBeGreaterThan(startedAt + 1.5)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  expect(
    await page.evaluate(() =>
      localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
    ),
  ).toBeNull()

  await page.evaluate(() => window.glassVoiceFixture.setAmplitude(0.1))
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
        ),
      { timeout: 12_000 },
    )
    .toBe('57')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
    { timeout: 15_000 },
  )
  await expectMicrophoneOff(page)
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          'beside-cue:glass-adventure:progress:glassworks',
        ) ?? 'null',
      ) as { completedBreakableIds: string[] },
  )
  expect(saved.completedBreakableIds).toEqual(['glassworks.first-goblet'])
  await page.reload()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(0)
  expect(errors).toEqual([])
})

test('cancel and page background stop capture; return requires an explicit fresh start', async ({
  page,
}) => {
  await openMuseum(page)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expectMicrophoneOff(page)
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(2)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  )
  await expect(page.getByRole('dialog')).toContainText('The microphone is off.')
  await expectMicrophoneOff(page)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow')),
  )
  await expect(
    page.getByRole('button', { name: 'Back to the museum' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to the museum' }).click()
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(2)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  await page.evaluate(() => window.glassVoiceFixture.setAmplitude(0.1))
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
    { timeout: 20_000 },
  )
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(3)
  await expectMicrophoneOff(page)
})

test('a browser permission prompt can blur the window without pausing or cancelling its grant', async ({
  page,
}) => {
  await openMuseum(page)
  await page.evaluate(() => window.glassVoiceFixture.deferNextPermission())
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Opening your microphone…' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.glassVoiceFixture.pendingPermissionCount()),
    )
    .toBe(1)

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Opening your microphone…' }),
  ).toBeVisible()

  await page.evaluate(() => window.glassVoiceFixture.grantPermission())
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(1)
})

test('true background cancels a pending permission grant and a late stream cannot resurrect recording', async ({
  page,
}) => {
  await openMuseum(page)
  await page.evaluate(() => window.glassVoiceFixture.deferNextPermission())
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Opening your microphone…' }),
  ).toBeVisible()

  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  )
  await expect(page.getByRole('dialog')).toContainText('The microphone is off.')
  await page.evaluate(() => window.glassVoiceFixture.grantPermission())
  await expectMicrophoneOff(page)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow')),
  )
  await expect(page.getByRole('dialog')).toContainText('The microphone is off.')
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(1)
})

test('permission denial returns to a fresh start instead of leaving the encounter stuck', async ({
  page,
}) => {
  await openMuseum(page)
  await page.evaluate(() => window.glassVoiceFixture.deferNextPermission())
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Opening your microphone…' }),
  ).toBeVisible()
  await page.evaluate(() => window.glassVoiceFixture.denyPermission())

  await expect(page.getByRole('alert')).toContainText(
    'Microphone access is off.',
  )
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
})

test('visible-window blur releases held movement and orbit without opening Pause', async ({
  page,
}) => {
  await openMuseum(page)
  const before = await playerPosition(page)
  await page.keyboard.down('KeyW')
  await expect
    .poll(async () => {
      const current = await playerPosition(page)
      return Math.hypot(current.x - before.x, current.z - before.z)
    })
    .toBeGreaterThan(0.05)

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(250)
  const movementReleased = await playerPosition(page)
  await page.waitForTimeout(250)
  expect((await playerPosition(page)).x).toBeCloseTo(movementReleased.x, 4)
  expect((await playerPosition(page)).z).toBeCloseTo(movementReleased.z, 4)
  await page.keyboard.up('KeyW')

  await page.mouse.move(320, 210)
  await page.mouse.down()
  await page.mouse.move(390, 220, { steps: 4 })
  const draggedYaw = await cameraYaw(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.move(460, 240, { steps: 4 })
  await page.waitForTimeout(50)
  expect(await cameraYaw(page)).toBeCloseTo(draggedYaw, 5)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.mouse.up()
})

test.describe('phone blur input', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('blur retires a touch stick contact before any stale or fresh move', async ({
    page,
    context,
  }) => {
    await openMuseum(page)
    const cdp = await context.newCDPSession(page)
    const stick = page.getByRole('group', { name: 'Move Merc' })
    const knob = stick.locator('span').nth(1)
    const box = await stick.boundingBox()
    expect(box).not.toBeNull()
    const centre = {
      x: box!.x + box!.width / 2,
      y: box!.y + box!.height / 2,
    }
    const held = { id: 1, x: centre.x + 20, y: centre.y - 8 }
    const before = await playerPosition(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, ...centre }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [held],
    })
    await expect
      .poll(async () => {
        const current = await playerPosition(page)
        return Math.hypot(current.x - before.x, current.z - before.z)
      })
      .toBeGreaterThan(0.03)
    await expect
      .poll(() =>
        knob.evaluate((element) => getComputedStyle(element).transform),
      )
      .not.toBe('matrix(1, 0, 0, 1, 0, 0)')

    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect
      .poll(() =>
        knob.evaluate((element) => getComputedStyle(element).transform),
      )
      .toBe('matrix(1, 0, 0, 1, 0, 0)')
    await page.waitForTimeout(250)
    const released = await playerPosition(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: centre.x + 28, y: centre.y - 12 }],
    })
    await page.waitForTimeout(250)
    expect((await playerPosition(page)).x).toBeCloseTo(released.x, 4)
    expect((await playerPosition(page)).z).toBeCloseTo(released.z, 4)

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    const beforeFreshContact = await playerPosition(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 2, ...centre }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 2, x: centre.x - 20, y: centre.y + 8 }],
    })
    await expect
      .poll(async () => {
        const current = await playerPosition(page)
        return Math.hypot(
          current.x - beforeFreshContact.x,
          current.z - beforeFreshContact.z,
        )
      })
      .toBeGreaterThan(0.03)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  })
})
