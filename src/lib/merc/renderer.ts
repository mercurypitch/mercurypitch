// ============================================================
// Merc renderer — one canvas, one WebGL2 context, one simulated Merc
// ============================================================
//
// mount() draws Merc into a container. Live mode runs a rAF loop that steps
// the physics at 240 Hz and draws every frame. Capture mode draws only when
// asked (renderAt), deterministically, for tests and store art.
//
// Lifetime rules that are easy to break:
// - iOS drops the GL context when the app goes to the background. The loss
//   handler must call preventDefault (the browser restores nothing without
//   it), forget every GL handle and stop the loop. The restore handler
//   rebuilds programs and targets and carries on with the same Sim, so Merc
//   resumes the pose he was in.
// - destroy() removes the loss listeners BEFORE it calls loseContext, or its
//   own loss handler would ask the browser to restore what it is releasing.
// - The loop stops while paused or while the page is hidden, and the first
//   frame after a restart steps no time, so Merc never jumps ahead.
// - A paused stage is not redrawn by the loop, so anything that clears the
//   canvas (a resize, a restore, a quality change) draws the current pose
//   once, at zero elapsed time.

import type { GradientStop, MercLook, MercPalette, MercQuality, MercState, MercView, MercViewName, } from './constants'
import { BG, BLOOM, isMercQuality, isMercState, LOOK, PALETTE, QUALITY, RIM, SHAPE, VIEWS, } from './constants'
import type { PostProgram, PostPrograms, RenderTargets, SceneProgram, } from './gl'
import { cameraFor, createPostPrograms, createRenderTargets, createSceneProgram, deleteRenderTargets, flat, lookUniforms, paletteUniforms, srgbToLin, } from './gl'
import type { MercPose, MercVoice, MercVoiceSource, PoseBias, SimSnapshot, } from './sim'
import { Sim, STEP } from './sim'

export interface MercMountOptions {
  /** Default 'high'. */
  quality?: MercQuality
  /**
   * Leave the background out: the canvas carries premultiplied alpha, so the
   * page shows through around Merc and his floor light adds onto it.
   */
  transparent?: boolean
  /** No loop: renderAt(t) draws exactly t seconds after the last setState. */
  capture?: boolean
  /**
   * With capture: setState is a soft transition at the current simulation
   * time (springs, particles and the lock carry over), as in live mode;
   * reset(name) is the hard restart.
   */
  continuous?: boolean
  /** Fixed CSS size in px (square). 0 (default) follows the container. */
  size?: number
  /** Default min(2, devicePixelRatio). */
  pixelRatio?: number
  /** Default 'front'. */
  view?: MercViewName | MercView
  /** Default 'idle'. */
  state?: MercState
  voiceAt?: MercVoiceSource | null
  /** Called once if Merc stops drawing for good after mount. */
  onFailure?: (error: Error) => void
}

/** Tuning on top of the look: any LOOK entry, the palette's stops or feet, the rim. */
export interface MercLookPatch extends Partial<MercLook> {
  stops?: readonly GradientStop[]
  bead?: readonly [deep: string, light: string]
  rim?: number
}

export interface MercRenderer {
  readonly canvas: HTMLCanvasElement
  readonly state: MercState
  /** Simulation time, seconds. */
  readonly time: number
  /** False once Merc has stopped drawing for good, or after destroy. */
  readonly ok: boolean
  readonly look: MercLook
  setState(name: MercState): void
  /** Hard reset to a state at its time 0, as if freshly mounted. */
  reset(name: MercState): void
  setVoice(voice: MercVoice): void
  setVoiceSource(source: MercVoiceSource | null): void
  setPoseBias(bias: Partial<PoseBias>): void
  setLook(patch: MercLookPatch): void
  setQuality(name: MercQuality): void
  setView(view: MercViewName | MercView): void
  setPaused(paused: boolean): void
  /** Capture mode: render exactly t seconds after the last setState. */
  renderAt(t: number): void
  destroy(): void
}

interface GlResources {
  readonly vao: WebGLVertexArrayObject
  readonly programs: Map<MercQuality, SceneProgram>
  readonly post: PostPrograms
  targets: RenderTargets | null
}

const resolveView = (v: MercViewName | MercView): MercView =>
  typeof v === 'string' ? VIEWS[v] : v

export function mount(
  container: HTMLElement,
  opts: MercMountOptions = {},
): MercRenderer {
  const capture = opts.capture ?? false
  const continuous = capture && (opts.continuous ?? false)
  const transparent = opts.transparent ?? false
  const size = opts.size ?? 0
  const pixelRatio =
    opts.pixelRatio ?? Math.min(2, window.devicePixelRatio || 1)
  const live = !capture

  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = size ? `${size}px` : '100%'
  canvas.style.height = size ? `${size}px` : '100%'
  container.appendChild(canvas)
  const context = canvas.getContext('webgl2', {
    alpha: transparent,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: capture,
    powerPreference: 'high-performance',
  })
  if (!context) {
    canvas.remove()
    throw new Error('WebGL2 is not available in this browser')
  }
  const gl: WebGL2RenderingContext = context

  let quality: MercQuality = opts.quality ?? 'high'
  let view = resolveView(opts.view ?? 'front')
  let cam = cameraFor(view)
  let look: MercLook = LOOK
  let lookU = lookUniforms(look)
  let palette: MercPalette = PALETTE
  let pal = paletteUniforms(palette)
  let rimStrength: number = RIM.strength
  const bgLin = new Float32Array(BG.map(srgbToLin))

  const sim = new Sim(opts.state ?? 'idle')
  sim.voiceAt = opts.voiceAt ?? null

  // ---------------------------------------------------------- GL resources

  let res: GlResources | null = null

  function createResources(): GlResources {
    // Null on a lost context, whatever the DOM typings say.
    const vao = gl.createVertexArray()
    if (vao === null) throw new Error('Vertex array allocation failed')
    const programs = new Map<MercQuality, SceneProgram>()
    try {
      programs.set(quality, createSceneProgram(gl, quality))
      const post = createPostPrograms(gl)
      return { vao, programs, post, targets: null }
    } catch (err) {
      for (const prg of programs.values()) gl.deleteProgram(prg.p)
      gl.deleteVertexArray(vao)
      throw err
    }
  }

  function releaseResources(r: GlResources): void {
    for (const prg of r.programs.values()) gl.deleteProgram(prg.p)
    gl.deleteProgram(r.post.down.p)
    gl.deleteProgram(r.post.blur.p)
    gl.deleteProgram(r.post.comp.p)
    if (r.targets) deleteRenderTargets(gl, r.targets)
    gl.deleteVertexArray(r.vao)
  }

  function sceneProgram(r: GlResources): SceneProgram {
    let prg = r.programs.get(quality)
    if (!prg) {
      prg = createSceneProgram(gl, quality)
      r.programs.set(quality, prg)
    }
    return prg
  }

  // ---------------------------------------------------------- size

  let width = 0
  let height = 0
  let needsDraw = true

  function resize(r: GlResources): void {
    const scale = QUALITY[quality].scale
    let w: number
    let h: number
    if (size) {
      w = Math.round(size * scale)
      h = w
    } else {
      const cw = container.clientWidth
      const ch = container.clientHeight
      // A zero-area container (display: none, mid-layout) keeps the last
      // good size instead of shrinking the targets to nothing.
      if ((cw <= 0 || ch <= 0) && r.targets) return
      w = Math.max(16, Math.round(cw * pixelRatio * scale))
      h = Math.max(16, Math.round(ch * pixelRatio * scale))
    }
    if (w === width && h === height && r.targets) return
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    width = w
    height = h
    const old = r.targets
    r.targets = null
    if (old) deleteRenderTargets(gl, old)
    r.targets = createRenderTargets(gl, w, h)
    needsDraw = true
  }

  // ---------------------------------------------------------- drawing

  function pass(
    prg: PostProgram,
    fb: WebGLFramebuffer | null,
    w: number,
    h: number,
    set: (l: PostProgram['loc']) => void,
  ): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.viewport(0, 0, w, h)
    gl.useProgram(prg.p)
    set(prg.loc)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function bindTex(
    unit: number,
    t: WebGLTexture,
    loc: WebGLUniformLocation | null,
  ): void {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.uniform1i(loc, unit)
  }

  function drawScene(
    prg: SceneProgram,
    P: MercPose,
    fb: WebGLFramebuffer,
  ): void {
    const { loc } = prg
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.viewport(0, 0, width, height)
    gl.useProgram(prg.p)
    gl.uniform2f(loc.uRes, width, height)
    gl.uniform3fv(loc.uCamPos, cam.pos)
    gl.uniform3fv(loc.uCamR, cam.right)
    gl.uniform3fv(loc.uCamU, cam.up)
    gl.uniform3fv(loc.uCamF, cam.fw)
    gl.uniform1f(loc.uFocal, cam.focal)
    gl.uniform4fv(loc.uBound, P.bound)
    gl.uniform1f(loc.uTime, P.t)
    gl.uniform3fv(loc.uRoot, P.root)
    gl.uniform4fv(loc.uShape, P.shape)
    gl.uniform1f(loc.uLip, P.lip)
    gl.uniform4fv(loc.uLean, P.lean)
    gl.uniform4fv(loc.uFeet, P.feet)
    gl.uniform4fv(loc.uRipple, P.ripple)
    gl.uniform4fv(loc.uWave, P.wave)
    gl.uniform1f(loc.uNub, P.nub)
    gl.uniform3fv(loc.uEyeC, P.eyeC)
    gl.uniform3fv(loc.uEyeX, P.eyeX)
    gl.uniform3fv(loc.uEyeZ, P.eyeZ)
    gl.uniform2fv(loc.uEyeFrz, P.eyeFrz)
    gl.uniform4fv(loc.uEyeA, P.eyeA)
    gl.uniform4fv(loc.uEyeB, P.eyeB)
    gl.uniform4fv(loc.uMouth, P.mouth)
    gl.uniform4fv(loc.uColor, P.color)
    gl.uniform1fv(loc.uGradH, pal.h)
    gl.uniform3fv(loc.uGradC, pal.c)
    gl.uniform3fv(loc.uBead, pal.bead)
    gl.uniform4fv(loc.uCore, P.core)
    gl.uniform4fv(loc.uRing, P.ring)
    gl.uniform4fv(loc.uArcs, P.arcs)
    gl.uniform4fv(loc.uArcs2, P.arcs2)
    gl.uniform1i(loc.uDropN, Math.min(6, P.drops.length))
    if (P.drops.length) {
      gl.uniform4fv(loc.uDrops, flat(P.drops, Math.min(6, P.drops.length), 4))
    }
    gl.uniform1i(loc.uSparkN, Math.min(8, P.sparks.length))
    if (P.sparks.length) {
      gl.uniform4fv(
        loc.uSparks,
        flat(P.sparks, Math.min(8, P.sparks.length), 4),
      )
    }
    gl.uniform1i(loc.uDotN, Math.min(12, P.dots.length))
    if (P.dots.length) {
      gl.uniform4fv(loc.uDots, flat(P.dots, Math.min(12, P.dots.length), 4))
    }
    gl.uniform4fv(loc.uStops, P.stops)
    const gh = [...P.ghosts]
    while (gh.length < 3) gh.push([0, 0, 0, 0])
    gl.uniform4fv(loc.uGhost, flat(gh, 3, 4))
    gl.uniform1f(loc.uGhostSq, P.shape[0])
    gl.uniform1f(loc.uSpeed, P.speed)
    gl.uniform4fv(loc.uArrow, P.arrow)
    const vx = cam.pos[0] - P.root[0]
    const vz = cam.pos[2] - P.root[2]
    gl.uniform1f(
      loc.uCamAz,
      Math.atan2(
        P.shape[2] * vx - P.shape[3] * vz,
        P.shape[3] * vx + P.shape[2] * vz,
      ),
    )
    gl.uniform4fv(loc.uLookE, lookU.edge)
    gl.uniform4fv(loc.uLookE2, lookU.edge2)
    gl.uniform4fv(loc.uLookS1, lookU.crown)
    gl.uniform4fv(loc.uLookS2, lookU.shoulder)
    gl.uniform4fv(loc.uLookK, lookU.k)
    gl.uniform3fv(loc.uLookT, lookU.tint)
    gl.uniform3fv(loc.uLookT2, lookU.tint2)
    // The study's debug views are not carried over; 0 is the normal image.
    gl.uniform1i(loc.uDebug, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function draw(r: GlResources, T: RenderTargets): void {
    const prg = sceneProgram(r)
    const P = sim.pose()
    gl.bindVertexArray(r.vao)
    const { post } = r
    drawScene(prg, P, T.main)
    // Glow: down to a quarter, blur; down to an eighth, blur. The tap spacing
    // follows Merc's size on screen (pixels per world unit at the camera
    // distance), so the halo keeps the same width relative to him at every
    // canvas size and framing. It was tuned on the 1024 px front view, 455 px
    // per unit; without this a small card got a halo several times wider.
    const ppu = (0.5 * T.h * cam.focal) / view.dist
    const bs = Math.min(2.5, Math.max(0.05, ppu / 455))
    pass(post.down, T.fa0, T.aw, T.ah, (l) => {
      bindTex(0, T.glow, l.uSrc)
      gl.uniform2f(l.uSrcTexel, 1 / T.w, 1 / T.h)
      gl.uniform2f(l.uDstRes, T.aw, T.ah)
    })
    pass(post.blur, T.fa1, T.aw, T.ah, (l) => {
      bindTex(0, T.a0, l.uSrc)
      gl.uniform2f(l.uDir, bs / T.aw, 0)
      gl.uniform2f(l.uDstRes, T.aw, T.ah)
    })
    pass(post.blur, T.fa0, T.aw, T.ah, (l) => {
      bindTex(0, T.a1, l.uSrc)
      gl.uniform2f(l.uDir, 0, bs / T.ah)
      gl.uniform2f(l.uDstRes, T.aw, T.ah)
    })
    pass(post.down, T.fb0, T.bw, T.bh, (l) => {
      bindTex(0, T.a0, l.uSrc)
      gl.uniform2f(l.uSrcTexel, 0.5 / T.aw, 0.5 / T.ah)
      gl.uniform2f(l.uDstRes, T.bw, T.bh)
    })
    // The wide level is blurred twice, with a wider tap spacing the second time.
    for (const k of [1, 1.6]) {
      pass(post.blur, T.fb1, T.bw, T.bh, (l) => {
        bindTex(0, T.b0, l.uSrc)
        gl.uniform2f(l.uDir, (k * bs) / T.bw, 0)
        gl.uniform2f(l.uDstRes, T.bw, T.bh)
      })
      pass(post.blur, T.fb0, T.bw, T.bh, (l) => {
        bindTex(0, T.b1, l.uSrc)
        gl.uniform2f(l.uDir, 0, (k * bs) / T.bh)
        gl.uniform2f(l.uDstRes, T.bw, T.bh)
      })
    }
    const lift = 1 + 0.6 * P.color[2]
    pass(post.comp, null, width, height, (l) => {
      bindTex(0, T.scene, l.uScene)
      bindTex(1, T.a0, l.uA)
      bindTex(2, T.b0, l.uB)
      gl.uniform2f(l.uRes, width, height)
      gl.uniform3fv(l.uBg, bgLin)
      gl.uniform1f(l.uOpaque, transparent ? 0 : 1)
      gl.uniform4f(
        l.uBloomK,
        BLOOM.tight * lift,
        BLOOM.wide * lift,
        BLOOM.overBody,
        0,
      )
      bindTex(3, T.glow, l.uCov)
      gl.uniform2f(
        l.uRim,
        Math.min(8, Math.max(0.9, RIM.width * ppu)),
        rimStrength,
      )
      // The body's base and crown tip on the screen, for the rim's height.
      const yOf = (p: readonly number[]): number => {
        const d = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]]
        const z = d[0] * cam.fw[0] + d[1] * cam.fw[1] + d[2] * cam.fw[2]
        const y =
          ((d[0] * cam.up[0] + d[1] * cam.up[1] + d[2] * cam.up[2]) *
            cam.focal) /
          Math.max(z, 1e-3)
        return 0.5 * height * (1 + y)
      }
      const r0 = P.root
      gl.uniform2f(
        l.uRimY,
        yOf([r0[0], r0[1] + SHAPE.flatY * P.shape[0], r0[2]]),
        yOf([r0[0], r0[1] + SHAPE.restH * P.shape[0], r0[2]]),
      )
    })
  }

  // ---------------------------------------------------------- live loop

  let raf = 0
  let last = 0
  let acc = 0
  let paused = false
  let destroyed = false
  let failed: Error | null = null

  const hidden = (): boolean => document.visibilityState === 'hidden'

  // Draws the current pose, unless the context is gone. Anything that throws
  // without a lost context stops Merc for good; a lost context waits for its
  // restore event.
  function render(): void {
    const r = res
    if (!r || gl.isContextLost()) return
    try {
      resize(r)
      if (r.targets) draw(r, r.targets)
      needsDraw = false
    } catch (err) {
      if (!gl.isContextLost()) fail(err)
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    if (!last) last = now
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    acc += dt
    try {
      while (acc >= STEP) {
        sim.step(STEP)
        acc -= STEP
      }
    } catch (err) {
      fail(err)
      return
    }
    render()
  }

  function stopLoop(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function syncLoop(): void {
    if (!live || destroyed || failed) return
    if (!paused && res && !hidden()) {
      if (!raf) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
      return
    }
    stopLoop()
    if (needsDraw && !hidden()) render()
  }

  function fail(err: unknown): void {
    if (failed || destroyed) return
    failed = err instanceof Error ? err : new Error(String(err))
    stopLoop()
    if (res && !gl.isContextLost()) releaseResources(res)
    res = null
    console.warn('[merc] stopped drawing:', failed.message)
    opts.onFailure?.(failed)
  }

  // ---------------------------------------------------------- context loss

  function onLost(e: Event): void {
    e.preventDefault()
    stopLoop()
    // Every handle died with the context; there is nothing to delete.
    res = null
    needsDraw = true
  }

  function onRestored(): void {
    if (destroyed || failed) return
    let r: GlResources | null = null
    try {
      r = createResources()
      resize(r)
    } catch (err) {
      if (gl.isContextLost()) return
      if (r) releaseResources(r)
      fail(err)
      return
    }
    res = r
    needsDraw = true
    syncLoop()
  }

  function onVisibility(): void {
    syncLoop()
  }

  // ---------------------------------------------------------- start

  try {
    const r = createResources()
    res = r
    resize(r)
  } catch (err) {
    if (res) releaseResources(res)
    res = null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    canvas.remove()
    throw err
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  if (live) document.addEventListener('visibilitychange', onVisibility)
  const ro = size
    ? null
    : new ResizeObserver(() => {
        if (!res || gl.isContextLost() || destroyed || failed) return
        try {
          resize(res)
        } catch (err) {
          if (!gl.isContextLost()) fail(err)
          return
        }
        syncLoop()
      })
  ro?.observe(container)
  syncLoop()

  // ---------------------------------------------------------- capture

  function stepTo(t: number): void {
    const target = Math.round(t / STEP)
    if (target < sim.n) sim.reset(sim.state)
    while (sim.n < target) sim.step(STEP)
  }

  // Continuous capture: the segment since the last setState (or reset), with
  // a snapshot of the simulation at its start for backward seeks.
  let seg: { n0: number; snap: SimSnapshot } | null = continuous
    ? { n0: 0, snap: sim.snapshot() }
    : null

  function stepSeg(s: { n0: number; snap: SimSnapshot }, t: number): void {
    const target = s.n0 + Math.round(t / STEP)
    if (target < sim.n) sim.restore(s.snap)
    while (sim.n < target) sim.step(STEP)
  }

  function invalidate(): void {
    needsDraw = true
    syncLoop()
  }

  return {
    canvas,
    get state() {
      return sim.state
    },
    get time() {
      return sim.t
    },
    get ok() {
      return failed === null && !destroyed
    },
    get look() {
      return structuredClone(look)
    },
    setState(name) {
      if (!isMercState(name)) return
      if (continuous) {
        sim.setState(name)
        sim.voiceT0 = sim.t
        seg = { n0: sim.n, snap: sim.snapshot() }
      } else if (capture) sim.reset(name)
      else sim.setState(name)
    },
    reset(name) {
      if (!isMercState(name)) return
      sim.reset(name)
      if (continuous) seg = { n0: 0, snap: sim.snapshot() }
    },
    setVoice(voice) {
      sim.voice = { ...voice }
    },
    setVoiceSource(source) {
      sim.voiceAt = source
    },
    setPoseBias(bias) {
      Object.assign(sim.bias, bias)
    },
    setLook(patch) {
      look = {
        edge: patch.edge ?? look.edge,
        edge2: patch.edge2 ?? look.edge2,
        crown: patch.crown ?? look.crown,
        shoulder: patch.shoulder ?? look.shoulder,
        k: patch.k ?? look.k,
        tint: patch.tint ?? look.tint,
        tint2: patch.tint2 ?? look.tint2,
      }
      lookU = lookUniforms(look)
      if (patch.stops || patch.bead) {
        palette = {
          stops: patch.stops ?? palette.stops,
          bead: patch.bead ?? palette.bead,
        }
        pal = paletteUniforms(palette)
      }
      if (patch.rim !== undefined) rimStrength = patch.rim
      invalidate()
    },
    setQuality(name) {
      if (!isMercQuality(name) || name === quality) return
      // Compile first, so a failure leaves the current quality drawing.
      if (res && !res.programs.has(name)) {
        res.programs.set(name, createSceneProgram(gl, name))
      }
      quality = name
      invalidate()
    },
    setView(v) {
      view = resolveView(v)
      cam = cameraFor(view)
      invalidate()
    },
    setPaused(p) {
      paused = p
      syncLoop()
    },
    renderAt(t) {
      if (seg) stepSeg(seg, t)
      else stepTo(t)
      const r = res
      if (destroyed || failed || !r || gl.isContextLost()) {
        throw new Error('Merc cannot draw: the renderer has no GL context')
      }
      resize(r)
      if (r.targets) draw(r, r.targets)
      gl.finish()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      stopLoop()
      ro?.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      document.removeEventListener('visibilitychange', onVisibility)
      if (res && !gl.isContextLost()) releaseResources(res)
      res = null
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.width = 0
      canvas.height = 0
      canvas.remove()
    },
  }
}
