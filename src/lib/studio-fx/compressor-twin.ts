// ============================================================
// Compressor twin — the lookahead of a compressor as a plain delay
// ============================================================
//
// A DynamicsCompressorNode delays what it passes by a fixed lookahead, and
// the paths that run beside a compressor must carry the same delay or the sum
// comb-filters. They used to carry a null compressor (threshold 0 dB, ratio
// 1): the right delay, but the full cost of a compressor's detector on every
// sample. A DelayNode set to the measured lookahead gives the same samples
// for a fraction of the cost.
//
// The lookahead is measured, not assumed: an impulse through a null
// compressor in an offline context at the song's rate. A clean unit impulse
// whole frames late is required. Anything else (another engine, a resampled
// kernel) keeps the null compressor, so a twin is never wrong, only dearer.
import { createNullCompressor } from './effect-shell'

type ContextFactory = (
  options: OfflineAudioContextOptions,
) => OfflineAudioContext

const measured = new Map<number, number | null>()
const pending = new Map<number, Promise<number | null>>()

/** A fresh compressor starts about 17 dB down; its gain settles within this. */
const MEASURE_SETTLE_SECONDS = 0.5
const MEASURE_WINDOW_SECONDS = 0.1
/**
 * A settled null compressor passes 0.99998 (-0.00013 dB), not exactly 1:
 * its gain math is approximate. The peak is checked loosely, the rest of
 * the response strictly: a smeared impulse is not a delay.
 */
const PEAK_TOLERANCE = 1e-3
const LEAK_TOLERANCE = 1e-6

/** The lookahead in frames at `rate`, once measured; undefined before, null if unusable. */
export function compressorLatencyFrames(
  rate: number,
): number | null | undefined {
  return measured.get(rate)
}

function readImpulse(data: Float32Array, at: number): number | null {
  let peak = -1
  let peakValue = 0
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > Math.abs(peakValue)) {
      peak = i
      peakValue = data[i]
    }
  }
  if (peak < at || Math.abs(peakValue - 1) > PEAK_TOLERANCE) return null
  for (let i = 0; i < data.length; i++)
    if (i !== peak && Math.abs(data[i]) > LEAK_TOLERANCE) return null
  return peak - at
}

/** The lookahead an impulse shows, null if unusable, undefined if nothing rendered. */
async function renderLookahead(
  rate: number,
  createContext: ContextFactory,
): Promise<number | null | undefined> {
  const at = Math.round(MEASURE_SETTLE_SECONDS * rate)
  const length = at + Math.round(MEASURE_WINDOW_SECONDS * rate)
  try {
    const ctx = createContext({ numberOfChannels: 1, length, sampleRate: rate })
    const impulse = ctx.createBuffer(1, length, rate)
    impulse.getChannelData(0)[at] = 1
    const source = ctx.createBufferSource()
    source.buffer = impulse
    source.connect(createNullCompressor(ctx)).connect(ctx.destination)
    source.start(0)
    const rendered = await ctx.startRendering()
    return readImpulse(rendered.getChannelData(0), at)
  } catch {
    // No offline context here, or it failed: measure again next time.
    return undefined
  }
}

/** Measure (once per rate) how late a compressor's output runs. */
export function measureCompressorLatency(
  rate: number,
  createContext: ContextFactory = (options) => new OfflineAudioContext(options),
): Promise<number | null> {
  const known = measured.get(rate)
  if (known !== undefined) return Promise.resolve(known)
  let job = pending.get(rate)
  if (!job) {
    job = renderLookahead(rate, createContext)
      .then((frames) => {
        if (frames !== undefined) measured.set(rate, frames)
        return frames ?? null
      })
      .finally(() => pending.delete(rate))
    pending.set(rate, job)
  }
  return job
}

/**
 * A node that delays exactly as a compressor does: a DelayNode once the
 * lookahead is known at this rate, a null compressor until then.
 */
export function createCompressorTwin(ctx: BaseAudioContext): AudioNode {
  const frames = measured.get(ctx.sampleRate)
  if (frames === undefined || frames === null) return createNullCompressor(ctx)
  const seconds = frames / ctx.sampleRate
  const delay = ctx.createDelay(seconds + 128 / ctx.sampleRate)
  delay.delayTime.value = seconds
  return delay
}

/** Test seam: forget what was measured. */
export function resetCompressorLatencyForTests(): void {
  measured.clear()
  pending.clear()
}
