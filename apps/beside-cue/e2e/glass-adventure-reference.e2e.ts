// Sustained references — real target audio, quiet scoring boundary and saved pointer tuning.
import { writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { openCameraPreview, openGameSettings, } from './helpers/glass-ui-settings'

interface ReferenceProof {
  holdSeconds: number
  endedAt: number | null
  samples: { elapsed: number; rms: number }[]
}
declare global {
  interface Window {
    referenceNoteProof: {
      references: ReferenceProof[]
      microphoneStarts: number
    }
  }
}

test.setTimeout(90_000)
const fullSceneProof = process.env.REFERENCE_FULL_SCENE_PROOF === '1'

async function openReferenceMuseum(page: Page): Promise<void> {
  await page.addInitScript((fullScene) => {
    // Audio and input assertions retain the real scene/controller while avoiding
    // software raster stalls. Pixel proof opts in with REFERENCE_FULL_SCENE_PROOF=1.
    if (!fullScene)
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
    localStorage.setItem(`${prefix}automatic-singing`, 'off')
    localStorage.setItem(`${prefix}comfortable-note`, '57')
    localStorage.setItem(
      `${prefix}progress:glassworks`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'goblet',
        completedBreakableIds: [],
      }),
    )
    window.referenceNoteProof = { references: [], microphoneStarts: 0 }
    let latestEnvelope:
      | { node: GainNode; peak: number; releaseAt: number }
      | undefined
    const createGain = AudioContext.prototype.createGain
    AudioContext.prototype.createGain = function () {
      const node = createGain.call(this)
      const envelope = { node, peak: 0, releaseAt: 0 }
      latestEnvelope = envelope
      const ramp = node.gain.exponentialRampToValueAtTime.bind(node.gain)
      node.gain.exponentialRampToValueAtTime = (value, time) => {
        envelope.peak = value
        return ramp(value, time)
      }
      const release = node.gain.setTargetAtTime.bind(node.gain)
      node.gain.setTargetAtTime = (value, time, constant) => {
        if (value === 0) envelope.releaseAt = time
        return release(value, time, constant)
      }
      return node
    }
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      const oscillator = createOscillator.call(this)
      const start = oscillator.start.bind(oscillator)
      oscillator.start = (when = 0) => {
        const envelope = latestEnvelope
        if (envelope?.peak === 0.13) {
          const at = when || this.currentTime
          const proof: ReferenceProof = {
            holdSeconds: envelope.releaseAt - at - 0.09,
            endedAt: null,
            samples: [],
          }
          window.referenceNoteProof.references.push(proof)
          const analyser = this.createAnalyser()
          analyser.fftSize = 2048
          envelope.node.connect(analyser)
          const pcm = new Float32Array(analyser.fftSize)
          const timer = setInterval(() => {
            analyser.getFloatTimeDomainData(pcm)
            const rms = Math.sqrt(
              pcm.reduce((sum, value) => sum + value * value, 0) / pcm.length,
            )
            proof.samples.push({ elapsed: this.currentTime - at, rms })
            if (proof.samples.length >= 120) clearInterval(timer)
          }, 25)
          oscillator.addEventListener(
            'ended',
            () => {
              proof.endedAt = this.currentTime - at
              clearInterval(timer)
              envelope.node.disconnect(analyser)
              analyser.disconnect()
            },
            { once: true },
          )
        }
        start(when)
      }
      return oscillator
    }
    navigator.mediaDevices.getUserMedia = async () => {
      window.referenceNoteProof.microphoneStarts++
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
        void context.close()
      }
      return destination.stream
    }
  }, fullSceneProof)
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

async function expectSustainedTargetReplay(
  page: Page,
  seconds: number,
): Promise<void> {
  const panel = page.getByRole('region', { name: 'Voice challenge' })
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 15_000,
  })
  const before = await page.evaluate(
    () => window.referenceNoteProof.references.length,
  )
  await panel.getByRole('button', { name: 'Hear example' }).click()
  await expect(panel).toHaveAttribute('data-voice-mode', 'reference')
  await expect(
    panel.getByRole('button', { name: 'Hear example' }),
  ).toBeDisabled()
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 15_000,
  })
  const proof = await page.evaluate(() => window.referenceNoteProof)
  expect(proof.microphoneStarts).toBe(1)
  expect(proof.references).toHaveLength(before + 1)
  const replay = proof.references.at(-1)!
  expect(replay.holdSeconds).toBeCloseTo(seconds, 5)
  const heldSamples = replay.samples.filter(
    (sample) => sample.elapsed >= 0.6 && sample.elapsed <= seconds,
  )
  expect(heldSamples.length).toBeGreaterThan(5)
  // A 0.13 peak sine has RMS ~0.092. The old decay is near zero by this window.
  expect(Math.min(...heldSamples.map((sample) => sample.rms))).toBeGreaterThan(
    0.08,
  )
  expect(replay.endedAt).toBeGreaterThanOrEqual(seconds + 0.3)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
}

for (const viewport of [
  { width: 393, height: 852 },
  { width: 740, height: 320 },
]) {
  test(`reference hold survives real pointer tuning and target replay at ${viewport.width}x${viewport.height} @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await openReferenceMuseum(page)
    await expectSustainedTargetReplay(page, 1.25)
    const defaultProof = await page.evaluate(() => window.referenceNoteProof)
    await openGameSettings(page, 'Advanced')
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
    const hold = settings.getByRole('slider', { name: 'Reference note hold' })
    await expect(hold).toHaveValue('1.25')
    await hold.scrollIntoViewIfNeeded()
    const bounds = await hold.boundingBox()
    if (!bounds) throw new Error('Missing reference hold slider')
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )
    await page.mouse.down()
    await page.mouse.move(
      bounds.x + bounds.width * 0.82,
      bounds.y + bounds.height / 2,
      { steps: 8 },
    )
    await page.mouse.up()
    await expect(hold).not.toHaveValue('1.25')
    const saved = await hold.inputValue()
    expect(Number(saved)).toBeGreaterThanOrEqual(1)
    expect(Number(saved)).toBeLessThanOrEqual(1.5)
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem(
            'beside-cue:glass-adventure:reference-note-hold:v1',
          ),
        ),
      )
      .toBe(saved)
    await page.screenshot({
      path: testInfo.outputPath('reference-settings.png'),
    })
    await page.reload()
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 40_000 },
    )
    await openCameraPreview(page)
    const camera = page.getByRole('dialog', { name: 'Camera comfort tuning' })
    await expect(
      camera.getByRole('slider', { name: 'Reference note hold' }),
    ).toHaveValue(saved)
    await camera.getByRole('button', { name: 'Close camera tuning' }).click()
    await expectSustainedTargetReplay(page, Number(saved))
    await writeFile(
      testInfo.outputPath('reference-audio-proof.json'),
      JSON.stringify(
        {
          viewport,
          rasterOmitted: !fullSceneProof,
          savedSeconds: Number(saved),
          defaultProof,
          savedProof: await page.evaluate(() => window.referenceNoteProof),
          sliderBounds: bounds,
          renderer: await page.evaluate(() => {
            const context = document
              .createElement('canvas')
              .getContext('webgl2')
            const debug = context?.getExtension('WEBGL_debug_renderer_info')
            return debug
              ? context!.getParameter(debug.UNMASKED_RENDERER_WEBGL)
              : null
          }),
        },
        null,
        2,
      ),
    )
    await openGameSettings(page, 'Advanced')
    await settings.getByRole('button', { name: 'Reset note hold' }).click()
    await expect(hold).toHaveValue('1.25')
  })
}
