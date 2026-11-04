// ============================================================
// Mic errors — what a failed microphone open is called, and what it tells the person
// ============================================================
//
// MicManager (mic-manager.ts) classifies every getUserMedia failure into one
// of a few kinds, so a surface can tell a denial it cannot retry from a busy
// device it can, and names the two refusals of its own: another tab holding
// the microphone, and an input of its own asked for again before it opened.

export type MicErrorKind =
  | 'permission-denied'
  | 'device-busy'
  | 'no-device'
  /** Another MercuryPitch tab holds the mic. Offer a hand-off, not a retry. */
  | 'held-elsewhere'
  | 'unknown'

export interface MicError {
  kind: MicErrorKind
  message: string
}

/**
 * The error name openDevice throws where the page cannot ask for a microphone
 * at all: no navigator.mediaDevices, as on an insecure origin, in some
 * embedded views and in some television browsers. Reaching through it anyway
 * threw a TypeError whose raw text became the copy.
 */
export const NO_CAPTURE = 'NoCaptureError'

export function classifyError(err: unknown): MicError {
  const name = (err as { name?: string } | null | undefined)?.name
  const rawMessage = (err as { message?: string } | null | undefined)?.message
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        kind: 'permission-denied',
        message:
          'Microphone access was denied. Allow microphone access in your browser to continue.',
      }
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return {
        kind: 'device-busy',
        message: 'The microphone is in use by another app or browser tab.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { kind: 'no-device', message: 'No microphone was found.' }
    case NO_CAPTURE:
      // A retry cannot help, so it is a missing device, not a busy one.
      return {
        kind: 'no-device',
        message: 'This browser cannot use a microphone.',
      }
    default:
      return {
        kind: 'unknown',
        message:
          rawMessage !== undefined && rawMessage.length > 0
            ? rawMessage
            : 'The microphone is unavailable.',
      }
  }
}

export function heldElsewhere(): MicError {
  return {
    kind: 'held-elsewhere',
    message:
      'Another MercuryPitch tab is using your microphone. Use it here instead to move it over.',
  }
}

/** An input of its own asked for again, or let go, before its open ran. */
export function superseded(): MicError {
  return { kind: 'unknown', message: 'The input changed before it opened.' }
}
