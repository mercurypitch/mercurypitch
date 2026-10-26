// Studio native fade regression — exact scheduler events must be accepted and render their retained gain.
import { expect, test } from '@playwright/test'
import { studioSegmentGain } from '../lib/studio/playback/edge-envelope'
import { captureStudioEnvelope, trimmedFadeSegment, } from '../lib/studio/playback/edge-envelope.test-fixtures'

test('Studio schedules adjacent explicit and safety fades at fractional audio-clock epochs @smoke', async ({
  page,
}) => {
  const schedules = [44100, 48000].flatMap((rate) =>
    Array.from({ length: 256 }, (_, quantum) =>
      captureStudioEnvelope(0.5 + (quantum * 4096) / rate),
    ),
  )
  const renderedSchedule = captureStudioEnvelope(0.5)
  const probeFrames = Array.from({ length: 5401 }, (_, index) => index * 100)
  const expected = probeFrames.map((frame) =>
    studioSegmentGain(
      trimmedFadeSegment,
      trimmedFadeSegment.startFrame + frame,
    ),
  )
  const result = await page.evaluate(
    async ({ schedules, renderedSchedule, probeFrames }) => {
      const scheduling = new OfflineAudioContext(2, 1, 48000)
      const failures: string[] = []
      const apply = (param: AudioParam, events: typeof renderedSchedule) => {
        for (const event of events) {
          if (event.kind === 'set')
            param.setValueAtTime(event.value, event.time)
          else
            param.setValueCurveAtTime(
              new Float32Array(event.values),
              event.time,
              event.duration,
            )
        }
      }
      for (const events of schedules) {
        const gain = scheduling.createGain()
        try {
          apply(gain.gain, events)
        } catch (error) {
          failures.push(String(error))
        }
        gain.disconnect()
      }
      if (failures.length) return { failures, samples: [] }
      const ctx = new OfflineAudioContext(1, 576000, 48000)
      const gain = ctx.createGain()
      const source = ctx.createConstantSource()
      apply(gain.gain, renderedSchedule)
      source.connect(gain)
      gain.connect(ctx.destination)
      source.start(0.5)
      source.stop(11.75)
      const buffer = await ctx.startRendering()
      return {
        failures,
        samples: probeFrames.map(
          (frame) => buffer.getChannelData(0)[24000 + frame],
        ),
      }
    },
    { schedules, renderedSchedule, probeFrames },
  )
  expect(result.failures).toEqual([])
  expect(result.samples).toHaveLength(expected.length)
  expect(
    Math.max(
      ...result.samples.map((sample, index) =>
        Math.abs(sample - expected[index]),
      ),
    ),
  ).toBeLessThan(0.00035)
  expect(result.samples[0]).toBe(0)
  expect(result.samples.at(-1)).toBe(0)
  expect(result.samples[240]).toBe(1)
})
