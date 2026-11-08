// ============================================================
// Studio armed input — what an arm opened for its lane to record and hear: a microphone's channels, or an instrument's sound
// ============================================================
//
// A lane records a microphone, one input of an interface or an aligned
// pair of them (lane-channel.ts), or, on a MIDI lane, the sound of an
// instrument the page plays (StudioInstrumentHold): no microphone opens for
// it. Either way the arm hands the take and the monitor one node, and every
// capture the arm opens after listens on it. A microphone is still there
// while its track is live; an instrument while its port is connected. Only
// a microphone's channels can be metered beside a take: an instrument has
// none.
import type { StudioInputTap } from './lane-channel'
import { openStudioLaneChannel, studioInputTap } from './lane-channel'
import type { StudioInputHold, StudioInputOpened, StudioInstrumentHold, StudioMicHold, } from './recorder-types'

export interface StudioArmedInput {
  /** What the lane records and hears: one channel, an aligned pair, the whole input, or an instrument's sound. */
  readonly node: AudioNode
  /** The microphone's stream; null for an instrument. */
  readonly stream: MediaStream | null
  /** What a microphone opened, for the armed lane's card; null for an instrument. */
  readonly opened: StudioInputOpened | null
  /** Still there to record from. */
  live(): boolean
  /** The input's channels for meters beside the take; null for an instrument. */
  tap(): StudioInputTap | null
  /** Take apart what the arm opened and give the input back. */
  close(): void
}

export function isStudioInstrumentHold(
  hold: StudioInputHold,
): hold is StudioInstrumentHold {
  return 'kind' in hold && hold.kind === 'instrument'
}

function openMicrophone(
  context: AudioContext,
  mic: StudioMicHold,
  createSource: (context: AudioContext, stream: MediaStream) => AudioNode,
): StudioArmedInput {
  const stream = mic.stream
  const source = createSource(context, stream)
  const lane = openStudioLaneChannel(context, source, stream, mic.pick ?? null)
  const { channels, pick, missing } = lane
  return {
    node: lane.input,
    stream,
    opened: { stream, channels, pick, missing },
    live: () => {
      const tracks = stream.getAudioTracks?.()
      return (
        tracks === undefined ||
        tracks.length === 0 ||
        tracks.some((track) => track.readyState === 'live')
      )
    },
    tap: () => studioInputTap({ context, source, stream, lane }),
    close: () => {
      lane.split?.close()
      try {
        source.disconnect()
      } catch {
        // Already apart.
      }
      mic.release()
    },
  }
}

/** Open what `hold` gives the lane on `context`: a microphone's source and channels, or an instrument's sound. */
export function openStudioArmedInput(
  context: AudioContext,
  hold: StudioInputHold,
  createSource: (context: AudioContext, stream: MediaStream) => AudioNode,
): StudioArmedInput {
  if (!isStudioInstrumentHold(hold))
    return openMicrophone(context, hold, createSource)
  return {
    node: hold.play(context),
    stream: null,
    opened: null,
    live: () => hold.connected(),
    tap: () => null,
    close: () => hold.release(),
  }
}
