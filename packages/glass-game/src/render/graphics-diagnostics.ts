// Graphics diagnostics — bounded failure context for the device console, without save data or audio.
type GraphicsCanvasScene =
  | 'museum-map'
  | 'gallery'
  | 'singing-current'
  | 'loading-merc'
interface GraphicsCanvasDiagnostic {
  scene: GraphicsCanvasScene
  instance: number
  lifecycle: 'active' | 'disposed'
}
const canvases = new WeakMap<HTMLCanvasElement, GraphicsCanvasDiagnostic>()
let nextInstance = 0

/** Weak ownership metadata never keeps a retired canvas or renderer alive. */
export function registerGraphicsCanvas(
  canvas: HTMLCanvasElement,
  scene: GraphicsCanvasScene,
): void {
  canvases.set(canvas, { scene, instance: ++nextInstance, lifecycle: 'active' })
}

/** Call before deliberate forceContextLoss; its event may arrive asynchronously. */
export function retireGraphicsCanvas(canvas: HTMLCanvasElement): void {
  const diagnostic = canvases.get(canvas)
  if (diagnostic !== undefined) diagnostic.lifecycle = 'disposed'
}

export function getGraphicsCanvasDiagnostic(
  canvas: HTMLCanvasElement,
): Readonly<GraphicsCanvasDiagnostic> | undefined {
  const diagnostic = canvases.get(canvas)
  return diagnostic === undefined ? undefined : { ...diagnostic }
}

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
