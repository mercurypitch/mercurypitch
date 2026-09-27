// Frost Promenade hardware proof — real microphone pipeline, wall fracture and restored passage.

import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    frostProofGain?: GainNode
    frostProofTrack?: MediaStreamTrack
    frostProofTasks: { start: number; duration: number }[]
  }
}

test.use({
  headless: false,
  hasTouch: true,
  viewport: { width: 800, height: 1100 },
  launchOptions: {
    args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl'],
  },
})
test.skip(
  process.env.GLASS_FROST_RENDER_PROOF !== '1',
  'Opt in to real GPU proof with GLASS_FROST_RENDER_PROOF=1.',
)
test.setTimeout(120_000)

for (const course of [
  {
    layout: 'cloudway-laboratory',
    levelId: 'cloudway-crystal-promenade-first-slice',
    prefix: '',
  },
  {
    layout: 'cloudway-mechanics-preview',
    levelId: 'cloudway-crystal-promenade-mechanics-preview',
    prefix: 'preview-',
  },
] as const) {
  for (const mode of ['third-person', 'first-person'] as const) {
    test(`${course.layout} shatters and restores its wall in ${mode}`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      const completedIds = [
        `${course.prefix}voice-home`,
        `${course.prefix}voice-third`,
      ]
      const wallId = `${course.prefix}voice-fifth`
      const checkpointId = `${course.prefix}wall-save`
      const key = `beside-cue:glass-adventure:progress:${course.levelId}`
      await page.addInitScript(
        ({ key, progress, mode }) => {
          const prefix = 'beside-cue:glass-adventure:'
          localStorage.setItem(`${prefix}tutorial`, 'seen')
          localStorage.setItem(
            `${prefix}museum-audio:v1`,
            JSON.stringify({ muted: true }),
          )
          localStorage.setItem(`${prefix}comfortable-note`, '57')
          localStorage.setItem(`${prefix}camera-mode:v1`, mode)
          if (localStorage.getItem(key) === null)
            localStorage.setItem(key, JSON.stringify(progress))
          window.frostProofTasks = []
          new PerformanceObserver((entries) => {
            for (const entry of entries.getEntries())
              window.frostProofTasks.push({
                start: entry.startTime,
                duration: entry.duration,
              })
          }).observe({ type: 'longtask', buffered: true })
          navigator.mediaDevices.getUserMedia = async () => {
            const audio = new AudioContext()
            await audio.resume()
            const oscillator = audio.createOscillator()
            oscillator.frequency.value = 220
            const gain = audio.createGain()
            gain.gain.value = 0
            const destination = audio.createMediaStreamDestination()
            oscillator.connect(gain).connect(destination)
            oscillator.start()
            const track = destination.stream.getAudioTracks()[0]!
            const stop = track.stop.bind(track)
            track.stop = () => {
              stop()
              oscillator.stop()
              void audio.close()
            }
            window.frostProofGain = gain
            window.frostProofTrack = track
            return destination.stream
          }
        },
        {
          key,
          mode,
          progress: {
            version: 2,
            levelId: course.levelId,
            checkpointId,
            completedBreakableIds: completedIds,
            finished: false,
          },
        },
      )

      const start = Date.now()
      await page.goto(`/glass-game/?layout=${course.layout}`, {
        waitUntil: 'domcontentloaded',
      })
      const game = page.getByTestId('glass-adventure')
      await expect(game).toHaveAttribute('data-ready', 'true', {
        timeout: 90_000,
      })
      const readyMilliseconds = Date.now() - start
      await expect(game).toHaveAttribute('data-checkpoint', checkpointId)
      await expect(game).toHaveAttribute('data-completed', '2')
      await expect(game).toHaveAttribute('data-camera-mode', mode)
      const graphics = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[aria-label^="Glass museum"] canvas',
        )
        const context = canvas?.getContext('webgl2')
        const debug = context?.getExtension('WEBGL_debug_renderer_info')
        return context && debug
          ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : null
      })
      expect(graphics).not.toBeNull()
      expect(graphics).not.toMatch(/SwiftShader|llvmpipe/i)
      const skip = page.getByRole('button', { name: 'Skip tutorial' })
      if (await skip.isVisible()) await skip.click()
      const sing = page.getByRole('button', { name: 'Sing to the glass' })
      await expect(sing).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('wall-before.png') })
      const clickAt = await page.evaluate(() => performance.now())
      await sing.click()
      const panel = page.getByLabel('Voice challenge', { exact: true })
      await expect(panel).toHaveAttribute(
        'data-voice-mode',
        /reference|singing/,
        { timeout: 10_000 },
      )
      const entryMilliseconds = await page.evaluate(
        (at) => performance.now() - at,
        clickAt,
      )
      await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
        timeout: 15_000,
      })
      await expect
        .poll(
          async () =>
            JSON.parse((await game.getAttribute('data-challenge-camera'))!)
              .settled,
        )
        .toBe(true)
      const cameraMetrics = JSON.parse(
        (await game.getAttribute('data-challenge-camera'))!,
      )
      expect(cameraMetrics.occluded).toBe(false)
      expect(cameraMetrics.targetFrame.minY).toBeGreaterThanOrEqual(
        cameraMetrics.safeBottomNdc - 0.001,
      )
      expect(cameraMetrics.targetFrame.maxY).toBeLessThan(0.95)
      await page.screenshot({ path: testInfo.outputPath('wall-challenge.png') })
      await page.evaluate(() => {
        const gain = window.frostProofGain!
        gain.gain.setValueAtTime(0.1, gain.context.currentTime)
      })
      await expect(game).toHaveAttribute('data-completed', '3', {
        timeout: 15_000,
      })
      await page.waitForTimeout(250)
      await expect(game).toHaveAttribute('data-ready', 'true')
      await expect(game).toHaveAttribute('data-completed', '3')
      await page.screenshot({
        path: testInfo.outputPath('wall-shattering.png'),
      })
      await page.waitForTimeout(2400)
      await page.screenshot({ path: testInfo.outputPath('wall-open.png') })
      const longTasks = await page.evaluate(
        (at) => window.frostProofTasks.filter((task) => task.start >= at),
        clickAt,
      )
      const saved = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        key,
      )
      expect(saved.completedBreakableIds).toContain(wallId)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(game).toHaveAttribute('data-ready', 'true', {
        timeout: 45_000,
      })
      await expect(game).toHaveAttribute('data-completed', '3')
      await expect(game).toHaveAttribute(
        'data-challenge-camera-mode',
        'exploration',
      )
      await page.screenshot({ path: testInfo.outputPath('wall-restored.png') })
      expect(errors).toEqual([])
      writeFileSync(
        testInfo.outputPath('hardware-receipt.json'),
        `${JSON.stringify({ graphics, course, mode, readyMilliseconds, entryMilliseconds, cameraMetrics, longTasks, errors }, null, 2)}\n`,
      )
    })
  }
}

for (const view of [
  {
    name: 'frost bend',
    checkpointId: 'final-save',
    completed: ['voice-home', 'voice-third'],
  },
  {
    name: 'Aurora return view',
    checkpointId: 'finale-save',
    completed: ['voice-home', 'voice-third', 'voice-fifth'],
  },
] as const) {
  test(`shows the ${view.name} from safe footing`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.addInitScript(({ checkpointId, completed }) => {
      const prefix = 'beside-cue:glass-adventure:'
      const levelId = 'cloudway-crystal-promenade-first-slice'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
      localStorage.setItem(
        `${prefix}progress:${levelId}`,
        JSON.stringify({
          version: 2,
          levelId,
          checkpointId,
          completedBreakableIds: completed,
          finished: false,
        }),
      )
    }, view)
    await page.goto('/glass-game/?layout=cloudway-laboratory', {
      waitUntil: 'domcontentloaded',
    })
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 90_000,
    })
    await expect(game).toHaveAttribute('data-checkpoint', view.checkpointId)
    if (view.checkpointId === 'finale-save') {
      await page.mouse.move(660, 470)
      await page.mouse.down()
      await page.mouse.move(150, 470, { steps: 24 })
      await page.mouse.up()
    }
    await page.waitForTimeout(700)
    await page.screenshot({
      path: testInfo.outputPath('platform-gameplay.png'),
    })
    expect(errors).toEqual([])
  })
}
