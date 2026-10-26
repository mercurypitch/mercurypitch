// Studio loudness — bounded BS.1770 K-weighted integration and finite 8x true-peak estimation.
import type { StudioLoudnessMeasurement } from '../studio/metering/stream-meter'
import { createStudioMeter } from '../studio/metering/stream-meter'

export type LoudnessMeasurement = StudioLoudnessMeasurement

/** Raw mono is measured as dual mono, matching Studio's two-speaker routing. */
export interface SampledAudio {
  readonly sampleRate: number
  readonly numberOfChannels: number
  getChannelData(channel: number): Float32Array
}

function measure(audio: SampledAudio, truePeak: boolean): LoudnessMeasurement {
  if (audio.numberOfChannels !== 1 && audio.numberOfChannels !== 2)
    throw new Error('Studio measures mono or stereo audio.')
  const channels = Array.from(
    { length: audio.numberOfChannels },
    (_, channel) => audio.getChannelData(channel),
  )
  if (channels.some((channel) => channel.length !== channels[0].length))
    throw new Error('The audio measurement received inconsistent channel data.')
  const meter = createStudioMeter({
    sampleRate: audio.sampleRate,
    channels: audio.numberOfChannels,
    dualMono: true,
    truePeak,
    maxFrames: channels[0].length,
  })
  meter.push(channels)
  return meter.finish()
}

export function integratedLoudness(audio: SampledAudio): number {
  return measure(audio, false).integratedLufs
}

export function measureLoudness(audio: SampledAudio): LoudnessMeasurement {
  return measure(audio, true)
}
