// ============================================================
// Stem blob data seam — every reader of UvrStemBlob.data goes through here
// ============================================================
//
// Stem rows written before the Blob migration hold an ArrayBuffer; rows
// written after hold a Blob. IndexedDB deserializes a Blob row to a lazy
// handle (bytes stay in the browser's blob storage), while an ArrayBuffer row
// materializes the full payload into JS memory on every read — the Phase 0
// bench measured ~30 ms and a payload-sized RAM step per 60 MiB stem for
// ArrayBuffer rows against sub-millisecond, near-zero-RAM Blob reads. These
// helpers are the single place that knows both shapes, so readers stay
// oblivious to which era a row came from.

export type StemData = ArrayBuffer | Blob

/** Byte size without touching payload bytes. */
export function stemDataSize(data: StemData): number {
  return data instanceof Blob ? data.size : data.byteLength
}

/**
 * A Blob view of the stem, e.g. for `URL.createObjectURL`. Blob rows pass
 * through untouched — no bytes enter JS memory. Legacy ArrayBuffer rows pay
 * the wrap copy they always did.
 */
export function stemDataBlob(data: StemData, mimeType: string): Blob {
  return data instanceof Blob ? data : new Blob([data], { type: mimeType })
}

/** File view for download/share paths; same copy semantics as stemDataBlob. */
export function stemDataFile(
  data: StemData,
  fileName: string,
  mimeType: string,
): File {
  return new File([data], fileName, { type: mimeType })
}

/**
 * The full payload as a caller-owned ArrayBuffer, e.g. to hand to
 * `decodeAudioData` (which detaches its input). Legacy ArrayBuffer rows are
 * copied so the row object stays intact; Blob rows read fresh bytes from
 * blob storage. Payload-sized — prefer stemDataBlob + object URL when a
 * copy in JS memory is not actually required.
 */
export function stemDataBytes(data: StemData): Promise<ArrayBuffer> {
  if (!(data instanceof Blob)) return Promise.resolve(data.slice(0))
  if (typeof data.arrayBuffer === 'function') return data.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsArrayBuffer(data)
  })
}

/**
 * The first `count` bytes — enough for WAV header parsing without
 * materializing the payload. `Blob.slice` is lazy, so a Blob row reads only
 * the header bytes from disk.
 */
export function stemHeaderBytes(
  data: StemData,
  count: number,
): Promise<ArrayBuffer> {
  if (!(data instanceof Blob)) return Promise.resolve(data.slice(0, count))
  const head = data.slice(0, count)
  // jsdom's Blob lacks arrayBuffer(); FileReader is the portable byte read.
  if (typeof head.arrayBuffer === 'function') return head.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsArrayBuffer(head)
  })
}
