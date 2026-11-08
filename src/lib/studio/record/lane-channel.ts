// ============================================================
// Studio lane channel — what an armed lane records and hears: one input of its capture, or an aligned pair mixed to mono
// ============================================================
//
// An interface hands the browser its inputs as the channels of one capture.
// A lane takes one of them, or an aligned pair at half each, as a DAW's
// record input does, and nothing else: the capture split, opened, and that
// pick as one mono node, which the take and the lane's monitor share, so a
// guitar is recorded raw and the singer hears what is recorded. A lane that
// chose nothing takes the default its input's count makes
// (defaultChannelPick): both sides of a stereo input, else input 1. One
// channel goes as it is. The count is the one the capture's track reports.
// A pick the capture does not have leaves the lane on the default, and the
// arm says so (StudioInputOpened). Where the browser does not say the count,
// the input goes as it is, and the recorder's one-channel input folds it
// (capture-input.ts).
import type { ChannelTap } from '@/lib/audio-input/channel-meters'
import { sourceTap } from '@/lib/audio-input/channel-meters'
import type { ChannelPick, ChannelSplit, } from '@/lib/audio-input/input-channels'
import { captureChannelCount, defaultChannelPick, isAvailablePick, splitChannels, } from '@/lib/audio-input/input-channels'
import type { StudioInputOpened } from './recorder-types'

export interface StudioLaneChannel extends Omit<StudioInputOpened, 'stream'> {
  /** Where the lane's input or pair is taken from the others; null where the input goes as it is. Closed with the arm. */
  readonly split: ChannelSplit | null
  /** What the lane records and hears: one mono node, or the input as it is. */
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
 * What a lane takes of an input of `channels` channels: its pick where the
 * input has it, else the default the count makes, and the pick it asked
 * for that the input does not have. Nothing is taken, and the input goes as
 * it is, where the count is not known.
 */
export function studioLaneRoute(
  pick: ChannelPick | null,
  channels: number | null,
): {
  readonly taken: ChannelPick | null
  readonly missing: ChannelPick | null
} {
  if (channels === null) return { taken: null, missing: pick }
  const fits = pick !== null && isAvailablePick(pick, channels)
  return {
    taken: fits ? pick : defaultChannelPick(channels),
    missing: pick === null || fits ? null : pick,
  }
}

/** The lane's pick of `source`, or its default, as one mono node. */
export function openStudioLaneChannel(
  context: BaseAudioContext,
  source: AudioNode,
  stream: MediaStream,
  pick: ChannelPick | null,
): StudioLaneChannel {
  const channels = reportedChannels(stream)
  const { taken, missing } = studioLaneRoute(pick, channels)
  if (taken === null || channels === null || channels === 1)
    return { split: null, input: source, channels, pick: taken, missing }
  const split = splitChannels(context, source, channels)
  split.open()
  return { split, input: split.take(taken), channels, pick: taken, missing }
}

/** The armed input as meters beside the take hear it, and the track that names it. */
export interface StudioInputTap extends ChannelTap {
  /** The input's channels as its track reports them; null where the browser does not say. */
  readonly channels: number | null
  /** The capture's track, which says which input the arm opened (trackIdentity). */
  readonly track: MediaStreamTrack | null
}

/**
 * A tap on an arm's input for meters that listen beside the take: on the
 * arm's own split, or on the input as it is when it has one channel, never
 * on a capture of their own.
 */
export function studioInputTap(armed: {
  readonly context: BaseAudioContext
  readonly source: AudioNode
  readonly stream: MediaStream
  readonly lane: StudioLaneChannel
}): StudioInputTap {
  const { split, channels } = armed.lane
  const tap: ChannelTap =
    split === null
      ? sourceTap(armed.context, armed.source)
      : { context: armed.context, send: split.send, unsend: split.unsend }
  return {
    ...tap,
    channels,
    track: armed.stream.getAudioTracks?.()[0] ?? null,
  }
}
