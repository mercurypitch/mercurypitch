// ============================================================
// GPU gate — can this device draw Merc live, or does he stay a still?
// ============================================================
//
// The one answer the app gives: the lessons' Mercs (merc-duo.ts) and the
// onboarding's MercPresence both ask it, so a device is never live on one
// page and stalled on the next. They share how long they wait for him, too.
//
// A WebGL drawn on the CPU names itself: Chrome's SwiftShader, Mesa's
// llvmpipe and softpipe, Windows' Basic Render Driver. Asked to fail on a
// major performance caveat, a browser mostly refuses one (headless Chromium
// 148 returns no context), but not always: with SwiftShader made its GPU
// (--use-angle=swiftshader) it hands one out all the same, so the name
// decides too. A Merc drawn there holds the main thread for seconds at a
// time, and what is under him stops answering.
//
// The probe (what the browser says) and the decision (what the app makes of
// it) are apart, so the decision can be tested without a browser.

/**
 * How long a page with Merc's still waits for the live Merc's shader before
 * it keeps the still and lets the WebGL context go. Lesson 1's two Mercs
 * compiled and linked in 0.1 to 1.9 s in a headless Chrome, on a CPU
 * (SwiftShader); the compile that froze a Windows Chrome took minutes. Ten
 * seconds is five times the slowest of those, and still inside the time a
 * reader spends on the opening screen, so a late Merc steps in where he
 * stands rather than halfway down the page. With KHR_parallel_shader_compile
 * the page keeps running while it waits (src/lib/merc/programs.ts), so
 * waiting costs only the context.
 */
export const LIVE_MERC_WAIT_MS = 10_000

/**
 * Calls `giveUp` once the page has been on screen for LIVE_MERC_WAIT_MS with
 * no live Merc ready, and returns the cancel, which a ready Merc calls. A
 * hidden page draws no frame, so he cannot be ready there: its time does not
 * count, and the wait starts over when the page shows. A lesson opened in a
 * background tab keeps him live for when it is read.
 */
export function waitForLiveMerc(giveUp: () => void): () => void {
  let timer = 0
  const arm = (): void => {
    window.clearTimeout(timer)
    timer =
      document.visibilityState === 'hidden'
        ? 0
        : window.setTimeout(expire, LIVE_MERC_WAIT_MS)
  }
  const cancel = (): void => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', arm)
  }
  const expire = (): void => {
    cancel()
    giveUp()
  }
  document.addEventListener('visibilitychange', arm)
  arm()
  return cancel
}

/** What a WebGL that draws on the CPU calls itself. */
export const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|software|basic render/i

/** What the browser said when asked for a WebGL2 context. */
export type RendererProbe =
  | { webgl2: false }
  | { webgl2: true; renderer: unknown }

/**
 * Asks the browser for a WebGL2 context that would not run on the CPU, reads
 * its renderer's name and hands the context back. Never throws: a browser
 * that will not answer has no WebGL2 for our purposes.
 */
export function probeWebGL2(): RendererProbe {
  try {
    const gl = document
      .createElement('canvas')
      .getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (gl === null) return { webgl2: false }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer: unknown = gl.getParameter(
      info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL,
    )
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { webgl2: true, renderer }
  } catch {
    return { webgl2: false }
  }
}

/**
 * True when this browser draws WebGL2 on a GPU, so Merc can run live. A name
 * the browser did not give as text is no reason to hold him back; a probe
 * that throws is.
 */
export function canRunLiveMerc(
  probe: () => RendererProbe = probeWebGL2,
): boolean {
  try {
    const found = probe()
    return (
      found.webgl2 &&
      !(
        typeof found.renderer === 'string' &&
        SOFTWARE_RENDERER.test(found.renderer)
      )
    )
  } catch {
    return false
  }
}
