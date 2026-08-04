// ============================================================
// input-health — is the microphone we were granted actually hearing anything?
// ============================================================
//
// A granted permission is not a working microphone. The OS can hand us a
// device that is muted at the system level, a Bluetooth headset can connect
// its playback profile without its input one, and a browser can quietly pick
// the webcam mic pointing at a wall instead of the headset on the singer's
// head. Every one of those looks identical from inside the app: the stream is
// live, frames arrive on schedule, and all of them are silent.
//
// So we watch the level. Once the singer has been asked to sing and we have
// heard nothing at all for a few seconds, that is worth saying out loud —
// it is the difference between "you sang flat" and "we never heard you".
//
// Pure and browser-free on purpose. The transitions are the part worth
// testing and they should be testable without a microphone.

export type InputHealth = 'unknown' | 'healthy' | 'silent'

/**
 * The level below which a frame counts as "nothing there", as linear RMS.
 *
 * 0.0018 is about -55 dBFS: below the room tone a laptop mic picks up at
 * normal gain, well above the numerical floor of a muted stream. A singer
 * whispering a metre away clears it comfortably, which is the point — this
 * must only fire when there is genuinely no signal, never merely a quiet one.
 */
export const SIGNAL_FLOOR_RMS = 0.0018

/**
 * How long we listen before deciding the silence is a fault rather than a
 * pause. Long enough to cover a count-in, a held breath and a late start;
 * short enough that nobody sings a whole exercise into a dead mic.
 */
export const SILENCE_GRACE_MS = 6000

export interface InputHealthState {
  status: InputHealth
  /** The loudest frame seen since this arm. */
  peakRms: number
  /** When the current arm began, or null while disarmed. */
  armedAt: number | null
}

export function initialInputHealth(): InputHealthState {
  return { status: 'unknown', peakRms: 0, armedAt: null }
}

/**
 * Start watching. Call when the singer has been asked for input — a take
 * starting, a tuner opening — not merely when the mic was acquired. Silence
 * during a brief or a reference tone is the correct behaviour, not a fault.
 */
export function armInputHealth(now: number): InputHealthState {
  return { status: 'unknown', peakRms: 0, armedAt: now }
}

/** Stop watching, and forget what we heard. */
export function disarmInputHealth(): InputHealthState {
  return initialInputHealth()
}

/**
 * Fold one observed level into the state, returning the same object when
 * nothing changed so callers can skip a re-render.
 *
 * `healthy` is sticky for the rest of the arm: once we have heard the singer
 * the device demonstrably works, and a rest between phrases must not raise an
 * alarm. A device that dies mid-run is a different failure with a different
 * detector — the stream's own `ended` event, and @/lib/mic-sentinel.
 */
export function observeInputLevel(
  state: InputHealthState,
  rms: number,
  now: number,
): InputHealthState {
  if (state.armedAt === null) return state
  if (state.status === 'healthy') return state

  const peakRms = rms > state.peakRms ? rms : state.peakRms

  if (peakRms >= SIGNAL_FLOOR_RMS) {
    return { status: 'healthy', peakRms, armedAt: state.armedAt }
  }

  const status: InputHealth =
    now - state.armedAt >= SILENCE_GRACE_MS ? 'silent' : 'unknown'

  if (status === state.status && peakRms === state.peakRms) return state
  return { status, peakRms, armedAt: state.armedAt }
}
