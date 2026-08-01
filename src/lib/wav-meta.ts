// ============================================================
// WAV header metadata — duration without decoding
// ============================================================
// Part stems land as PCM WAV from the separation server; reading
// byteRate + data-chunk size off the RIFF header gives an exact
// duration for a few bytes of I/O, where decodeAudioData would cost a
// full decode (and a second in-memory copy) of a ~60 MB file.

/**
 * Seconds of audio in a RIFF/WAVE buffer, or undefined when the header
 * is not parseable (non-WAV, truncated, or a zero byteRate). Only the
 * leading bytes are inspected, so passing a small slice is enough.
 *
 * `totalBytes` (the whole file's size) rescues streamed WAVs whose data
 * chunk declares 0 or 0xFFFFFFFF instead of a real length.
 */
export function wavDurationSeconds(
  header: ArrayBuffer,
  totalBytes?: number,
): number | undefined {
  const view = new DataView(header)
  const tag = (off: number) =>
    String.fromCharCode(
      view.getUint8(off),
      view.getUint8(off + 1),
      view.getUint8(off + 2),
      view.getUint8(off + 3),
    )
  try {
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return undefined
    let offset = 12
    let byteRate: number | undefined
    while (offset + 8 <= view.byteLength) {
      const id = tag(offset)
      const size = view.getUint32(offset + 4, true)
      if (id === 'fmt ') {
        byteRate = view.getUint32(offset + 16, true)
      }
      if (id === 'data') {
        if (byteRate === undefined || byteRate === 0) return undefined
        // A streamed writer may not know the length up front — fall back
        // to "everything after this chunk header" when the field is a
        // placeholder.
        const bogus = size === 0 || size === 0xffffffff
        const dataBytes =
          bogus && totalBytes !== undefined ? totalBytes - (offset + 8) : size
        if (dataBytes <= 0) return undefined
        return dataBytes / byteRate
      }
      // Chunks are word-aligned; odd sizes carry a pad byte.
      offset += 8 + size + (size % 2)
    }
    return undefined
  } catch {
    return undefined
  }
}
