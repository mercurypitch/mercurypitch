// ============================================================
// WAV blob windows — decode any slice of a stored WAV without decodeAudioData
// ============================================================
//
// Stems are stored as uncompressed WAV, where sample position maps to byte
// position exactly. That makes windowed playback possible: parse the header
// once (a few hundred bytes off a lazy Blob slice), then read any window of
// frames as one small slice and convert it to Float32 channel data. RAM cost
// is the window, not the song.
//
// Supported sample formats cover everything our separation pipeline and
// bench emit: PCM 8/16/24/32-bit integer and 32-bit IEEE float, mono or
// multi-channel, including WAVE_FORMAT_EXTENSIBLE wrappers of both.

export interface WavBlobFormat {
  /** 1 = integer PCM, 3 = IEEE float (extensible resolved to one of these). */
  readonly formatTag: 1 | 3
  readonly channelCount: number
  readonly sampleRate: number
  readonly bitsPerSample: 8 | 16 | 24 | 32
  readonly bytesPerFrame: number
  /** Absolute byte offset of the first audio frame in the blob. */
  readonly dataByteOffset: number
  readonly dataByteLength: number
  readonly frameCount: number
  readonly durationSeconds: number
}

const RIFF = 0x46464952 // 'RIFF' little-endian
const WAVE = 0x45564157 // 'WAVE'
const FMT = 0x20746d66 // 'fmt '
const DATA = 0x61746164 // 'data'
const FORMAT_PCM = 1
const FORMAT_FLOAT = 3
const FORMAT_EXTENSIBLE = 0xfffe
/** A header should resolve within this much prelude; bail past it. */
const MAXIMUM_HEADER_SCAN_BYTES = 1024 * 1024

/** jsdom's Blob lacks arrayBuffer(); FileReader is the portable byte read. */
function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsArrayBuffer(blob)
  })
}

async function viewOf(
  blob: Blob,
  offset: number,
  length: number,
): Promise<DataView | null> {
  if (offset + length > blob.size) return null
  const bytes = await blobBytes(blob.slice(offset, offset + length))
  if (bytes.byteLength < length) return null
  return new DataView(bytes)
}

interface ParsedFmt {
  formatTag: 1 | 3
  channelCount: number
  sampleRate: number
  bitsPerSample: 8 | 16 | 24 | 32
}

function parseFmtChunk(view: DataView): ParsedFmt | null {
  let formatTag = view.getUint16(0, true)
  const channelCount = view.getUint16(2, true)
  const sampleRate = view.getUint32(4, true)
  const bitsPerSample = view.getUint16(14, true)
  if (formatTag === FORMAT_EXTENSIBLE) {
    // The real format is the first two bytes of the SubFormat GUID at byte 24.
    if (view.byteLength < 26) return null
    formatTag = view.getUint16(24, true)
  }
  if (formatTag !== FORMAT_PCM && formatTag !== FORMAT_FLOAT) return null
  if (channelCount < 1 || channelCount > 32) return null
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return null
  if (
    bitsPerSample !== 8 &&
    bitsPerSample !== 16 &&
    bitsPerSample !== 24 &&
    bitsPerSample !== 32
  ) {
    return null
  }
  if (formatTag === FORMAT_FLOAT && bitsPerSample !== 32) return null
  return { formatTag, channelCount, sampleRate, bitsPerSample }
}

/**
 * Parse the container without touching the payload. Returns null for
 * anything that is not a WAV this module can window — the caller falls back
 * to the full-decode path.
 */
export async function parseWavBlobFormat(
  blob: Blob,
): Promise<WavBlobFormat | null> {
  const head = await viewOf(blob, 0, 12)
  if (head === null) return null
  if (head.getUint32(0, true) !== RIFF || head.getUint32(8, true) !== WAVE) {
    return null
  }

  let offset = 12
  let fmt: ParsedFmt | null = null
  const scanLimit = Math.min(blob.size, MAXIMUM_HEADER_SCAN_BYTES)
  while (offset + 8 <= scanLimit) {
    const chunkHead = await viewOf(blob, offset, 8)
    if (chunkHead === null) return null
    const chunkId = chunkHead.getUint32(0, true)
    const declaredSize = chunkHead.getUint32(4, true)

    if (chunkId === FMT) {
      const fmtSize = Math.min(declaredSize, 40)
      if (fmtSize < 16) return null
      const fmtView = await viewOf(blob, offset + 8, fmtSize)
      if (fmtView === null) return null
      fmt = parseFmtChunk(fmtView)
      if (fmt === null) return null
    } else if (chunkId === DATA) {
      if (fmt === null) return null
      const dataByteOffset = offset + 8
      // Writers that stream may leave a placeholder size; clamp to reality.
      const dataByteLength = Math.min(
        declaredSize === 0 || declaredSize === 0xffffffff
          ? blob.size - dataByteOffset
          : declaredSize,
        blob.size - dataByteOffset,
      )
      const bytesPerSample = fmt.bitsPerSample / 8
      const bytesPerFrame = bytesPerSample * fmt.channelCount
      const frameCount = Math.floor(dataByteLength / bytesPerFrame)
      if (frameCount <= 0) return null
      return {
        ...fmt,
        bytesPerFrame,
        dataByteOffset,
        dataByteLength: frameCount * bytesPerFrame,
        frameCount,
        durationSeconds: frameCount / fmt.sampleRate,
      }
    }

    // Chunks are word-aligned: odd sizes carry one pad byte.
    offset += 8 + declaredSize + (declaredSize % 2)
  }
  return null
}

/**
 * Read frames [startFrame, startFrame + frameCount) as one Float32Array per
 * channel, clamped to the stream's end. Only the window's bytes are read
 * from storage.
 */
export async function readWavBlobWindow(
  blob: Blob,
  format: WavBlobFormat,
  startFrame: number,
  frameCount: number,
): Promise<readonly Float32Array[]> {
  const start = Math.max(0, Math.floor(startFrame))
  const frames = Math.max(
    0,
    Math.min(Math.floor(frameCount), format.frameCount - start),
  )
  const channels = Array.from(
    { length: format.channelCount },
    () => new Float32Array(frames),
  )
  if (frames === 0) return channels

  const byteStart = format.dataByteOffset + start * format.bytesPerFrame
  const view = new DataView(
    await blobBytes(
      blob.slice(byteStart, byteStart + frames * format.bytesPerFrame),
    ),
  )
  const bytesPerSample = format.bitsPerSample / 8

  for (let frame = 0; frame < frames; frame++) {
    const frameOffset = frame * format.bytesPerFrame
    for (let channel = 0; channel < format.channelCount; channel++) {
      const at = frameOffset + channel * bytesPerSample
      let value: number
      if (format.formatTag === FORMAT_FLOAT) {
        value = view.getFloat32(at, true)
      } else if (format.bitsPerSample === 16) {
        value = view.getInt16(at, true) / 0x8000
      } else if (format.bitsPerSample === 24) {
        const unsigned =
          view.getUint8(at) |
          (view.getUint8(at + 1) << 8) |
          (view.getUint8(at + 2) << 16)
        value =
          (unsigned >= 0x800000 ? unsigned - 0x1000000 : unsigned) / 0x800000
      } else if (format.bitsPerSample === 32) {
        value = view.getInt32(at, true) / 0x80000000
      } else {
        value = (view.getUint8(at) - 128) / 128
      }
      channels[channel][frame] = value
    }
  }
  return channels
}
