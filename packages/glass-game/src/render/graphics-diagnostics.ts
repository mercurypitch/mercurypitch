// Graphics diagnostics — bounded failure context for the device console, without save data or audio.
export function reportGraphicsFailure(
  scene: 'museum-map' | 'singing-current',
  stage:
    | 'module-load'
    | 'initialization'
    | 'asset-load'
    | 'context-lost'
    | 'frame',
  cause: unknown,
): void {
  console.error('[Glassworks graphics]', {
    scene,
    stage,
    errorName:
      cause instanceof Error ? cause.name.slice(0, 80) : 'UnknownError',
    errorMessage:
      cause instanceof Error
        ? cause.message.slice(0, 240)
        : 'No error detail supplied',
  })
}

/** Two lines per load attempt leave context even if the OS kills the WebView. */
export function reportGraphicsLoad(
  scene: 'museum-map' | 'gallery' | 'singing-current',
  id: string,
  phase: 'loading' | 'ready',
): void {
  console.info('[Glassworks scene]', { scene, id: id.slice(0, 100), phase })
}
