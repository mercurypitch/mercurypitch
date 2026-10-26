// Studio WAV verification — parse and measure the delivered PCM bytes independently of the source buffer.
import type { StudioMeasureOptions, StudioPcmReader, } from '../metering/measure-async'
import { measureStudioPcm } from '../metering/measure-async'
import type { StudioLoudnessMeasurement } from '../metering/stream-meter'

export interface StudioWavMeasurement extends StudioLoudnessMeasurement {
  frames: number
  sampleRate: 48000
  channels: 2
  bitDepth: 16
}

const invalidWav = () =>
  new Error('The rendered WAV is incomplete or has an unsupported format.')

function validateFormat(
  data: DataView,
  body: number,
  size: number,
  seen: boolean,
): void {
  if (
    seen ||
    size !== 16 ||
    data.getUint16(body, true) !== 1 ||
    data.getUint16(body + 2, true) !== 2 ||
    data.getUint32(body + 4, true) !== 48000 ||
    data.getUint32(body + 8, true) !== 192000 ||
    data.getUint16(body + 12, true) !== 4 ||
    data.getUint16(body + 14, true) !== 16
  )
    throw invalidWav()
}

/** Only the v1 deliverable is accepted here, not arbitrary user-uploaded WAV formats. */
export function studioWavReader(bytes: ArrayBuffer): StudioPcmReader {
  const data = new DataView(bytes)
  const text = (offset: number, count: number) => {
    let result = ''
    for (let i = 0; i < count; i++)
      result += String.fromCharCode(data.getUint8(offset + i))
    return result
  }
  const invalid = invalidWav
  if (
    data.byteLength < 44 ||
    text(0, 4) !== 'RIFF' ||
    text(8, 4) !== 'WAVE' ||
    data.getUint32(4, true) !== data.byteLength - 8
  )
    throw invalid()
  let cursor = 12,
    sampleOffset = -1,
    sampleLength = 0,
    hasFormat = false
  while (cursor < data.byteLength) {
    if (cursor + 8 > data.byteLength) throw invalid()
    const kind = text(cursor, 4)
    const size = data.getUint32(cursor + 4, true)
    const body = cursor + 8
    const end = body + size
    if (end > data.byteLength) throw invalid()
    if (kind === 'fmt ') {
      validateFormat(data, body, size, hasFormat)
      hasFormat = true
    }
    if (kind === 'data') {
      if (sampleOffset !== -1 || size === 0 || size % 4 !== 0) throw invalid()
      sampleOffset = body
      sampleLength = size
    }
    cursor = end + (size % 2)
  }
  if (!hasFormat || sampleOffset === -1 || cursor !== data.byteLength)
    throw invalid()
  const frames = sampleLength / 4
  return {
    sampleRate: 48000,
    channels: 2,
    frames,
    read(from, to) {
      if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        to < from ||
        to > frames
      )
        throw invalid()
      const channels = [
        new Float32Array(to - from),
        new Float32Array(to - from),
      ]
      for (let frame = from; frame < to; frame++)
        for (let channel = 0; channel < 2; channel++)
          channels[channel][frame - from] =
            data.getInt16(sampleOffset + frame * 4 + channel * 2, true) / 32768
      return channels
    },
  }
}

export async function measureStudioWav(
  bytes: ArrayBuffer,
  options: StudioMeasureOptions = {},
): Promise<StudioWavMeasurement> {
  const reader = studioWavReader(bytes)
  return {
    ...(await measureStudioPcm(reader, options)),
    frames: reader.frames,
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16,
  }
}
