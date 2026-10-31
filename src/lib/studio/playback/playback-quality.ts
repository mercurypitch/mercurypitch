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
// tier. Auto picks per song: the best tier whose estimated load
// (song-load.ts) stays under AUTO_LOAD_CEILING of the audio thread, from
// the lanes that sound and a short offline render of a voice chain, measured
// once on the device and kept. Until that render is in, the browser's hints
// (cores, memory) cap the tier. While playing on Auto, a run of underruns
// (the browser's playout statistics, where it has them) steps down one tier
// for the session, with a notice; the next session starts from Auto's own
// pick again.
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import type { StudioPlaybackTier } from './playback-tiers'
import { PLAYBACK_TIERS } from './playback-tiers'
import type { StudioSongShape } from './song-load'
import { songLoad, studioSongChains } from './song-load'

export type { StudioPlaybackTier } from './playback-tiers'
export { PLAYBACK_TIERS } from './playback-tiers'
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

/**
 * Auto keeps a song's estimated load (song-load.ts) under this share of
 * the audio thread. On this desktop the 12-lane fixture played clean at
 * Light (49.9 % of the thread) and underran at Balanced (63.4 %), where
 * the estimate reads 59.8 to 66.6 % over the benchmark's spread (161.9 to
 * 180.3 us): at 60 % Auto would sometimes pick Balanced there, at 55 % it
 * never does.
 */
export const AUTO_LOAD_CEILING = 0.55

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
 * Auto's pick for a song: the best tier whose estimated load on this device
 * stays under AUTO_LOAD_CEILING, Light when none does. Before the device's
 * benchmark is in, the browser's hints cap it, and Balanced at most: Best
 * needs the device to show it can carry it.
 */
export function pickAutoTier(
  hints: StudioDeviceHints,
  song: StudioSongShape,
): StudioPlaybackTier {
  const { voiceChainUs } = hints
  if (voiceChainUs === undefined || !(voiceChainUs > 0))
    return lower(hintedTier(hints), 'balanced')
  const chains = studioSongChains(song)
  return (
    PLAYBACK_TIERS.find(
      (tier) => songLoad(chains, tier, voiceChainUs) <= AUTO_LOAD_CEILING,
    ) ?? 'light'
  )
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

/** What Auto knows, beyond the song: a new object whenever any of it changes. */
export interface StudioPlaybackQualityState {
  readonly choice: StudioPlaybackChoice
  /** The tier Auto stepped down to for underruns this session, if it did. */
  readonly steppedTo: StudioPlaybackTier | null
  /** Whether this device's benchmark is in, so Auto can size each song. */
  readonly measured: boolean
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
const listeners = new Set<Listener>()
const watch = createUnderrunWatch()

/** This device's measured voice chain in microseconds per 128 frames, once the benchmark is in. */
export function playbackVoiceChainUs(): number | undefined {
  return hints.voiceChainUs
}

/** The tier Auto plays `song` at: its own pick, under any step down this session. */
export function autoPlaybackTier(song: StudioSongShape): StudioPlaybackTier {
  const auto = pickAutoTier(hints, song)
  return steppedTo === null ? auto : lower(auto, steppedTo)
}

/** The tier live playback builds `song` at now. */
export function livePlaybackTier(song: StudioSongShape): StudioPlaybackTier {
  return choice === 'auto' ? autoPlaybackTier(song) : choice
}

/** The effect profile live playback builds `song` with now. */
export function livePlaybackProfile(song: StudioSongShape): StudioFxProfile {
  return TIER_PROFILES[livePlaybackTier(song)]
}

export function playbackQualityState(): StudioPlaybackQualityState {
  return {
    choice,
    steppedTo,
    measured: hints.voiceChainUs !== undefined,
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

/** The listener's own choice, kept on this device. A step down ends with it. */
export function setPlaybackChoice(next: StudioPlaybackChoice): void {
  choice = next
  steppedTo = null
  notice = null
  storeChoice(next)
  watch.restart(-Infinity)
  publish()
}

/**
 * Keep the benchmark (playback-benchmark.ts) on this device. Auto sizes
 * songs with it from the next Play: a paused graph built at the tier the
 * hints allowed is built again if the song's tier differs.
 */
export function recordPlaybackBenchmark(voiceChainUs: number): void {
  if (!(voiceChainUs > 0) || !Number.isFinite(voiceChainUs)) return
  hints = { ...hints, voiceChainUs }
  storeBenchmark(voiceChainUs)
  publish()
}

/** Whether Auto still needs its benchmark on this device. */
export function needsPlaybackBenchmark(): boolean {
  return hints.voiceChainUs === undefined
}

/**
 * A reading of the playing context's playout statistics, when the browser
 * has them: on Auto, a run of underruns while a run built at `tier` plays
 * steps down one tier from it for the session. Called from the playing
 * graph's schedule tick. A run built before a step down plays on at its own
 * tier until the next Play, so its underruns do not step down again.
 */
export function notePlayout(
  ctx: BaseAudioContext,
  now: number,
  tier: StudioPlaybackTier,
): void {
  if (choice !== 'auto') return
  const stats = (
    ctx as BaseAudioContext & { playoutStats?: StudioPlayoutStats }
  ).playoutStats
  if (!stats) return
  if (!watch.read(stats, now)) return
  watch.restart(now)
  const next = stepDown(tier)
  if (
    next === tier ||
    (steppedTo !== null && lower(next, steppedTo) === steppedTo)
  )
    return
  steppedTo = next
  notice = `Playback was breaking up, so Studio moved to ${PLAYBACK_TIER_LABELS[next]} for this session. It applies from the next Play.`
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
  listeners.clear()
  watch.restart(-Infinity)
}
