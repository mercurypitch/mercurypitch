// Merc narration acceptance — approved D2 playback stays separate from microphone capture.
import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    mercNarrationProbe: {
      starts: number
      active: Set<AudioBufferSourceNode>
    }
  }
}

test.use({
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

test('Merc speaks after a gesture, becomes quiet before capture, and respects his own mute @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}museum-audio:v1`,
      JSON.stringify({ muted: true }),
    )
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
    window.mercNarrationProbe = probe
    const originalStart = AudioBufferSourceNode.prototype.start
    const originalDisconnect = AudioBufferSourceNode.prototype.disconnect
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (!this.loop && (this.buffer?.duration ?? 0) > 0.8) {
        probe.starts++
        probe.active.add(this)
        this.addEventListener('ended', () => probe.active.delete(this), {
          once: true,
        })
      }
      originalStart.apply(this, args)
    }
    AudioBufferSourceNode.prototype.disconnect = function (...args: unknown[]) {
      Reflect.apply(originalDisconnect, this, args)
      if (args.length === 0) probe.active.delete(this)
    }
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext()
      await context.resume()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      gain.gain.value = 0
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
      return destination.stream
    }
  })
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  // Raster composition is verified separately. Retain the real loaded scene,
  // controls and audio graph without letting SwiftShader delay the short cue.
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2')
      if (!gl) throw new Error('The real scene must load')
      for (const method of [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ])
        Object.defineProperty(gl, method, {
          configurable: true,
          value: () => undefined,
        })
    })
  expect(await page.evaluate(() => window.mercNarrationProbe.starts)).toBe(0)
  await page
    .getByLabel('Glass museum; drag to look around')
    .click({ position: { x: 310, y: 140 } })
  await expect
    .poll(() => page.evaluate(() => window.mercNarrationProbe.starts))
    .toBe(1)
  expect(await page.evaluate(() => window.mercNarrationProbe.active.size)).toBe(
    1,
  )
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.mercNarrationProbe.active.size)).toBe(
    0,
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Pause game' }).click()
  const merc = page.getByRole('checkbox', { name: 'Merc voice', exact: true })
  await expect(merc).toBeChecked()
  await merc.uncheck()
  expect(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('beside-cue:glass-adventure:merc-narration:v1') ??
          'null',
      ),
    ),
  ).toEqual({ enabled: false })
  await page.getByRole('button', { name: 'Back to the museum' }).click()
  await page
    .getByLabel('Glass museum; drag to look around')
    .click({ position: { x: 310, y: 140 } })
  expect(await page.evaluate(() => window.mercNarrationProbe.starts)).toBe(1)
  expect(errors).toEqual([])
})
