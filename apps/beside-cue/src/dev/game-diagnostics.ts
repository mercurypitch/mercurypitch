// Game device diagnostics — reuse the portable console and record bounded graphics lifecycle clues.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getGraphicsCanvasDiagnostic } from '@irchiinnuss/glass-game/graphics-diagnostics'
import { setupPortableConsole } from '../../../../src/components/PortableConsole'
import { flushPortableConsole } from '../../../../src/lib/portable-console'
import { BUILD } from '../build-info'
import { beginGameDiagnosticBoot, readNativeDiagnosticSnapshot, } from './game-diagnostic-boot'

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
  const boot = beginGameDiagnosticBoot({
    build: BUILD,
    storage: () =>
      Capacitor.isNativePlatform() ? localStorage : sessionStorage,
    id: globalThis.crypto.randomUUID(),
    at: Date.now(),
  })
  console.info('[Beside Cue build]', BUILD, {
    bootId: boot.id,
    previousBoot: boot.previous,
    buildChanged: boot.buildChanged,
    timeOrigin: performance.timeOrigin,
    platform: Capacitor.getPlatform(),
    path: window.location.pathname,
    viewport: [window.innerWidth, window.innerHeight],
    pixelRatio: window.devicePixelRatio,
  })
  flushPortableConsole()
  if (Capacitor.getPlatform() === 'ios') {
    const native = registerPlugin<{ read(): Promise<unknown> }>(
      'BesideCueGameDiagnostics',
    )
    void native
      .read()
      .then((value) => {
        const snapshot = readNativeDiagnosticSnapshot(value)
        if (snapshot === undefined)
          throw new Error('Unavailable native diagnostics')
        console.info('[Beside Cue native boot]', {
          bootId: boot.id,
          boundary: boot.attachNative(snapshot),
          launchId: snapshot.launchId,
          version: snapshot.version,
          build: snapshot.build,
        })
        for (const event of snapshot.events)
          console.info('[Beside Cue native lifecycle]', {
            bootId: boot.id,
            ...event,
            ...(event.kind === 'web-content-terminated'
              ? { cause: 'unknown' }
              : {}),
          })
        flushPortableConsole()
      })
      .catch(() => {
        console.info('[Beside Cue native diagnostics]', {
          bootId: boot.id,
          status: 'unavailable',
        })
        flushPortableConsole()
      })
  }
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
          bootId: boot.id,
          event: type,
          scene: ownership?.scene ?? 'unknown',
          lifecycle: ownership?.lifecycle ?? 'unknown',
          instance: ownership?.instance,
          ...ownership?.snapshot,
          drawingBuffer: [canvas.width, canvas.height],
          viewport: [canvas.clientWidth, canvas.clientHeight],
          visibility: document.visibilityState,
        }
        if (ownership?.lifecycle === 'disposed')
          console.info('[Glassworks graphics lifecycle]', report)
        else console.warn('[Glassworks graphics lifecycle]', report)
        if (Capacitor.isNativePlatform() && ownership?.lifecycle !== 'disposed')
          flushPortableConsole()
      },
      true,
    )
  }
  document.addEventListener('visibilitychange', () => {
    console.info('[Beside Cue visibility]', document.visibilityState, {
      bootId: boot.id,
    })
    if (document.visibilityState === 'hidden') flushPortableConsole()
  })
}
