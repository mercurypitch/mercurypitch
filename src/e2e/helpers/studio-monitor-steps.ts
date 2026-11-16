// Studio monitor steps — what a spec reads of the monitor in the output the page sent to its speakers: the steepest step from one sample to the next (a click steps far more steeply than the tone it monitors), the tone's peak and its envelope a period at a time, and the output around a press, placed on the audio clock.
import { expect, type Page } from '@playwright/test'
import type { StudioClickStamp } from './studio-output-capture'
import { captureOutput, untilAudioClock } from './studio-output-capture'

/** A render quantum, in frames. */
const QUANTUM = 128

/**
 * How soon after its press a lane joining a microphone already flowing must
 * be heard: the press's own work and a few render quanta. Measured at up to
 * 38 ms in headless Chromium under a full parallel run, and 273 to 305 ms
 * for a lane that waited for its input to settle.
 */
export const JOINED_WITHIN_SECONDS = 0.1

/** The largest change from one sample to the next, and the sample it lands on. */
export function steepestStep(samples: Float32Array): {
  step: number
  index: number
} {
  let step = 0
  let index = 0
  for (let i = 1; i < samples.length; i++) {
    const change = Math.abs(samples[i] - samples[i - 1])
    if (change > step) {
      step = change
      index = i
    }
  }
  return { step, index }
}

/** The largest change from one sample to the next. */
export function steepest(samples: Float32Array): number {
  return steepestStep(samples).step
}

export function peak(samples: Float32Array): number {
  let most = 0
  for (const sample of samples) most = Math.max(most, Math.abs(sample))
  return most
}

/**
 * The tone's envelope from `from` on, a quantum at a time: the loudest
 * sample of each whole period of `period` frames, read every 128 frames and
 * placed at the frame in its middle. A tone with harmonics peaks unevenly
 * within a period, never across one.
 */
export function periodEnvelope(
  samples: Float32Array,
  from: number,
  period: number,
): { readonly frame: number; readonly value: number }[] {
  const readings: { frame: number; value: number }[] = []
  for (let start = from; start + period <= samples.length; start += QUANTUM)
    readings.push({
      frame: start + Math.floor(period / 2),
      value: peak(samples.subarray(start, start + period)),
    })
  return readings
}

/**
 * Where a lane that joins the output is first heard: the first reading of
 * the envelope from `from` on (`periodEnvelope`) more than a tenth above
 * `level`, the output's loudest before the press, or null. The reading sits
 * mid-period, so it can come up to half a period before the crossing.
 */
export function firstRise(
  samples: Float32Array,
  from: number,
  period: number,
  level: number,
): number | null {
  const risen = periodEnvelope(samples, from, period).find(
    ({ value }) => value > level * 1.1,
  )
  return risen?.frame ?? null
}

/**
 * The output up to `seconds` past `press`, the tone as it played until 20 ms
 * before the press, and where a time from the press falls in the output.
 */
export async function aroundPress(
  page: Page,
  press: StudioClickStamp,
  seconds: number,
) {
  await untilAudioClock(page, press.contextTime + seconds)
  const { samples, startFrame, sampleRate } = await captureOutput(page)
  const at = (from: number) =>
    Math.round((press.contextTime + from) * sampleRate) - startFrame
  // A capture taken late starts after the press, and measures nothing of it.
  expect(at(-0.02)).toBeGreaterThan(0)
  return { samples, heard: samples.subarray(0, at(-0.02)), at, sampleRate }
}
