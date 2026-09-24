// Museum microphone errors — translate the shared manager's classified failures into honest recovery.

export type MicrophoneRecoveryAction = 'take-over' | 'retry' | 'none'

export type MicrophoneIssueKind =
  | 'permission-denied'
  | 'device-busy'
  | 'no-device'
  | 'held-elsewhere'
  | 'insecure-context'
  | 'unknown'

export interface MicrophoneIssue {
  kind: MicrophoneIssueKind
  message: string
  action: MicrophoneRecoveryAction
}

export function microphoneIssue(cause: unknown): MicrophoneIssue {
  const error =
    typeof cause === 'object' && cause !== null
      ? (cause as { kind?: string; name?: string })
      : {}
  if (error.kind === 'permission-denied' || error.name === 'NotAllowedError')
    return {
      kind: 'permission-denied',
      message:
        'Microphone access is off. Allow it in your browser or app settings, then try again.',
      action: 'retry',
    }
  if (error.kind === 'no-device' || error.name === 'NotFoundError')
    return {
      kind: 'no-device',
      message: 'No microphone was found. Connect one, then try again.',
      action: 'retry',
    }
  if (error.kind === 'insecure-context')
    return {
      kind: 'insecure-context',
      message:
        'The microphone needs HTTPS or localhost. Open the secure game link to sing.',
      action: 'none',
    }
  if (error.kind === 'held-elsewhere')
    return {
      kind: 'held-elsewhere',
      message:
        'Another tab for this app is using the microphone. Move it to Glassworks to continue here.',
      action: 'take-over',
    }
  if (error.kind === 'device-busy')
    return {
      kind: 'device-busy',
      message:
        'Another app or browser outside this Glassworks session may be using the microphone. Close it, then try again.',
      action: 'retry',
    }
  return {
    kind: 'unknown',
    message:
      'The microphone could not start. Check your microphone connection, then try again.',
    action: 'retry',
  }
}

export function microphoneTakeoverTimedOut(): MicrophoneIssue {
  return {
    kind: 'held-elsewhere',
    message:
      'The other tab did not release the microphone. If it was just closed, wait a moment, then use it here again.',
    action: 'take-over',
  }
}

export function microphoneError(cause: unknown): string {
  return microphoneIssue(cause).message
}
