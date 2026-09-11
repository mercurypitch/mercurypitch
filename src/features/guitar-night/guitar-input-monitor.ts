// Guitar input monitoring adds an opt-in wet branch to an already-owned interface source.
// ============================================================

import { createGuitarAmpStage } from '@/lib/guitar/guitar-amp-stage'
import type { GuitarElectricAmpParameters, GuitarElectricAmpStage, } from '@/lib/guitar/guitar-electric-amp'

const MONITOR_GAIN_TIME_CONSTANT_SECONDS = 0.01
const ROUTE_RELEASE_SECONDS = 0.15
const ROUTE_WARMUP_SECONDS = 0.03

export interface GuitarInputMonitor {
  setEnabled(enabled: boolean): boolean
  /** Zero-based browser input channel. An actual change turns monitoring off. */
  setInputChannel(channel: number): boolean
  setParameters(parameters: GuitarElectricAmpParameters): void
  dispose(): void
}

interface GuitarInputMonitorOptions {
  context: BaseAudioContext
  source: AudioNode
  destination: AudioNode
  parameters: GuitarElectricAmpParameters
  inputChannel?: number
  inputChannelCount?: number
}

interface MonitorRoute {
  splitter: ChannelSplitterNode
  mono: GainNode
  stage: GuitarElectricAmpStage
}

function setMonitorGainTarget(
  gain: AudioParam,
  target: number,
  at: number,
): void {
  const held = gain.value
  if (typeof gain.cancelAndHoldAtTime === 'function') {
    gain.cancelAndHoldAtTime(at)
  } else {
    gain.cancelScheduledValues(at)
    gain.setValueAtTime(held, at)
  }
  gain.setTargetAtTime(target, at, MONITOR_GAIN_TIME_CONSTANT_SECONDS)
}

/**
 * Attach one wet monitor branch without replacing the dry analyser, worklet,
 * or recording routes already connected to the source.
 */
export function createGuitarInputMonitor(
  options: GuitarInputMonitorOptions,
): GuitarInputMonitor {
  const output = options.context.createGain()
  // A mono guitar becomes [guitar, guitar] at unity, not [guitar, silence].
  // Speaker interpretation also preserves an eventual stereo effect output.
  output.channelCount = 2
  output.channelCountMode = 'explicit'
  output.channelInterpretation = 'speakers'
  output.gain.setValueAtTime(0, options.context.currentTime)
  output.connect(options.destination)

  const channelCount =
    options.inputChannelCount === undefined ? 1 : options.inputChannelCount
  const validCount =
    Number.isInteger(channelCount) && channelCount >= 1 && channelCount <= 32
  const validChannel = (channel: number): boolean =>
    validCount &&
    Number.isInteger(channel) &&
    channel >= 0 &&
    channel < channelCount
  let inputChannel =
    options.inputChannel === undefined ? 0 : options.inputChannel
  let route: MonitorRoute | undefined
  let parameters = options.parameters
  let enabled = false
  let disposed = false
  let retireAt: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let removeResumeListener: (() => void) | undefined

  const releaseRoute = (): void => {
    if (route !== undefined) {
      try {
        options.source.disconnect(route.splitter)
      } catch {
        // The listening controller may already have disconnected every branch.
      }
      route.splitter.disconnect()
      route.mono.disconnect()
      route.stage.dispose()
      route = undefined
    }
  }

  const activate = (at = options.context.currentTime): boolean => {
    if (!validChannel(inputChannel)) return false
    if (route === undefined) {
      let splitter: ChannelSplitterNode | undefined
      let mono: GainNode | undefined
      let stage: GuitarElectricAmpStage | undefined
      let connected = false
      try {
        splitter = options.context.createChannelSplitter(channelCount)
        mono = options.context.createGain()
        mono.channelCount = 1
        mono.channelCountMode = 'explicit'
        mono.channelInterpretation = 'discrete'
        // Only this splitter outlet ever enters the head; no downmix of other
        // interface inputs, and no changes to the existing dry capture routes.
        stage = createGuitarAmpStage(options.context, parameters)
        options.source.connect(splitter)
        connected = true
        splitter.connect(mono, inputChannel, 0)
        mono.connect(stage.input)
        stage.output.connect(output)
        route = { splitter, mono, stage }
      } catch {
        if (connected) options.source.disconnect(splitter!)
        splitter?.disconnect()
        mono?.disconnect()
        stage?.dispose()
        return false
      }
    }
    setMonitorGainTarget(output.gain, 1, at)
    return true
  }

  const finishRetirement = (): void => {
    timer = undefined
    removeResumeListener?.()
    removeResumeListener = undefined
    if (disposed || retireAt === undefined) return
    const context = options.context
    if (context.state !== 'running' && context.state !== 'closed') {
      // A suspended context has not consumed its fade: park, do not wall-poll.
      context.addEventListener('statechange', finishRetirement)
      removeResumeListener = () =>
        context.removeEventListener('statechange', finishRetirement)
      return
    }
    if (context.state !== 'closed' && context.currentTime < retireAt) {
      timer = setTimeout(
        finishRetirement,
        Math.max(5, (retireAt - context.currentTime) * 1000 + 5),
      )
      return
    }
    releaseRoute()
    retireAt = undefined
    if (context.state === 'closed') enabled = false
    // A fresh head cannot retain the old input's filter/envelope/cabinet tail.
    // Selection alone never reopens it; only an explicit queued enable may.
    if (enabled) enabled = activate(context.currentTime + ROUTE_WARMUP_SECONDS)
  }

  return {
    setEnabled(nextEnabled) {
      if (disposed) return false
      if (
        !nextEnabled ||
        options.context.state === 'closed' ||
        !validChannel(inputChannel)
      ) {
        enabled = false
        setMonitorGainTarget(output.gain, 0, options.context.currentTime)
        return false
      }
      // An accepted early re-enable waits for the old route to become silent.
      enabled = retireAt !== undefined || activate()
      return enabled
    },
    setInputChannel(channel) {
      if (disposed) return false
      if (!validChannel(channel)) {
        this.setEnabled(false)
        return false
      }
      if (channel === inputChannel) return true
      inputChannel = channel
      this.setEnabled(false)
      if (route !== undefined && retireAt === undefined) {
        retireAt = options.context.currentTime + ROUTE_RELEASE_SECONDS
        finishRetirement()
      }
      return true
    },
    setParameters(nextParameters) {
      if (disposed) return
      parameters = nextParameters
      route?.stage.setParameters(nextParameters, options.context.currentTime)
    },
    dispose() {
      if (disposed) return
      disposed = true
      enabled = false
      // The listening owner releases the source stream immediately afterwards,
      // so a delayed gain release would be cut off upstream. Disconnect now;
      // deliberate in-session toggles still use the pop-free ramp above.
      if (timer !== undefined) clearTimeout(timer)
      removeResumeListener?.()
      releaseRoute()
      output.disconnect()
    },
  }
}
