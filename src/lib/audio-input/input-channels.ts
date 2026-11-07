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
  /** One channel as a node of its own: mono, never mixed with the others. */
  alone(channel: number): GainNode
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
  return {
    open() {
      source.connect(splitter)
      opened = true
    },
    send(channel, target) {
      splitter.connect(target, channel, 0)
    },
    alone(channel) {
      const mono = context.createGain()
      mono.channelCount = 1
      mono.channelCountMode = 'explicit'
      mono.channelInterpretation = 'discrete'
      splitter.connect(mono, channel, 0)
      return mono
    },
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
