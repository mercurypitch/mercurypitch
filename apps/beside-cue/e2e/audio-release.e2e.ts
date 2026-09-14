// Audio release regression — measure real rendered PCM across background changes.
import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

interface PcmSample {
  readonly time: number
  readonly rms: number
}

interface AudioReleaseHarness {
  readonly context: AudioContext
  readonly samples: PcmSample[]
  readonly stateChanges: { time: number; state: AudioContextState }[]
  readonly ready: Promise<void>
  readonly toneStartedAt: number
  background(): number
  foregroundAndPlay(): Promise<void>
  interruptRelease(): Promise<void>
  resumeClock(): Promise<number>
  measure(from: number, to: number): { count: number; rms: number }
  dispose(): void
}

declare global {
  interface Window {
    audioReleaseHarness: AudioReleaseHarness
  }
}

async function startMeasuredTone(page: Page): Promise<void> {
  // A test-only document isolates the real audio modules from onboarding music.
  // No product source, AudioParam automation, or native audio method is mocked.
  await page.route('**/audio-release-harness', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><button id="start">Start measured audio</button>',
    }),
  )
  await page.goto('/audio-release-harness')
  await page.evaluate(
    async ({ sharedModule }) => {
      const shared: typeof import('../../../packages/audio-io/src/shared-audio-context') =
        await import(sharedModule)
      const {
        createWebAudioOutput,
      }: typeof import('../src/audio/web-audio-output') =
        await import('/src/audio/web-audio-output.ts')

      function referenceWav(): ArrayBuffer {
        const sampleRate = 48_000
        const frames = sampleRate * 4
        const bytes = new ArrayBuffer(44 + frames * 2)
        const view = new DataView(bytes)
        const text = (at: number, value: string): void => {
          for (let i = 0; i < value.length; i += 1)
            view.setUint8(at + i, value.charCodeAt(i))
        }
        text(0, 'RIFF')
        view.setUint32(4, bytes.byteLength - 8, true)
        text(8, 'WAVEfmt ')
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)
        view.setUint16(22, 1, true)
        view.setUint32(24, sampleRate, true)
        view.setUint32(28, sampleRate * 2, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        text(36, 'data')
        view.setUint32(40, frames * 2, true)
        for (let i = 0; i < frames; i += 1) {
          view.setInt16(
            44 + i * 2,
            Math.round(
              Math.sin((i * 2 * Math.PI * 440) / sampleRate) * 0.25 * 32_767,
            ),
            true,
          )
        }
        return bytes
      }

      document.querySelector<HTMLButtonElement>('#start')!.onclick = () => {
        const lease = shared.acquireSharedAudioContext('e2e-pcm-meter')
        const context = lease.ensure()!
        // Preserve the real user-gesture unlock, before loading the meter.
        const unlocked = lease.unlock()
        const samples: PcmSample[] = []
        const stateChanges: { time: number; state: AudioContextState }[] = []
        context.addEventListener('statechange', () => {
          stateChanges.push({ time: context.currentTime, state: context.state })
        })
        const bytes = referenceWav()
        const output = createWebAudioOutput({
          fetchArrayBuffer: async () => bytes.slice(0),
        })
        const playTone = () =>
          output.play({
            source: {
              src: 'e2e-reference-tone.wav',
              mimeType: 'audio/wav',
              sha256: 'e'.repeat(64),
              byteLength: bytes.byteLength,
              durationMs: 4_000,
              sampleRateHz: 48_000,
              channels: 1,
            },
            playback: { kind: 'one-shot' },
            initialGain: 1,
          })
        let toneStartedAt = 0
        let recorder: AudioWorkletNode | undefined
        const originalConnect = AudioNode.prototype.connect
        const ready = (async () => {
          if (!(await unlocked))
            throw new Error('Real audio context could not unlock.')
          const meterUrl = URL.createObjectURL(
            new Blob(
              [
                `
          class PcmMeter extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0]?.[0];
              let power = 0;
              if (input) for (const value of input) power += value * value;
              this.port.postMessage({ time: currentTime, rms: Math.sqrt(power / (input?.length || 1)) });
              return true;
            }
          }
          registerProcessor('pcm-meter', PcmMeter);
        `,
              ],
              { type: 'text/javascript' },
            ),
          )
          try {
            await context.audioWorklet.addModule(meterUrl)
          } finally {
            URL.revokeObjectURL(meterUrl)
          }
          recorder = new AudioWorkletNode(context, 'pcm-meter')
          recorder.port.onmessage = (event: MessageEvent<PcmSample>) => {
            samples.push(event.data)
          }
          // The worklet writes silence; its side tap measures the existing final
          // mix without redirecting or doubling the production destination path.
          recorder.connect(context.destination)
          AudioNode.prototype.connect = function (
            destination,
            ...ports: number[]
          ) {
            if (destination === context.destination && this !== recorder) {
              Reflect.apply(originalConnect, this, [recorder])
            }
            return Reflect.apply(originalConnect, this, [destination, ...ports])
          }
          const playback = playTone()
          if ((await playback.started) !== 'started')
            throw new Error('Reference tone did not start.')
          toneStartedAt = context.currentTime
        })()
        window.audioReleaseHarness = {
          context,
          samples,
          stateChanges,
          ready,
          get toneStartedAt() {
            return toneStartedAt
          },
          background() {
            const at = context.currentTime
            shared.suspendSharedAudioContext()
            return at
          },
          async foregroundAndPlay() {
            shared.cancelSharedAudioContextSuspension()
            if ((await playTone().started) !== 'started')
              throw new Error('Replacement tone did not start.')
          },
          async interruptRelease() {
            const interrupted = new Promise<void>((resolve) => {
              const listener = (): void => {
                if (context.state !== 'suspended') return
                context.removeEventListener('statechange', listener)
                resolve()
              }
              context.addEventListener('statechange', listener)
            })
            shared.suspendSharedAudioContext()
            // Chromium cannot produce iOS's `interrupted` state. Actually park
            // its render thread immediately to test the same frozen-tail hazard.
            await context.suspend()
            await interrupted
          },
          async resumeClock() {
            shared.cancelSharedAudioContextSuspension()
            if (!(await lease.unlock()))
              throw new Error('Audio clock did not resume.')
            return context.currentTime
          },
          measure(from, to) {
            const range = samples.filter(
              (sample) => sample.time >= from && sample.time < to,
            )
            return {
              count: range.length,
              rms: Math.sqrt(
                range.reduce((sum, sample) => sum + sample.rms ** 2, 0) /
                  Math.max(1, range.length),
              ),
            }
          },
          dispose() {
            AudioNode.prototype.connect = originalConnect
            output.dispose()
            recorder?.port.close()
            recorder?.disconnect()
            lease.release()
            shared.resetSharedAudioContext()
          },
        }
      }
    },
    {
      sharedModule: `/@fs${fileURLToPath(new URL('../../../packages/audio-io/src/shared-audio-context.ts', import.meta.url))}`,
    },
  )
  await page.getByRole('button', { name: 'Start measured audio' }).click()
  await page.evaluate(() => window.audioReleaseHarness.ready)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = window.audioReleaseHarness
        return h.samples.some(
          (sample) => sample.time > h.toneStartedAt + 0.18 && sample.rms > 0.1,
        )
      }),
    )
    .toBe(true)
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.audioReleaseHarness?.dispose())
})

test('native background intent renders a short decay before suspending the shared clock', async ({
  page,
}, testInfo) => {
  await startMeasuredTone(page)
  const stoppedAt = await page.evaluate(() =>
    window.audioReleaseHarness.background(),
  )
  await expect
    .poll(() => page.evaluate(() => window.audioReleaseHarness.context.state))
    .toBe('suspended')
  await expect
    .poll(() =>
      page.evaluate(
        (at) => window.audioReleaseHarness.measure(at + 0.15, at + 0.2).count,
        stoppedAt,
      ),
    )
    .toBeGreaterThan(3)
  const measured = await page.evaluate((at) => {
    const h = window.audioReleaseHarness
    return {
      baseline: h.measure(at - 0.05, at - 0.005),
      early: h.measure(at + 0.005, at + 0.04),
      late: h.measure(at + 0.15, at + 0.2),
      elapsedAudioSeconds: h.context.currentTime - at,
    }
  }, stoppedAt)
  await testInfo.attach('rendered-release.json', {
    body: JSON.stringify(measured),
    contentType: 'application/json',
  })
  expect(measured.baseline.rms).toBeGreaterThan(0.1)
  expect(measured.early.rms).toBeGreaterThan(measured.baseline.rms * 0.1)
  expect(measured.early.rms).toBeLessThan(measured.baseline.rms * 0.95)
  expect(measured.late.rms).toBeLessThan(measured.baseline.rms * 0.05)
  expect(measured.elapsedAudioSeconds).toBeGreaterThanOrEqual(0.18)
})

test('returning during the release keeps replacement playback running past the old suspend deadline', async ({
  page,
}, testInfo) => {
  await startMeasuredTone(page)
  const returnedAt = await page.evaluate(async () => {
    const h = window.audioReleaseHarness
    const at = h.background()
    // Both events occur in one task, strictly inside the release grace even
    // on a busy CI host. Never rely on a short wall-clock timeout landing early.
    await h.foregroundAndPlay()
    return at
  })
  await expect
    .poll(() =>
      page.evaluate(
        (at) => window.audioReleaseHarness.context.currentTime - at,
        returnedAt,
      ),
    )
    .toBeGreaterThan(0.4)
  const measured = await page.evaluate((at) => {
    const h = window.audioReleaseHarness
    return {
      signal: h.measure(at + 0.3, at + 0.38),
      state: h.context.state,
      suspended: h.stateChanges.some(
        (event) => event.time >= at && event.state === 'suspended',
      ),
    }
  }, returnedAt)
  await testInfo.attach('replacement-pcm.json', {
    body: JSON.stringify(measured),
    contentType: 'application/json',
  })
  expect(measured.signal.count).toBeGreaterThan(3)
  expect(measured.signal.rms).toBeGreaterThan(0.1)
  expect(measured.state).toBe('running')
  expect(measured.suspended).toBe(false)
})

test('an interrupted release stays silent when only the shared clock resumes', async ({
  page,
}, testInfo) => {
  await startMeasuredTone(page)
  await page.evaluate(() => window.audioReleaseHarness.interruptRelease())
  const resumedAt = await page.evaluate(() =>
    window.audioReleaseHarness.resumeClock(),
  )
  await expect
    .poll(() =>
      page.evaluate(
        (at) => window.audioReleaseHarness.context.currentTime - at,
        resumedAt,
      ),
    )
    .toBeGreaterThan(0.15)
  const measured = await page.evaluate(
    (at) => window.audioReleaseHarness.measure(at + 0.03, at + 0.13),
    resumedAt,
  )
  await testInfo.attach('resumed-clock-pcm.json', {
    body: JSON.stringify(measured),
    contentType: 'application/json',
  })
  expect(measured.count).toBeGreaterThan(3)
  expect(measured.rms).toBeLessThan(0.000001)
})
