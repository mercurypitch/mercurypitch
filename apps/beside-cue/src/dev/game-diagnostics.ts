// Game device diagnostics — reuse the portable console and record bounded graphics lifecycle clues.
import { Capacitor } from '@capacitor/core'
import { getGraphicsCanvasDiagnostic } from '@irchiinnuss/glass-game/graphics-diagnostics'
import { setupPortableConsole } from '../../../../src/components/PortableConsole'
import { BUILD } from '../build-info'

let installed = false
export function setupGameDiagnostics(): void {
  if (installed) return
  installed = true
  document.documentElement.style.setProperty(
    '--portable-console-handle-bottom',
    'calc(96px + env(safe-area-inset-bottom))',
  )
  setupPortableConsole({
    appName: 'Beside Cue',
    persistence: Capacitor.isNativePlatform() ? 'device' : 'session',
    minimised: true,
  })
  console.info('[Beside Cue build]', BUILD, {
    platform: Capacitor.getPlatform(),
    path: window.location.pathname,
    viewport: [window.innerWidth, window.innerHeight],
    pixelRatio: window.devicePixelRatio,
  })
  // WebGL context events do not bubble. Capture catches every game canvas
  // without creating a diagnostic GPU context of our own.
  for (const type of ['webglcontextlost', 'webglcontextrestored']) {
    document.addEventListener(
      type,
      (event) => {
        const canvas = event.target
        if (!(canvas instanceof HTMLCanvasElement)) return
        const ownership = getGraphicsCanvasDiagnostic(canvas)
        const report = {
          event: type,
          scene: ownership?.scene ?? 'unknown',
          lifecycle: ownership?.lifecycle ?? 'unknown',
          instance: ownership?.instance,
          drawingBuffer: [canvas.width, canvas.height],
          viewport: [canvas.clientWidth, canvas.clientHeight],
          visibility: document.visibilityState,
        }
        if (ownership?.lifecycle === 'disposed')
          console.info('[Glassworks graphics lifecycle]', report)
        else console.warn('[Glassworks graphics lifecycle]', report)
      },
      true,
    )
  }
  document.addEventListener('visibilitychange', () => {
    console.info('[Beside Cue visibility]', document.visibilityState)
  })
}
