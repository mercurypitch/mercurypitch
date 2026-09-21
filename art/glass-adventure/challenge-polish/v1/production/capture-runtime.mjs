// Capture actual compiled singing scenes, their instruction budgets and camera return.
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const source = new URL(
  process.env.CHALLENGE_PROOF_URL ??
    'https://127.0.0.1:5298/glass-game/?campaign=1',
)
if (!['127.0.0.1', 'localhost'].includes(source.hostname))
  throw new Error('Proofs must use a local compiled preview.')
const prefix = 'glassworks-resonance-conservatory/resonance-conservatory'
const specifications = [
  {
    id: 'desktop-goblet',
    width: 1440,
    height: 900,
    title: 'First Light Gallery',
    levelId: 'glassworks-chamber/chamber',
    checkpointId: 'glassworks-chamber/chamber/chamber/checkpoint/arrival',
    completed: [],
  },
  {
    id: 'tablet-fern',
    width: 1024,
    height: 768,
    touch: true,
    title: 'Resonance Conservatory',
    levelId: prefix,
    checkpointId: `${prefix}/fern-house/checkpoint/entry`,
    completed: [`${prefix}/foyer/encounter/entrance-goblet`],
  },
  {
    id: 'phone-portrait',
    width: 390,
    height: 844,
    touch: true,
    title: 'Resonance Conservatory',
    levelId: prefix,
    checkpointId: `${prefix}/wave-salon/checkpoint/entry`,
    completed: [
      `${prefix}/foyer/encounter/entrance-goblet`,
      `${prefix}/fern-house/encounter/fern-wave`,
      `${prefix}/orchid-house/encounter/orchid-wave`,
    ],
  },
  {
    id: 'narrow-phone-portrait',
    width: 320,
    height: 640,
    touch: true,
    title: 'Resonance Conservatory',
    levelId: prefix,
    checkpointId: `${prefix}/wave-salon/checkpoint/entry`,
    completed: [
      `${prefix}/foyer/encounter/entrance-goblet`,
      `${prefix}/fern-house/encounter/fern-wave`,
      `${prefix}/orchid-house/encounter/orchid-wave`,
    ],
  },
]
const selection = process.env.CHALLENGE_PROOF_CASE ?? 'all'
const shatterProof = process.env.CHALLENGE_PROOF_SHATTER === '1'
const traversalRasterEvidence =
  'During the approach only, the harness replaced WebGL2 clear, drawArrays, drawArraysInstanced, drawElements and drawElementsInstanced with no-ops, then restored each original property descriptor before the viewport resize, camera assertions and full-raster screenshots.'
if (
  selection !== 'all' &&
  !specifications.some((item) => item.id === selection)
)
  throw new Error(`Unknown proof case: ${selection}`)
if (shatterProof && selection !== 'desktop-goblet')
  throw new Error(
    'CHALLENGE_PROOF_SHATTER=1 requires CHALLENGE_PROOF_CASE=desktop-goblet.',
  )
const output = new URL(
  process.env.CHALLENGE_PROOF_OUTPUT_URL ??
    new URL('../proofs/runtime/', import.meta.url),
)
if (output.protocol !== 'file:' || !output.href.endsWith('/'))
  throw new Error('Proof output must be a directory file URL ending in /.')
await mkdir(output, { recursive: true })
const proofs = []
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
try {
  for (const specification of specifications.filter(
    (item) => selection === 'all' || item.id === selection,
  )) {
    console.log(`Starting ${specification.id}`)
    const context = await browser.newContext({
      // Traverse at a modest raster size, then restore the requested full size
      // before any camera or visual evidence. Software WebGL is not a timing test.
      viewport: { width: 640, height: 480 },
      hasTouch: specification.touch === true,
      ignoreHTTPSErrors: true,
      // The tablet proof verifies final composition. Normal transition timing
      // is covered by the browser camera smokes and need not spend minutes in
      // a software-rendered appearance capture.
      reducedMotion:
        specification.id === 'tablet-fern' ? 'reduce' : 'no-preference',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((spec) => {
      const storage = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${storage}tutorial`, 'seen')
      localStorage.setItem(
        `${storage}tutorial:${spec.levelId}:settle-and-wave:v2`,
        'seen',
      )
      localStorage.setItem(`${storage}comfortable-note`, '57')
      localStorage.setItem(
        `${storage}progress:${spec.levelId}`,
        JSON.stringify({
          version: 1,
          levelId: spec.levelId,
          checkpointId: spec.checkpointId,
          completedBreakableIds: spec.completed,
        }),
      )
      // Silent PCM creates the real mic graph without completing the challenge.
      // Progress above is a legitimate earlier checkpoint, never this target.
      navigator.mediaDevices.getUserMedia = async () => {
        const audio = new AudioContext()
        await audio.resume()
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        gain.gain.value = 0
        oscillator.frequency.value = 220
        const destination = audio.createMediaStreamDestination()
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        window.challengeProofVoice = {
          setAmplitude: (amplitude) => {
            gain.gain.setValueAtTime(amplitude, audio.currentTime)
          },
        }
        const track = destination.stream.getAudioTracks()[0]
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          void audio.close()
        }
        return destination.stream
      }
    }, specification)
    const frames = (count) =>
      page.evaluate(
        (remaining) =>
          new Promise((resolve) => {
            const frame = () =>
              --remaining <= 0 ? resolve() : requestAnimationFrame(frame)
            requestAnimationFrame(frame)
          }),
        count,
      )
    const attributes = () =>
      page.getByTestId('glass-adventure').evaluate((element) => ({
        ...element.dataset,
      }))
    const waitForChallengeCameraSettled = (panelLocator) =>
      expect
        .poll(
          async () => {
            const camera = JSON.parse(
              (await attributes()).challengeCamera ?? 'null',
            )
            const bounds = await panelLocator.boundingBox()
            const measuredSafeBottom =
              bounds === null
                ? null
                : Math.min(
                    0.62,
                    Math.max(
                      0,
                      (specification.height - bounds.y + 16) /
                        specification.height,
                    ),
                  )
            return (
              camera?.mode === 'holding' &&
              camera?.settled === true &&
              measuredSafeBottom !== null &&
              Math.abs(camera.safeBottomFraction - measuredSafeBottom) < 0.005
            )
          },
          { timeout: 90_000, intervals: [100] },
        )
        .toBe(true)
    const suspendTraversalRaster = () =>
      page.evaluate(() => {
        const methods = [
          'clear',
          'drawArrays',
          'drawArraysInstanced',
          'drawElements',
          'drawElementsInstanced',
        ]
        const originals = methods.map((name) => {
          let owner = WebGL2RenderingContext.prototype
          while (
            owner !== null &&
            !Object.prototype.hasOwnProperty.call(owner, name)
          )
            owner = Object.getPrototypeOf(owner)
          const descriptor =
            owner === null
              ? undefined
              : Object.getOwnPropertyDescriptor(owner, name)
          if (owner === null || descriptor?.value === undefined)
            throw new Error(`Cannot suspend WebGL2 ${name}.`)
          Object.defineProperty(owner, name, {
            ...descriptor,
            value: () => undefined,
          })
          return { descriptor, name, owner }
        })
        window.challengeProofRestoreRaster = () => {
          for (const { descriptor, name, owner } of originals)
            Object.defineProperty(owner, name, descriptor)
          delete window.challengeProofRestoreRaster
        }
      })
    const restoreTraversalRaster = () =>
      page.evaluate(() => {
        if (typeof window.challengeProofRestoreRaster !== 'function')
          throw new Error('Traversal raster restore callback is missing.')
        window.challengeProofRestoreRaster()
      })
    const installControlledPresentationClock = async () => {
      await page.evaluate(() => {
        const name = 'requestAnimationFrame'
        let owner = window
        while (
          owner !== null &&
          !Object.prototype.hasOwnProperty.call(owner, name)
        )
          owner = Object.getPrototypeOf(owner)
        const descriptor =
          owner === null
            ? undefined
            : Object.getOwnPropertyDescriptor(owner, name)
        if (owner === null || descriptor?.value === undefined)
          throw new Error('Cannot control the presentation animation clock.')
        const nativeRequestAnimationFrame = descriptor.value.bind(window)
        let virtualNow = null
        Object.defineProperty(owner, name, {
          ...descriptor,
          value: (callback) =>
            nativeRequestAnimationFrame((timestamp) => {
              virtualNow ??= timestamp
              callback(virtualNow)
            }),
        })
        window.challengeProofAdvanceAnimationClock = (seconds) => {
          if (virtualNow === null)
            throw new Error('Controlled presentation clock is not primed.')
          virtualNow += seconds * 1000
        }
        window.challengeProofRestoreAnimationClock = () => {
          Object.defineProperty(owner, name, descriptor)
          delete window.challengeProofAdvanceAnimationClock
          delete window.challengeProofRestoreAnimationClock
        }
      })
      // The already queued app frame schedules its successor through the
      // controlled clock before actual PCM is allowed to complete the judge.
      await frames(1)
    }
    const advanceControlledPresentationClock = (seconds) =>
      page.evaluate((amount) => {
        if (typeof window.challengeProofAdvanceAnimationClock !== 'function')
          throw new Error('Controlled presentation clock is missing.')
        window.challengeProofAdvanceAnimationClock(amount)
      }, seconds)
    const restoreControlledPresentationClock = () =>
      page.evaluate(() => {
        if (typeof window.challengeProofRestoreAnimationClock !== 'function')
          throw new Error('Controlled presentation clock restore is missing.')
        window.challengeProofRestoreAnimationClock()
      })
    const shot = async (suffix) => {
      const filename = `${specification.id}-${suffix}.png`
      await page.screenshot({
        path: new URL(filename, output).pathname,
        timeout: shatterProof ? 150_000 : 90_000,
      })
      return filename
    }
    try {
      await page.goto(source.href)
      await page
        .getByRole('navigation', { name: 'Select a museum island' })
        .getByRole('button', {
          name: `Select ${specification.title} on the museum map`,
        })
        .click()
      await page
        .getByRole('button', {
          name: `Open selected gallery: ${specification.title}`,
        })
        .click()
      const game = page.getByTestId('glass-adventure')
      await expect(game).toHaveAttribute('data-ready', 'true', {
        timeout: 90_000,
      })
      console.log(`${specification.id}: gallery ready`)
      const skip = page.getByRole('button', { name: /skip/i })
      if (await skip.isVisible()) await skip.click()
      await expect(game).toHaveAttribute(
        'data-checkpoint',
        specification.checkpointId,
      )
      // Assets and the environment are now initialized. Harness-only traversal
      // suppression keeps actual input/physics while omitting expensive
      // reflection/transmission draws during the approach. Every original
      // descriptor is restored before any full-raster visual evidence.
      await suspendTraversalRaster()
      await page
        .locator('canvas[aria-label="Floating glass museum"]')
        .evaluate((canvas) => {
          canvas.width = 1
          canvas.height = 1
        })
      await page.getByRole('button', { name: 'Recenter camera' }).click()
      await frames(3)
      const sing = page.getByRole('button', { name: 'Sing to the glass' })
      if (!(await sing.isVisible())) {
        await page.keyboard.down('KeyW')
        try {
          await expect(sing).toBeVisible({ timeout: 60_000 })
        } finally {
          await page.keyboard.up('KeyW')
        }
      }
      await restoreTraversalRaster()
      await page.setViewportSize({
        width: specification.width,
        height: specification.height,
      })
      await frames(8)
      const before = await attributes()
      if (specification.touch) await sing.tap()
      else await page.keyboard.press('KeyF')
      const panel = page.getByLabel('Voice challenge', { exact: true })
      await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
        timeout: 20_000,
      })
      await expect(game).toHaveAttribute(
        'data-challenge-camera-mode',
        'holding',
        { timeout: 90_000 },
      )
      await waitForChallengeCameraSettled(panel)
      if (specification.levelId === prefix) {
        // Reach the longer wave-step instruction through actual PCM/YIN. A
        // steady note cannot finish the wave or award this target's completion.
        await page.evaluate(() => window.challengeProofVoice.setAmplitude(0.1))
        await expect(panel).toHaveAttribute('data-step-index', '1', {
          timeout: 20_000,
        })
        await page.evaluate(() => window.challengeProofVoice.setAmplitude(0))
        await waitForChallengeCameraSettled(panel)
      }
      const singing = await attributes()
      const panelBounds = await panel.boundingBox()
      const camera = JSON.parse(singing.challengeCamera)
      const singingFile = await shot('singing')
      console.log(`${specification.id}: singing captured`)
      expect(panelBounds).not.toBeNull()
      expect(camera.combinedFrame.minX).toBeGreaterThanOrEqual(-0.9)
      expect(camera.combinedFrame.maxX).toBeLessThanOrEqual(0.9)
      expect(camera.combinedFrame.minY).toBeGreaterThan(
        1 - (2 * panelBounds.y) / specification.height,
      )
      expect(camera.combinedFrame.maxY).toBeLessThanOrEqual(0.88)
      let help
      let helpPanelBounds
      let helpFile
      if (specification.id === 'narrow-phone-portrait') {
        const showInstructions = panel.getByRole('button', {
          name: 'Show singing instructions',
          exact: true,
        })
        await showInstructions.tap()
        const hideInstructions = panel.getByRole('button', {
          name: 'Hide singing instructions',
          exact: true,
        })
        await expect(hideInstructions).toHaveAttribute('aria-expanded', 'true')
        await waitForChallengeCameraSettled(panel)
        help = await attributes()
        helpPanelBounds = await panel.boundingBox()
        const helpCamera = JSON.parse(help.challengeCamera)
        expect(helpPanelBounds).not.toBeNull()
        expect(helpCamera.combinedFrame.minX).toBeGreaterThanOrEqual(-0.9)
        expect(helpCamera.combinedFrame.maxX).toBeLessThanOrEqual(0.9)
        expect(helpCamera.combinedFrame.minY).toBeGreaterThan(
          1 - (2 * helpPanelBounds.y) / specification.height,
        )
        expect(helpCamera.combinedFrame.maxY).toBeLessThanOrEqual(0.88)
        helpFile = await shot('help')
        console.log(`${specification.id}: expanded help captured`)
        await hideInstructions.tap()
        await expect(showInstructions).toHaveAttribute('aria-expanded', 'false')
        await waitForChallengeCameraSettled(panel)
      }
      let action
      let shattering
      let shatteringFile
      if (shatterProof) {
        const completedBefore = Number(singing.completed)
        await installControlledPresentationClock()
        await page.evaluate(() => window.challengeProofVoice.setAmplitude(0.1))
        await expect(game).toHaveAttribute(
          'data-completed',
          String(completedBefore + 1),
          { timeout: 20_000 },
        )
        await expect(game).toHaveAttribute(
          'data-challenge-camera-mode',
          'holding',
        )
        const holdingAfterCompletion = await attributes()
        await expect(panel).toBeHidden()
        // Advance once past the shared anticipation beat, then hold this
        // presentation timestamp while SwiftShader produces the full raster.
        // Completion above remains the real PCM/judge path.
        await advanceControlledPresentationClock(0.2)
        await frames(2)
        shattering = await attributes()
        expect(shattering.challengeCameraMode).toBe('holding')
        shatteringFile = await shot('shattering')
        console.log(`${specification.id}: shatter captured`)
        await restoreControlledPresentationClock()
        action = {
          kind: 'actual-pcm-shatter',
          amplitude: 0.1,
          completedBefore,
          completedAfter: Number(shattering.completed),
          cameraModeAtCompletion: holdingAfterCompletion.challengeCameraMode,
          cameraModeAtCapture: shattering.challengeCameraMode,
          controlledPresentationSecondsAtCapture: 0.2,
          animationClockRestoredBeforeReturn: true,
        }
      } else {
        await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(panel).toBeHidden()
      }
      await expect(game).toHaveAttribute(
        'data-challenge-camera-mode',
        'exploration',
        { timeout: 90_000 },
      )
      const returned = await attributes()
      const returnFile = await shot('returned')
      console.log(`${specification.id}: return captured`)
      expect(errors).toEqual([])
      const files = [singingFile]
      if (helpFile !== undefined) files.push(helpFile)
      if (shatteringFile !== undefined) files.push(shatteringFile)
      files.push(returnFile)
      proofs.push({
        case: specification.id,
        evidence: shatterProof
          ? `Compiled campaign host with real keyboard entry and actual PCM completion. The completion increment was observed while the cinematic camera remained holding. After real completion, the harness advanced the requestAnimationFrame presentation timestamp by 0.2 seconds and held it for the full-raster shard screenshot, then restored the native requestAnimationFrame descriptor before observing the natural return to exploration. This is deterministic appearance evidence, not real-time timing or video evidence. ${traversalRasterEvidence} Software rendering, not physical-device performance.`
          : `Compiled campaign host, real keyboard entry on desktop and real tap on touch contexts. Saved earlier checkpoint only; PCM settles the wave first step but never completes this target. ${traversalRasterEvidence} Software rendering, not physical-device performance.`,
        ...(specification.id === 'tablet-fern'
          ? {
              captureMotion:
                'reduce (appearance-only compiled proof; normal-motion entry, reframe and return are covered by the separate @smoke camera Playwright E2E)',
            }
          : {}),
        viewport: { width: specification.width, height: specification.height },
        before,
        singing,
        ...(help === undefined ? {} : { help, helpPanelBounds }),
        ...(action === undefined ? {} : { action, shattering }),
        returned,
        panelBounds,
        files,
        errors,
      })
    } catch (error) {
      proofs.push({
        case: specification.id,
        failure: String(error),
        errors,
        state: await attributes().catch(() => null),
      })
      throw error
    } finally {
      await page
        .evaluate(() => window.challengeProofRestoreAnimationClock?.())
        .catch(() => undefined)
      await writeFile(
        new URL(`manifest-${selection}.json`, output),
        `${JSON.stringify({ capturedAt: new Date().toISOString(), url: source.href, proofs }, null, 2)}\n`,
      )
      await context.close()
    }
  }
} finally {
  await browser.close()
}
