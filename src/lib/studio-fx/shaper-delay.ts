// ============================================================
// Shaper delay — how late an oversampled WaveShaperNode runs, measured once per rate
// ============================================================
//
// An oversampled WaveShaperNode resamples up and back down through linear
// phase filters, and its output runs late by their delay. Chromium 148:
// 128 frames at 2x and 192 at 4x, at 44.1 and 48 kHz alike, the response
// symmetric about its centre to 3e-8. A shaper run at 2x or without
// oversampling (fx-profile.ts) adds a delay of the difference to stay as
// late as a 4x one, so the chain's latency does not change with it.
//
// The delays are measured, not assumed: an impulse through an identity
// shaper in an offline context at the song's rate, one render per rate.
// Until a rate is measured, or when the responses do not line up the way
// they should (another engine), every shaper runs at 4x as before: a
// profile can only save work where the delays are known.
type ContextFactory = (
  options: OfflineAudioContextOptions,
) => OfflineAudioContext

/** Frames each oversampling runs late, at one rate. */
export type ShaperDelays = Readonly<Record<OverSampleType, number>>

const MODES: readonly OverSampleType[] = ['none', '2x', '4x']
const measured = new Map<number, ShaperDelays | null>()
const pending = new Map<number, Promise<ShaperDelays | null>>()

const IMPULSE_AT = 4096
const WINDOW_FRAMES = 4096
/** The resampling filters pass an impulse at 0.992 of its height. */
const PEAK_FLOOR = 0.9

/** The delays at `rate`, once measured; undefined before, null if unusable. */
export function shaperDelays(rate: number): ShaperDelays | null | undefined {
  return measured.get(rate)
}

async function renderDelay(
  rate: number,
  mode: OverSampleType,
  createContext: ContextFactory,
): Promise<number | null> {
  const length = IMPULSE_AT + WINDOW_FRAMES
  const ctx = createContext({ numberOfChannels: 1, length, sampleRate: rate })
  const impulse = ctx.createBuffer(1, length, rate)
  impulse.getChannelData(0)[IMPULSE_AT] = 0.5
  const source = ctx.createBufferSource()
  source.buffer = impulse
  const shaper = ctx.createWaveShaper()
  shaper.curve = new Float32Array([-1, 0, 1])
  shaper.oversample = mode
  source.connect(shaper).connect(ctx.destination)
  source.start(0)
  const data = (await ctx.startRendering()).getChannelData(0)
  let peak = 0
  for (let i = 1; i < data.length; i++)
    if (Math.abs(data[i]) > Math.abs(data[peak])) peak = i
  if (peak < IMPULSE_AT || Math.abs(data[peak]) < 0.5 * PEAK_FLOOR) return null
  return peak - IMPULSE_AT
}

async function renderDelays(
  rate: number,
  createContext: ContextFactory,
): Promise<ShaperDelays | null | undefined> {
  try {
    const frames: number[] = []
    for (const mode of MODES) {
      const delay = await renderDelay(rate, mode, createContext)
      if (delay === null) return null
      frames.push(delay)
    }
    const [none, twice, four] = frames
    // More oversampling, never less delay: anything else is not understood.
    if (none !== 0 || twice > four) return null
    return { none, '2x': twice, '4x': four }
  } catch {
    // No offline context here, or it failed: measure again next time.
    return undefined
  }
}

/** Measure (once per rate) how late each oversampling runs. */
export function measureShaperDelays(
  rate: number,
  createContext: ContextFactory = (options) => new OfflineAudioContext(options),
): Promise<ShaperDelays | null> {
  const known = measured.get(rate)
  if (known !== undefined) return Promise.resolve(known)
  let job = pending.get(rate)
  if (!job) {
    job = renderDelays(rate, createContext)
      .then((delays) => {
        if (delays !== undefined) measured.set(rate, delays)
        return delays ?? null
      })
      .finally(() => pending.delete(rate))
    pending.set(rate, job)
  }
  return job
}

/**
 * How an oversampled shaper runs at `rate` when asked for `wanted`: that
 * oversampling and the frames that make it as late as 4x, once the delays
 * are known; 4x with nothing to make up until then.
 */
export function shaperRun(
  rate: number,
  wanted: OverSampleType,
): { readonly oversample: OverSampleType; readonly makeUpFrames: number } {
  const delays = measured.get(rate)
  if (!delays || wanted === '4x') return { oversample: '4x', makeUpFrames: 0 }
  return { oversample: wanted, makeUpFrames: delays['4x'] - delays[wanted] }
}

/** Test seam: forget what was measured. */
export function resetShaperDelaysForTests(): void {
  measured.clear()
  pending.clear()
}
