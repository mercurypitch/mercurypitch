// Guitar input monitoring adds an opt-in wet branch to an already-owned interface source.
// ============================================================

import { createGuitarAmpStage } from '@/lib/guitar/guitar-amp-stage'
import type { GuitarElectricAmpParameters, GuitarElectricAmpStage, } from '@/lib/guitar/guitar-electric-amp'

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
  const output = options.context.createGain()
  output.gain.setValueAtTime(0, options.context.currentTime)
  output.connect(options.destination)

  let stage: GuitarElectricAmpStage | undefined
  let parameters = options.parameters
  let enabled = false
  let disposed = false

  const disconnect = (): void => {
    if (stage !== undefined) {
      try {
        options.source.disconnect(stage.input)
      } catch {
        // The listening controller may already have disconnected every branch.
      }
      stage.dispose()
    }
    output.disconnect()
  }

  return {
    setEnabled(nextEnabled) {
      if (disposed) return false
      if (nextEnabled && stage === undefined) {
        // Listening alone needs only dry analysis. Studio assets and DSP wait
        // for the separate, explicit headphone-monitor action.
        stage = createGuitarAmpStage(options.context, parameters)
        options.source.connect(stage.input)
        stage.output.connect(output)
      }
      enabled = nextEnabled
      setMonitorGainTarget(
        output.gain,
        nextEnabled ? 1 : 0,
        options.context.currentTime,
      )
      return enabled
    },
    setParameters(nextParameters) {
      if (disposed) return
      parameters = nextParameters
      stage?.setParameters(nextParameters, options.context.currentTime)
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
