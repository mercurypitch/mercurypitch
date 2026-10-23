// ============================================================
// GPU gate: software WebGL keeps Merc on his still, a GPU runs him live
// ============================================================
//
// The decision is tested on probes handed in, the way a browser would answer;
// the probe itself on a fake WebGL2 context, the one edge jsdom lacks.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RendererProbe } from './gpu-gate'
import { canRunLiveMerc, probeWebGL2, SOFTWARE_RENDERER } from './gpu-gate'

const SWIFTSHADER =
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))'
const GEFORCE = 'ANGLE (NVIDIA GeForce RTX 3070)'

/** A probe that finds WebGL2, drawn by this renderer. */
const finds =
  (renderer: unknown): (() => RendererProbe) =>
  () => ({ webgl2: true, renderer })

// What a context reports through each of the two ways to ask its renderer.
const UNMASKED_RENDERER = 0x9246
const PLAIN_RENDERER = 0x1f01

/** A WebGL2 context as a browser hands it out, with the names it reports. */
function webgl2(names: { unmasked?: string; plain?: string }) {
  const loseContext = vi.fn()
  const gl = {
    RENDERER: PLAIN_RENDERER,
    getExtension: (name: string): unknown => {
      if (name === 'WEBGL_lose_context') return { loseContext }
      const hidden = names.unmasked === undefined
      return name === 'WEBGL_debug_renderer_info' && !hidden
        ? { UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER }
        : null
    },
    getParameter: (param: number): unknown =>
      param === UNMASKED_RENDERER ? names.unmasked : names.plain,
  }
  return { gl, loseContext }
}

/** The browser answers a WebGL2 request with this context (null: none). */
function browserGives(context: unknown) {
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(((id: string) =>
      id === 'webgl2'
        ? context
        : null) as typeof HTMLCanvasElement.prototype.getContext)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('canRunLiveMerc', () => {
  it('keeps a software renderer on the still', () => {
    // Arrange
    const probe = finds(SWIFTSHADER)

    // Act
    const live = canRunLiveMerc(probe)

    // Assert
    expect(live).toBe(false)
  })

  it('keeps every software renderer the browsers name on the still', () => {
    // Arrange
    const names = [
      'Mesa llvmpipe (LLVM 15.0.7, 256 bits)',
      'Gallium 0.4 on softpipe',
      'Microsoft Basic Render Driver',
      'Apple Software Renderer',
    ]

    // Act
    const verdicts = names.map((name) => canRunLiveMerc(finds(name)))

    // Assert
    expect(verdicts).toEqual([false, false, false, false])
  })

  it('runs live on a hardware renderer', () => {
    // Arrange: a name that is no name at all is no reason to hold him back.
    const names = [GEFORCE, 123]

    // Act
    const verdicts = names.map((name) => canRunLiveMerc(finds(name)))

    // Assert
    expect(verdicts).toEqual([true, true])
  })

  it('keeps the still without WebGL2 or when the probe throws', () => {
    // Arrange
    const without = (): RendererProbe => ({ webgl2: false })
    const broken = (): RendererProbe => {
      throw new Error('the GPU process went away')
    }

    // Act
    const verdicts = [without, broken].map((probe) => canRunLiveMerc(probe))

    // Assert
    expect(verdicts).toEqual([false, false])
  })

  it('asks the browser itself when no probe is handed in, and holds a software GL back', () => {
    // Arrange
    browserGives(webgl2({ unmasked: SWIFTSHADER }).gl)

    // Act
    const live = canRunLiveMerc()

    // Assert
    expect(live).toBe(false)
  })

  it('asks the browser itself when no probe is handed in, and runs live on a GPU', () => {
    // Arrange
    browserGives(webgl2({ unmasked: GEFORCE }).gl)

    // Act
    const live = canRunLiveMerc()

    // Assert
    expect(live).toBe(true)
  })
})

describe('SOFTWARE_RENDERER', () => {
  it('is the pattern the lessons shipped with, case-insensitive and unchanged', () => {
    // Assert: moved from merc-duo.ts as it was written there.
    expect(SOFTWARE_RENDERER.source).toBe(
      'swiftshader|llvmpipe|softpipe|software|basic render',
    )
    expect(SOFTWARE_RENDERER.flags).toBe('i')
  })
})

describe('probeWebGL2', () => {
  it("reports the GPU's own name and gives the context back", () => {
    // Arrange
    const { gl, loseContext } = webgl2({
      unmasked: GEFORCE,
      plain: 'WebKit WebGL',
    })
    browserGives(gl)

    // Act
    const probe = probeWebGL2()

    // Assert
    expect(probe).toEqual({ webgl2: true, renderer: GEFORCE })
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('reports the plain renderer string when the browser hides the GPU name', () => {
    // Arrange
    browserGives(webgl2({ plain: 'Mozilla' }).gl)

    // Act
    const probe = probeWebGL2()

    // Assert
    expect(probe).toEqual({ webgl2: true, renderer: 'Mozilla' })
  })

  it('asks the browser to refuse a context it would draw on the CPU', () => {
    // Arrange
    const spy = browserGives(webgl2({ unmasked: GEFORCE }).gl)

    // Act
    probeWebGL2()

    // Assert: this is what keeps a blocklisted GPU on the still.
    expect(spy).toHaveBeenCalledWith('webgl2', {
      failIfMajorPerformanceCaveat: true,
    })
  })

  it('finds no WebGL2 when the browser gives no context', () => {
    // Arrange
    browserGives(null)

    // Act
    const probe = probeWebGL2()

    // Assert
    expect(probe).toEqual({ webgl2: false })
  })

  it('finds no WebGL2 when asking throws', () => {
    // Arrange
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        throw new Error('WebGL is blocked here')
      },
    )

    // Act
    const probe = probeWebGL2()

    // Assert
    expect(probe).toEqual({ webgl2: false })
  })
})
