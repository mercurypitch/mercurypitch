// ============================================================
// What this device can actually do — read from the device itself
// ============================================================
//
// Compatibility tables disagree about Android System WebView (caniuse
// says no WebGPU, MDN's data mirrors Chrome's yes), and neither is a
// measurement: the app runs in the WebView, so the app is the only
// honest source. This module answers three questions a bug report or a
// renderer decision actually needs — which engine is hosting us, what
// graphics backend exists, and whether the microphone is granted — and
// the Settings screen shows them behind a tap.
//
// The parsing half is pure so it can be tested; the probing half is a
// thin async wrapper that never throws.

export interface DeviceSupport {
  /** 'Android WebView 121', 'Chrome 138', 'Safari', … */
  engine: string
  /** 'WebGPU ready', 'WebGPU present, no adapter', 'WebGL2', 'none' */
  graphics: string
  /** 'granted' | 'prompt' | 'denied' | 'unknown' */
  microphone: string
}

/**
 * Which browser engine is hosting the page. The `; wv)` token is what
 * separates an Android System WebView (what a Capacitor app runs in)
 * from Chrome for Android — the distinction the compat tables blur, and
 * the one that decides whether a WebGPU renderer can ship in the app.
 */
export const parseEngineLabel = (userAgent: string): string => {
  const chrome = /Chrome\/(\d+)/.exec(userAgent)?.[1]
  if (chrome !== undefined) {
    return userAgent.includes('; wv)')
      ? `Android WebView ${chrome}`
      : `Chrome ${chrome}`
  }
  const firefox = /Firefox\/(\d+)/.exec(userAgent)?.[1]
  if (firefox !== undefined) return `Firefox ${firefox}`
  const safari = /Version\/(\d+)[.\d]* Safari/.exec(userAgent)?.[1]
  if (safari !== undefined) return `Safari ${safari}`
  return 'Unknown engine'
}

/** The graphics line, given what the probes found. */
export const graphicsLabel = (facts: {
  hasWebGpuApi: boolean
  hasAdapter: boolean
  hasWebGl2: boolean
}): string => {
  if (facts.hasWebGpuApi && facts.hasAdapter) return 'WebGPU ready'
  if (facts.hasWebGpuApi) return 'WebGPU present, no adapter'
  return facts.hasWebGl2 ? 'WebGL2' : 'none'
}

const probeWebGl2 = (): boolean => {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

const probeAdapter = async (): Promise<boolean> => {
  try {
    const gpu = (
      navigator as { gpu?: { requestAdapter: () => Promise<unknown> } }
    ).gpu
    if (gpu === undefined) return false
    return (await gpu.requestAdapter()) !== null
  } catch {
    return false
  }
}

const probeMicrophone = async (): Promise<string> => {
  try {
    const permissions = navigator.permissions as
      | { query?: (d: { name: string }) => Promise<{ state: string }> }
      | undefined
    if (permissions?.query === undefined) return 'unknown'
    const status = await permissions.query({ name: 'microphone' })
    return status.state
  } catch {
    // Not every engine knows the 'microphone' permission name.
    return 'unknown'
  }
}

/** Ask the device. Never throws; unknown is a valid answer. */
export const probeDeviceSupport = async (): Promise<DeviceSupport> => {
  const hasWebGpuApi = typeof navigator !== 'undefined' && 'gpu' in navigator
  const [hasAdapter, microphone] = await Promise.all([
    hasWebGpuApi ? probeAdapter() : Promise.resolve(false),
    probeMicrophone(),
  ])
  return {
    engine: parseEngineLabel(navigator.userAgent),
    graphics: graphicsLabel({
      hasWebGpuApi,
      hasAdapter,
      hasWebGl2: probeWebGl2(),
    }),
    microphone,
  }
}
