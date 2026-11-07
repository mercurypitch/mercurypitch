// ============================================================
// Devices a test can plug in and pull out
// ============================================================
//
// jsdom keeps no device list and opens no capture, so the input code would
// have nothing to read. This fakes that edge honestly instead: a device list
// on `navigator.mediaDevices` a case can change and announce, and a capture
// track that says which device it opened and fires the events a browser's
// track would.

export interface FakeTrackOptions {
  label?: string
  deviceId?: string
  groupId?: string
  /** On top of 48 kHz with the browser's voice processing off. */
  settings?: MediaTrackSettings
}

/** A live capture track: an EventTarget, so a case can fire `mute` and `ended`. */
export function fakeTrack(options: FakeTrackOptions = {}): MediaStreamTrack {
  const track = new EventTarget() as EventTarget & {
    label: string
    muted: boolean
    readyState: MediaStreamTrackState
    getSettings: () => MediaTrackSettings
  }
  track.label = options.label ?? ''
  track.muted = false
  track.readyState = 'live'
  track.getSettings = () => ({
    deviceId: options.deviceId,
    groupId: options.groupId,
    sampleRate: 48_000,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    ...options.settings,
  })
  return track as unknown as MediaStreamTrack
}

export function fakeStream(track: MediaStreamTrack = fakeTrack()): MediaStream {
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream
}

/** An input as `enumerateDevices()` lists it. */
export function audioInput(
  deviceId: string,
  label: string,
  groupId = deviceId,
): MediaDeviceInfo {
  return { deviceId, groupId, kind: 'audioinput', label } as MediaDeviceInfo
}

export interface FakeMediaDevices {
  /** What `enumerateDevices()` lists from now on. */
  list: (devices: MediaDeviceInfo[]) => void
  /** Fire `devicechange`, as a plug or an unplug would. */
  change: () => void
  /** Put the browser's own `navigator.mediaDevices` back. */
  restore: () => void
}

/** Puts a device list on `navigator.mediaDevices` that a case controls. */
export function fakeMediaDevices(
  initial: MediaDeviceInfo[] = [],
): FakeMediaDevices {
  let devices = initial
  const target = new EventTarget()
  const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: () => Promise.resolve(devices),
      getUserMedia: () => Promise.reject(new Error('not in this test')),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
  })
  return {
    list: (next) => {
      devices = next
    },
    change: () => {
      target.dispatchEvent(new Event('devicechange'))
    },
    restore: () => {
      if (original === undefined) {
        Reflect.deleteProperty(navigator, 'mediaDevices')
      } else {
        Object.defineProperty(navigator, 'mediaDevices', original)
      }
    },
  }
}
