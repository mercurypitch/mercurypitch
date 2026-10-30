// ============================================================
// Studio playback benchmark — how fast this device renders a voice chain, for Auto
// ============================================================
//
// Auto (playback-quality.ts) needs to know how much effect work this device
// carries. The browser's hints (cores, memory) only bound it, so Studio
// renders the voice role's chain, the heaviest of the role chains, over a
// second of a test signal in an offline context and times it. The result,
// in microseconds per 128 frames, is kept on the device; it is measured
// again only when the benchmark itself changes.
import { roleChain } from '@/lib/studio-fx/auto-mix'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import { measureCompressorLatency } from '@/lib/studio-fx/compressor-twin'
import { withoutSafetyLimiter } from '@/lib/studio-fx/role-chains'
import { needsPlaybackBenchmark, recordPlaybackBenchmark, } from './playback-quality'

type ContextFactory = (
  options: OfflineAudioContextOptions,
) => OfflineAudioContext

const RATE = 48000
const SECONDS = 1
const QUANTUM = 128

/** A voice-like test signal: a gliding tone with a breathy band of noise. */
function testSignal(ctx: BaseAudioContext): AudioBuffer {
  const frames = RATE * SECONDS
  const buffer = ctx.createBuffer(1, frames, RATE)
  const data = buffer.getChannelData(0)
  let seed = 1
  let phase = 0
  for (let i = 0; i < frames; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const t = i / RATE
    phase += (2 * Math.PI * (196 + 60 * Math.sin(2 * Math.PI * 0.7 * t))) / RATE
    data[i] = 0.3 * Math.sin(phase) + 0.05 * (seed / 4294967296 - 0.5)
  }
  return buffer
}

async function renderOnce(createContext: ContextFactory): Promise<number> {
  const ctx = createContext({
    numberOfChannels: 2,
    length: RATE * SECONDS,
    sampleRate: RATE,
  })
  const chain = createStudioFxChain(
    ctx,
    withoutSafetyLimiter(roleChain('voice', { bpm: 120 })),
  )
  const source = ctx.createBufferSource()
  source.buffer = testSignal(ctx)
  source.connect(chain.input)
  chain.output.connect(ctx.destination)
  source.start(0)
  const started = performance.now()
  await ctx.startRendering()
  const elapsed = performance.now() - started
  chain.dispose()
  return (elapsed * 1000) / ((RATE * SECONDS) / QUANTUM)
}

/**
 * Microseconds this device spends rendering one voice chain for 128
 * frames, the faster of two renders (the first warms the engine up); null
 * where offline rendering is not available.
 */
export async function benchmarkVoiceChain(
  createContext: ContextFactory = (options) => new OfflineAudioContext(options),
): Promise<number | null> {
  try {
    // Live chains run their twins as delays once this is measured; so does this one.
    await measureCompressorLatency(RATE)
    const first = await renderOnce(createContext)
    const second = await renderOnce(createContext)
    const best = Math.min(first, second)
    return Number.isFinite(best) && best > 0 ? best : null
  } catch {
    return null
  }
}

/** How long the benchmark waits after Studio opens, and between checks while playing. */
const BENCHMARK_WAIT_MS = 3000
let benchmarked = false

export interface StudioBenchmarkSchedule {
  /** True while playing: the benchmark waits, so it never competes with playback. */
  readonly busy: () => boolean
  readonly run?: () => Promise<number | null>
  readonly wait?: (callback: () => void, delayMs: number) => () => void
}

/**
 * Run the benchmark once a session, a few seconds after Studio opens and
 * never while it plays, when Auto still needs it on this device. Returns a
 * cancel for a Studio that closes first.
 */
export function schedulePlaybackBenchmark({
  busy,
  run = benchmarkVoiceChain,
  wait = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs)
    return () => clearTimeout(timer)
  },
}: StudioBenchmarkSchedule): () => void {
  if (benchmarked || !needsPlaybackBenchmark()) return () => {}
  let cancel = (): void => {}
  const attempt = (): void => {
    if (busy()) {
      cancel = wait(attempt, BENCHMARK_WAIT_MS)
      return
    }
    benchmarked = true
    void run().then((voiceChainUs) => {
      if (voiceChainUs !== null) recordPlaybackBenchmark(voiceChainUs)
    })
  }
  cancel = wait(attempt, BENCHMARK_WAIT_MS)
  return () => cancel()
}

/** Test seam: allow another benchmark this session. */
export function resetPlaybackBenchmarkForTests(): void {
  benchmarked = false
}
