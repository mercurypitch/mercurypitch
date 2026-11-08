// ============================================================
// Studio armed inputs — what each armed lane records and hears: its pick of a microphone the lanes on it share, or an instrument's sound
// ============================================================
//
// A lane records a microphone, one input of an interface or an aligned
// pair of them (lane-channel.ts), or, on a MIDI lane, the sound of an
// instrument the page plays (StudioInstrumentHold): no microphone opens for
// it. Either way the arm hands the take and the monitor one node, and every
// capture the arm opens after listens on it. Lanes armed on one microphone
// share it, as a DAW's tracks share one interface: one source and one split,
// each lane taking its own pick, and both go with the last lane on it. A
// microphone is still there while its track is live; an instrument while its
// port is connected. Only a microphone's channels can be metered beside a
// take: an instrument has none.
import type { StudioInputChannels, StudioInputTap } from './lane-channel'
import { openStudioInputChannels, studioInputTap } from './lane-channel'
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
  /** Take apart what the lane took, and give its hold back: the microphone goes with the last lane on it. */
  close(): void
}

export function isStudioInstrumentHold(
  hold: StudioInputHold,
): hold is StudioInstrumentHold {
  return 'kind' in hold && hold.kind === 'instrument'
}

/** A microphone the lanes armed on it share: one source, one split. */
interface SharedMicrophone {
  /** Which opening of a microphone this is: a new number each time one opens. */
  readonly capture: number
  readonly source: AudioNode
  readonly channels: StudioInputChannels
  tap(): StudioInputTap
  lanes: number
}

function trackLive(stream: MediaStream): boolean {
  const tracks = stream.getAudioTracks?.()
  return (
    tracks === undefined ||
    tracks.length === 0 ||
    tracks.some((track) => track.readyState === 'live')
  )
}

function disconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // Already apart.
  }
}

/** The inputs of every armed lane on one clock; a microphone opened once for the lanes that share it. */
export function createStudioArmedInputs(
  createSource: (context: AudioContext, stream: MediaStream) => AudioNode,
) {
  const microphones = new Map<MediaStream, SharedMicrophone>()
  let opened = 0

  function share(context: AudioContext, stream: MediaStream): SharedMicrophone {
    const found = microphones.get(stream)
    if (found !== undefined) return found
    const source = createSource(context, stream)
    const channels = openStudioInputChannels(context, source, stream)
    const made: SharedMicrophone = {
      capture: ++opened,
      source,
      channels,
      tap: () => studioInputTap({ context, source, stream, lane: channels }),
      lanes: 0,
    }
    microphones.set(stream, made)
    return made
  }

  function openMicrophone(
    context: AudioContext,
    mic: StudioMicHold,
  ): StudioArmedInput {
    const stream = mic.stream
    const shared = share(context, stream)
    shared.lanes += 1
    const lane = shared.channels.take(mic.pick ?? null)
    let closed = false
    return {
      node: lane.input,
      stream,
      opened: {
        stream,
        channels: shared.channels.channels,
        pick: lane.pick,
        missing: lane.missing,
      },
      live: () => trackLive(stream),
      close: () => {
        if (closed) return
        closed = true
        shared.lanes -= 1
        if (shared.lanes > 0) shared.channels.drop(lane.input)
        else {
          microphones.delete(stream)
          shared.channels.close()
          disconnect(shared.source)
        }
        mic.release()
      },
    }
  }

  return {
    /** Open what `hold` gives a lane on `context`: its pick of a microphone, shared with the lanes on it, or an instrument's sound. */
    open(context: AudioContext, hold: StudioInputHold): StudioArmedInput {
      if (!isStudioInstrumentHold(hold)) return openMicrophone(context, hold)
      return {
        node: hold.play(context),
        stream: null,
        opened: null,
        live: () => hold.connected(),
        close: () => hold.release(),
      }
    },
    /** The armed microphone's channels, for meters beside a take on its own split; null while no lane holds one. */
    tap(): StudioInputTap | null {
      const [first] = microphones.values()
      return first?.tap() ?? null
    },
    /** Which opening of the microphone the lanes share; null while none holds one. */
    capture(): number | null {
      const [first] = microphones.values()
      return first?.capture ?? null
    },
  }
}

export type StudioArmedInputs = ReturnType<typeof createStudioArmedInputs>
