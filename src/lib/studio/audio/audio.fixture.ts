// Studio audio fixtures — deterministic sample arrays without browser audio mocks.
import type { PcmAudio } from './import-limits'

export function sampledAudio(
  channels: number[][] | Float32Array[],
  sampleRate = 48_000,
): PcmAudio {
  const data = channels.map((channel) => Float32Array.from(channel))
  return {
    sampleRate,
    numberOfChannels: data.length,
    length: data[0]?.length ?? 0,
    getChannelData: (channel) => data[channel],
  }
}

export function toneAudio(
  frames = 48_000,
  channels = 1,
  amplitude = 0.1,
): PcmAudio {
  return sampledAudio(
    Array.from({ length: channels }, (_, channel) =>
      Float32Array.from(
        { length: frames },
        (_, frame) =>
          amplitude *
          Math.sin((2 * Math.PI * (220 + channel * 110) * frame) / 48_000),
      ),
    ),
  )
}
