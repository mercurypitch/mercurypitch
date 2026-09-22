// ── Jam audio source ─────────────────────────────────────────────────
// What the room captures, and whether it got what it asked for.
//
// The room has always captured "the microphone": the default device, and a
// transmitted clone with echo cancellation, noise suppression and automatic
// gain control turned back ON to stop two laptops on speakers howling at
// each other (docs/plans/jam-mic-feedback.md). That is right for a voice
// room and wrong for an instrument, where the same three processors gate
// sustained notes, eat pick attack and pump every dynamic the player put
// in. A guitar is not a voice with a different timbre; it is a signal the
// voice pipeline is actively hostile to.
//
// So a capture now has a PROFILE. `voice` is exactly today's behaviour.
// `instrument` picks a named input and asks for nothing to be done to it.
//
// VERIFY, NEVER ASSUME. Constraints are requests. Chrome silently ignores
// `applyConstraints()` for audio-processing properties on a live track, so
// everything here is set at getUserMedia time -- and even then the answer
// is whatever `getSettings()` says afterwards, not what was asked for.
// `describeCapture` is how the room finds out, and how a test session can
// see on screen whether the processing really is off.
//
// Tests: src/tests/jam-audio-source.test.ts.

export type JamAudioProfile = 'voice' | 'instrument'

/**
 * Chrome's master switch is `echoCancellation`.
 *
 * Since M37 setting it false disables the whole getUserMedia processing
 * chain rather than just the canceller, and it is also what unlocks a true
 * stereo capture. Firefox treats the three independently, so all three are
 * set explicitly rather than relying on the one.
 *
 * `voiceIsolation` is newer, already shipping, and platform-gated today --
 * which means it is the one that will quietly start mangling a guitar as
 * Chrome extends support. It is not in the DOM typings yet, hence the cast
 * at the end of `constraintsFor`.
 */
interface ExtendedAudioConstraints extends MediaTrackConstraints {
  voiceIsolation?: boolean
}

/** Mono. A DI is one signal, and Safari captures one channel regardless. */
const CAPTURE_CHANNELS = 1

export function constraintsFor(
  profile: JamAudioProfile,
  deviceId: string | null,
): MediaTrackConstraints {
  const processed = profile === 'voice'
  const base: ExtendedAudioConstraints = {
    echoCancellation: processed,
    noiseSuppression: processed,
    autoGainControl: processed,
    voiceIsolation: false,
    channelCount: { ideal: CAPTURE_CHANNELS },
    sampleRate: { ideal: 48000 },
  }
  // `exact`, so a stale id fails loudly instead of silently handing back
  // the built-in microphone -- which for a guitarist is the difference
  // between "no sound" and "the room hears my laptop fan". The caller
  // retries without it; see startLocalAudio.
  if (deviceId !== null && deviceId !== '') {
    base.deviceId = { exact: deviceId }
  }
  return base as MediaTrackConstraints
}

/** What the browser actually gave us, and whether it is fit for purpose. */
export interface JamCaptureReport {
  profile: JamAudioProfile
  deviceLabel: string
  echoCancellation: boolean | null
  noiseSuppression: boolean | null
  autoGainControl: boolean | null
  channelCount: number | null
  sampleRate: number | null
  /** True when the profile's intent survived contact with the browser. */
  asRequested: boolean
  /** Plain sentences, safe to show a musician mid-session. */
  warnings: readonly string[]
}

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * Read a capture back and say whether it is what the profile needed.
 *
 * A missing setting reads as `null`, not as `false`. Safari omits most of
 * this block, and "the browser did not say" is a different fact from "the
 * processing is off" -- the first cannot be acted on, the second can.
 */
export function describeCapture(
  profile: JamAudioProfile,
  settings: MediaTrackSettings | null | undefined,
  deviceLabel = '',
): JamCaptureReport {
  const s = settings ?? {}
  const ec = bool(s.echoCancellation)
  const ns = bool(s.noiseSuppression)
  const agc = bool(s.autoGainControl)
  const channelCount = num(s.channelCount)
  const sampleRate = num(s.sampleRate)
  const warnings: string[] = []

  if (profile === 'instrument') {
    const on = [
      ec === true ? 'echo cancellation' : null,
      ns === true ? 'noise suppression' : null,
      agc === true ? 'automatic gain control' : null,
    ].filter((x): x is string => x !== null)
    if (on.length > 0) {
      warnings.push(
        `This browser kept ${joinWords(on)} on. Sustained notes will be gated and your dynamics squashed.`,
      )
    }
    if (ec === null && ns === null && agc === null) {
      warnings.push(
        'This browser does not report whether it is processing the input, so the signal may not be raw.',
      )
    }
    if (sampleRate !== null && sampleRate !== 48000) {
      warnings.push(
        `Capturing at ${sampleRate} Hz, so the browser is resampling to 48 kHz. Set the interface to 48 kHz to avoid it.`,
      )
    }
  }

  const asRequested =
    profile === 'voice'
      ? ec !== false
      : ec !== true && ns !== true && agc !== true

  return {
    profile,
    deviceLabel,
    echoCancellation: ec,
    noiseSuppression: ns,
    autoGainControl: agc,
    channelCount,
    sampleRate,
    asRequested,
    warnings,
  }
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

// ── Devices ──────────────────────────────────────────────────────────

export interface JamAudioInput {
  deviceId: string
  label: string
  /**
   * A loopback of something this machine is PLAYING, not something it is
   * hearing.
   *
   * PipeWire and PulseAudio expose one of these per output ("Monitor of
   * Built-in Audio"), and they enumerate as ordinary capture devices. In a
   * jam room picking one is never right and is actively harmful: you
   * capture the room's own output and send it back, which is a feedback
   * loop with a network round trip in the middle. Linux users are the ones
   * who will see these, which makes it exactly the footgun a guitarist on
   * Arch would find first.
   */
  isLoopback: boolean
}

/**
 * Spot a monitor source by its name, which is all we have.
 *
 * The device id is hashed per origin, so the `.monitor` suffix PulseAudio
 * uses internally never reaches us -- only the human label does. That
 * label is generated as "Monitor of <sink>" and is not reliably localised,
 * so this is a heuristic and is used to SORT and WARN rather than to hide:
 * a wrong guess that buries a real input would be worse than the footgun
 * it prevents.
 */
export function isLoopbackLabel(label: string): boolean {
  return /\bmonitor of\b|\bloopback\b/i.test(label)
}

/**
 * The input devices worth offering, with usable names.
 *
 * Labels are empty until a capture has been permitted at least once, so a
 * picker shown before the first unmute would list "", "", "". The caller
 * decides what to do about that; this only reports what is there.
 *
 * Chrome's synthetic "default" entry is kept deliberately -- it is the
 * right choice for the singer on a phone, and dropping it would leave a
 * list whose first useful row is an interface they do not own.
 */
export async function listJamAudioInputs(): Promise<JamAudioInput[]> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== 'function') return []
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, index) => {
        const label = d.label !== '' ? d.label : `Input ${index + 1}`
        return {
          deviceId: d.deviceId,
          label,
          isLoopback: isLoopbackLabel(label),
        }
      })
    // Real inputs first, monitors last, each group in the order the
    // browser gave them -- which on every platform puts the default first.
    return [
      ...inputs.filter((d) => !d.isLoopback),
      ...inputs.filter((d) => d.isLoopback),
    ]
  } catch {
    // Enumeration can reject in a cross-origin frame or with media blocked.
    return []
  }
}

export const PROFILE_COPY: Record<
  JamAudioProfile,
  { label: string; hint: string }
> = {
  voice: {
    label: 'Voice',
    hint: 'Echo cancellation on, so speakers do not feed back. Right for talking and for singing.',
  },
  instrument: {
    label: 'Instrument',
    hint: 'Nothing applied to the signal. Right for a guitar or keys through an interface. Use headphones.',
  },
}
