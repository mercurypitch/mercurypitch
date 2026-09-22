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
 * at the end of `captureConstraints`.
 */
interface ExtendedAudioConstraints extends MediaTrackConstraints {
  voiceIsolation?: boolean
}

/**
 * NO channel constraint, deliberately.
 *
 * This asked for `channelCount: { ideal: 1 }` and that was the reason a
 * 4-in interface had no channels to choose between: the browser was told
 * to hand back one, so a guitar on input 1 and a microphone on input 2
 * arrived already summed and nothing downstream could separate them.
 *
 * Guitar Night has never had that problem because `ANALYSIS_CONSTRAINTS`
 * in mic-manager.ts asks for no channel count at all and takes the
 * device's native one, which is how it offers "Input 1 / Input 2" on the
 * same hardware. Matching it is what lets the monitor show which input the
 * signal is really on.
 *
 * What the ROOM hears is unchanged: the transmitted track is still the raw
 * capture with no graph in the way, and the browser downmixes it for Opus
 * exactly as it did before. Choosing a channel governs monitoring and the
 * meter, not transmission -- see jam-input-monitor.ts for why that line is
 * drawn where it is.
 */

/**
 * The capture is ALWAYS raw, whatever the profile.
 *
 * This took a review to get right and the mistake is worth recording.
 * Making the constraints profile-dependent -- processed for `voice`, raw
 * for `instrument` -- looks obvious and is wrong twice over, because the
 * captured track is not the track the peers hear:
 *
 *  - the raw capture feeds the PITCH DETECTOR, and gating a sustained
 *    quiet note or pumping its level corrupts the trail and the scoring;
 *  - `makeTransmitTrack` checks `raw.getSettings().echoCancellation` to
 *    detect a device that applied the clone's constraints to the shared
 *    source. Capture with cancellation already on and that guard fires on
 *    every voice capture, stops the clone, and leaves the room sending an
 *    uncancelled track -- reinstating the feedback bug it exists to
 *    prevent.
 *
 * So: capture raw, and let the profile decide whether a PROCESSED CLONE
 * is made for transmission. That is exactly what the room did before this
 * file existed; all that is added here is choosing the device.
 */
export function captureConstraints(
  deviceId: string | null,
): MediaTrackConstraints {
  const base: ExtendedAudioConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    voiceIsolation: false,
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

  return {
    profile,
    deviceLabel,
    echoCancellation: ec,
    noiseSuppression: ns,
    autoGainControl: agc,
    channelCount,
    sampleRate,
    // A voice wants the processing ON and an instrument wants it off, so
    // "as requested" is the opposite question for each. Neither treats
    // `null` as a failure: a browser that will not say has not said no.
    asRequested:
      profile === 'voice'
        ? ec !== false
        : ec !== true && ns !== true && agc !== true,
    warnings:
      profile === 'instrument'
        ? instrumentWarnings(ec, ns, agc, sampleRate)
        : [],
  }
}

/**
 * What to tell a player whose signal did not arrive the way they asked.
 *
 * Instrument only. A voice capture that kept its processing is doing its
 * job, and the one voice failure worth naming -- cancellation that did not
 * take -- is carried by `asRequested` rather than by a sentence, because
 * the room cannot act on it either.
 */
function instrumentWarnings(
  ec: boolean | null,
  ns: boolean | null,
  agc: boolean | null,
  sampleRate: number | null,
): string[] {
  const warnings: string[] = []
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
  return warnings
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
   * loop with a network round trip in the middle.
   *
   * This is a FIREFOX-ON-LINUX problem specifically. Chromium filters
   * monitors out in its audio manager -- `InputDevicesInfoCallback` skips
   * any source with `monitor_of_sink != PA_INVALID_INDEX`, and refuses to
   * open one even if it is the system default -- so they never reach
   * enumerateDevices() there. Firefox exposes them and will happily
   * capture one.
   */
  isLoopback: boolean
}

/**
 * Spot a monitor source by its name, which is all we have.
 *
 * The device id is hashed per origin, so the `.monitor` suffix PulseAudio
 * uses internally never reaches us, and `PA_PROP_DEVICE_CLASS=monitor`
 * is not surfaced by the MediaDevices API either. The human label is
 * genuinely the best available signal.
 *
 * It is a better signal than it looks: both servers build the string with
 * a plain format call and NOT through gettext -- pipewire-pulse does
 * `snprintf(monitor_desc, size, "Monitor of %s", desc)` and PulseAudio
 * does the same in `pa_sink_new`. So it is English on every locale.
 *
 * Still used to SORT and WARN rather than to hide. "Monitor" alone is an
 * ordinary word for studio hardware, and burying somebody's real input
 * would be worse than the footgun this prevents.
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
        // NOT "Input N". Guitar Night names CHANNELS that way -- its
        // picker renders "Input 1 · Mono" -- so using the same words for
        // a device the browser has not named yet reads as a channel list
        // to anyone who has used both. It was, and the guitarist looking
        // for their interface picked from the wrong kind of thing.
        const label = d.label !== '' ? d.label : `Device ${index + 1}`
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

/**
 * Turn a remembered input into one that exists right now.
 *
 * A `deviceId` is not a hardware key. On Linux it is derived from the
 * PulseAudio source name, which carries the USB serial -- so it survives
 * reboots and even a different port -- but it also carries the PROFILE
 * suffix (`.pro-audio`, `.analog-stereo`). Switch a Scarlett from stereo
 * to Pro Audio and the id changes, the `exact` constraint fails, and the
 * room silently falls back to a laptop microphone. Clearing site data
 * does the same, because the per-origin salt resets.
 *
 * So the label is remembered alongside the id and used as the second key.
 * Exact id first; then the same label; then nothing, and let the caller
 * take the default.
 */
export function resolveDeviceId(
  savedId: string | null,
  savedLabel: string | null,
  devices: readonly JamAudioInput[],
): string | null {
  if (savedId !== null && devices.some((d) => d.deviceId === savedId)) {
    return savedId
  }
  if (savedLabel !== null && savedLabel !== '') {
    const byLabel = devices.find((d) => d.label === savedLabel && !d.isLoopback)
    if (byLabel !== undefined) return byLabel.deviceId
  }
  return null
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
