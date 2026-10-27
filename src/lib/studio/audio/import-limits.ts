// ============================================================
// Studio import limits — bounded preparation and explicit cancellation checkpoints
// ============================================================

export interface StudioImportLimits {
  maxEncodedBytes: number
  maxFrames: number
  maxWorkingBytes: number
}

// Engineering admission limits, not a claim about measured device capacity.
// Native decodeAudioData may allocate before it reports its actual dimensions.
export const DEFAULT_STUDIO_IMPORT_LIMITS: Readonly<StudioImportLimits> = {
  maxEncodedBytes: 64 * 1024 * 1024,
  maxFrames: 48_000 * 300,
  maxWorkingBytes: 512 * 1024 * 1024,
}

export function importLimits(
  overrides: Partial<StudioImportLimits> = {},
): StudioImportLimits {
  const limits = { ...DEFAULT_STUDIO_IMPORT_LIMITS, ...overrides }
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error('Studio import limits must be positive safe integers')
    }
  }
  if (
    limits.maxFrames > DEFAULT_STUDIO_IMPORT_LIMITS.maxFrames ||
    limits.maxEncodedBytes > DEFAULT_STUDIO_IMPORT_LIMITS.maxEncodedBytes ||
    limits.maxWorkingBytes > DEFAULT_STUDIO_IMPORT_LIMITS.maxWorkingBytes
  ) {
    throw new Error('Studio import limits cannot exceed the supported maximum')
  }
  return limits
}

export function checkImportCancelled(signal?: AbortSignal): void {
  if (signal?.aborted === true)
    throw new DOMException('Studio import cancelled', 'AbortError')
}

export function admitWorkingBytes(
  bytes: number,
  limits: StudioImportLimits,
): void {
  if (!Number.isSafeInteger(bytes) || bytes > limits.maxWorkingBytes) {
    throw new Error('This audio needs too much memory. Choose a shorter file.')
  }
}

// One yield per slice of work, not per chunk: a timer yield costs at least
// 4 ms once nested, which made a three-minute song's passes take seconds.
const SLICE_MS = 12
let sliceStarted = -Infinity

/** Yield between large chunks so route changes and Cancel can be observed. */
export async function importCheckpoint(signal?: AbortSignal): Promise<void> {
  checkImportCancelled(signal)
  if (performance.now() - sliceStarted < SLICE_MS) return
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  sliceStarted = performance.now()
  checkImportCancelled(signal)
}

export interface PcmAudio {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  getChannelData(channel: number): Float32Array
}

export function validatePcmDimensions(
  audio: PcmAudio,
  limits: StudioImportLimits,
): void {
  if (audio.sampleRate !== 48_000)
    throw new Error('Studio audio must use a 48 kHz sample rate')
  if (audio.numberOfChannels !== 1 && audio.numberOfChannels !== 2) {
    throw new Error('Choose mono or stereo audio.')
  }
  if (
    !Number.isSafeInteger(audio.length) ||
    audio.length <= 0 ||
    audio.length > limits.maxFrames
  ) {
    throw new Error('This audio is empty or too long. Choose a shorter file.')
  }
}
