// ============================================================
// Turning a failed mic acquire into a line worth reading
// ============================================================
//
// The engine already classifies the failure (MicError.kind); the games
// used to throw that away and print one generic "Microphone unavailable
// — check permissions and retry." for every cause. That sentence sent a
// real Android bug round the houses: Capacitor was denying the WebView's
// audio-capture request because the app's manifest was missing
// MODIFY_AUDIO_SETTINGS, and the screen looked exactly like a permission
// the player had refused — while Android settings showed the microphone
// as allowed, so "check permissions" was advice that could not work.
//
// So each kind gets its own line, and each line says what to DO.

export interface MicErrorLike {
  kind: string
  message?: string
}

const isMicErrorLike = (err: unknown): err is MicErrorLike =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as { kind?: unknown }).kind === 'string'

/** The player-facing line for a failed mic acquire. */
export const micErrorLine = (err: unknown): string => {
  if (!isMicErrorLike(err)) {
    const message =
      err instanceof Error && err.message.length > 0 ? ` (${err.message})` : ''
    return `The microphone did not start${message}. Try again, or restart the app.`
  }
  switch (err.kind) {
    case 'permission-denied':
      return 'Microphone access was refused. Allow the microphone for this app, then tap to start again.'
    case 'device-busy':
      return 'Another app is using the microphone. Close it, then tap to start again.'
    case 'no-device':
      return 'No microphone was found on this device.'
    case 'held-elsewhere':
      return 'Another Beside Cue tab is holding the microphone. Close it, then tap to start again.'
    // The one failure that retrying can never fix, and the one the player
    // can fix in a second once told what it actually is. Browsers withhold
    // `navigator.mediaDevices` entirely outside a secure context, so a LAN
    // address over plain http has no microphone at all -- which surfaced as
    // "undefined is not an object (evaluating
    // 'navigator.mediaDevices.getUserMedia')", a sentence about the wrong
    // thing.
    case 'insecure-context':
      return 'The microphone needs a secure connection. Open this page over https, or on localhost — http on a network address hides the microphone from every browser.'
    default:
      return typeof err.message === 'string' && err.message.length > 0
        ? err.message
        : 'The microphone did not start. Try again, or restart the app.'
  }
}
