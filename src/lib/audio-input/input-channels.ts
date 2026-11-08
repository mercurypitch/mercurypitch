// ============================================================
// Input channels — one channel of a multichannel input, apart from the rest
// ============================================================
//
// An audio interface reaches the browser as one capture with a channel per
// input, so a guitar on input 1 and a microphone on input 2 arrive together,
// and anything that downmixes them sums the two. Whatever wants the guitar
// alone (a recording, a meter, the sound in somebody's headphones) splits
// the capture and takes one outlet. This is that split: Guitar Night's
// recorder takes its chosen channel through it, and Jam's input check meters
// every channel and plays one through it.
//
// The split adds one edge to the source and only ever takes that edge away,
// because the source usually belongs to someone else: a listening
// controller that may already have released it.
//
// A mono signal is taken from a capture the way a DAW's record input is
// (Reaper's Mono and Stereo inputs, Ableton's "1", "2" and "1/2"): one
// channel, or an aligned pair, 1 and 2 or 3 and 4, summed at half each.
// Nothing mixes every channel. Web Audio's own downmix, a node of fewer
// channels than its input, mixes only stereo, quad and 5.1 and keeps the
// first channel of any other count, so the mixing is done here, never left
// to it.

/** Web Audio's ceiling for a ChannelSplitterNode, so for any input's channels. */
export const MAX_INPUT_CHANNELS = 32

/**
 * The channel count a capture really has, clamped to what a split can
 * address: the track's own setting, else the source node's (Safari omits
 * most of the settings block), else one, never zero.
 */
export function captureChannelCount(
  trackChannelCount: unknown,
  sourceChannelCount: unknown,
): number {
  const fromTrack = Number(trackChannelCount)
  const fromSource = Number(sourceChannelCount)
  const exposed =
    Number.isFinite(fromTrack) && fromTrack > 0
      ? Math.floor(fromTrack)
      : Number.isFinite(fromSource) && fromSource > 0
        ? Math.floor(fromSource)
        : 1
  // Clamped rather than thrown on. Guitar Night refuses to truncate
  // because it is analysing for pitch and a missing channel is a wrong
  // answer (guitarInputAnalysisChannelCount); for a meter or a monitor a
  // channel past 32 costs the ability to see or hear it, which is worth
  // strictly less than an input that will not open.
  return Math.min(Math.max(1, exposed), MAX_INPUT_CHANNELS)
}

/** Whether `channel` is one of `channelCount` channels, and a split can address them. */
export function isAvailableChannel(
  channel: number,
  channelCount: number,
): boolean {
  return (
    Number.isInteger(channel) &&
    channel >= 0 &&
    channel < channelCount &&
    channelCount <= MAX_INPUT_CHANNELS
  )
}

/**
 * Which channels of a capture make one mono signal: `channel` alone, or an
 * aligned pair (`channel` even, and the one after it) summed at half each.
 * 0-based.
 */
export interface ChannelPick {
  readonly channel: number
  readonly pair: boolean
}

/**
 * What a mono take hears of a capture nobody chose channels for: both
 * sides of a stereo input at half each, and the first channel of any other.
 * An input of three or more channels is an interface, where each channel
 * is something else plugged in, and none of them is mixed in unasked.
 */
export function defaultChannelPick(channelCount: number): ChannelPick {
  return { channel: 0, pair: channelCount === 2 }
}

/** Whether a capture of `channelCount` channels has `pick`: its channel, or both of its aligned pair. */
export function isAvailablePick(
  pick: ChannelPick,
  channelCount: number,
): boolean {
  if (!pick.pair) return isAvailableChannel(pick.channel, channelCount)
  return (
    pick.channel % 2 === 0 &&
    isAvailableChannel(pick.channel, channelCount) &&
    isAvailableChannel(pick.channel + 1, channelCount)
  )
}

/** Every pick a capture of `channelCount` channels offers: each channel, then each aligned pair. */
export function channelPicks(channelCount: number): ChannelPick[] {
  const count = Math.min(
    Math.max(0, Math.floor(channelCount)),
    MAX_INPUT_CHANNELS,
  )
  const picks: ChannelPick[] = []
  for (let channel = 0; channel < count; channel += 1)
    picks.push({ channel, pair: false })
  for (let channel = 0; channel + 1 < count; channel += 2)
    picks.push({ channel, pair: true })
  return picks
}

/** Whether two picks take the same channels; null is nobody's choice. */
export function samePick(
  a: ChannelPick | null,
  b: ChannelPick | null,
): boolean {
  return a === null || b === null
    ? a === b
    : a.channel === b.channel && a.pair === b.pair
}

/** Loudest channel, for "your guitar is on input 2". Null when all silent. */
export function loudestChannel(
  levels: readonly number[],
  floor = 0.005,
): number | null {
  let best: number | null = null
  let bestLevel = floor
  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i] ?? 0
    if (level > bestLevel) {
      best = i
      bestLevel = level
    }
  }
  return best
}

export interface ChannelSplit {
  /** Feed the source in. Until then no channel carries anything. */
  open(): void
  /** Send one channel into `target`'s first input. */
  send(channel: number, target: AudioNode): void
  /** Take `target` off `channel` again; nothing when it was not sent there. */
  unsend(channel: number, target: AudioNode): void
  /** One channel as a node of its own: mono, never mixed with the others. */
  alone(channel: number): GainNode
  /** `channel` and the one after it as one mono node: the two summed at half each, the others left out. */
  pair(channel: number): GainNode
  /** A pick as one mono node: its channel alone, or its pair. */
  take(pick: ChannelPick): GainNode
  /** Take the split out: its edge from the source, if it was fed, then its outlets. */
  close(): void
}

/**
 * Split `source` into its `channelCount` channels. Nothing is connected
 * until `open`, so a caller can build the rest of its graph, or fail to,
 * before the source feeds anything.
 */
export function splitChannels(
  context: BaseAudioContext,
  source: AudioNode,
  channelCount: number,
): ChannelSplit {
  const splitter = context.createChannelSplitter(channelCount)
  let opened = false
  // Everything stays inside this function: a browser test hands it to a
  // page as its text (studio-lane-input.spec.ts).
  const mono = (channels: readonly number[], gain: number) => {
    const node = context.createGain()
    node.channelCount = 1
    node.channelCountMode = 'explicit'
    node.channelInterpretation = 'discrete'
    if (gain !== 1) node.gain.value = gain
    for (const channel of channels) splitter.connect(node, channel, 0)
    return node
  }
  const alone = (channel: number) => mono([channel], 1)
  const pair = (channel: number) => mono([channel, channel + 1], 0.5)
  return {
    open() {
      source.connect(splitter)
      opened = true
    },
    send(channel, target) {
      splitter.connect(target, channel, 0)
    },
    unsend(channel, target) {
      try {
        splitter.disconnect(target, channel, 0)
      } catch {
        // Not sent there, or the split is already closed.
      }
    },
    alone,
    pair,
    take: (pick) => (pick.pair ? pair(pick.channel) : alone(pick.channel)),
    close() {
      if (opened) {
        try {
          source.disconnect(splitter)
        } catch {
          // The source's owner may already have let it go.
        }
      }
      splitter.disconnect()
    },
  }
}
