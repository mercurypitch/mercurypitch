// ============================================================
// Merc renderer — one canvas, one WebGL2 context, one simulated Merc
// ============================================================
//
// mount() draws Merc into a container. Live mode runs a rAF loop that steps
// the physics at 240 Hz and draws every frame. Capture mode draws only when
// asked (renderAt), deterministically, for tests and store art.
//
// Lifetime rules that are easy to break:
// - Live mode enables KHR_parallel_shader_compile and never reads a shader
//   status before the driver is done (programs.ts says why). It polls each
//   frame, draws nothing until the programs have linked, and calls onReady
//   after the first frame. Without the extension mount() waits once, as
//   capture does.
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

import type { GradientStop, MercLight, MercLook, MercPalette, MercQuality, MercState, MercView, MercViewName, } from './constants'
import { BG, BLOOM, isMercQuality, isMercState, LIGHT, LOOK, PALETTE, QUALITY, RIM, SHAPE, VIEWS, } from './constants'
import type { RenderTargets } from './gl'
import { cameraFor, createRenderTargets, deleteRenderTargets, flat, lightUniforms, lookUniforms, paletteUniforms, srgbToLin, } from './gl'
import type { PostProgram, PostPrograms, ProgramBuild, SceneProgram, } from './programs'
import { buildDone, createPoller, deleteBuilt, deletePostPrograms, dropBuild, finishBuild, startBuild, } from './programs'
import type { MercPose, MercVoice, MercVoiceSource, PoseBias, SimSnapshot, SparkleSide, } from './sim'
import { Sim, STEP } from './sim'
import type { GlideMouth } from './sim-glide'

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
  /** Where a celebration's sparkles land. Default 'around'. */
  sparkles?: SparkleSide
  /** Reduced motion for the glide states (`hum`, `ride`). Default false. */
  still?: boolean
  /** `hum`'s and `ride`'s sound rings. Default true. */
  rings?: boolean
  /** His mouth while he hums or rides (GlideMouth). Default 'closed'. */
  glideMouth?: GlideMouth
  /** Called once if Merc stops drawing for good after mount. */
  onFailure?: (error: Error) => void
  /**
   * Live mode: called once, when his programs have linked and his first
   * frame is drawn (a hidden page draws it once it shows). The canvas stays
   * empty until then. Never synchronously in mount(), never after a failure
   * or destroy.
   */
  onReady?: () => void
}

/** Tuning on top of the look: any LOOK entry, the palette's stops or feet, the rim, the light. */
export interface MercLookPatch extends Partial<MercLook> {
  stops?: readonly GradientStop[]
  bead?: readonly [deep: string, light: string]
  rim?: number
  /** The light he casts, all of it (LIGHT is Merc's own cool blue). */
  light?: MercLight
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
  /** Reduced motion: `ride` stands upright, `hum`'s rings only fade. */
  setStill(still: boolean): void
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
  let lightU = lightUniforms(LIGHT)
  const bgLin = new Float32Array(BG.map(srgbToLin))

  const sim = new Sim(opts.state ?? 'idle')
  sim.voiceAt = opts.voiceAt ?? null
  sim.sparkleSide = opts.sparkles ?? 'around'
  sim.still = opts.still ?? false
  sim.soundRings = opts.rings ?? true
  sim.glideMouth = opts.glideMouth ?? 'closed'

  // ---------------------------------------------------------- GL resources

  // Enabled before any compile, so ANGLE compiles off the GPU process's main
  // thread. Capture links at once, as a browser without the extension does.
  const parallel = live ? gl.getExtension('KHR_parallel_shader_compile') : null
  let res: GlResources | null = null
  // Still with the driver: the first programs, and a quality asked for.
  let building: ProgramBuild | null = null
  let switching: ProgramBuild | null = null
  // The quality asked for; `quality` is the one drawn.
  let wanted: MercQuality = quality

  function releaseResources(r: GlResources): void {
    for (const prg of r.programs.values()) gl.deleteProgram(prg.p)
    deletePostPrograms(gl, r.post)
    if (r.targets) deleteRenderTargets(gl, r.targets)
    gl.deleteVertexArray(r.vao)
  }

  // Every GL object held, drawn with or still building.
  function releaseAll(): void {
    if (res) releaseResources(res)
    if (building) dropBuild(gl, building)
    if (switching) dropBuild(gl, switching)
  }

  // Asks for the first programs; without the extension, waits for them here.
  function startResources(): void {
    building = startBuild(gl, quality, true)
    if (!parallel) takeBuild()
  }

  // The first build, read, becomes res: a vertex array, targets for the canvas.
  function takeBuild(): void {
    const pending = building!
    building = null
    const b = finishBuild(gl, pending)
    // Null on a lost context, whatever the DOM typings say.
    const vao = gl.createVertexArray()
    if (vao === null) {
      deleteBuilt(gl, b)
      throw new Error('Vertex array allocation failed')
    }
    const r = { vao, programs: new Map([[b.quality, b.scene]]), post: b.post! }
    res = { ...r, targets: null }
    needsDraw = true
    resize(res)
    seekQuality(res)
  }

  // Draws the quality asked for once its program is there, asking for it
  // first. Without the extension that ask waits, and a failure throws to
  // setQuality's caller with the drawn quality still drawing.
  function seekQuality(r: GlResources): void {
    if (wanted === quality || switching) return
    if (r.programs.has(wanted)) {
      quality = wanted
      invalidate()
      return
    }
    switching = startBuild(gl, wanted, false)
    if (parallel) poller.ask()
    else takeSwitch(r)
  }

  function takeSwitch(r: GlResources): void {
    const b = switching!
    switching = null
    try {
      r.programs.set(b.quality, finishBuild(gl, b).scene)
    } catch (err) {
      wanted = quality
      throw err
    }
    seekQuality(r)
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
    gl.uniform1i(loc.uZero, 0)
    gl.uniform3fv(loc.uLight, lightU)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function draw(r: GlResources, T: RenderTargets): void {
    const prg = r.programs.get(quality)
    if (!prg) throw new Error(`Merc has no ${quality} program`)
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
      announce()
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
    poller.cancel()
    if (!gl.isContextLost()) releaseAll()
    res = null
    building = null
    switching = null
    console.warn('[merc] stopped drawing:', failed.message)
    opts.onFailure?.(failed)
  }

  // ---------------------------------------------------------- context loss

  function onLost(e: Event): void {
    e.preventDefault()
    stopLoop()
    poller.cancel()
    // Every handle died with the context; there is nothing to delete.
    res = null
    building = null
    switching = null
    needsDraw = true
  }

  function onRestored(): void {
    if (destroyed || failed) return
    try {
      startResources()
    } catch (err) {
      if (!gl.isContextLost()) fail(err)
      return
    }
    if (building) poller.ask()
    else syncLoop()
  }

  function onVisibility(): void {
    syncLoop()
  }

  // ---------------------------------------------------------- readiness

  const poller = createPoller(poll)
  let announced = false

  function poll(): void {
    if (destroyed || failed || gl.isContextLost()) return
    try {
      if (building) {
        if (!buildDone(gl, parallel, building)) {
          poller.ask()
          return
        }
        takeBuild()
        // His first frame now: he says ready once it is on the canvas.
        if (!hidden()) render()
        syncLoop()
      }
    } catch (err) {
      if (!gl.isContextLost()) fail(err)
      return
    }
    if (res) pollSwitch(res)
  }

  // A quality's program finished: draw it, or stay if it failed.
  function pollSwitch(r: GlResources): void {
    if (!switching) return
    if (!buildDone(gl, parallel, switching)) return poller.ask()
    try {
      takeSwitch(r)
    } catch (err) {
      if (!gl.isContextLost()) console.warn('[merc] quality not changed:', err)
    }
  }

  function announce(): void {
    if (announced || failed || destroyed) return
    announced = true
    opts.onReady?.()
  }

  // ---------------------------------------------------------- start

  try {
    startResources()
  } catch (err) {
    releaseAll()
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
  // With the extension the first programs are still building.
  if (parallel) poller.ask()

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
      if (patch.light) lightU = lightUniforms(patch.light)
      invalidate()
    },
    setQuality(name) {
      if (!isMercQuality(name)) return
      // Linked first, so a failure leaves the current quality drawing.
      wanted = name
      if (res) seekQuality(res)
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
    setStill(still) {
      sim.still = still
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
      poller.cancel()
      ro?.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      document.removeEventListener('visibilitychange', onVisibility)
      if (!gl.isContextLost()) releaseAll()
      res = null
      building = null
      switching = null
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.width = 0
      canvas.height = 0
      canvas.remove()
    },
  }
}
