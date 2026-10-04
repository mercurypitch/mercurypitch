// ============================================================
// The silence the lock screen's carrier plays
// ============================================================
//
// WebKit shows Now Playing for a media element that plays sound, so the
// carrier (webkit-now-playing.ts) plays generated silence beside the song.
// Each time it goes round, WebKit moves the lock screen's bar to its own
// place for a moment, so the longer the better: an hour of FLAC, built in
// about 10 ms, where the WebView plays FLAC, and four seconds of WAV, which
// every WebView plays, where it does not.

/**
 * Which silence the carrier plays: an hour of FLAC, where the WebView plays
 * FLAC, or the few seconds of WAV every WebView plays.
 */
export type SilenceKind = 'long' | 'short'

/**
 * Seconds of silence the short carrier loops: past WebKit's 0.95 s, and
 * long enough that it goes round seldom (webkit-now-playing.ts,
 * `onCarrierRound`).
 */
const CARRIER_SECONDS = 4

/**
 * Seconds of silence the long carrier plays before it goes round: past any
 * song, so the lock screen's bar is never sent to 0:00 by it in the middle
 * of one (webkit-now-playing.ts, `onCarrierRound`). About 670 KB of FLAC.
 */
const LONG_CARRIER_SECONDS = 3600

/**
 * The iPhone's own output rate, in stereo, 16-bit. unmute.js, which plays
 * silence beside Web Audio for the same reason, warns that silence of a lower
 * quality can drag Web Audio's output down with it on iOS.
 */
const CARRIER_SAMPLE_RATE = 48_000
const CARRIER_CHANNELS = 2

/** A 16-bit PCM WAV file of silence, `seconds` long. */
export function silentWav(seconds: number, sampleRate: number): ArrayBuffer {
  const blockAlign = CARRIER_CHANNELS * 2
  const dataBytes = Math.round(seconds * sampleRate) * blockAlign
  const wav = new DataView(new ArrayBuffer(44 + dataBytes))
  const text = (at: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) {
      wav.setUint8(at + i, value.charCodeAt(i))
    }
  }
  text(0, 'RIFF')
  wav.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true)
  wav.setUint16(22, CARRIER_CHANNELS, true)
  wav.setUint32(24, sampleRate, true)
  wav.setUint32(28, sampleRate * blockAlign, true)
  wav.setUint16(32, blockAlign, true)
  wav.setUint16(34, 16, true)
  text(36, 'data')
  wav.setUint32(40, dataBytes, true)
  // The samples are the buffer's own zeros.
  return wav.buffer
}

/** Samples in one FLAC frame. The frame header names 4096 by a code. */
const FLAC_BLOCK = 4096

/** The frame header's code for each sample rate it names directly. */
const FLAC_RATE_CODES: Readonly<Record<number, number>> = {
  44_100: 0b1001,
  48_000: 0b1010,
}

/** A byte-at-a-time CRC table, for a polynomial of `width` bits. */
function crcTable(polynomial: number, width: number): Uint16Array {
  const top = 1 << (width - 1)
  const mask = (1 << width) - 1
  const table = new Uint16Array(256)
  for (let byte = 0; byte < 256; byte += 1) {
    let crc = byte << (width - 8)
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & top ? ((crc << 1) ^ polynomial) & mask : (crc << 1) & mask
    }
    table[byte] = crc
  }
  return table
}

/** FLAC's frame-header CRC (x^8 + x^2 + x + 1) and frame CRC (x^16 + x^15 + x^2 + 1). */
const CRC8 = crcTable(0x07, 8)
const CRC16 = crcTable(0x8005, 16)

function crc8(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0
  for (let i = start; i < end; i += 1) crc = CRC8[crc ^ bytes[i]!]!
  return crc
}

function crc16(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0
  for (let i = start; i < end; i += 1) {
    crc = ((crc << 8) & 0xffff) ^ CRC16[(crc >> 8) ^ bytes[i]!]!
  }
  return crc
}

/** A frame's number as FLAC writes it: in UTF-8's coding. */
function codedFrameNumber(n: number): number[] {
  if (n < 0x80) return [n]
  if (n < 0x800) return [0xc0 | (n >> 6), 0x80 | (n & 0x3f)]
  if (n < 0x1_0000) {
    return [0xe0 | (n >> 12), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)]
  }
  return [
    0xf0 | (n >> 18),
    0x80 | ((n >> 12) & 0x3f),
    0x80 | ((n >> 6) & 0x3f),
    0x80 | (n & 0x3f),
  ]
}

/**
 * A 16-bit stereo FLAC file of silence, at least `seconds` long, in whole
 * frames of 4096 samples. Each frame is a header and, per channel, a
 * CONSTANT subframe of 0: 14 to 16 bytes where WAV takes 16 KB, so an hour
 * comes to about 670 KB.
 */
export function silentFlac(seconds: number, sampleRate: number): ArrayBuffer {
  const rateCode = FLAC_RATE_CODES[sampleRate]
  if (rateCode === undefined) {
    throw new RangeError(`No FLAC frame code for ${sampleRate} Hz`)
  }
  const frames = Math.max(1, Math.ceil((seconds * sampleRate) / FLAC_BLOCK))
  const samples = frames * FLAC_BLOCK
  // A frame: 4 header bytes, the number, the header's CRC, two 3-byte
  // subframes and the frame's CRC.
  const frameBytes = (n: number): number => 13 + codedFrameNumber(n).length
  let total = 4 + 4 + 34
  for (let n = 0; n < frames; n += 1) total += frameBytes(n)
  const bytes = new Uint8Array(total)

  // "fLaC", then STREAMINFO, the only metadata block, so the last one.
  bytes.set([0x66, 0x4c, 0x61, 0x43, 0x80, 0x00, 0x00, 34], 0)
  const info = new DataView(bytes.buffer, 8, 34)
  info.setUint16(0, FLAC_BLOCK)
  info.setUint16(2, FLAC_BLOCK)
  const smallest = frameBytes(0)
  const largest = frameBytes(frames - 1)
  info.setUint8(4, smallest >> 16)
  info.setUint16(5, smallest & 0xffff)
  info.setUint8(7, largest >> 16)
  info.setUint16(8, largest & 0xffff)
  // 20 bits of rate, 3 of channels less one, 5 of bits per sample less
  // one, 36 of samples. The MD5 stays zero: not worked out.
  info.setUint8(10, sampleRate >> 12)
  info.setUint8(11, (sampleRate >> 4) & 0xff)
  info.setUint8(12, ((sampleRate & 0xf) << 4) | (1 << 1) | (15 >> 4))
  info.setUint8(13, ((15 & 0xf) << 4) | Math.floor(samples / 2 ** 32))
  info.setUint32(14, samples >>> 0)

  let at = 42
  for (let n = 0; n < frames; n += 1) {
    const start = at
    // Sync, fixed block size; 4096 samples and the rate by code; left and
    // right, 16 bits.
    bytes.set([0xff, 0xf8, 0xc0 | rateCode, 0x18], at)
    at += 4
    const number = codedFrameNumber(n)
    bytes.set(number, at)
    at += number.length
    bytes[at] = crc8(bytes, start, at)
    at += 1
    // Two CONSTANT subframes of 0: the buffer's own zeros, six bytes.
    at += 6
    const crc = crc16(bytes, start, at)
    bytes[at] = crc >> 8
    bytes[at + 1] = crc & 0xff
    at += 2
  }
  return bytes.buffer
}

/** The silence of a kind, as a file the carrier can play from a blob: URL. */
export function silenceBlob(kind: SilenceKind): Blob {
  return kind === 'long'
    ? new Blob([silentFlac(LONG_CARRIER_SECONDS, CARRIER_SAMPLE_RATE)], {
        type: 'audio/flac',
      })
    : new Blob([silentWav(CARRIER_SECONDS, CARRIER_SAMPLE_RATE)], {
        type: 'audio/wav',
      })
}
