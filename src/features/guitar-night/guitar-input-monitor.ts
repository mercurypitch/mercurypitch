// Guitar input monitoring adds an opt-in wet branch to an already-owned interface source.
// ============================================================

import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { createGuitarElectricAmpStage } from '@/lib/guitar/guitar-electric-amp'

const MONITOR_GAIN_TIME_CONSTANT_SECONDS = 0.01

export interface GuitarInputMonitor {
  setEnabled(enabled: boolean): boolean
  setParameters(parameters: GuitarElectricAmpParameters): void
  dispose(): void
}

interface GuitarInputMonitorOptions {
  context: AudioContext
  source: MediaStreamAudioSourceNode
  destination: AudioNode
  parameters: GuitarElectricAmpParameters
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
  const stage = createGuitarElectricAmpStage(
    options.context,
    options.parameters,
  )
  const output = options.context.createGain()
  output.gain.setValueAtTime(0, options.context.currentTime)
  options.source.connect(stage.input)
  stage.output.connect(output)
  output.connect(options.destination)

  let enabled = false
  let disposed = false

  const disconnect = (): void => {
    try {
      options.source.disconnect(stage.input)
    } catch {
      // The listening controller may already have disconnected every branch.
    }
    output.disconnect()
    stage.dispose()
  }

  return {
    setEnabled(nextEnabled) {
      if (disposed) return false
      enabled = nextEnabled
      setMonitorGainTarget(
        output.gain,
        nextEnabled ? 1 : 0,
        options.context.currentTime,
      )
      return enabled
    },
    setParameters(parameters) {
      if (disposed) return
      stage.setParameters(parameters, options.context.currentTime)
    },
    dispose() {
      if (disposed) return
      disposed = true
      enabled = false
      // The listening owner releases the source stream immediately afterwards,
      // so a delayed gain release would be cut off upstream. Disconnect now;
      // deliberate in-session toggles still use the pop-free ramp above.
      disconnect()
    },
  }
}
