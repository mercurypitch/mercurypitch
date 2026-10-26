// Studio memory admission — shared reservations for imports, retained audio and renders.
export const STUDIO_WORKING_BYTES = 512 * 1024 * 1024

let reservedBytes = 0

/** Reserve before reading or allocating; the owner releases after native work settles.
 * Low-level canonical readers do not reserve again when their caller owns this budget.
 * This counts application allocations, not browser-private codec or garbage-collector memory.
 */
export function reserveStudioMemory(bytes: number): () => void {
  if (
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    reservedBytes + bytes > STUDIO_WORKING_BYTES
  ) {
    throw new Error(
      'Studio needs more memory for this audio. Stop playback or choose shorter files.',
    )
  }
  reservedBytes += bytes
  let released = false
  return () => {
    if (released) return
    released = true
    reservedBytes -= bytes
  }
}

export function studioReservedMemoryBytes(): number {
  return reservedBytes
}
