const OUTPUT_SAMPLE_RATE = 44_100
const WAV_HEADER_BYTES = 44

export const GUIDED_EXAMPLE_CLIP_MS = 5_000
export const MAX_GUIDED_EXAMPLE_SOURCE_BYTES = 25 * 1024 * 1024
export const GUIDED_EXAMPLE_ACCEPT =
  'audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/x-m4a,audio/webm,audio/ogg,audio/wav,audio/x-wav,audio/wave,.mp3,.m4a,.mp4,.aac,.webm,.ogg,.oga,.wav'
export const GUIDED_EXAMPLE_FORMATS = 'MP3, M4A/MP4, AAC, WebM, Ogg, or WAV'

const SUPPORTED_EXTENSIONS = [
  '.mp3',
  '.m4a',
  '.mp4',
  '.aac',
  '.webm',
  '.ogg',
  '.oga',
  '.wav',
] as const

export interface DecodedGuidedExerciseAudio {
  buffer: AudioBuffer
  durationMs: number
}

export interface GuidedExerciseAudioClip {
  file: File
  durationMs: number
  startMs: number
}

export function isSupportedGuidedExerciseAudio(file: File): boolean {
  const type = file.type.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (type.startsWith('audio/')) return true
  const name = file.name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export async function decodeGuidedExerciseAudio(
  file: File,
): Promise<DecodedGuidedExerciseAudio> {
  if (!isSupportedGuidedExerciseAudio(file)) {
    throw new Error(`Choose ${GUIDED_EXAMPLE_FORMATS} audio.`)
  }
  if (file.size === 0) throw new Error('The selected audio file is empty.')
  if (file.size > MAX_GUIDED_EXAMPLE_SOURCE_BYTES) {
    throw new Error(
      'The source file is over 25 MiB. Export a shorter audio file and try again.',
    )
  }
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error(
      'This browser cannot prepare audio clips. Record here or use a current browser.',
    )
  }

  try {
    const context = new OfflineAudioContext(1, 1, OUTPUT_SAMPLE_RATE)
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    const durationMs = Math.round(buffer.duration * 1000)
    if (!Number.isFinite(durationMs) || durationMs < 1) {
      throw new Error('The selected audio has no playable duration.')
    }
    return { buffer, durationMs }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The selected')) {
      throw error
    }
    throw new Error(
      `This file could not be decoded. Export it as ${GUIDED_EXAMPLE_FORMATS} and try again.`,
    )
  }
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function clipName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '').trim() || 'example-audio'
  return `${stem}-5s-clip.wav`
}

export function createGuidedExerciseAudioClip(
  file: File,
  buffer: AudioBuffer,
  requestedStartMs: number,
  clipDurationMs = GUIDED_EXAMPLE_CLIP_MS,
): GuidedExerciseAudioClip {
  const boundedDurationMs = Math.max(1, Math.round(clipDurationMs))
  const sourceDurationMs = Math.round(buffer.duration * 1000)
  const maximumStartMs = Math.max(0, sourceDurationMs - boundedDurationMs)
  const startMs = Math.min(
    maximumStartMs,
    Math.max(0, Math.round(requestedStartMs)),
  )
  const startFrame = Math.min(
    buffer.length - 1,
    Math.max(0, Math.floor((startMs / 1000) * buffer.sampleRate)),
  )
  const requestedFrames = Math.max(
    1,
    Math.round((boundedDurationMs / 1000) * buffer.sampleRate),
  )
  const frameCount = Math.min(requestedFrames, buffer.length - startFrame)
  const pcmBytes = frameCount * 2
  const bytes = new ArrayBuffer(WAV_HEADER_BYTES + pcmBytes)
  const view = new DataView(bytes)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcmBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcmBytes, true)

  const channelCount = buffer.numberOfChannels
  const channels = Array.from({ length: channelCount }, (_, channel) =>
    buffer.getChannelData(channel),
  )
  let outputOffset = WAV_HEADER_BYTES
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sample = 0
    for (const channel of channels) sample += channel[startFrame + frame] ?? 0
    sample = Math.max(-1, Math.min(1, sample / channelCount))
    view.setInt16(
      outputOffset,
      sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
      true,
    )
    outputOffset += 2
  }

  const durationMs = Math.max(
    1,
    Math.round((frameCount / buffer.sampleRate) * 1000),
  )
  return {
    file: new File([bytes], clipName(file.name), { type: 'audio/wav' }),
    durationMs,
    startMs,
  }
}

export function audioDurationLabel(durationMs: number): string {
  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
