// ============================================================
// Saved input — a remembered input found again, by its id and then by its name
// ============================================================
//
// A room that remembers an input keeps its id and its name, because the id
// alone does not survive a change of profile or of site data
// (resolveDeviceId). A loopback is never found by name: one picked by
// mistake is a room sending its own sound back to itself. Jam finds its
// saved input through here, and so will any room that keeps an input of its
// own.

/** A device as an input list offers it: its id and the name it shows. */
type ListedDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>

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
 * Exact id first; then the same label, never a loopback's; then nothing,
 * and let the caller take the default.
 */
export function resolveDeviceId(
  savedId: string | null,
  savedLabel: string | null,
  devices: readonly ListedDevice[],
): string | null {
  if (savedId !== null && devices.some((d) => d.deviceId === savedId)) {
    return savedId
  }
  if (savedLabel !== null && savedLabel !== '') {
    const byLabel = devices.find(
      (d) => d.label === savedLabel && !isLoopbackLabel(d.label),
    )
    if (byLabel !== undefined) return byLabel.deviceId
  }
  return null
}
