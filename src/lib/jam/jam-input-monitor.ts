// ── Jam input monitor ────────────────────────────────────────────────
// Is the guitar reaching the browser at all, and on which channel?
//
// A jam room has no answer to that today. You unmute, you play, and the
// only feedback is whether somebody in another country says they can hear
// you -- which on the run this was written for was "no", for a reason
// (nothing was being sent) that had nothing to do with the instrument.
//
// Guitar Night solved this long ago and the shape is worth copying:
// capture every channel the interface exposes, split them, and let a
// player see and hear one. `createGuitarInputMonitor` does it with an amp
// stage in the path because Guitar Night is playing through an amp
// simulation; this is deliberately the plain version.
//
// TWO THINGS, DELIBERATELY SEPARATE. The METER runs whenever the monitor
// exists, because "can the browser see my guitar" is a question you want
// answered without putting the signal in your ears. HEARING yourself is
// opt-in on top of that, because in a room with speakers it is a feedback
// loop.
//
// NOT IN THE SEND PATH. Routing the transmitted track through here would
// mean a MediaStreamDestination and one more Web Audio buffer between the
// pickup and the encoder, on the one feature where that cost is the whole
// point. So the room still hears the raw capture track exactly as it did;
// this is a branch off it, and the channel chosen here changes what YOU
// hear and what the meter reports, not what anyone else does. The UI has
// to say so, or it is a lie of exactly the kind this panel exists to
// stop telling.
//
// Tests: src/tests/jam-input-monitor.test.ts.

/** Web Audio's own ceiling for a splitter, and Guitar Night's too. */
export const MAX_MONITOR_CHANNELS = 32

export interface JamInputMonitor {
  /** How many channels this capture actually exposes. */
  readonly channelCount: number
  /** Audible monitoring. The meter is unaffected. */
  setEnabled(enabled: boolean): void
  enabled(): boolean
  /** Which channel is monitored and metered as `level()`. Zero-based. */
  setChannel(channel: number): void
  channel(): number
  /** RMS of the selected channel, 0-1, whether or not it is audible. */
  level(): number
  /** RMS per channel, so the live input can be found rather than guessed. */
  channelLevels(): readonly number[]
  /**
   * What this graph adds, in ms, from `AudioContext.baseLatency`.
   *
   * Reported rather than assumed. It is also the one capture-side latency
   * figure available to script, which the latency budget currently guesses
   * at as a platform constant.
   */
  baseLatencyMs(): number | null
  dispose(): void
}

export interface JamInputMonitorOptions {
  stream: MediaStream
  /** Injected in tests; a real one is created when absent. */
  context?: AudioContext
  channel?: number
}

/** The channel count a capture really has, clamped to what we can address. */
export function monitorChannelCount(
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
  // answer; here a channel past 32 costs you the ability to monitor it,
  // which is worth strictly less than a room that will not open.
  return Math.min(Math.max(1, exposed), MAX_MONITOR_CHANNELS)
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

function rms(data: Float32Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i] ?? 0
    sum += v * v
  }
  return data.length === 0 ? 0 : Math.sqrt(sum / data.length)
}

/**
 * Open a monitor on a capture.
 *
 * Returns null rather than throwing when the browser cannot build the
 * graph -- an AudioContext refused before a user gesture, a stream with no
 * audio track. A room that works minus one diagnostic is a better outcome
 * than a room that does not open.
 */
export function createJamInputMonitor(
  options: JamInputMonitorOptions,
): JamInputMonitor | null {
  const track = options.stream.getAudioTracks()[0]
  if (track === undefined) return null

  let context: AudioContext
  try {
    context =
      options.context ??
      new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
  } catch {
    return null
  }

  let source: MediaStreamAudioSourceNode
  try {
    source = context.createMediaStreamSource(options.stream)
  } catch {
    if (options.context === undefined) void context.close?.()
    return null
  }

  const channelCount = monitorChannelCount(
    track.getSettings?.().channelCount,
    source.channelCount,
  )
  let channel = Math.min(Math.max(0, options.channel ?? 0), channelCount - 1)
  let isEnabled = false
  let disposed = false

  const splitter = context.createChannelSplitter(channelCount)
  source.connect(splitter)

  // One analyser per channel. This is what makes "which input is my guitar
  // on" answerable by looking rather than by unplugging things.
  const analysers: AnalyserNode[] = []
  const buffers: Float32Array[] = []
  // A silent sink: some WebKit builds only pull an analyser that is
  // transitively connected to the destination, and a meter that reads zero
  // on a phone is worse than no meter (see JamPitchDetector, same fix).
  const sink = context.createGain()
  sink.gain.value = 0
  sink.connect(context.destination)

  for (let i = 0; i < channelCount; i += 1) {
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
    splitter.connect(analyser, i, 0)
    analyser.connect(sink)
    analysers.push(analyser)
    buffers.push(new Float32Array(analyser.fftSize))
  }

  // The audible branch, held at zero until asked for.
  const monitorGain = context.createGain()
  monitorGain.gain.value = 0
  monitorGain.connect(context.destination)
  let picked: GainNode | null = null

  const connectPicked = (): void => {
    picked?.disconnect()
    picked = context.createGain()
    picked.channelCount = 1
    picked.channelCountMode = 'explicit'
    picked.channelInterpretation = 'discrete'
    splitter.connect(picked, channel, 0)
    picked.connect(monitorGain)
  }
  connectPicked()

  const levelOf = (index: number): number => {
    const analyser = analysers[index]
    const buffer = buffers[index]
    if (analyser === undefined || buffer === undefined) return 0
    analyser.getFloatTimeDomainData(buffer as Float32Array<ArrayBuffer>)
    return rms(buffer)
  }

  return {
    channelCount,
    enabled: () => isEnabled,
    channel: () => channel,
    setEnabled(next: boolean): void {
      if (disposed || next === isEnabled) return
      isEnabled = next
      // Ramped, not stepped: a gain that jumps to 1 on a guitar already
      // being played is a click straight into somebody's headphones.
      const at = context.currentTime
      monitorGain.gain.cancelScheduledValues(at)
      monitorGain.gain.setValueAtTime(monitorGain.gain.value, at)
      monitorGain.gain.linearRampToValueAtTime(next ? 1 : 0, at + 0.02)
      if (next) void context.resume?.()
    },
    setChannel(next: number): void {
      if (disposed) return
      const clamped = Math.min(Math.max(0, Math.floor(next)), channelCount - 1)
      if (clamped === channel) return
      channel = clamped
      connectPicked()
    },
    level: () => (disposed ? 0 : levelOf(channel)),
    channelLevels: () =>
      disposed ? [] : analysers.map((_, index) => levelOf(index)),
    baseLatencyMs: () => {
      const base = context.baseLatency
      return typeof base === 'number' && Number.isFinite(base)
        ? base * 1000
        : null
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      try {
        picked?.disconnect()
        monitorGain.disconnect()
        for (const a of analysers) a.disconnect()
        sink.disconnect()
        splitter.disconnect()
        source.disconnect()
      } catch {
        // Already torn down by a closing context; nothing to undo.
      }
      // Only ours. A caller-supplied context belongs to the caller.
      if (options.context === undefined) void context.close?.()
    },
  }
}
