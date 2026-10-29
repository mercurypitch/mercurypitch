// Studio output capture — the last 680 ms the page sent to its speakers, placed on the audio clock, so a spec can time a change to the millisecond.
//
// An AnalyserNode taps every connection to the destination and keeps the
// newest 32768 samples. An AudioWorklet tap was tried first and read whole
// quanta of exact silence during graph changes that this analyser, on the
// same graph at the same moments, never saw: the worklet's input dropped
// out, not the output. So the analyser is the recorder. studio-output.ts
// samples a smaller analyser every 10 ms from the page's timers, which is
// enough for a dip but cannot time one.
import { expect, type Page } from '@playwright/test'
import { STUDIO_RATE, studioRegion } from './dedicatedstudio-fixture'

const CAPTURE_FRAMES = 32768

/** A mono 16-bit WAV of `seconds`, one sample per frame from `sample`. */
function wavFrom(seconds: number, sample: (frame: number) => number): Buffer {
  const frames = Math.round(STUDIO_RATE * seconds)
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(STUDIO_RATE, 24)
  bytes.writeUInt32LE(STUDIO_RATE * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  for (let frame = 0; frame < frames; frame++)
    bytes.writeInt16LE(
      Math.max(-32767, Math.min(32767, Math.round(sample(frame) * 32767))),
      44 + frame * 2,
    )
  return bytes
}

/** A tone that changes pitch at `switchSeconds`, so the song's two parts are told apart by ear and by a spec. */
export function twoPartWav(
  seconds: number,
  switchSeconds: number,
  [first, second]: readonly [number, number],
  peak: number,
): Buffer {
  return wavFrom(seconds, (frame) => {
    const hz = frame < switchSeconds * STUDIO_RATE ? first : second
    return Math.sin((2 * Math.PI * hz * frame) / STUDIO_RATE) * peak
  })
}

/** Seeded white noise: any two places in it share nothing, as two places in a song do not. */
export function noiseWav(seconds: number, peak: number, seed: number): Buffer {
  let state = seed >>> 0
  return wavFrom(seconds, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return (state / 2 ** 32 - 0.5) * 2 * peak
  })
}

/** Import a generated take as a lane of its own, and wait until it is saved. */
export async function importWav(
  page: Page,
  name: string,
  buffer: Buffer,
): Promise<void> {
  const studio = studioRegion(page)
  await studio.getByLabel('Upload audio', { exact: true }).setInputFiles({
    name: `${name}.wav`,
    mimeType: 'audio/wav',
    buffer,
  })
  await expect(
    studio.getByRole('button', { name: `${name} details`, exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
}

/** Wait until the audio clock reaches `time`: audio time, not page time. */
export async function untilAudioClock(page: Page, time: number): Promise<void> {
  await page.waitForFunction(
    (until) => (window.__studioCapture?.context.currentTime ?? 0) >= until,
    time,
  )
}

/** The audio clock now. */
export async function audioClock(page: Page): Promise<number> {
  return page.evaluate(() => window.__studioCapture?.context.currentTime ?? 0)
}

declare global {
  interface Window {
    __studioCapture?: {
      context: AudioContext
      analyser: AnalyserNode
      sources: {
        created: number
        live: Set<AudioBufferSourceNode>
      }
      clicks: StudioClickStamp[]
    }
  }
}

/**
 * Where the audio clock stood when a pointer was pressed or released, a key
 * went down or up, or a control committed a change.
 */
export interface StudioClickStamp {
  readonly kind: 'down' | 'up' | 'key' | 'keyup' | 'change'
  /** performance.now() in the capture phase, before any handler of the page. */
  readonly performanceMs: number
  /** The context's currentTime then: the render position. */
  readonly contextTime: number
  /** getOutputTimestamp(): the time at the speakers, and when it was there. */
  readonly outputContextTime: number
  readonly outputPerformanceMs: number
  readonly baseLatency: number
  readonly outputLatency: number
}

/** What the page sent to its speakers, mixed to mono, from one audio-clock frame. */
export interface StudioCapture {
  readonly sampleRate: number
  readonly startFrame: number
  readonly samples: Float32Array
}

/**
 * Tap every connection to an AudioContext's destination, count the buffer
 * sources the page starts and those not yet ended, and stamp each pointer
 * press and release, each key press and release and each committed change
 * with the audio clock. Offline renders are left out, as tapOutput does.
 */
export async function captureStudioOutput(page: Page): Promise<void> {
  await page.addInitScript((frames) => {
    const connect = AudioNode.prototype.connect as (
      this: AudioNode,
      ...args: unknown[]
    ) => unknown
    AudioNode.prototype.connect = function (
      this: AudioNode,
      ...args: unknown[]
    ) {
      const result = connect.apply(this, args)
      const target = args[0]
      if (
        target instanceof AudioDestinationNode &&
        target.context instanceof AudioContext
      ) {
        const context = target.context
        if (window.__studioCapture?.context !== context) {
          const analyser = context.createAnalyser()
          analyser.fftSize = frames
          window.__studioCapture = {
            context,
            analyser,
            sources: { created: 0, live: new Set() },
            clicks: [],
          }
        }
        const output = typeof args[1] === 'number' ? args[1] : 0
        connect.call(this, window.__studioCapture.analyser, output)
      }
      return result
    } as typeof AudioNode.prototype.connect
    const create = BaseAudioContext.prototype.createBufferSource
    BaseAudioContext.prototype.createBufferSource = function (
      this: BaseAudioContext,
    ) {
      const source = create.call(this)
      const capture = window.__studioCapture
      if (capture?.context === this) {
        capture.sources.created++
        capture.sources.live.add(source)
        // Chromium can send `ended` twice for one source; a set counts it once.
        source.addEventListener('ended', () =>
          capture.sources.live.delete(source),
        )
      }
      return source
    }
    const stamp = (kind: StudioClickStamp['kind']) => () => {
      const capture = window.__studioCapture
      if (!capture) return
      const performanceMs = performance.now()
      const { context } = capture
      const output = context.getOutputTimestamp()
      capture.clicks.push({
        kind,
        performanceMs,
        contextTime: context.currentTime,
        outputContextTime: output.contextTime ?? 0,
        outputPerformanceMs: output.performanceTime ?? 0,
        baseLatency: context.baseLatency,
        outputLatency: context.outputLatency,
      })
    }
    window.addEventListener('pointerdown', stamp('down'), { capture: true })
    window.addEventListener('pointerup', stamp('up'), { capture: true })
    window.addEventListener('keydown', stamp('key'), { capture: true })
    window.addEventListener('keyup', stamp('keyup'), { capture: true })
    window.addEventListener('change', stamp('change'), { capture: true })
  }, CAPTURE_FRAMES)
}

/** Forget earlier stamps. */
export async function clearClicks(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__studioCapture) window.__studioCapture.clicks = []
  })
}

/** The stamps since the last clear, in order. */
export async function readClicks(page: Page): Promise<StudioClickStamp[]> {
  return page.evaluate(() => window.__studioCapture?.clicks ?? [])
}

/** The newest 32768 samples sent to the speakers, ending where the audio clock stands. */
export async function captureOutput(page: Page): Promise<StudioCapture> {
  const raw = await page.evaluate(() => {
    const { analyser, context } = window.__studioCapture!
    const samples = new Float32Array(analyser.fftSize)
    // The clock moves a quantum at a time: read until it holds still around the copy.
    for (let attempt = 0; attempt < 20; attempt++) {
      const before = context.currentTime
      analyser.getFloatTimeDomainData(samples)
      if (context.currentTime === before)
        return {
          sampleRate: context.sampleRate,
          endFrame: Math.round(before * context.sampleRate),
          samples: Array.from(samples),
        }
    }
    throw new Error('The audio clock did not hold still for a capture.')
  })
  return {
    sampleRate: raw.sampleRate,
    startFrame: raw.endFrame - raw.samples.length,
    samples: Float32Array.from(raw.samples),
  }
}

/** Buffer sources started on the tapped context, and those not ended yet. */
export async function liveSources(
  page: Page,
): Promise<{ created: number; live: number }> {
  return page.evaluate(() => ({
    created: window.__studioCapture?.sources.created ?? 0,
    live: window.__studioCapture?.sources.live.size ?? 0,
  }))
}

const db = (power: number) => (power > 0 ? 10 * Math.log10(power) : -120)

/** Mean power over each window of `windowFrames`, stepping by `stepFrames`: both whole frames. */
function powerTrace(
  capture: StudioCapture,
  windowFrames: number,
  stepFrames: number,
): { frame: number; power: number }[] {
  const { samples, startFrame } = capture
  const trace: { frame: number; power: number }[] = []
  for (let at = 0; at + windowFrames <= samples.length; at += stepFrames) {
    let sum = 0
    for (let i = at; i < at + windowFrames; i++) sum += samples[i] * samples[i]
    trace.push({ frame: startFrame + at, power: sum / windowFrames })
  }
  return trace
}

/** Amplitude of one frequency over `windowFrames` from `at` (Goertzel), both whole frames. */
function toneAmplitude(
  capture: StudioCapture,
  at: number,
  windowFrames: number,
  hz: number,
): number {
  const k = (2 * Math.PI * hz) / capture.sampleRate
  const coefficient = 2 * Math.cos(k)
  let previous = 0
  let before = 0
  for (let i = at; i < at + windowFrames; i++) {
    const next = capture.samples[i] + coefficient * previous - before
    before = previous
    previous = next
  }
  const real = previous - before * Math.cos(k)
  const imaginary = before * Math.sin(k)
  return (2 * Math.hypot(real, imaginary)) / windowFrames
}

/** What a seek did to the sound, read from the captured output around one click. */
export interface SeekReading {
  /** Steady level before the click and once it settled, in dBFS. */
  readonly beforeDb: number
  readonly afterDb: number
  /**
   * How far the quietest window around the change fell below the quietest
   * window of the same length while the level was steady, per window length
   * in ms: what the seek adds to the level's own ripple.
   */
  readonly dipDb: Readonly<Record<'5' | '10' | '30', number>>
  /** The longest stretch, in ms, whose 5 ms windows all sit 40 dB or more under the quieter steady level. */
  readonly silentMs: number
  /** Audio-clock ms from the click's currentTime until the new position's tone reaches half its level. */
  readonly clickToSoundMs: number | null
  /** How far the speakers trail the render clock, as the page reports it, in ms. */
  readonly outputPathMs: number
}

/**
 * Read one seek from a capture: the click's audio-clock stamp, a tone only
 * the new position plays, and the level before the click against the level
 * from `settleMs` after it. Windows step every millisecond.
 *
 * Every window, step and position is a whole frame. A millisecond is 48
 * frames at 48 kHz but 44.1 at 44.1 kHz, the rate of a machine with no
 * sound card, such as the CI runner: there, fractional positions read
 * samples that do not exist, every power came out NaN, the dip and silence
 * read zero and no tone was found. A capture that does not hold the click
 * and the settled level, or that reads as no level at all, throws.
 */
export function readSeek(
  capture: StudioCapture,
  click: StudioClickStamp,
  newHz: number,
  settleMs: number,
): SeekReading {
  const frames = (milliseconds: number) =>
    Math.max(1, Math.round((milliseconds * capture.sampleRate) / 1000))
  const toMs = (count: number) => (count * 1000) / capture.sampleRate
  const step = frames(1)
  const clickFrame = Math.round(click.contextTime * capture.sampleRate)
  const settledFrame = clickFrame + frames(settleMs)
  const settledAt = settledFrame - capture.startFrame
  if (
    clickFrame - frames(30) < capture.startFrame ||
    settledAt + frames(30) > capture.samples.length
  )
    throw new Error(
      'The capture does not hold the click and the settled level after it.',
    )
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const trace5 = powerTrace(capture, frames(5), step)
  const beforeDb = db(
    median(
      trace5
        .filter(({ frame }) => frame < clickFrame - frames(5))
        .map(({ power }) => power),
    ),
  )
  const afterDb = db(
    median(
      trace5
        .filter(({ frame }) => frame >= settledFrame)
        .map(({ power }) => power),
    ),
  )
  if (
    !Number.isFinite(beforeDb + afterDb) ||
    Math.min(beforeDb, afterDb) <= -120
  )
    throw new Error('The capture holds no level to read a seek from.')
  const floor = Math.min(beforeDb, afterDb)
  const dip = (windowMs: number) => {
    const windowFrames = frames(windowMs)
    const windows = powerTrace(capture, windowFrames, step)
    const quietest = (keep: (frame: number) => boolean) =>
      Math.min(
        ...windows.filter(({ frame }) => keep(frame)).map(({ power }) => power),
      )
    const steady = Math.min(
      quietest((frame) => frame + windowFrames <= clickFrame),
      quietest((frame) => frame >= settledFrame),
    )
    const around = quietest(
      (frame) => frame + windowFrames > clickFrame && frame < settledFrame,
    )
    return Math.max(0, db(steady) - db(around))
  }
  let silentSteps = 0
  let run = 0
  for (const { frame, power } of trace5) {
    if (frame < clickFrame || frame >= settledFrame) continue
    run = db(power) <= floor - 40 ? run + 1 : 0
    silentSteps = Math.max(silentSteps, run)
  }
  // The new tone's settled amplitude, then the first 5 ms window holding half
  // of it: by then half the window holds the new tone, so time its middle.
  const windowFrames = frames(5)
  const target = toneAmplitude(capture, settledAt, frames(20), newHz)
  let clickToSoundMs: number | null = null
  for (
    let at = clickFrame - capture.startFrame;
    at + windowFrames < settledAt;
    at += frames(0.25)
  ) {
    if (toneAmplitude(capture, at, windowFrames, newHz) >= target / 2) {
      clickToSoundMs = toMs(
        capture.startFrame + at + windowFrames / 2 - clickFrame,
      )
      break
    }
  }
  return {
    beforeDb,
    afterDb,
    dipDb: { '5': dip(5), '10': dip(10), '30': dip(30) },
    silentMs: toMs(silentSteps * step),
    clickToSoundMs,
    outputPathMs:
      (click.contextTime -
        (click.outputContextTime +
          (click.performanceMs - click.outputPerformanceMs) / 1000)) *
      1000,
  }
}
