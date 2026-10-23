// ============================================================
// GPU gate — can this device draw Merc live, or does he stay a still?
// ============================================================
//
// The one answer the app gives: the lessons' Mercs (merc-duo.ts) and the
// onboarding's MercPresence both ask it, so a device is never live on one
// page and stalled on the next.
//
// A WebGL drawn on the CPU names itself: Chrome's SwiftShader, Mesa's
// llvmpipe and softpipe, Windows' Basic Render Driver. Headless Chrome hands
// out a SwiftShader context even when asked to fail on a performance caveat,
// so the name decides too. A Merc drawn there holds the main thread for
// seconds at a time, and what is under him stops answering.
//
// The probe (what the browser says) and the decision (what the app makes of
// it) are apart, so the decision can be tested without a browser.

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
