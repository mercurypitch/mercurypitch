// ============================================================
// Channel meters — a live peak and level health for each input and aligned pair of a capture, read beside whatever else listens to it
// ============================================================
//
// An inputs view wants to see every jack of an interface at once: which one
// the guitar is on, which one clips. It listens on a tap, a capture's
// channels sent one at a time (a split's send, or the capture as it is when
// it has one channel), so it can sit beside a recording on the recording's
// own split instead of opening a capture of its own. Each input gets an
// analyser; each aligned pair a mono mix at half each, as a take hears it,
// and an analyser on that. Every block peak is read as level-health reads
// it, against a noise floor of its own. The analysers feed a silent sink:
// some WebKit builds pull only an analyser that reaches the destination
// (jam-input-monitor.ts does the same).
//
// Read on a timer, not on animation frames: the Studio keeps its frames for
// the playhead and asks for none while a lane is armed.
import type { ChannelPick } from './input-channels'
import { splitChannels } from './input-channels'
import type { GuitarInputHealth } from './level-health'
import { createNoiseFloorFollower, describeInputHealth } from './level-health'

/** A capture's channels, each sent into a node on its own, and taken off again. */
export interface ChannelTap {
  readonly context: BaseAudioContext
  send(channel: number, target: AudioNode): void
  unsend(channel: number, target: AudioNode): void
}

/** One row's reading: its block peak, 0 to 1, and how that reads. */
export interface ChannelMeterReading {
  readonly peak: number
  readonly health: GuitarInputHealth
}

/** How often the meters read, in ms: twenty times a second. */
export const CHANNEL_METER_INTERVAL_MS = 50

/** The capture as it is, for one channel: there is nothing to split. */
export function sourceTap(
  context: BaseAudioContext,
  source: AudioNode,
): ChannelTap {
  return {
    context,
    send: (_channel, target) => {
      source.connect(target)
    },
    unsend: (_channel, target) => {
      try {
        source.disconnect(target)
      } catch {
        // Already apart.
      }
    },
  }
}

/**
 * A tap on a capture of the caller's own: split into its `channels`, or as
 * it is for one. The close takes the split off the source again.
 */
export function tapCapture(
  context: BaseAudioContext,
  source: AudioNode,
  channels: number,
): { readonly tap: ChannelTap; close(): void } {
  if (channels <= 1)
    return { tap: sourceTap(context, source), close: () => undefined }
  const split = splitChannels(context, source, channels)
  split.open()
  return {
    tap: { context, send: split.send, unsend: split.unsend },
    close: () => split.close(),
  }
}

function peakOf(block: Float32Array): number {
  let peak = 0
  for (const value of block) peak = Math.max(peak, Math.abs(value))
  return Math.min(1, peak)
}

/**
 * Meter each of `picks` on `tap`, calling `onRead` with their readings, in
 * the same order, every `intervalMs`. Returns the stop, which takes every
 * node it added off the tap again.
 */
export function meterChannels(
  tap: ChannelTap,
  picks: readonly ChannelPick[],
  onRead: (readings: readonly ChannelMeterReading[]) => void,
  intervalMs = CHANNEL_METER_INTERVAL_MS,
): () => void {
  const { context } = tap
  const sink = context.createGain()
  sink.gain.value = 0
  sink.connect(context.destination)
  const rows = picks.map((pick) => {
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0
    analyser.connect(sink)
    let mix: GainNode | null = null
    if (pick.pair) {
      mix = context.createGain()
      mix.channelCount = 1
      mix.channelCountMode = 'explicit'
      mix.channelInterpretation = 'discrete'
      mix.gain.value = 0.5
      tap.send(pick.channel, mix)
      tap.send(pick.channel + 1, mix)
      mix.connect(analyser)
    } else tap.send(pick.channel, analyser)
    // From silence, not from the first block: a meter opened on a note
    // already sounding would take the note for the room's noise.
    const floor = createNoiseFloorFollower()
    floor.push(0, 0)
    return {
      pick,
      analyser,
      mix,
      floor,
      block: new Float32Array(analyser.fftSize),
    }
  })
  const seconds = intervalMs / 1000
  const timer = setInterval(() => {
    onRead(
      rows.map((row) => {
        row.analyser.getFloatTimeDomainData(row.block)
        const peak = peakOf(row.block)
        const floor = row.floor.push(peak, seconds)
        return { peak, health: describeInputHealth(peak, floor).state }
      }),
    )
  }, intervalMs)
  return () => {
    clearInterval(timer)
    for (const row of rows) {
      if (row.mix === null) tap.unsend(row.pick.channel, row.analyser)
      else {
        tap.unsend(row.pick.channel, row.mix)
        tap.unsend(row.pick.channel + 1, row.mix)
        row.mix.disconnect()
      }
      row.analyser.disconnect()
    }
    sink.disconnect()
  }
}
