// Runtime fracture proof helpers — drive the shipped game with real Web Audio input and freeze a real WebGL shard frame.

import { expect } from '@playwright/test'

export const ADVENTURE_STORAGE_PREFIX = 'beside-cue:glass-adventure'

export async function installRuntimeProofFixture(page, setup) {
  await page.addInitScript(
    ({ prefix, setup }) => {
      localStorage.setItem(`${prefix}:tutorial`, 'seen')
      localStorage.setItem(`${prefix}:${setup.tutorialPreference}`, 'seen')
      localStorage.setItem(
        `${prefix}:museum-audio:v1`,
        JSON.stringify({ muted: true, music: 0, ambience: 0 }),
      )
      if (setup.comfortableNote !== undefined)
        localStorage.setItem(
          `${prefix}:comfortable-note`,
          String(setup.comfortableNote),
        )
      if (setup.comfortablePair !== undefined)
        localStorage.setItem(
          `${prefix}:comfortable-pair`,
          JSON.stringify(setup.comfortablePair),
        )
      localStorage.setItem(
        `${prefix}:progress:${setup.levelId}`,
        JSON.stringify({
          version: 2,
          levelId: setup.levelId,
          checkpointId: setup.checkpointId,
          completedBreakableIds: setup.completedBreakableIds,
          finished: false,
          rewards: {
            version: 1,
            discoveredEncounterIds: [],
            collectedCoinIds: [],
            qualityResults: [],
            collectedPortraitIds: [],
          },
        }),
      )

      const nativeRequestAnimationFrame =
        window.requestAnimationFrame.bind(window)
      const drawMethodNames = [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ]
      const drawMethodDescriptors = new Map(
        drawMethodNames.map((name) => [
          name,
          Object.getOwnPropertyDescriptor(
            WebGL2RenderingContext.prototype,
            name,
          ),
        ]),
      )
      let drawSuppressed = false
      const suppressDraws = () => {
        if (drawSuppressed) return
        for (const name of drawMethodNames)
          Object.defineProperty(WebGL2RenderingContext.prototype, name, {
            configurable: true,
            value: () => undefined,
          })
        drawSuppressed = true
      }
      const restoreDraws = () => {
        if (!drawSuppressed) return
        for (const [name, descriptor] of drawMethodDescriptors) {
          if (descriptor === undefined)
            delete WebGL2RenderingContext.prototype[name]
          else
            Object.defineProperty(
              WebGL2RenderingContext.prototype,
              name,
              descriptor,
            )
        }
        drawSuppressed = false
      }
      let armedAt = null
      let frozenAt = null
      let staticPausedAt = null
      let animationCallbacks = 0
      let completedAnimationCallbacks = 0
      let lastAnimationTimestamp = null
      let blocked = false
      let blockReason = null
      let pauseAfterNextFrame = false
      let pendingCallbacks = []
      let rasterSize = null
      let rasterMinimized = false

      const canvas = () =>
        document.querySelector('canvas[aria-label="Floating glass museum"]')
      const rememberRasterSize = () => {
        const element = canvas()
        if (element === null) throw new Error('Museum canvas is unavailable.')
        rasterSize ??= { width: element.width, height: element.height }
        return element
      }
      const minimizeRaster = () => {
        const element = rememberRasterSize()
        element.width = 1
        element.height = 1
        rasterMinimized = true
        suppressDraws()
      }
      const restoreRaster = () => {
        const element = rememberRasterSize()
        element.width = rasterSize.width
        element.height = rasterSize.height
        rasterMinimized = false
      }
      window.requestAnimationFrame = (callback) => {
        if (blocked) {
          pendingCallbacks.push(callback)
          return 0
        }
        return nativeRequestAnimationFrame((timestamp) => {
          if (blocked) {
            pendingCallbacks.push(callback)
            return
          }
          animationCallbacks++
          lastAnimationTimestamp = timestamp
          const fractureFrame =
            armedAt !== null &&
            frozenAt === null &&
            timestamp >= armedAt + setup.freezeDelayMs
          const staticFrame = pauseAfterNextFrame
          if (fractureFrame) {
            restoreDraws()
            restoreRaster()
          }
          if (fractureFrame || staticFrame) {
            blocked = true
            blockReason = fractureFrame ? 'fracture' : 'static'
            pauseAfterNextFrame = false
          }
          callback(timestamp)
          completedAnimationCallbacks++
          if (fractureFrame) frozenAt = performance.now()
          if (staticFrame) staticPausedAt = performance.now()
        })
      }

      const armFreeze = () => {
        if (armedAt !== null) return
        const adventure = document.querySelector(
          '[data-testid="glass-adventure"]',
        )
        if (
          adventure === null ||
          Number(adventure.getAttribute('data-completed')) <
            setup.freezeAtCompleted
        )
          return
        armedAt = performance.now()
      }
      const completionObserver = new MutationObserver(armFreeze)
      const observeCompletion = () => {
        if (document.documentElement === null) return
        completionObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-completed'],
          childList: true,
          subtree: true,
        })
        armFreeze()
      }
      if (document.documentElement === null)
        document.addEventListener('DOMContentLoaded', observeCompletion, {
          once: true,
        })
      else observeCompletion()

      let amplitude = 0
      let midi = 57
      const sources = []
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      )
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!constraints?.audio) return originalGetUserMedia(constraints)
        const context = new AudioContext()
        await context.resume()
        const oscillator = context.createOscillator()
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
        const gain = context.createGain()
        gain.gain.value = amplitude
        const destination = context.createMediaStreamDestination()
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        const track = destination.stream.getAudioTracks()[0]
        const nativeStop = track.stop.bind(track)
        track.stop = () => {
          if (track.readyState === 'ended') return
          nativeStop()
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
          void context.close()
        }
        sources.push({ context, gain, oscillator, track })
        return destination.stream
      }

      window.glassProofFixture = {
        sources,
        get freeze() {
          return {
            armedAt,
            freezeAt: armedAt === null ? null : armedAt + setup.freezeDelayMs,
            frozenAt,
            frozen: frozenAt !== null,
            animationCallbacks,
            completedAnimationCallbacks,
            lastAnimationTimestamp,
            now: performance.now(),
            blockReason,
            rasterMinimized,
            rasterSize,
            drawSuppressed,
          }
        },
        get raster() {
          return {
            minimized: rasterMinimized,
            size: rasterSize,
            staticPausedAt,
            blocked,
            blockReason,
            animationCallbacks,
            completedAnimationCallbacks,
            drawSuppressed,
          }
        },
        minimizeRaster,
        restoreAndPauseAfterNextFrame() {
          staticPausedAt = null
          pauseAfterNextFrame = true
          restoreDraws()
          restoreRaster()
        },
        resumeWithMinimizedRaster() {
          minimizeRaster()
          blocked = false
          blockReason = null
          staticPausedAt = null
          const callbacks = pendingCallbacks
          pendingCallbacks = []
          for (const callback of callbacks)
            window.requestAnimationFrame(callback)
        },
        setVoice(nextMidi, nextAmplitude) {
          if (!Number.isFinite(nextMidi) || !Number.isFinite(nextAmplitude))
            throw new Error('Voice fixture values must be finite.')
          midi = nextMidi
          amplitude = nextAmplitude
          const frequency = 440 * 2 ** ((nextMidi - 69) / 12)
          for (const source of sources) {
            if (source.track.readyState !== 'live') continue
            source.oscillator.frequency.setValueAtTime(
              frequency,
              source.context.currentTime,
            )
            source.gain.gain.setValueAtTime(
              nextAmplitude,
              source.context.currentTime,
            )
          }
        },
        glideMidi(nextMidi, durationSeconds) {
          if (!Number.isFinite(nextMidi) || !Number.isFinite(durationSeconds))
            throw new Error('Voice glide values must be finite.')
          midi = nextMidi
          const frequency = 440 * 2 ** ((nextMidi - 69) / 12)
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
        setAmplitude(nextAmplitude) {
          if (!Number.isFinite(nextAmplitude))
            throw new Error('Voice amplitude must be finite.')
          amplitude = nextAmplitude
          for (const source of sources)
            if (source.track.readyState === 'live')
              source.gain.gain.setValueAtTime(
                nextAmplitude,
                source.context.currentTime,
              )
        },
        async dispose() {
          completionObserver.disconnect()
          restoreDraws()
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
    {
      prefix: ADVENTURE_STORAGE_PREFIX,
      setup: {
        freezeDelayMs: 475,
        ...setup,
      },
    },
  )
}

export async function minimizeProofRaster(page) {
  await page.evaluate(() => window.glassProofFixture.minimizeRaster())
  await expect
    .poll(
      () => page.evaluate(() => window.glassProofFixture.raster.minimized),
      { timeout: 5000, intervals: [25] },
    )
    .toBe(true)
}

export async function restoreAndPauseProofFrame(page) {
  await page.evaluate(() =>
    window.glassProofFixture.restoreAndPauseAfterNextFrame(),
  )
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.glassProofFixture.raster.staticPausedAt !== null,
        ),
      { timeout: 90_000, intervals: [100] },
    )
    .toBe(true)
  return page.evaluate(() => window.glassProofFixture.raster)
}

export async function resumeWithMinimizedProofRaster(page) {
  await page.evaluate(() =>
    window.glassProofFixture.resumeWithMinimizedRaster(),
  )
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raster = window.glassProofFixture.raster
          return raster.minimized && !raster.blocked
        }),
      { timeout: 5000, intervals: [25] },
    )
    .toBe(true)
}

export async function approachEncounter(
  page,
  { checkpointId, label, direction, travelDistance = 2.1 },
) {
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-checkpoint', checkpointId)
  await page.getByRole('button', { name: 'Recenter camera' }).click()
  const length = Math.hypot(direction.x, direction.z)
  const unit = { x: direction.x / length, z: direction.z / length }
  await expect
    .poll(
      async () => {
        const yaw = Number(await adventure.getAttribute('data-camera-yaw'))
        return -Math.sin(yaw) * unit.x - Math.cos(yaw) * unit.z
      },
      { timeout: 20_000, intervals: [50] },
    )
    .toBeGreaterThan(0.99)
  const before = await playerPosition(page)
  const offer = page.getByRole('button', { name: 'Sing to the glass' })
  await page.keyboard.down('KeyW')
  try {
    const deadline = Date.now() + 10_000
    let current = before
    while (Date.now() < deadline) {
      // Real keyboards repeat keydown while held. Reasserting the same public
      // input keeps the proof moving if a headless focus transition released
      // the first contact while the software renderer was compiling shaders.
      await page.keyboard.down('KeyW')
      current = await playerPosition(page)
      const projectedDistance =
        (current.x - before.x) * unit.x + (current.z - before.z) * unit.z
      if (
        projectedDistance > travelDistance ||
        (await offer.isVisible().catch(() => false))
      )
        break
      await page.waitForTimeout(50)
    }
    const projectedDistance =
      (current.x - before.x) * unit.x + (current.z - before.z) * unit.z
    if (
      projectedDistance <= travelDistance &&
      !(await offer.isVisible().catch(() => false))
    )
      throw new Error(
        `Could not approach ${label}: ${JSON.stringify({
          before,
          current,
          projectedDistance,
          cameraYaw: Number(await adventure.getAttribute('data-camera-yaw')),
          travelYaw: await adventure.getAttribute('data-travel-yaw'),
          challengeCamera: await adventure.getAttribute(
            'data-challenge-camera-mode',
          ),
          freeze: await page.evaluate(() => window.glassProofFixture.freeze),
        })}`,
      )
  } finally {
    await page.keyboard.up('KeyW')
  }
  await expect(page.getByText(label, { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await expect(offer).toBeVisible()
}

export async function setVoice(page, midi, amplitude) {
  await page.evaluate(
    ({ midi, amplitude }) => window.glassProofFixture.setVoice(midi, amplitude),
    { midi, amplitude },
  )
}

export async function glideVoice(page, midi, durationSeconds) {
  await page.evaluate(
    ({ midi, durationSeconds }) =>
      window.glassProofFixture.glideMidi(midi, durationSeconds),
    { midi, durationSeconds },
  )
  await waitForAudioSeconds(page, durationSeconds)
}

export async function waitForAudioSeconds(page, seconds) {
  const startedAt = await page.evaluate(
    () => window.glassProofFixture.sources.at(-1)?.context.currentTime ?? 0,
  )
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.glassProofFixture.sources.at(-1)?.context.currentTime ?? 0,
        ),
      { timeout: Math.max(6000, seconds * 5000), intervals: [25] },
    )
    .toBeGreaterThan(startedAt + seconds)
}

export async function waitForFrozenShardFrame(page) {
  await expect
    .poll(() => page.evaluate(() => window.glassProofFixture.freeze.frozen), {
      timeout: 90_000,
      intervals: [50],
    })
    .toBe(true)
  return page.evaluate(() => window.glassProofFixture.freeze)
}

export async function rendererInfo(page) {
  return page.getByLabel('Floating glass museum').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2')
    if (gl === null) throw new Error('WebGL2 renderer is unavailable.')
    gl.finish()
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : 'unavailable',
      width: canvas.width,
      height: canvas.height,
    }
  })
}

export async function captureCanvas(page, path, marker) {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const canvas = page.getByLabel('Floating glass museum')
  await canvas.evaluate((element) => {
    const gl = element.getContext('webgl2')
    if (gl === null) throw new Error('WebGL2 renderer is unavailable.')
    gl.finish()
  })
  const bounds = await canvas.boundingBox()
  if (bounds === null) throw new Error('Museum canvas has no bounds.')
  await viewport.evaluate((element, marker) => {
    const adventure = element.parentElement
    if (adventure === null)
      throw new Error('Museum viewport has no adventure host.')
    for (const sibling of adventure.children)
      if (sibling !== element) sibling.setAttribute(marker, 'true')
    const style = document.createElement('style')
    style.id = marker
    style.textContent = `[${marker}="true"] { visibility: hidden !important; }`
    document.head.append(style)
  }, marker)
  try {
    await page.screenshot({
      path,
      clip: bounds,
      animations: 'disabled',
      timeout: 90_000,
    })
  } finally {
    await viewport.evaluate((element, marker) => {
      const adventure = element.parentElement
      for (const sibling of adventure?.children ?? [])
        sibling.removeAttribute(marker)
      document.getElementById(marker)?.remove()
    }, marker)
  }
}

export async function zoomTowardEncounter(page, steps = 2) {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Museum viewport has no bounds.')
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )
  for (let step = 0; step < steps; step++) await page.mouse.wheel(0, -420)
  await page.waitForTimeout(500)
}

export async function disposeProofFixture(page) {
  await page.evaluate(() => window.glassProofFixture?.dispose())
}

async function playerPosition(page) {
  const adventure = page.getByTestId('glass-adventure')
  return {
    x: Number(await adventure.getAttribute('data-player-x')),
    z: Number(await adventure.getAttribute('data-player-z')),
  }
}
