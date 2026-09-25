// Museum microphone errors — translate the shared manager's classified failures into honest recovery.

export type MicrophoneRecoveryAction = 'take-over' | 'retry' | 'none'

export type MicrophoneIssueKind =
  | 'permission-denied'
  | 'device-busy'
  | 'no-device'
  | 'held-elsewhere'
  | 'insecure-context'
  | 'unknown'

export interface MicrophoneDiagnostic {
  name: string
  message: string
}

export interface MicrophoneIssue {
  kind: MicrophoneIssueKind
  message: string
  action: MicrophoneRecoveryAction
  diagnostic?: MicrophoneDiagnostic
}

const MAXIMUM_DIAGNOSTIC_NAME_LENGTH = 80
const MAXIMUM_DIAGNOSTIC_MESSAGE_LENGTH = 320

function readProperty(
  value: object,
  property: 'kind' | 'name' | 'message' | 'diagnostic',
): unknown {
  try {
    return (value as Record<string, unknown>)[property]
  } catch {
    return undefined
  }
}

function boundedDiagnosticText(value: unknown, maximum: number): string {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maximum) return normalized
  return `${normalized.slice(0, maximum - 1)}…`
}

function readDiagnostic(value: unknown): MicrophoneDiagnostic | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const name = boundedDiagnosticText(
    readProperty(value, 'name'),
    MAXIMUM_DIAGNOSTIC_NAME_LENGTH,
  )
  const message = boundedDiagnosticText(
    readProperty(value, 'message'),
    MAXIMUM_DIAGNOSTIC_MESSAGE_LENGTH,
  )
  if (!name && !message) return undefined
  return {
    name: name || 'MicrophoneError',
    message: message || 'No additional browser message was provided.',
  }
}

export function microphoneIssue(cause: unknown): MicrophoneIssue {
  const error =
    typeof cause === 'object' && cause !== null
      ? {
          kind: readProperty(cause, 'kind'),
          name: readProperty(cause, 'name'),
          message: readProperty(cause, 'message'),
          diagnostic: readProperty(cause, 'diagnostic'),
        }
      : {
          kind: undefined,
          name: undefined,
          message: undefined,
          diagnostic: undefined,
        }
  const directBrowserFailure =
    error.kind === undefined &&
    typeof error.name === 'string' &&
    typeof error.message === 'string'
  const diagnostic = readDiagnostic(
    error.diagnostic ?? (directBrowserFailure ? cause : undefined),
  )
  const withDiagnostic = (
    issue: Omit<MicrophoneIssue, 'diagnostic'>,
  ): MicrophoneIssue =>
    diagnostic === undefined ? issue : { ...issue, diagnostic }
  if (error.kind === 'permission-denied' || error.name === 'NotAllowedError')
    return withDiagnostic({
      kind: 'permission-denied',
      message:
        'Microphone access is off. Allow it in your browser or app settings, then try again.',
      action: 'retry',
    })
  if (error.kind === 'no-device' || error.name === 'NotFoundError')
    return withDiagnostic({
      kind: 'no-device',
      message: 'No microphone was found. Connect one, then try again.',
      action: 'retry',
    })
  if (error.kind === 'insecure-context')
    return withDiagnostic({
      kind: 'insecure-context',
      message:
        'The microphone needs HTTPS or localhost. Open the secure game link to sing.',
      action: 'none',
    })
  if (error.kind === 'held-elsewhere')
    return withDiagnostic({
      kind: 'held-elsewhere',
      message:
        'Another tab for this app is using the microphone. Move it to Glassworks to continue here.',
      action: 'take-over',
    })
  if (
    error.kind === 'device-busy' ||
    error.name === 'NotReadableError' ||
    error.name === 'AbortError' ||
    error.name === 'TrackStartError'
  )
    return withDiagnostic({
      kind: 'device-busy',
      message:
        'The microphone could not start. Choose another microphone or check the selected input, then try again.',
      action: 'retry',
    })
  return withDiagnostic({
    kind: 'unknown',
    message:
      'The microphone could not start. Check your microphone connection, then try again.',
    action: 'retry',
  })
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
