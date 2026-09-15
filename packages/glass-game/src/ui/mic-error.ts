// Museum microphone errors — translate the shared manager's classified failures into recovery.
export function microphoneError(cause: unknown): string {
  const error =
    typeof cause === 'object' && cause !== null
      ? (cause as { kind?: string; name?: string })
      : {}
  if (error.kind === 'permission-denied' || error.name === 'NotAllowedError')
    return 'Microphone access is off. Allow it in your browser or app settings, then try again.'
  if (error.kind === 'no-device' || error.name === 'NotFoundError')
    return 'No microphone was found. Connect one, then try again.'
  if (error.kind === 'insecure-context')
    return 'The microphone needs HTTPS or localhost. Open the secure game link to sing.'
  if (error.kind === 'held-elsewhere')
    return 'Another game tab is using the microphone. Finish there, then try again.'
  if (error.kind === 'device-busy')
    return 'Another app is using the microphone. Close it, then try again.'
  return 'The microphone could not start. Check your microphone connection, then try again.'
}
