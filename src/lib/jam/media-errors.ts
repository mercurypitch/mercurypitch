// ── Media error messages ─────────────────────────────────────────────
// getUserMedia failures all arrive as a DOMException, and the difference
// between them is the difference between "tap allow" and "you cannot fix
// this here". Saying "access denied or unavailable" for every one of them
// sends people looking for a prompt that is never going to appear.

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

/**
 * What the browser already decided, before we ask.
 *
 * A site-level Block is the case worth catching: getUserMedia rejects
 * instantly with NotAllowedError and shows no prompt at all, by design, so
 * a page cannot nag past a decision. Nothing in the app can undo it -- only
 * a message that names the browser's own settings helps.
 *
 * The Permissions API is not universally implemented for microphone (Firefox
 * notably), hence 'unknown' rather than a guess.
 */
export async function micPermissionState(): Promise<MicPermissionState> {
  try {
    const perms = navigator.permissions
    if (perms === undefined) return 'unknown'
    const status = await perms.query({
      name: 'microphone' as PermissionName,
    })
    if (
      status.state === 'granted' ||
      status.state === 'denied' ||
      status.state === 'prompt'
    ) {
      return status.state
    }
    return 'unknown'
  } catch {
    // Unsupported descriptor, or a browser that throws rather than rejects.
    return 'unknown'
  }
}

/**
 * Turn a getUserMedia rejection into something worth reading.
 *
 * `blocked` is passed separately because NotAllowedError covers both "you
 * dismissed the prompt" and "this site is blocked in settings", and only
 * the Permissions API can tell them apart.
 */
export function micErrorMessage(err: unknown, blocked: boolean): string {
  const name = err instanceof DOMException ? err.name : ''

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return blocked
      ? 'Your browser is blocking the microphone for this site. No prompt will appear until you change it: open the padlock (or site settings) in the address bar, set Microphone to Allow, then reload.'
      : 'Microphone permission was not granted. Try again and choose Allow when your browser asks.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Plug one in, or pick a different input in your system settings.'
  }
  // Another app or tab holding the device exclusively -- common on Windows.
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The microphone is in use by another app or tab. Close whatever is holding it and try again.'
  }
  if (!window.isSecureContext) {
    return 'The microphone needs a secure connection. Open this page over https and try again.'
  }
  return 'Microphone unavailable.'
}
