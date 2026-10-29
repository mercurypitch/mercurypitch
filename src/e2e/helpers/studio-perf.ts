// Studio performance probes — long tasks, frame pacing, main-thread CPU per phase, audio glitches and the time from a press to the first sound.
//
// Read the same way against any build, so a change is judged by numbers taken
// before and after it. Every reading comes from the browser: long tasks from
// the Long Tasks API, CPU from Chromium's own counters over the DevTools
// protocol (thread time, not wall time), frames from requestAnimationFrame,
// underruns from AudioContext.playbackStats where Chromium has it, and the
// first sound from what the page sent to its speakers (studio-output-capture).
import { writeFileSync } from 'node:fs'
import type { CDPSession, Page } from '@playwright/test'
import type { StudioCapture } from './studio-output-capture'
import { frameClock, rms } from './studio-output-span'

declare global {
  interface Window {
    __studioPerf?: {
      longTasks: { start: number; duration: number }[]
      frames: number[] | null
      presses: number[]
    }
    __studioRecorder?: {
      /** The clock followed: the newest one the page connected to its speakers. */
      context: AudioContext | null
      /** The audio-clock frame of the first copied sample. */
      startFrame: number
      /** The frame after the last one copied. */
      filled: number
      parts: Float32Array[]
      /** The first frame on this clock that was not silent, or -1. */
      heardFrame: number
      error: string | null
      stopped: boolean
    }
  }
}

/** Record every long task, and the moment of every pointer press, from the first script on. */
export async function installPerfProbes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const perf: NonNullable<Window['__studioPerf']> = {
      longTasks: [],
      frames: null,
      presses: [],
    }
    window.__studioPerf = perf
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          perf.longTasks.push({
            start: entry.startTime,
            duration: entry.duration,
          })
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      /* No Long Tasks API: the readings say so with a null. */
    }
    window.addEventListener(
      'pointerdown',
      () => perf.presses.push(performance.now()),
      { capture: true },
    )
  })
}

export interface LongTaskReading {
  readonly count: number
  readonly maxMs: number
  readonly totalMs: number
  /** Each task's time past 50 ms, summed: Lighthouse's total blocking time. */
  readonly blockingMs: number
}

export interface FrameReading {
  readonly count: number
  readonly p50Ms: number
  readonly p95Ms: number
  readonly maxMs: number
  /** Frames that took longer than two 60 Hz frames: a visible stutter. */
  readonly over33: number
}

export interface CpuReading {
  /** Main-thread time in tasks, script, layout and style, per second of the phase. */
  readonly taskMsPerS: number
  readonly scriptMsPerS: number
  readonly layoutMsPerS: number
  readonly styleMsPerS: number
}

export interface PhaseReading {
  readonly wallMs: number
  readonly longTasks: LongTaskReading
  readonly cpu: CpuReading
  readonly frames: FrameReading | null
  readonly heapMb: number
}

const percentile = (sorted: number[], share: number) =>
  sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]

const round = (value: number, places = 1) =>
  Math.round(value * 10 ** places) / 10 ** places

async function cpuMetrics(cdp: CDPSession): Promise<Map<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return new Map(metrics.map(({ name, value }) => [name, value]))
}

/** A DevTools session that counts main-thread CPU time. */
export async function openCpuCounters(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' })
  return cdp
}

async function startFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const perf = window.__studioPerf!
    const frames: number[] = []
    perf.frames = frames
    const tick = (time: number) => {
      if (perf.frames !== frames) return
      frames.push(time)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function stopFrames(page: Page): Promise<FrameReading> {
  const times = await page.evaluate(() => {
    const frames = window.__studioPerf!.frames ?? []
    window.__studioPerf!.frames = null
    return frames
  })
  const gaps = times.slice(1).map((time, index) => time - times[index])
  const sorted = [...gaps].sort((a, b) => a - b)
  return {
    count: gaps.length,
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted.at(-1) ?? 0),
    over33: gaps.filter((gap) => gap > 33.4).length,
  }
}

/** Phases named in STUDIO_PERF_PROFILE (comma separated) are also sampled by the profiler. */
function profiled(name: string): boolean {
  return (process.env.STUDIO_PERF_PROFILE ?? '').split(',').includes(name)
}

/** Phases named in STUDIO_PERF_TRACE also record a Chromium trace: style, layout and what invalidated them. */
function traced(name: string): boolean {
  return (process.env.STUDIO_PERF_TRACE ?? '').split(',').includes(name)
}

const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.invalidationTracking',
  'blink.user_timing',
]

function beside(name: string, extension: string): string {
  const out = process.env.STUDIO_PERF_OUT ?? 'studio-perf.json'
  return out.replace(/\.json$/, '') + `-${name}.${extension}`
}

/**
 * Run `action` and read what it cost the page: long tasks that started
 * during it, main-thread CPU over it, and, with `frames`, the gaps between
 * animation frames while it ran. A phase named in STUDIO_PERF_PROFILE also
 * writes a CPU profile beside STUDIO_PERF_OUT, to be read with its source maps.
 */
export async function measurePhase(
  page: Page,
  cdp: CDPSession,
  name: string,
  action: () => Promise<void>,
  options: { frames?: boolean } = {},
): Promise<PhaseReading> {
  const profile = profiled(name)
  if (profile) {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await cdp.send('Profiler.start')
  }
  const browser = traced(name) ? page.context().browser() : null
  if (browser)
    await browser.startTracing(page, {
      path: beside(name, 'trace.json'),
      categories: TRACE_CATEGORIES,
    })
  const before = await cpuMetrics(cdp)
  const from = await page.evaluate(() => performance.now())
  if (options.frames) await startFrames(page)
  await action()
  const frames = options.frames ? await stopFrames(page) : null
  // A long task is reported once it ends; give the observer a frame to run.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  )
  const to = await page.evaluate(() => performance.now())
  const after = await cpuMetrics(cdp)
  if (profile) {
    const { profile: samples } = await cdp.send('Profiler.stop')
    writeFileSync(beside(name, 'cpuprofile'), JSON.stringify(samples))
  }
  if (browser) await browser.stopTracing()
  const tasks = await page.evaluate(
    ([start, end]) =>
      window.__studioPerf!.longTasks.filter(
        (task) => task.start >= start && task.start < end,
      ),
    [from, to],
  )
  const seconds = Math.max(0.001, (to - from) / 1000)
  const perSecond = (name: string) =>
    round((((after.get(name) ?? 0) - (before.get(name) ?? 0)) * 1000) / seconds)
  return {
    wallMs: Math.round(to - from),
    longTasks: {
      count: tasks.length,
      maxMs: Math.round(Math.max(0, ...tasks.map((task) => task.duration))),
      totalMs: Math.round(tasks.reduce((sum, task) => sum + task.duration, 0)),
      blockingMs: Math.round(
        tasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
      ),
    },
    cpu: {
      taskMsPerS: perSecond('TaskDuration'),
      scriptMsPerS: perSecond('ScriptDuration'),
      layoutMsPerS: perSecond('LayoutDuration'),
      styleMsPerS: perSecond('RecalcStyleDuration'),
    },
    frames,
    heapMb: round((after.get('JSHeapUsedSize') ?? 0) / 2 ** 20),
  }
}

export interface GlitchReading {
  readonly supported: boolean
  readonly underrunEvents: number | null
  readonly underrunMs: number | null
}

/** Underruns counted by the context the page plays through, where Chromium exposes them. */
export async function readGlitches(page: Page): Promise<GlitchReading> {
  return page.evaluate(() => {
    const stats = (
      window.__studioCapture?.context as
        | (AudioContext & {
            playbackStats?: {
              underrunEvents?: number
              underrunDuration?: number
            }
          })
        | undefined
    )?.playbackStats
    if (!stats || typeof stats.underrunEvents !== 'number')
      return { supported: false, underrunEvents: null, underrunMs: null }
    return {
      supported: true,
      underrunEvents: stats.underrunEvents,
      underrunMs: (stats.underrunDuration ?? 0) * 1000,
    }
  })
}

/**
 * Copy what the page sends to its speakers every 40 ms from now on, always
 * from the newest clock it connected to them. The capture alone holds 680
 * ms, and a first Play that makes its clock in the press keeps the page busy
 * for longer than that before a spec's round trip comes back. Copied inside
 * the page, only one task longer than about 600 ms loses frames, and the
 * recorder says so.
 */
async function armOutputRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const recorder: NonNullable<Window['__studioRecorder']> = {
      context: null,
      startFrame: 0,
      filled: 0,
      parts: [],
      heardFrame: -1,
      error: null,
      stopped: false,
    }
    window.__studioRecorder = recorder
    let part = new Float32Array(0)
    let lastTick = performance.now()
    const stopAt = lastTick + 120_000
    const tick = () => {
      const now = performance.now()
      if (recorder.stopped || now > stopAt) {
        recorder.stopped = true
        return
      }
      const capture = window.__studioCapture
      if (capture?.context.state === 'running') {
        const { analyser, context } = capture
        if (part.length !== analyser.fftSize)
          part = new Float32Array(analyser.fftSize)
        const before = context.currentTime
        analyser.getFloatTimeDomainData(part)
        // The clock moves a quantum at a time: a copy it moved under waits for the next tick.
        if (context.currentTime === before) {
          const rate = context.sampleRate
          const partEnd = Math.round(before * rate)
          const partStart = partEnd - part.length
          if (recorder.context !== context) {
            // Nothing reached this clock's speakers before the last tick,
            // which saw no connection to them: the copy must reach back to then.
            const unseen = Math.round((before - (now - lastTick) / 1000) * rate)
            recorder.context = context
            recorder.parts = []
            recorder.heardFrame = -1
            recorder.error =
              partStart > Math.max(0, unseen)
                ? `The recorder reached the new clock ${partStart - Math.max(0, unseen)} frames late.`
                : null
            recorder.startFrame = recorder.filled = Math.max(0, partStart)
          }
          if (partStart > recorder.filled)
            recorder.error ??= `The copies leave ${partStart - recorder.filled} frames out at frame ${recorder.filled}.`
          else if (partEnd > recorder.filled) {
            const fresh = part.slice(recorder.filled - partStart)
            if (recorder.heardFrame < 0) {
              const at = fresh.findIndex((sample) => Math.abs(sample) > 1e-4)
              if (at >= 0) recorder.heardFrame = recorder.filled + at
            }
            recorder.parts.push(fresh)
            recorder.filled = partEnd
          }
        }
      }
      lastTick = now
      setTimeout(tick, 40)
    }
    tick()
  })
}

/** The newest pointer press, on the page's performance clock. */
export async function lastPress(page: Page): Promise<number> {
  return page.evaluate(() => window.__studioPerf!.presses.at(-1) ?? NaN)
}

export interface FirstSoundReading {
  /** Ms from the press until the output first reaches 1 % of its settled level (-40 dB), at the speakers. */
  readonly firstSoundMs: number | null
  /** The same until half of it (-6 dB). */
  readonly halfLevelMs: number | null
  readonly sampleRate: number
  readonly baseLatencyMs: number
  readonly outputLatencyMs: number
}

/**
 * When the song was heard after `pressPlay` pressed Play (it returns the
 * press's performance time): the press placed on the audio clock through
 * getOutputTimestamp, which says which audio-clock time the speakers play at
 * a given performance time, so the reading counts the output path too. A
 * first Play can make its clock inside the press; the press then lands
 * before that clock's first frame, and the time before it counts as the
 * silence it was.
 */
export async function firstSoundOf(
  page: Page,
  pressPlay: () => Promise<number>,
  settleMs = 1000,
): Promise<FirstSoundReading> {
  await armOutputRecorder(page)
  const pressMs = await pressPlay()
  const read = await page.evaluate(
    async ({ press, settle }) => {
      const recorder = window.__studioRecorder!
      const wait = () => new Promise((resolve) => setTimeout(resolve, 40))
      const deadline = performance.now() + 60_000
      try {
        // The clock that plays the song is the one that sounds after the press.
        while (recorder.heardFrame < 0) {
          if (recorder.error) return { error: recorder.error }
          if (performance.now() > deadline)
            return { error: 'Nothing sounded after the press.' }
          await wait()
        }
        const context = recorder.context!
        let output = context.getOutputTimestamp()
        while (!output.performanceTime) {
          if (performance.now() > deadline)
            return {
              error: 'The clock never said when it reached the speakers.',
            }
          await wait()
          output = context.getOutputTimestamp()
        }
        const pressAt =
          output.contextTime! - (output.performanceTime - press) / 1000
        const rate = context.sampleRate
        const first = Math.round(Math.max(0, pressAt - 0.03) * rate)
        const last = Math.round((pressAt + settle / 1000 + 0.05) * rate)
        while (recorder.filled < last) {
          if (recorder.context !== context)
            return { error: 'The page changed clocks while the song started.' }
          if (recorder.error) return { error: recorder.error }
          if (performance.now() > deadline)
            return { error: 'The audio clock stopped before the span ended.' }
          await wait()
        }
        if (recorder.error) return { error: recorder.error }
        // Frames before the first copy were silence: zeros already.
        const samples = new Float32Array(last - first)
        let frame = recorder.startFrame
        for (const part of recorder.parts) {
          const from = Math.max(frame, first)
          const to = Math.min(frame + part.length, last)
          for (let at = from; at < to; at++)
            samples[at - first] = part[at - frame]
          frame += part.length
        }
        return {
          sampleRate: rate,
          startFrame: first,
          samples: Array.from(samples),
          pressAt,
          baseLatency: context.baseLatency,
          outputLatency: context.outputLatency,
        }
      } finally {
        recorder.stopped = true
      }
    },
    { press: pressMs, settle: settleMs },
  )
  if ('error' in read) throw new Error(read.error)
  const capture: StudioCapture = {
    sampleRate: read.sampleRate,
    startFrame: read.startFrame,
    samples: Float32Array.from(read.samples),
  }
  const { frames, toMs } = frameClock(capture)
  const pressIndex =
    Math.round(read.pressAt * capture.sampleRate) - capture.startFrame
  const settledIndex = pressIndex + frames(settleMs)
  const settled = rms(capture, settledIndex, frames(40))
  const window5 = frames(5)
  const arrival = (share: number): number | null => {
    for (
      let at = Math.max(0, pressIndex);
      at + window5 <= settledIndex;
      at += frames(0.25)
    )
      if (rms(capture, at, window5) >= settled * share)
        return round(toMs(at + window5 / 2 - pressIndex))
    return null
  }
  return {
    firstSoundMs: settled > 0 ? arrival(0.01) : null,
    halfLevelMs: settled > 0 ? arrival(0.5) : null,
    sampleRate: read.sampleRate,
    baseLatencyMs: round(read.baseLatency * 1000),
    outputLatencyMs: round(read.outputLatency * 1000),
  }
}

/** A mono 16-bit take: a tone and its near octave, a slow pulse and a little seeded noise. */
export function perfTakeWav(
  seconds: number,
  hz: number,
  seed: number,
  rate = 48_000,
): Buffer {
  const frames = Math.round(rate * seconds)
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24)
  bytes.writeUInt32LE(rate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  let state = seed >>> 0
  const pulse = 1.5 + (seed % 5)
  for (let frame = 0; frame < frames; frame++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const t = frame / rate
    const envelope = 0.6 + 0.4 * Math.sin(2 * Math.PI * pulse * t)
    const sample =
      0.22 * envelope * Math.sin(2 * Math.PI * hz * t) +
      0.08 * envelope * Math.sin(2 * Math.PI * hz * 2.01 * t) +
      0.02 * (state / 2 ** 32 - 0.5)
    bytes.writeInt16LE(Math.round(sample * 32_767), 44 + frame * 2)
  }
  return bytes
}
