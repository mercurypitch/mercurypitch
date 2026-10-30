// ============================================================
// Studio playback quality — Auto, Best, Balanced or Light, chosen per device
// ============================================================
//
// Live playback runs every lane's effects on one audio thread, and a slow
// device runs out of it: the sound breaks up. A tier trades effect work for
// headroom (TIER_PROFILES, fx-profile.ts), and every tier keeps each
// chain's latency, so lanes stay in line. A run keeps the tier it was built
// with: a change applies from the next Play, as a paused graph of another
// tier is built again (kept-run.ts). Export always renders at Best, the
// full chains, whatever the tier.
//
// The choice is the device's, not the project's: it is kept in this
// browser's storage, and a project opened elsewhere plays at that device's
// tier. Auto picks from what the browser says about the device (cores,
// memory) and a short offline render of a voice chain, measured once, kept,
// and used from the next session: within a session the tier changes only by
// the listener's choice or a step down, so a paused graph is never built
// again for a measurement. While playing on Auto, a run of underruns (the
// browser's playout statistics, where it has them) steps down one tier for
// the session, with a notice; the next session starts from Auto's own pick
// again.
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'

export const PLAYBACK_TIERS = ['best', 'balanced', 'light'] as const
export type StudioPlaybackTier = (typeof PLAYBACK_TIERS)[number]
export type StudioPlaybackChoice = 'auto' | StudioPlaybackTier

export const PLAYBACK_TIER_LABELS: Readonly<
  Record<StudioPlaybackChoice, string>
> = {
  auto: 'Auto',
  best: 'Best',
  balanced: 'Balanced',
  light: 'Light',
}

/** What each tier asks of the live chains. Best is the full chains export renders. */
export const TIER_PROFILES: Readonly<
  Record<StudioPlaybackTier, StudioFxProfile>
> = {
  best: FULL_FX_PROFILE,
  balanced: {
    id: 'balanced',
    oversample: { saturation: '4x', exciter: 'none', limiter: 'none' },
    reverbBus: true,
    lite: [],
  },
  light: {
    id: 'light',
    oversample: { saturation: '2x', exciter: 'none', limiter: 'none' },
    reverbBus: true,
    lite: ['dyneq', 'deesser'],
  },
}

/** What the browser tells about the device, and what the benchmark measured. */
export interface StudioDeviceHints {
  /** navigator.hardwareConcurrency */
  readonly cores?: number
  /** navigator.deviceMemory, in GB (Chromium only, capped at 8) */
  readonly memoryGb?: number
  /** One voice chain's offline render cost here, in microseconds per 128 frames. */
  readonly voiceChainUs?: number
}

/** A 128-frame quantum at 48 kHz, in microseconds: the audio thread's budget for one. */
const QUANTUM_US = (128 / 48000) * 1e6
/**
 * A 12-lane song (the medium profiling fixture, with the live master)
 * costs this many voice chains at each tier: 10.3, 8.0 and 5.8, rendered
 * offline in Chromium 148 on 30 Oct 2026.
 */
export const SONG_IN_VOICE_CHAINS: Readonly<
  Record<StudioPlaybackTier, number>
> = {
  best: 10,
  balanced: 8,
  light: 6,
}
/** Auto leaves this much of the audio thread free for everything else it does. */
const AUTO_LOAD_CEILING = 0.5

function lower(
  a: StudioPlaybackTier,
  b: StudioPlaybackTier,
): StudioPlaybackTier {
  return PLAYBACK_TIERS[
    Math.max(PLAYBACK_TIERS.indexOf(a), PLAYBACK_TIERS.indexOf(b))
  ]
}

/** The tier the device itself allows: little memory or few cores cap it. */
function hintedTier({
  cores,
  memoryGb,
}: StudioDeviceHints): StudioPlaybackTier {
  if ((memoryGb ?? 8) < 4 || (cores ?? 8) < 4) return 'light'
  if ((memoryGb ?? 8) < 8 || (cores ?? 8) < 8) return 'balanced'
  return 'best'
}

/**
 * The most one voice chain may cost here, offline in microseconds per 128
 * frames, for Auto to pick `tier`: a 12-lane song then uses at most half
 * the audio thread.
 */
export function autoTierLimitUs(tier: StudioPlaybackTier): number {
  return (AUTO_LOAD_CEILING * QUANTUM_US) / SONG_IN_VOICE_CHAINS[tier]
}

/** The best tier whose limit the measured voice chain is within. */
function measuredTier(voiceChainUs: number): StudioPlaybackTier {
  return (
    PLAYBACK_TIERS.find((tier) => voiceChainUs <= autoTierLimitUs(tier)) ??
    'light'
  )
}

/**
 * Auto's pick: the lower of what the hints allow and what the benchmark
 * measured. Without a benchmark yet, Balanced at most: Best needs the
 * device to show it can carry it.
 */
export function pickAutoTier(hints: StudioDeviceHints): StudioPlaybackTier {
  const hinted = hintedTier(hints)
  const measured =
    hints.voiceChainUs !== undefined && Number.isFinite(hints.voiceChainUs)
      ? measuredTier(hints.voiceChainUs)
      : 'balanced'
  return lower(hinted, measured)
}

/** One tier down, Light the floor. */
export function stepDown(tier: StudioPlaybackTier): StudioPlaybackTier {
  return PLAYBACK_TIERS[
    Math.min(PLAYBACK_TIERS.indexOf(tier) + 1, PLAYBACK_TIERS.length - 1)
  ]
}

/** What a run of fallback (underrun) events must be to step down. */
const UNDERRUN_EVENTS = 3
const UNDERRUN_WINDOW_MS = 5000
/** Playing time a tier gets before its underruns count: a start can stutter once. */
const SETTLE_MS = 2000

/** The browser's playout statistics: AudioContext.playoutStats in Chromium. */
export interface StudioPlayoutStats {
  readonly fallbackFramesEvents: number
}

/**
 * Watches underruns while playing: true once `UNDERRUN_EVENTS` new fallback
 * events land within `UNDERRUN_WINDOW_MS` of playing at one tier.
 */
export function createUnderrunWatch() {
  let since = -Infinity
  let base: number | null = null
  const events: number[] = []
  return {
    /** A tier starts (or starts again): its first moments do not count. */
    restart(now: number): void {
      since = now
      base = null
      events.length = 0
    },
    /** Feed a reading taken while playing; true when it is time to step down. */
    read(stats: StudioPlayoutStats, now: number): boolean {
      const count = stats.fallbackFramesEvents
      if (!Number.isFinite(count)) return false
      if (now - since < SETTLE_MS || base === null || count < base) {
        base = count
        return false
      }
      for (let i = base; i < count; i++) events.push(now)
      base = count
      while (events.length > 0 && now - events[0] > UNDERRUN_WINDOW_MS)
        events.shift()
      return events.length >= UNDERRUN_EVENTS
    },
  }
}

const CHOICE_KEY = 'mercurypitch.studio.playbackQuality'
const BENCHMARK_KEY = 'mercurypitch.studio.playbackBenchmark'
/** Bump when the benchmark chain or its scale changes, so old results are measured again. */
const BENCHMARK_VERSION = 1

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readStoredChoice(): StudioPlaybackChoice {
  try {
    const value = storage()?.getItem(CHOICE_KEY)
    return value === 'best' || value === 'balanced' || value === 'light'
      ? value
      : 'auto'
  } catch {
    return 'auto'
  }
}

function storeChoice(choice: StudioPlaybackChoice): void {
  try {
    if (choice === 'auto') storage()?.removeItem(CHOICE_KEY)
    else storage()?.setItem(CHOICE_KEY, choice)
  } catch {
    // Private mode or storage off: the choice lasts this session.
  }
}

export function readStoredBenchmark(): number | undefined {
  try {
    const raw = storage()?.getItem(BENCHMARK_KEY)
    if (raw === null || raw === undefined || raw === '') return undefined
    const parsed = JSON.parse(raw) as {
      version?: number
      voiceChainUs?: number
    }
    return parsed.version === BENCHMARK_VERSION &&
      typeof parsed.voiceChainUs === 'number' &&
      parsed.voiceChainUs > 0
      ? parsed.voiceChainUs
      : undefined
  } catch {
    return undefined
  }
}

function storeBenchmark(voiceChainUs: number): void {
  try {
    storage()?.setItem(
      BENCHMARK_KEY,
      JSON.stringify({ version: BENCHMARK_VERSION, voiceChainUs }),
    )
  } catch {
    // Measured again next session.
  }
}

function browserHints(): StudioDeviceHints {
  if (typeof navigator === 'undefined') return {}
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    cores:
      typeof nav.hardwareConcurrency === 'number'
        ? nav.hardwareConcurrency
        : undefined,
    memoryGb:
      typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
  }
}

export interface StudioPlaybackQualityState {
  readonly choice: StudioPlaybackChoice
  /** The tier live playback runs at now. */
  readonly tier: StudioPlaybackTier
  /** Auto's own pick on this device, before any step down. */
  readonly autoTier: StudioPlaybackTier
  /** Set when Auto stepped down this session. */
  readonly notice: string | null
}

type Listener = (state: StudioPlaybackQualityState) => void

let choice: StudioPlaybackChoice = readStoredChoice()
let hints: StudioDeviceHints = {
  ...browserHints(),
  voiceChainUs: readStoredBenchmark(),
}
let steppedTo: StudioPlaybackTier | null = null
let notice: string | null = null
/** Set once this session's benchmark is in: it counts from the next session. */
let measured = false
const listeners = new Set<Listener>()
const watch = createUnderrunWatch()

function currentTier(): StudioPlaybackTier {
  if (choice !== 'auto') return choice
  const auto = pickAutoTier(hints)
  return steppedTo === null ? auto : lower(auto, steppedTo)
}

export function playbackQualityState(): StudioPlaybackQualityState {
  return {
    choice,
    tier: currentTier(),
    autoTier: pickAutoTier(hints),
    notice,
  }
}

function publish(): void {
  const state = playbackQualityState()
  for (const listener of listeners) listener(state)
}

export function subscribePlaybackQuality(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The effect profile live playback builds with now. */
export function livePlaybackProfile(): StudioFxProfile {
  return TIER_PROFILES[currentTier()]
}

/** The listener's own choice, kept on this device. A step down ends with it. */
export function setPlaybackChoice(next: StudioPlaybackChoice): void {
  choice = next
  steppedTo = null
  notice = null
  storeChoice(next)
  watch.restart(-Infinity)
  publish()
}

/** Keep the benchmark (playback-benchmark.ts) on this device, for Auto from the next session. */
export function recordPlaybackBenchmark(voiceChainUs: number): void {
  if (!(voiceChainUs > 0) || !Number.isFinite(voiceChainUs)) return
  measured = true
  storeBenchmark(voiceChainUs)
}

/** Whether Auto still needs its benchmark on this device. */
export function needsPlaybackBenchmark(): boolean {
  return !measured && hints.voiceChainUs === undefined
}

/**
 * A reading of the playing context's playout statistics, when the browser
 * has them: on Auto, a run of underruns steps down one tier for the
 * session. Called from the playing graph's schedule tick.
 */
export function notePlayout(ctx: BaseAudioContext, now: number): void {
  if (choice !== 'auto') return
  const stats = (
    ctx as BaseAudioContext & { playoutStats?: StudioPlayoutStats }
  ).playoutStats
  if (!stats) return
  if (!watch.read(stats, now)) return
  const tier = currentTier()
  if (tier === 'light') return
  steppedTo = stepDown(tier)
  notice = `Playback was breaking up, so Studio moved to ${PLAYBACK_TIER_LABELS[steppedTo]} for this session. It applies from the next Play.`
  watch.restart(now)
  publish()
}

/** Test seam: start again from storage and the browser's hints. */
export function resetPlaybackQualityForTests(
  next: StudioDeviceHints = {},
): void {
  choice = readStoredChoice()
  hints = { ...next, voiceChainUs: next.voiceChainUs ?? readStoredBenchmark() }
  steppedTo = null
  notice = null
  measured = false
  listeners.clear()
  watch.restart(-Infinity)
}
