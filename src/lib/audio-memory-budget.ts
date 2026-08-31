// ============================================================
// Audio memory budgets — one device-aware source for every play-along ceiling
// ============================================================
//
// Two different ceilings guard prepared-song playback, and they are not the
// same number:
//
//   encoded  — the stored blob bytes pulled out of IndexedDB in one load.
//   decoded  — Float32 PCM held in RAM, `duration x rate x channels x 4`.
//
// For the WAV stems the separation pipeline writes, decoded is about twice
// encoded. For an MP3 original it is closer to ten times, which is why one
// constant could never serve both.
//
// WHAT THE BROWSER WILL AND WILL NOT TELL US
//
// `navigator.deviceMemory` is quantised to a power of two and **clamped to 8**
// by the Device Memory spec, so a 64 GB workstation reports exactly the same
// `8` as an 8 GB laptop. Firefox and Safari do not implement it at all.
// `performance.memory` is Chrome-only and measures the JS heap, which is not
// where AudioBuffers live. So the honest ceiling of our knowledge is
// "mobile or not, and at least this much" — never the real figure.
//
// That is why the desktop tier is deliberately generous rather than computed:
// on a machine that reports 8 we cannot tell 8 GB from 64 GB, and refusing to
// open a song on a workstation is the worse error. `setNativeDeviceMemoryGb`
// is the seam for a native shell that CAN read the real figure.

const MIB = 1024 * 1024
const GIB = 1024 * MIB

export type AudioDeviceClass = 'mobile' | 'desktop'

export interface AudioMemoryBudget {
  readonly deviceClass: AudioDeviceClass
  /** What the platform admitted to, in GiB. Null when it will not say. */
  readonly reportedMemoryGb: number | null
  /** True once a native shell has supplied the real figure. */
  readonly fromNativeReport: boolean
  readonly encodedBytes: number
  readonly decodedBytes: number
}

interface DeviceMemoryEnvironment {
  readonly deviceMemoryGb?: number | undefined
  readonly mobile?: boolean | undefined
  readonly matchesNarrow?: boolean | undefined
}

let nativeMemoryGb: number | null = null

/**
 * Supplied by a native shell (Capacitor and friends) that can read real device
 * RAM. Pass null to fall back to what the browser reports. Set this before the
 * first prepared song opens; budgets are computed per load, not cached.
 */
export function setNativeDeviceMemoryGb(gb: number | null): void {
  nativeMemoryGb = gb !== null && Number.isFinite(gb) && gb > 0 ? gb : null
}

export function nativeDeviceMemoryGb(): number | null {
  return nativeMemoryGb
}

function readEnvironment(): DeviceMemoryEnvironment {
  if (typeof navigator === 'undefined') return {}
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  const uaData = (navigator as { userAgentData?: { mobile?: boolean } })
    .userAgentData
  const matchesNarrow =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)').matches
      : undefined
  return {
    deviceMemoryGb: typeof memory === 'number' ? memory : undefined,
    mobile: typeof uaData?.mobile === 'boolean' ? uaData.mobile : undefined,
    matchesNarrow,
  }
}

/**
 * Width, not `(pointer: coarse)`. A touchscreen laptop answers coarse and has
 * desktop memory; treating it as a phone would halve its ceiling for nothing.
 */
function classifyDevice(
  environment: DeviceMemoryEnvironment,
): AudioDeviceClass {
  if (environment.mobile === true) return 'mobile'
  if (environment.mobile === false) return 'desktop'
  return environment.matchesNarrow === true ? 'mobile' : 'desktop'
}

function budgetFor(
  deviceClass: AudioDeviceClass,
  memoryGb: number | null,
): { encodedBytes: number; decodedBytes: number } {
  if (deviceClass === 'mobile') {
    // A phone renderer is killed, not warned, when it overcommits. These stay
    // conservative until a native shell reports something better.
    if (memoryGb !== null && memoryGb <= 2) {
      return { encodedBytes: 128 * MIB, decodedBytes: 192 * MIB }
    }
    return { encodedBytes: 256 * MIB, decodedBytes: 384 * MIB }
  }
  if (memoryGb !== null && memoryGb <= 2) {
    return { encodedBytes: 384 * MIB, decodedBytes: 512 * MIB }
  }
  if (memoryGb !== null && memoryGb <= 4) {
    return { encodedBytes: 1 * GIB, decodedBytes: 2 * GIB }
  }
  // 8-or-more, or a browser that will not say. Generous, but still bounded:
  // a renderer that overcommits crashes the tab with no message at all, which
  // is a worse outcome than an honest "too large" for a genuinely huge song.
  return { encodedBytes: 2 * GIB, decodedBytes: 4 * GIB }
}

export function audioMemoryBudget(
  overrides: DeviceMemoryEnvironment = {},
): AudioMemoryBudget {
  const environment = { ...readEnvironment(), ...overrides }
  const deviceClass = classifyDevice(environment)
  const reportedMemoryGb =
    nativeMemoryGb ??
    (typeof environment.deviceMemoryGb === 'number' &&
    Number.isFinite(environment.deviceMemoryGb) &&
    environment.deviceMemoryGb > 0
      ? environment.deviceMemoryGb
      : null)
  return {
    deviceClass,
    reportedMemoryGb,
    fromNativeReport: nativeMemoryGb !== null,
    ...budgetFor(deviceClass, reportedMemoryGb),
  }
}

export function encodedAudioBudgetBytes(): number {
  return audioMemoryBudget().encodedBytes
}

export function decodedAudioBudgetBytes(): number {
  return audioMemoryBudget().decodedBytes
}
