// Adventure voice regression — real PCM, YIN capture, lifecycle and saved success.
import { expect, test, type Page } from '@playwright/test'

interface VoiceSource {
  context: AudioContext
  gain: GainNode
  oscillator: OscillatorNode
  track: MediaStreamTrack
}
interface PairCalibration {
  version: 1
  low: number
  high?: number
}
interface MuseumSetup {
  path: string
  levelId: string
  checkpointId: string
  completedBreakableIds: string[]
  tutorialPreference: string
  pairPreference: PairCalibration | null
  waitForEncounter: boolean
}
interface PendingPermission {
  resolve(stream: MediaStream): void
  reject(cause: unknown): void
}
interface ChallengeCameraMetrics {
  encounterId: string | null
  mode: 'exploration' | 'entering' | 'holding' | 'restoring'
  safeBottomFraction: number
  safeBottomNdc: number | null
  mercFrame: { minX: number; maxX: number; minY: number; maxY: number } | null
  targetFrame: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null
  combinedFrame: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null
}
declare global {
  interface Window {
    glassVoiceFixture: {
      sources: VoiceSource[]
      readonly narrationStarts: number
      readonly referenceStarts: number
      deferNextPermission(): void
      grantPermission(): Promise<void>
      denyPermission(): void
      pendingPermissionCount(): number
      setAmplitude(value: number): void
      setMidi(value: number): void
      glideMidi(value: number, durationSeconds: number): void
      dispose(): Promise<void>
    }
  }
}

const twinPrefix = 'glassworks-twin-galleries/twin-galleries'
const twinIds = {
  lower: `${twinPrefix}/warm/encounter/lower-urn`,
  upper: `${twinPrefix}/cool/encounter/upper-decanter`,
  bridgePair: `${twinPrefix}/court/encounter/bridge-pair`,
  coolCheckpoint: `${twinPrefix}/cool/checkpoint/entry`,
  courtCheckpoint: `${twinPrefix}/court/checkpoint/entry`,
} as const
const conservatoryPrefix =
  'glassworks-resonance-conservatory/resonance-conservatory'
const conservatoryIds = {
  entrance: `${conservatoryPrefix}/foyer/encounter/entrance-goblet`,
  fern: `${conservatoryPrefix}/fern-house/encounter/fern-wave`,
  fernCheckpoint: `${conservatoryPrefix}/fern-house/checkpoint/entry`,
} as const

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

async function openMuseum(
  page: Page,
  options: Partial<MuseumSetup> = {},
): Promise<void> {
  const setup: MuseumSetup = {
    path: '/glass-game/',
    levelId: 'glassworks',
    checkpointId: 'goblet',
    completedBreakableIds: [],
    tutorialPreference: 'tutorial',
    pairPreference: null,
    waitForEncounter: true,
    ...options,
  }
  await page.addInitScript((museum) => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}${museum.tutorialPreference}`, 'seen')
    // A legitimate reached checkpoint shortens traversal covered by controls tests.
    // This grants no break, bridge or target note; all singing below is real PCM.
    if (localStorage.getItem(`${prefix}progress:${museum.levelId}`) === null) {
      localStorage.setItem(
        `${prefix}progress:${museum.levelId}`,
        JSON.stringify({
          version: 1,
          levelId: museum.levelId,
          checkpointId: museum.checkpointId,
          completedBreakableIds: museum.completedBreakableIds,
        }),
      )
    }
    if (museum.pairPreference !== null)
      localStorage.setItem(
        `${prefix}comfortable-pair`,
        JSON.stringify(museum.pairPreference),
      )
    let amplitude = 0
    let midi = 57
    let narrationStarts = 0
    let referenceStarts = 0
    const startBuffer = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      // Reference notes are oscillators; crack noise is shorter than 0.8s.
      // This observes actual spoken buffer playback without replacing it.
      if (!this.loop && (this.buffer?.duration ?? 0) > 0.8) narrationStarts++
      startBuffer.apply(this, args)
    }
    const microphoneOscillators = new WeakSet<OscillatorNode>()
    const startOscillator = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (...args) {
      if (!microphoneOscillators.has(this)) referenceStarts++
      startOscillator.apply(this, args)
    }
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
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
      microphoneOscillators.add(oscillator)
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
      sources.push({ context, gain, oscillator, track })
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
      get narrationStarts() {
        return narrationStarts
      },
      get referenceStarts() {
        return referenceStarts
      },
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
      setMidi(value) {
        if (!Number.isFinite(value)) throw new Error('MIDI must be finite.')
        midi = value
        const frequency = 440 * 2 ** ((value - 69) / 12)
        for (const source of sources)
          if (source.track.readyState === 'live')
            source.oscillator.frequency.setValueAtTime(
              frequency,
              source.context.currentTime,
            )
      },
      glideMidi(value, durationSeconds) {
        if (!Number.isFinite(value)) throw new Error('MIDI must be finite.')
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
          throw new Error('Glide duration must be positive.')
        midi = value
        const frequency = 440 * 2 ** ((value - 69) / 12)
        for (const source of sources) {
          if (source.track.readyState !== 'live') continue
          const now = source.context.currentTime
          const parameter = source.oscillator.frequency
          const current = parameter.value
          parameter.cancelScheduledValues(now)
          parameter.setValueAtTime(current, now)
          parameter.exponentialRampToValueAtTime(
            frequency,
            now + durationSeconds,
          )
        }
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
  }, setup)
  await page.goto(setup.path)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-level-id',
    setup.levelId,
  )
  if (setup.waitForEncounter)
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

async function blurAtPlayerPosition(
  page: Page,
): Promise<{ x: number; z: number }> {
  return page.evaluate(() => {
    const adventure = document.querySelector<HTMLElement>(
      '[data-testid="glass-adventure"]',
    )
    const x = Number(adventure?.dataset.playerX)
    const z = Number(adventure?.dataset.playerZ)
    if (!Number.isFinite(x) || !Number.isFinite(z))
      throw new Error('Player position is unavailable before window blur.')
    window.dispatchEvent(new Event('blur'))
    return { x, z }
  })
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

async function expectPlayerMovement(
  page: Page,
  before: { x: number; z: number },
  minimumDistance: number,
): Promise<void> {
  // RAF callbacks can bunch after software-rendering stalls; their count is
  // not elapsed physics time. Keep input held and require real travel instead.
  await expect
    .poll(
      async () => {
        const current = await playerPosition(page)
        return Math.hypot(current.x - before.x, current.z - before.z)
      },
      { timeout: 3000, intervals: [50] },
    )
    .toBeGreaterThan(minimumDistance)
}

async function minimizeMuseumRaster(page: Page): Promise<void> {
  // Selected behavior-only cases use this after genuine scene initialization.
  // Keep real RAF, controls, audio and CSS hit targets while avoiding costly
  // full-size SwiftShader output. These cases make no visual-rendering claim.
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const canvas = page.locator('canvas[aria-label="Floating glass museum"]')
  const before = {
    viewport: await viewport.boundingBox(),
    canvas: await canvas.boundingBox(),
  }
  expect(before.viewport).not.toBeNull()
  expect(before.canvas).not.toBeNull()

  await canvas.evaluate((element) => {
    element.width = 1
    element.height = 1
  })

  expect(await viewport.boundingBox()).toEqual(before.viewport)
  expect(await canvas.boundingBox()).toEqual(before.canvas)
  await animationFrames(page, 4)
  expect(
    await canvas.evaluate((element) => {
      const context = element.getContext('webgl2')
      return {
        canvasWidth: element.width,
        canvasHeight: element.height,
        drawingBufferWidth: context?.drawingBufferWidth,
        drawingBufferHeight: context?.drawingBufferHeight,
      }
    }),
  ).toEqual({
    canvasWidth: 1,
    canvasHeight: 1,
    drawingBufferWidth: 1,
    drawingBufferHeight: 1,
  })
}

async function omitMuseumRasterOutput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Twin voice cases assert the real scene lifecycle, controls and Web Audio
    // pipeline, while visual rendering has dedicated browser coverage.
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

async function setVoice(
  page: Page,
  midi: number,
  amplitude: number,
): Promise<void> {
  await page.evaluate(
    ({ nextMidi, nextAmplitude }) => {
      window.glassVoiceFixture.setMidi(nextMidi)
      window.glassVoiceFixture.setAmplitude(nextAmplitude)
    },
    { nextMidi: midi, nextAmplitude: amplitude },
  )
}

async function glideVoice(
  page: Page,
  midi: number,
  seconds: number,
): Promise<void> {
  await page.evaluate(
    ({ nextMidi, durationSeconds }) => {
      window.glassVoiceFixture.glideMidi(nextMidi, durationSeconds)
    },
    { nextMidi: midi, durationSeconds: seconds },
  )
  await holdForAudioSeconds(page, seconds)
}

async function holdForAudioSeconds(page: Page, seconds: number): Promise<void> {
  const startedAt = await page.evaluate(
    () => window.glassVoiceFixture.sources.at(-1)?.context.currentTime ?? 0,
  )
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.glassVoiceFixture.sources.at(-1)?.context.currentTime ?? 0,
        ),
      { timeout: Math.max(6000, seconds * 4000) },
    )
    .toBeGreaterThan(startedAt + seconds)
}

async function approachRestoredEncounter(
  page: Page,
  checkpointId: string,
  label: string,
  desiredDirection: { x: number; z: number },
): Promise<void> {
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-checkpoint', checkpointId)
  const directionLength = Math.hypot(desiredDirection.x, desiredDirection.z)
  expect(directionLength).toBeGreaterThan(0)
  const direction = {
    x: desiredDirection.x / directionLength,
    z: desiredDirection.z / directionLength,
  }
  // Restored camera yaw is deliberately player-owned. Recenter through the
  // public control so forward follows the checkpoint pose toward its exhibit.
  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await animationFrames(page, 2)
  const yaw = await cameraYaw(page)
  expect(
    -Math.sin(yaw) * direction.x - Math.cos(yaw) * direction.z,
  ).toBeGreaterThan(0.99)
  const before = await playerPosition(page)
  await page.keyboard.down('KeyW')
  try {
    await expect
      .poll(
        async () => {
          const current = await playerPosition(page)
          return (
            (current.x - before.x) * direction.x +
            (current.z - before.z) * direction.z
          )
        },
        { timeout: 8000, intervals: [32] },
      )
      .toBeGreaterThan(2.1)
  } finally {
    await page.keyboard.up('KeyW')
  }
  await settledPlayerPosition(page)
  await expect(page.getByText(label, { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
}

async function expectVoicePanelFits(page: Page): Promise<void> {
  const bounds = await page
    .getByLabel('Voice challenge')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })
  expect(bounds.left).toBeGreaterThanOrEqual(0)
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight)
}

async function challengeCameraMetrics(
  page: Page,
): Promise<ChallengeCameraMetrics | null> {
  const value = await page
    .getByTestId('glass-adventure')
    .getAttribute('data-challenge-camera')
  return value === null || value === 'null'
    ? null
    : (JSON.parse(value) as ChallengeCameraMetrics)
}

async function voicePanelTopNdc(page: Page): Promise<number | null> {
  const panelBounds = await page.getByLabel('Voice challenge').boundingBox()
  const viewport = page.viewportSize()
  return panelBounds === null || viewport === null
    ? null
    : 1 - (panelBounds.y / viewport.height) * 2
}

async function expectChallengeCameraFitsPanel(
  page: Page,
  encounterId: string,
): Promise<void> {
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
    { timeout: 20_000 },
  )
  await expect
    .poll(
      async () => {
        const [metrics, panelTopNdc] = await Promise.all([
          challengeCameraMetrics(page),
          voicePanelTopNdc(page),
        ])
        const frame = metrics?.combinedFrame
        return (
          metrics?.encounterId === encounterId &&
          metrics.mercFrame !== null &&
          metrics.targetFrame !== null &&
          frame !== null &&
          panelTopNdc !== null &&
          metrics.safeBottomFraction > 0.2 &&
          frame.minX >= -0.9 &&
          frame.maxX <= 0.9 &&
          frame.minY >= panelTopNdc &&
          frame.maxY <= 0.88
        )
      },
      { timeout: 20_000, intervals: [100] },
    )
    .toBe(true)

  const metrics = await challengeCameraMetrics(page)
  const panelTopNdc = await voicePanelTopNdc(page)
  expect(metrics?.encounterId).toBe(encounterId)
  expect(metrics?.mercFrame).not.toBeNull()
  expect(metrics?.targetFrame).not.toBeNull()
  expect(metrics?.combinedFrame?.minX).toBeGreaterThanOrEqual(-0.9)
  expect(metrics?.combinedFrame?.maxX).toBeLessThanOrEqual(0.9)
  expect(panelTopNdc).not.toBeNull()
  expect(metrics?.combinedFrame?.minY).toBeGreaterThanOrEqual(panelTopNdc ?? 1)
  expect(metrics?.combinedFrame?.maxY).toBeLessThanOrEqual(0.88)
}

async function savedProgress(
  page: Page,
  levelId: string,
): Promise<{
  version: 1
  levelId: string
  checkpointId: string
  completedBreakableIds: string[]
  finished?: boolean
}> {
  return page.evaluate((id) => {
    const raw = localStorage.getItem(
      `beside-cue:glass-adventure:progress:${id}`,
    )
    if (raw === null) throw new Error(`Missing saved progress for ${id}.`)
    return JSON.parse(raw) as {
      version: 1
      levelId: string
      checkpointId: string
      completedBreakableIds: string[]
      finished?: boolean
    }
  }, levelId)
}

async function settledPlayerPosition(
  page: Page,
): Promise<{ x: number; z: number }> {
  let previous = await playerPosition(page)
  for (let attempt = 0; attempt < 12; attempt++) {
    await animationFrames(page, 3)
    const current = await playerPosition(page)
    if (current.x === previous.x && current.z === previous.z) return current
    previous = current
  }
  throw new Error('Player movement did not settle after input release.')
}

function expectNormalBrakingDistance(
  beforeBlur: { x: number; z: number },
  settled: { x: number; z: number },
): void {
  // Full speed is 1.15 m/s and normal braking takes 0.14 s, for about
  // 0.081 m of travel. Leave fixed-step and observation margin without
  // allowing a stuck input to walk until collision makes it appear settled.
  expect(
    Math.hypot(settled.x - beforeBlur.x, settled.z - beforeBlur.z),
  ).toBeLessThan(0.12)
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
  await expect
    .poll(() => page.evaluate(() => window.glassVoiceFixture.narrationStarts))
    .toBe(1)
  await expect(page.getByTestId('merc-narration-caption')).toHaveText(
    'Merc: Beautiful. A new path is open.',
  )
  await page.getByRole('button', { name: 'Pause game', exact: true }).click()
  await expect(page.getByTestId('merc-narration-caption')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to the museum' }).click()
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
  expect(
    await page.evaluate(() => window.glassVoiceFixture.narrationStarts),
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

test('Twin high-note calibration rejects an overlapping range and recovers safely', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await omitMuseumRasterOutput(page)
  await openMuseum(page, {
    path: '/glass-game/?layout=twin-galleries',
    levelId: twinPrefix,
    checkpointId: twinIds.coolCheckpoint,
    completedBreakableIds: [twinIds.lower],
    tutorialPreference: `tutorial:${twinPrefix}:comfortable-pair:v1`,
    pairPreference: { version: 1, low: 52 },
    waitForEncounter: false,
  })
  await approachRestoredEncounter(
    page,
    twinIds.coolCheckpoint,
    'Celadon lark decanter',
    { x: 1, z: 0 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )

  await setVoice(page, 54, 0.1)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const panel = page.getByLabel('Voice challenge')
  await expect(panel).toHaveAttribute('data-voice-mode', 'finding')
  await expect(
    page.getByRole('heading', {
      name: 'Choose a clearly different comfortable high note.',
    }),
  ).toBeVisible({ timeout: 10_000 })
  await expectVoicePanelFits(page)
  expect(
    await page.evaluate(() =>
      localStorage.getItem('beside-cue:glass-adventure:comfortable-pair'),
    ),
  ).toBe(JSON.stringify({ version: 1, low: 52 }))
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
  expect(
    await page.evaluate(
      () => window.glassVoiceFixture.sources.at(-1)?.track.readyState,
    ),
  ).toBe('live')

  await setVoice(page, 64, 0.1)
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('beside-cue:glass-adventure:comfortable-pair'),
      ),
    )
    .toBe(JSON.stringify({ version: 1, low: 52, high: 64 }))
  await setVoice(page, 64, 0)
  await expect(panel).toHaveAttribute('data-voice-mode', /reference|singing/)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expectMicrophoneOff(page)
  expect(await savedProgress(page, twinPrefix)).toEqual({
    version: 1,
    levelId: twinPrefix,
    checkpointId: twinIds.coolCheckpoint,
    completedBreakableIds: [twinIds.lower],
  })
})

test('Twin court requires low then high, Replay resets the partial pair, and only the full pair saves', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await omitMuseumRasterOutput(page)
  await openMuseum(page, {
    path: '/glass-game/?layout=twin-galleries',
    levelId: twinPrefix,
    checkpointId: twinIds.courtCheckpoint,
    completedBreakableIds: [twinIds.lower, twinIds.upper],
    tutorialPreference: `tutorial:${twinPrefix}:comfortable-pair:v1`,
    pairPreference: { version: 1, low: 52, high: 64 },
    waitForEncounter: false,
  })
  await approachRestoredEncounter(
    page,
    twinIds.courtCheckpoint,
    'Twin-tone answer',
    { x: 0, z: 1 },
  )
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-completed', '2')
  expect(await savedProgress(page, twinPrefix)).toEqual({
    version: 1,
    levelId: twinPrefix,
    checkpointId: twinIds.courtCheckpoint,
    completedBreakableIds: [twinIds.lower, twinIds.upper],
  })

  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const panel = page.getByLabel('Voice challenge')
  await expect(
    page.getByRole('heading', { name: 'Listen to both notes in order.' }),
  ).toBeVisible({ timeout: 6000 })
  await expect
    .poll(() => page.evaluate(() => window.glassVoiceFixture.referenceStarts))
    .toBe(2)
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 8000,
  })
  await expectVoicePanelFits(page)
  await expect(
    page.getByRole('list', { name: 'Note order' }).getByText('Lower note'),
  ).toHaveAttribute('aria-current', 'step')

  // A long higher note is real detector input, but cannot satisfy step one.
  await setVoice(page, 64, 0.1)
  await expect(page.getByText(/E4 ·/)).toBeVisible({ timeout: 6000 })
  await holdForAudioSeconds(page, 1.25)
  await expect(panel).toHaveAttribute('data-step-index', '0')
  await expect(
    page.getByRole('progressbar', { name: 'Glass resonance' }),
  ).toHaveAttribute('aria-valuenow', '0')
  await expect(adventure).toHaveAttribute('data-completed', '2')

  // Completing only the low step advances the live pair but persists no break.
  await setVoice(page, 52, 0.1)
  await expect(panel).toHaveAttribute('data-step-index', '1', {
    timeout: 10_000,
  })
  await setVoice(page, 52, 0)
  await expect(
    page.getByRole('list', { name: 'Note order' }).getByText('Higher note'),
  ).toHaveAttribute('aria-current', 'step')
  expect(await savedProgress(page, twinPrefix)).toEqual({
    version: 1,
    levelId: twinPrefix,
    checkpointId: twinIds.courtCheckpoint,
    completedBreakableIds: [twinIds.lower, twinIds.upper],
  })

  const referencesBeforeReplay = await page.evaluate(
    () => window.glassVoiceFixture.referenceStarts,
  )
  await page.getByRole('button', { name: 'Hear both notes again' }).click()
  await expect(panel).toHaveAttribute('data-voice-mode', 'reference')
  await expect(panel).toHaveAttribute('data-step-index', '0')
  await expect
    .poll(() => page.evaluate(() => window.glassVoiceFixture.referenceStarts))
    .toBe(referencesBeforeReplay + 2)
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 8000,
  })
  await expect(
    page.getByRole('list', { name: 'Note order' }).getByText('Lower note'),
  ).toHaveAttribute('aria-current', 'step')

  await setVoice(page, 52, 0.1)
  await expect(panel).toHaveAttribute('data-step-index', '1', {
    timeout: 10_000,
  })
  await setVoice(page, 64, 0.1)
  await expect(adventure).toHaveAttribute('data-completed', '3', {
    timeout: 12_000,
  })
  await expectMicrophoneOff(page)
  expect(await savedProgress(page, twinPrefix)).toEqual({
    version: 2,
    levelId: twinPrefix,
    checkpointId: twinIds.courtCheckpoint,
    completedBreakableIds: [twinIds.lower, twinIds.upper, twinIds.bridgePair],
    finished: false,
    rewards: {
      version: 1,
      discoveredEncounterIds: [],
      collectedCoinIds: [],
      qualityResults: [],
      collectedPortraitIds: [],
    },
  })
})

test('Conservatory accepts two deliberate whole-tone waves, a brief dropout, and a return to the middle', async ({
  page,
}) => {
  await omitMuseumRasterOutput(page)
  await openMuseum(page, {
    path: '/glass-game/?layout=conservatory',
    levelId: conservatoryPrefix,
    checkpointId: conservatoryIds.fernCheckpoint,
    completedBreakableIds: [conservatoryIds.entrance],
    tutorialPreference: `tutorial:${conservatoryPrefix}:settle-and-wave:v2`,
    waitForEncounter: false,
  })
  await approachRestoredEncounter(
    page,
    conservatoryIds.fernCheckpoint,
    'The first gentle wave',
    { x: 0, z: 1 },
  )
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-completed', '1')

  await setVoice(page, 57, 0.1)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const panel = page.getByLabel('Voice challenge')
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 12_000,
  })
  await expect(
    page
      .getByRole('list', { name: 'Lesson steps' })
      .getByText('Settle your note'),
  ).toHaveAttribute('aria-current', 'step')
  await expect(panel).toHaveAttribute('data-step-index', '1', {
    timeout: 10_000,
  })
  await expect(
    page.getByRole('list', { name: 'Lesson steps' }).getByText(/Sway twice/),
  ).toHaveAttribute('aria-current', 'step')
  await expect(
    page.getByRole('heading', { name: /sway.*twice/i }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expectVoicePanelFits(page)
  await expectChallengeCameraFitsPanel(page, conservatoryIds.fern)
  await page.setViewportSize({ width: 320, height: 640 })
  await expectVoicePanelFits(page)
  await expectChallengeCameraFitsPanel(page, conservatoryIds.fern)
  await page.setViewportSize({ width: 640, height: 480 })

  for (const midi of [59, 57, 55, 57]) await glideVoice(page, midi, 0.35)
  await page.evaluate(() => window.glassVoiceFixture.setAmplitude(0))
  await holdForAudioSeconds(page, 0.075)
  await page.evaluate(() => window.glassVoiceFixture.setAmplitude(0.1))
  for (const midi of [59, 57, 55]) await glideVoice(page, midi, 0.35)
  await holdForAudioSeconds(page, 0.15)
  await expect(
    page.getByRole('progressbar', { name: 'Glass resonance' }),
  ).toHaveAttribute('aria-valuenow', '98', { timeout: 6000 })
  await expect(adventure).toHaveAttribute('data-completed', '1')

  await glideVoice(page, 57, 0.35)
  await expect(adventure).toHaveAttribute('data-completed', '2', {
    timeout: 12_000,
  })
  await expectMicrophoneOff(page)
  expect(
    (await savedProgress(page, conservatoryPrefix)).completedBreakableIds,
  ).toEqual([conservatoryIds.entrance, conservatoryIds.fern])
})

test('visible-window blur releases held movement and orbit without opening Pause', async ({
  page,
}) => {
  await openMuseum(page)
  await minimizeMuseumRaster(page)
  const before = await playerPosition(page)
  await page.keyboard.down('KeyW')
  await expectPlayerMovement(page, before, 0.05)

  const positionAtBlur = await blurAtPlayerPosition(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const movementReleased = await settledPlayerPosition(page)
  expectNormalBrakingDistance(positionAtBlur, movementReleased)
  await animationFrames(page, 6)
  expect((await playerPosition(page)).x).toBeCloseTo(movementReleased.x, 4)
  expect((await playerPosition(page)).z).toBeCloseTo(movementReleased.z, 4)
  await page.keyboard.up('KeyW')

  await page.mouse.move(320, 210)
  await page.mouse.down()
  await page.mouse.move(390, 220, { steps: 4 })
  const draggedYaw = await cameraYaw(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.move(460, 240, { steps: 4 })
  await animationFrames(page, 2)
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
    await minimizeMuseumRaster(page)
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
    await expectPlayerMovement(page, before, 0.03)
    await expect
      .poll(() =>
        knob.evaluate((element) => getComputedStyle(element).transform),
      )
      .not.toBe('matrix(1, 0, 0, 1, 0, 0)')

    const positionAtBlur = await blurAtPlayerPosition(page)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect
      .poll(() =>
        knob.evaluate((element) => getComputedStyle(element).transform),
      )
      .toBe('matrix(1, 0, 0, 1, 0, 0)')
    const released = await settledPlayerPosition(page)
    expectNormalBrakingDistance(positionAtBlur, released)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: centre.x + 28, y: centre.y - 12 }],
    })
    await animationFrames(page, 6)
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
    await expectPlayerMovement(page, beforeFreshContact, 0.03)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  })
})
