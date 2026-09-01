// ============================================================
// What a decoded stem costs, and how much of it a device can hold
// ============================================================
//
// `decodeAudioData` returns an AudioBuffer, which is uncompressed Float32
// samples — one 32-bit float per sample per channel, resident for as long as
// the mixer holds the track. A 6 MB m4a becomes ~74 MB in memory, and the
// mixer holds every stem at once because they all have to play together.
//
// That is fine for two stems and fatal for six. The play-along part presets
// ("I play drums", "I play guitar") select `['vocal', ...parts]` — vocal plus
// every isolated band stem — so a full-band song asks a phone to hold six
// decoded stems simultaneously. On iOS the content process is killed for it,
// which is not a JavaScript error anyone can catch: the tab dies, WebKit
// reloads it, and after a few rounds it shows its own "a problem repeatedly
// occurred" page. It dies during `decodeAudioData`, which is exactly when the
// mixer is showing "Decoding audio".
//
// So the size is computed before the decode is attempted, and a load that
// cannot fit is trimmed and explained rather than run into the ceiling.

import type { DeviceClass } from '@/lib/device-tier'

/** Web Audio decodes to 32-bit floats, one per sample per channel. */
const BYTES_PER_SAMPLE = 4

/**
 * Bytes one decoded stem holds resident.
 *
 * The sample rate is the AudioContext's, not the file's — `decodeAudioData`
 * resamples to the context rate, so a 48kHz context makes a 44.1kHz file
 * bigger than its own header suggests.
 */
export function decodedStemBytes(
  durationSec: number,
  sampleRate: number,
  channels: number,
): number {
  if (
    !Number.isFinite(durationSec) ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(channels) ||
    durationSec <= 0 ||
    sampleRate <= 0 ||
    channels <= 0
  ) {
    return 0
  }
  return Math.round(durationSec * sampleRate * channels * BYTES_PER_SAMPLE)
}

export interface DecodedBudgetInput {
  deviceClass: DeviceClass
  /** `navigator.deviceMemory` in GB; Chromium only, null everywhere else. */
  deviceMemoryGb: number | null
}

/**
 * How many bytes of decoded audio this device can be asked to hold.
 *
 * Deliberately well under what the hardware has. The number that matters is
 * not the device's RAM but the browser's per-tab allowance before the OS
 * kills the process, and on iOS that is a few hundred megabytes regardless of
 * how much the phone is fitted with — a home-screen PWA gets no more than a
 * Safari tab. `deviceMemory` is absent there entirely (Chromium-only), so the
 * mobile default cannot be conditioned on it and is set for the tightest case
 * rather than the average one.
 */
export function decodedBudgetBytes(input: DecodedBudgetInput): number {
  const MB = 1024 * 1024
  if (input.deviceClass === 'desktop') {
    // Desktop browsers page rather than die. Generous, but still bounded: a
    // ten-stem song at ten minutes should not be attempted anywhere.
    return 1536 * MB
  }
  if (input.deviceClass === 'tv') return 384 * MB
  // Mobile. A reported 2GB device gets less again; everything else, including
  // every iPhone (which reports nothing), gets the conservative floor.
  if (input.deviceMemoryGb !== null && input.deviceMemoryGb <= 2)
    return 192 * MB
  return 320 * MB
}

/**
 * How many stem downloads and decodes may overlap.
 *
 * Concurrency is a memory decision, not a speed one: each in-flight stem holds
 * its compressed ArrayBuffer AND its decoded AudioBuffer at the same moment,
 * so five parallel loads mean five of each at the peak. Serialising on a phone
 * costs wall-clock and removes that multiplier.
 */
export function stemLoadConcurrency(deviceClass: DeviceClass): number {
  return deviceClass === 'desktop' ? 4 : 1
}

export interface StemFitInput {
  /** Stems already decoded and held. */
  loaded: number
  /** Stems still to load. */
  pending: number
  /** Bytes one decoded stem holds, from `decodedStemBytes`. */
  perStemBytes: number
  budgetBytes: number
}

export interface StemFit {
  /** How many of the pending stems may be loaded. */
  allowed: number
  /** Pending stems that will be skipped. */
  skipped: number
  projectedBytes: number
}

/**
 * How many of the pending stems fit in what is left of the budget.
 *
 * Never reports the already-loaded stems as skippable: by the time this is
 * asked they are decoded and resident, and pretending otherwise would trim a
 * load that has already been paid for.
 */
export function fitStems(input: StemFitInput): StemFit {
  const projectedBytes = (input.loaded + input.pending) * input.perStemBytes
  if (input.perStemBytes <= 0) {
    // No usable duration yet — do not trim on a guess.
    return { allowed: input.pending, skipped: 0, projectedBytes }
  }
  const room = input.budgetBytes - input.loaded * input.perStemBytes
  const allowed = Math.max(
    0,
    Math.min(input.pending, Math.floor(room / input.perStemBytes)),
  )
  return { allowed, skipped: input.pending - allowed, projectedBytes }
}

// ── Streamed playback ────────────────────────────────────────
//
// The other way to hold a stem: decode a few seconds at a time and schedule
// them (see `streaming-stem-voice.ts`). Then what is resident is the window
// and the lookahead, which does not grow with the song — a four-minute stem
// and a forty-minute one cost the same.

/**
 * Long enough that a phone schedules ~15 source nodes a minute per stem
 * rather than one per AAC packet, short enough that the lookahead is cheap.
 */
export const STREAMED_WINDOW_SECONDS = 4
/** Windows allowed to be scheduled but not yet finished. */
export const STREAMED_LOOKAHEAD_WINDOWS = 2

/**
 * Bytes one streamed stem holds resident for playback, excluding the peak
 * envelope the waveform draws from (which is counted separately, because it
 * is the part that scales with duration).
 */
export function streamedStemBytes(
  sampleRate: number,
  channels: number,
): number {
  if (
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(channels) ||
    sampleRate <= 0 ||
    channels <= 0
  ) {
    return 0
  }
  return Math.round(
    STREAMED_WINDOW_SECONDS *
      STREAMED_LOOKAHEAD_WINDOWS *
      sampleRate *
      channels *
      BYTES_PER_SAMPLE,
  )
}

/** Megabytes, for a log line or a sentence. */
export function mb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024))
}
