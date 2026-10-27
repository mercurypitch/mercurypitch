// Studio memory admission — shared reservations for imports, retained audio and renders.
const MIB = 1024 * 1024
/** The floor every device gets: phones, and desktops that report 2 GB or less. */
export const STUDIO_WORKING_BYTES = 512 * MIB
/** Desktops the app already trusts with 2 GiB or more of decoded audio. */
export const STUDIO_DESKTOP_WORKING_BYTES = 1024 * MIB

/** A reservation that does not fit the budget. Something smaller may still fit. */
export class StudioMemoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudioMemoryError'
  }
}

let reservedBytes = 0
let budgetBytes: number | null = null
const reclaimers = new Set<() => void>()

/**
 * The working budget for this device, read once. It follows the classing in
 * lib/audio-memory-budget.ts, which gives a desktop that reports more than
 * 2 GB (or nothing) 2 GiB or more of decoded audio. Importing that module
 * here would split it out of Drum Night's first paint, so the rule is read
 * directly: a phone or a narrow window, or 2 GB or less, keeps the floor.
 */
export function studioWorkingBytes(): number {
  if (budgetBytes === null) {
    const nav =
      typeof navigator === 'undefined'
        ? undefined
        : (navigator as {
            deviceMemory?: number
            userAgentData?: { mobile?: boolean }
          })
    const mobile =
      nav?.userAgentData?.mobile ??
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 768px)').matches)
    const memory = nav?.deviceMemory
    budgetBytes =
      !mobile && (typeof memory !== 'number' || memory > 2)
        ? STUDIO_DESKTOP_WORKING_BYTES
        : STUDIO_WORKING_BYTES
  }
  return budgetBytes
}

/** Tests pin the budget; null reads the device again. */
export function setStudioWorkingBytes(bytes: number | null): void {
  budgetBytes = bytes
}

/**
 * Register memory that can be dropped on demand, such as decoded playback
 * buffers no run is using. A reservation that would not fit asks the
 * reclaimers to free what they can before it fails.
 */
export function registerStudioMemoryReclaimer(reclaim: () => void): () => void {
  reclaimers.add(reclaim)
  return () => reclaimers.delete(reclaim)
}

/** Reserve before reading or allocating; the owner releases after native work settles.
 * Low-level canonical readers do not reserve again when their caller owns this budget.
 * This counts application allocations, not browser-private codec or garbage-collector memory.
 */
export function reserveStudioMemory(bytes: number): () => void {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw memoryError()
  const fits = () => reservedBytes + bytes <= studioWorkingBytes()
  for (const reclaim of [...reclaimers]) {
    if (fits()) break
    reclaim()
  }
  if (!fits()) throw memoryError()
  reservedBytes += bytes
  let released = false
  return () => {
    if (released) return
    released = true
    reservedBytes -= bytes
  }
}

function memoryError(): Error {
  return new StudioMemoryError(
    'Studio needs more memory for this audio. Stop playback or choose shorter files.',
  )
}

export function studioReservedMemoryBytes(): number {
  return reservedBytes
}

const retainedResources = new WeakMap<object, () => void>()

/** Transfer a reservation to an output until its consumer has finished with it. */
export function retainStudioResource<T extends object>(
  resource: T,
  release: () => void,
): T {
  retainedResources.set(resource, release)
  return resource
}

export function releaseStudioResource(resource: object): void {
  retainedResources.get(resource)?.()
  retainedResources.delete(resource)
}
