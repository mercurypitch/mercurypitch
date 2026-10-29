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
import { captureSpan, frameClock, rms } from './studio-output-span'

declare global {
  interface Window {
    __studioPerf?: {
      longTasks: { start: number; duration: number }[]
      frames: number[] | null
      presses: number[]
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
    const out = process.env.STUDIO_PERF_OUT ?? 'studio-perf.json'
    writeFileSync(
      out.replace(/\.json$/, '') + `-${name}.cpuprofile`,
      JSON.stringify(samples),
    )
  }
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
 * When the song was heard after a press of Play: the press's performance
 * time placed on the audio clock through getOutputTimestamp, which says
 * which audio-clock time the speakers play at a given performance time, so
 * the reading counts the output path too. Call it right after the press:
 * the capture holds only the last 680 ms.
 */
export async function firstSoundAfter(
  page: Page,
  pressMs: number,
  settleMs = 1000,
): Promise<FirstSoundReading> {
  await page.waitForFunction(
    () => (window.__studioCapture?.context.currentTime ?? 0) > 0,
  )
  const clock = await page.evaluate((press) => {
    const { context } = window.__studioCapture!
    const output = context.getOutputTimestamp()
    const contextTime = output.contextTime ?? context.currentTime
    const performanceTime = output.performanceTime ?? performance.now()
    return {
      pressAt: contextTime - (performanceTime - press) / 1000,
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency,
      outputLatency: context.outputLatency,
    }
  }, pressMs)
  const from = Math.max(0, clock.pressAt - 0.03)
  const capture = await captureSpan(
    page,
    from,
    clock.pressAt + settleMs / 1000 + 0.05,
  )
  const { frames, toMs } = frameClock(capture)
  const pressIndex =
    Math.round(clock.pressAt * capture.sampleRate) - capture.startFrame
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
    sampleRate: clock.sampleRate,
    baseLatencyMs: round(clock.baseLatency * 1000),
    outputLatencyMs: round(clock.outputLatency * 1000),
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
