// Studio output tap — steady test tones, every sound the page sends to a speaker summed into one analyser, and the level traced around an action.
import { expect, type Locator, type Page } from '@playwright/test'
import { STUDIO_RATE, studioRegion } from './dedicatedstudio-fixture'

declare global {
  interface Window {
    __studioTaps?: AnalyserNode[]
    __studioSources?: number
    __studioTrace?: {
      start: number
      /** [ms since the start, mean power] every 10 ms. */
      trace: [number, number][]
      sources: number
      actionAt?: number
      done: boolean
    }
  }
}

/** Steady tones: any change in the output level comes from the mix. */
export function steadyWav(
  seconds: number,
  hz: readonly number[],
  peak: number,
): Buffer {
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
  for (let frame = 0; frame < frames; frame++) {
    let sample = 0
    for (const tone of hz)
      sample += Math.sin((2 * Math.PI * tone * frame) / STUDIO_RATE)
    bytes.writeInt16LE(
      Math.round((sample / hz.length) * peak * 32_767),
      44 + frame * 2,
    )
  }
  return bytes
}

/**
 * Everything the page sends to its speakers, summed into one analyser, and
 * every buffer source it starts there. Offline renders are left out: a
 * latency measurement renders to its own destination, and a tap there would
 * halve the mean while it runs, which reads as a 3 dB dip.
 */
export async function tapOutput(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
        const context = target.context as BaseAudioContext & {
          __studioTap?: AnalyserNode
        }
        if (!context.__studioTap) {
          context.__studioTap = context.createAnalyser()
          context.__studioTap.fftSize = 512
          window.__studioTaps = [
            ...(window.__studioTaps ?? []),
            context.__studioTap,
          ]
        }
        connect.call(this, context.__studioTap)
      }
      return result
    } as typeof AudioNode.prototype.connect
    const create = BaseAudioContext.prototype.createBufferSource
    BaseAudioContext.prototype.createBufferSource = function (
      this: BaseAudioContext,
    ) {
      if (this instanceof AudioContext)
        window.__studioSources = (window.__studioSources ?? 0) + 1
      return create.call(this)
    }
  })
}

export interface LevelTrace {
  /** Median level before the action, in dBFS. */
  before: number
  /** Median level once it has settled, in dBFS. */
  after: number
  /** How far a 30 ms average fell below the quieter of the two, in dB. */
  dip: number
  /** Buffer sources started meanwhile: a restart starts a whole new set. */
  sources: number
}

/**
 * How long after an action a trace looks for a dip, and where it ends: the
 * level after the action is the median between the two.
 */
export interface TraceWindow {
  settleMs: number
  endMs: number
}

/** The output level every 10 ms: 150 ms before `action`, and 1.35 s after it unless a window says otherwise. */
export async function traceLevel(
  page: Page,
  action: () => Promise<unknown>,
  { settleMs, endMs }: TraceWindow = { settleMs: 750, endMs: 1350 },
): Promise<LevelTrace> {
  await page.evaluate((endMs) => {
    const samples = new Float32Array(512)
    const run: NonNullable<Window['__studioTrace']> = {
      start: performance.now(),
      trace: [],
      sources: window.__studioSources ?? 0,
      done: false,
    }
    window.__studioTrace = run
    const timer = setInterval(() => {
      let sum = 0
      let count = 0
      for (const tap of window.__studioTaps ?? []) {
        if (tap.context.state !== 'running') continue
        tap.getFloatTimeDomainData(samples)
        for (const value of samples) sum += value * value
        count += samples.length
      }
      const now = performance.now() - run.start
      run.trace.push([now, count ? sum / count : 0])
      if (run.actionAt === undefined || now < run.actionAt + endMs) return
      clearInterval(timer)
      run.done = true
    }, 10)
  }, endMs)
  await page.waitForFunction(
    () => (window.__studioTrace?.trace.at(-1)?.[0] ?? 0) >= 150,
  )
  await page.evaluate(() => {
    const run = window.__studioTrace!
    run.actionAt = performance.now() - run.start
  })
  await action()
  await page.waitForFunction(() => window.__studioTrace?.done === true)
  const { trace, actionAt, sources } = await page.evaluate(() => {
    const run = window.__studioTrace!
    return {
      trace: run.trace,
      actionAt: run.actionAt!,
      sources: (window.__studioSources ?? 0) - run.sources,
    }
  })
  const db = (power: number) => (power > 0 ? 10 * Math.log10(power) : -120)
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const powers = (from: number, to: number) =>
    trace.filter(([t]) => t >= from && t < to).map(([, power]) => power)
  const before = db(median(powers(0, actionAt)))
  const after = db(median(powers(actionAt + settleMs, Infinity)))
  const during = powers(actionAt, actionAt + settleMs)
  let floor = Infinity
  for (let i = 2; i < during.length; i++)
    floor = Math.min(floor, (during[i] + during[i - 1] + during[i - 2]) / 3)
  return {
    before,
    after,
    dip: Math.min(before, after) - db(floor),
    sources,
  }
}

/** Wait out an element's own CSS animations and transitions. */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

export async function outputLevel(page: Page): Promise<number> {
  return (await traceLevel(page, async () => undefined)).after
}

export async function importSteady(
  page: Page,
  name: string,
  hz: number[],
  peak = 0.3,
) {
  const studio = studioRegion(page)
  await studio.getByLabel('Upload audio', { exact: true }).setInputFiles({
    name: `${name}.wav`,
    mimeType: 'audio/wav',
    buffer: steadyWav(40, hz, peak),
  })
  await expect(
    studio.getByRole('button', { name: `${name} details`, exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
}

export async function openDesk(page: Page): Promise<Locator> {
  await studioRegion(page)
    .getByRole('button', { name: 'Mix', exact: true })
    .click()
  const desk = studioRegion(page).getByRole('region', {
    name: 'Mix',
    exact: true,
  })
  await expect(desk).toBeVisible()
  // The desk slides up; its controls' boxes are final once it lands.
  await settled(desk)
  return desk
}
