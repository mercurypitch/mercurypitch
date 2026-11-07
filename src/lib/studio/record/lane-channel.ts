// ============================================================
// Studio lane channel — what an armed lane records and hears: one channel of its input alone, or all of it
// ============================================================
//
// An interface hands the browser its inputs as the channels of one capture.
// A lane on one of them takes it alone: the source split, opened, and that
// channel as a mono node, which the take and the lane's monitor share, so a
// guitar is recorded raw and the singer hears what is recorded. The count is
// the one the capture's track reports. A channel the capture does not have,
// or a count the browser does not say, leaves the lane on all of it, mixed,
// and the arm says so (StudioInputOpened).
import type { ChannelSplit } from '@/lib/audio-input/input-channels'
import { captureChannelCount, isAvailableChannel, splitChannels, } from '@/lib/audio-input/input-channels'
import type { StudioInputOpened } from './recorder-types'

export interface StudioLaneChannel extends Omit<StudioInputOpened, 'stream'> {
  /** Where the lane's one channel is taken from the others; null while it records them all. Closed with the arm. */
  readonly split: ChannelSplit | null
  /** What the lane records and hears: its one channel, or the whole source. */
  readonly input: AudioNode
}

/** How many channels an input opened with, as its track says; null where the browser does not say. */
export function reportedChannels(stream: MediaStream): number | null {
  const count = Number(
    stream.getAudioTracks?.()[0]?.getSettings?.().channelCount,
  )
  return Number.isFinite(count) && count > 0
    ? captureChannelCount(count, null)
    : null
}

/**
 * `channel` of `source` alone, or all of it: for null, for a channel the
 * input does not have, and for an input whose track does not say its count.
 */
export function openStudioLaneChannel(
  context: BaseAudioContext,
  source: AudioNode,
  stream: MediaStream,
  channel: number | null,
): StudioLaneChannel {
  const channels = reportedChannels(stream)
  if (
    channel === null ||
    channels === null ||
    !isAvailableChannel(channel, channels)
  )
    return {
      split: null,
      input: source,
      channels,
      channel: null,
      missingChannel: channel,
    }
  const split = splitChannels(context, source, channels)
  split.open()
  return {
    split,
    input: split.alone(channel),
    channels,
    channel,
    missingChannel: null,
  }
}
