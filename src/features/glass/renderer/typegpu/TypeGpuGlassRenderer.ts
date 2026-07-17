// ============================================================
// TypeGpuGlassRenderer — the PRIMARY mirror backend (decision 9:
// TypeGPU/WebGPU is mandated for Glass; "Powered by TypeGPU").
//
// One fullscreen TGSL fragment renders the quicksilver pane:
// depth-tinted glass, the gold target band, resonance ripples,
// the drifting specular sheen, and the waveform ribbon evaluated
// as distance-to-polyline over a storage buffer of recent samples
// (additive glow, aqua in band, violet fringe with resonance).
// Text, the chrome frame, the perimeter meter and cracks render
// on a transparent Canvas2D overlay (shared CrackField geometry —
// hairlines and text are not shader territory, plan §5.4).
//
// Patterns follow chaos-master: tgpu.initFromDevice over the
// shared device (src/lib/gpu/webgpu-device), TGSL vertexFn /
// fragmentFn, root.createRenderPipeline, and root.destroy() on
// dispose — NEVER device.destroy() (Firefox GPU-process crash).
// ============================================================

import type { TgpuRoot } from 'typegpu'
import { tgpu } from 'typegpu'
import { arrayOf, builtin, f32, struct, u32, vec2f, vec3f, vec4f, } from 'typegpu/data'
import { abs, clamp, dot, exp, fract, length, max, min, mix, mul, sin, sub, } from 'typegpu/std'
import { acquireWebGpuDevice } from '@/lib/gpu/webgpu-device'
import { CrackField } from '../crack-field'
import type { GlassRenderer, GlassSceneUpdate } from '../GlassRenderer'
import { ShardBurst } from '../shard-burst'

const VIEW_CENTS = 340 // half-range of the pane's vertical pitch view
const RIBBON_MAX = 152
const DPR_CAP = 2

const SceneUniforms = struct({
  time: f32,
  resonance: f32,
  /** 0 idle · 1 calibrate · 2 live · 3 playback */
  mode: u32,
  ribbonCount: u32,
  /** canvas width / height */
  aspect: f32,
  /** Latest sample: y (0..1 pane space), voiced flag, in-band flag, level */
  headY: f32,
  headVoiced: f32,
  headInBand: f32,
  level: f32,
})

const sceneLayout = tgpu
  .bindGroupLayout({
    uni: { uniform: SceneUniforms },
    /** Ribbon samples: x = pane-space y (0..1), y = voiced flag (0/1). */
    ribbon: { storage: arrayOf(vec2f, RIBBON_MAX), access: 'readonly' },
  })
  .$name('GlassScene.layout')

const VertexOutput = {
  position: builtin.position,
  uv: vec2f,
}

const vertex = tgpu.vertexFn({
  in: { vertexIndex: builtin.vertexIndex },
  out: VertexOutput,
})(({ vertexIndex }) => {
  const corners = [vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(1, 1)]
  const corner = corners[vertexIndex]!
  return {
    position: vec4f(corner.x, corner.y, 0, 1),
    // uv: x → 0..1 left→right, y → 0..1 TOP→bottom (matches pane space).
    uv: vec2f((corner.x + 1) * 0.5, (1 - corner.y) * 0.5),
  }
})

const fragment = tgpu.fragmentFn({ in: { uv: vec2f }, out: vec4f })(({
  uv,
}) => {
  const u = sceneLayout.$.uni
  // Aspect-corrected space so distances are round, not stretched.
  const p = vec2f(uv.x * u.aspect, uv.y)

  // Glass body: a translucent depth tint — the page's cosmos glows
  // through the transparent canvas behind this.
  let col = mul(
    mix(vec3f(0.105, 0.141, 0.188), vec3f(0.035, 0.027, 0.078), uv.y),
    0.85,
  )
  let alpha = f32(0.34)

  // Resonance ripples blooming from the target line's center.
  if (u.resonance > 0.02) {
    const rip = length(vec2f((uv.x - 0.5) * u.aspect, (uv.y - 0.5) * 2.6))
    const wave = sin(rip * 30 - u.time * 4.4) * 0.5 + 0.5
    const glowR = wave * exp(-rip * 2.2) * u.resonance * 0.3
    col = vec3f(col.x + glowR, col.y + glowR * 0.914, col.z + glowR * 0.659)
  }

  // Target etch (live + playback): soft gold band + a dashed line.
  if (u.mode >= 2) {
    const dy = abs(uv.y - 0.5)
    const band = f32(35.0 / (VIEW_CENTS * 2.0)) // tolerance half-height
    const bandGlow = (1 - clamp(dy / band, 0, 1)) * 0.06
    const dash = sin(uv.x * 90) * 0.5 + 0.5
    const line = exp(-dy * dy * 90000) * (0.25 + 0.5 * dash)
    const gold = bandGlow + line * 0.7
    col = vec3f(col.x + gold, col.y + gold * 0.914, col.z + gold * 0.659)
    alpha += line * 0.35
  }

  // The ribbon: distance to the sample polyline (storage buffer).
  let minDist = f32(9)
  for (let i = 0; i < RIBBON_MAX - 1; i++) {
    if (u32(i + 1) < u.ribbonCount) {
      const a = sceneLayout.$.ribbon[i]!
      const b = sceneLayout.$.ribbon[i + 1]!
      if (a.y > 0.5 && b.y > 0.5) {
        const pa = vec2f((f32(i) / f32(RIBBON_MAX - 1)) * u.aspect, a.x)
        const pb = vec2f((f32(i + 1) / f32(RIBBON_MAX - 1)) * u.aspect, b.x)
        const toP = sub(p, pa)
        const seg = sub(pb, pa)
        const h = clamp(dot(toP, seg) / max(dot(seg, seg), 0.000001), 0, 1)
        const d = length(sub(toP, mul(seg, h)))
        minDist = min(minDist, d)
      }
    }
  }
  if (minDist < 8) {
    const wide = exp(-minDist * 26)
    const core = exp(-minDist * minDist * 14000)
    // Blue → aqua when the head is in band; gold during playback.
    let ribbonCol = mix(
      vec3f(0.345, 0.651, 1.0),
      vec3f(0.176, 0.831, 0.749),
      u.headInBand,
    )
    if (u.mode === 3) {
      ribbonCol = vec3f(1.0, 0.914, 0.659)
    }
    // Quicksilver violet fringe rises with resonance.
    const fringe = mul(vec3f(0.737, 0.549, 1.0), wide * u.resonance * 0.3)
    col = vec3f(
      col.x + ribbonCol.x * (wide * 0.3 + core * 0.95) + fringe.x,
      col.y + ribbonCol.y * (wide * 0.3 + core * 0.95) + fringe.y,
      col.z + ribbonCol.z * (wide * 0.3 + core * 0.95) + fringe.z,
    )
    alpha += wide * 0.22 + core * 0.6
  }

  // The singing head: a swelling dot at the newest sample.
  if (u.headVoiced > 0.5 && u.mode !== 3 && u.ribbonCount > 0) {
    const headX = (f32(u.ribbonCount - 1) / f32(RIBBON_MAX - 1)) * u.aspect
    const hd = length(sub(p, vec2f(headX, u.headY)))
    const headGlow = exp(-hd * hd * 9000) * (0.7 + u.level * 2)
    const headCol = mix(
      vec3f(0.345, 0.651, 1.0),
      vec3f(0.176, 0.831, 0.749),
      u.headInBand,
    )
    col = vec3f(
      col.x + headCol.x * headGlow,
      col.y + headCol.y * headGlow,
      col.z + headCol.z * headGlow,
    )
    alpha += headGlow * 0.5
  }

  // Specular sheen drifting diagonally; brightens with resonance.
  const sweep = fract(u.time * 0.045) * 2.2 - 0.6
  const q = uv.x * 0.8 + uv.y * 0.2 - sweep
  const spec = exp(-q * q * 240) * (0.05 + u.resonance * 0.1)
  col = vec3f(col.x + spec, col.y + spec, col.z + spec)
  alpha += spec * 0.4

  // Premultiplied-alpha safety: rgb must never exceed alpha.
  alpha = clamp(alpha, 0, 1)
  const lum = max(col.x, max(col.y, col.z))
  alpha = max(alpha, min(lum, 1))
  return vec4f(min(col.x, alpha), min(col.y, alpha), min(col.z, alpha), alpha)
})

const IDLE_STATE: GlassSceneUpdate = {
  mode: 'idle',
  offCents: null,
  level: 0,
  resonance: 0,
  fatigue: 0,
  crackStep: 0,
  targetLabel: '',
}

export class TypeGpuGlassRenderer implements GlassRenderer {
  readonly backend = 'typegpu' as const

  /** Acquire the shared device, stand up a TypeGPU root, verify a canvas
   *  context — throws on any failure so the factory can fall back. */
  static async create(): Promise<TypeGpuGlassRenderer> {
    const { device } = await acquireWebGpuDevice()
    const root = tgpu.initFromDevice({ device })
    return new TypeGpuGlassRenderer(root)
  }

  private root: TgpuRoot
  private wrapper: HTMLDivElement
  private gpuCanvas: HTMLCanvasElement
  private overlay: HTMLCanvasElement
  private overlayCtx: CanvasRenderingContext2D | null
  private context: GPUCanvasContext | null = null
  private format: GPUTextureFormat
  private uniforms
  private ribbonBuffer
  private drawScene: (pass: GPURenderPassEncoder) => void

  private observer: ResizeObserver | null = null
  private rafId = 0
  private disposed = false
  private width = 0
  private height = 0
  private dpr = 1

  private state: GlassSceneUpdate = IDLE_STATE
  /** Pane-space samples: x = y-position 0..1, y = voiced flag. */
  private ribbon: Array<{ y: number; voiced: number }> = []
  private calCenter: number | null = null
  private crackField = new CrackField()
  private burst: ShardBurst | null = null
  private reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  private constructor(root: TgpuRoot) {
    this.root = root
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'glass-scene-stack'
    this.gpuCanvas = document.createElement('canvas')
    this.gpuCanvas.className = 'glass-scene-canvas'
    this.overlay = document.createElement('canvas')
    this.overlay.className = 'glass-scene-canvas glass-scene-overlay'
    this.wrapper.append(this.gpuCanvas, this.overlay)
    this.overlayCtx = this.overlay.getContext('2d')
    this.format = navigator.gpu.getPreferredCanvasFormat()

    this.uniforms = root.createBuffer(SceneUniforms).$usage('uniform')
    this.ribbonBuffer = root
      .createBuffer(arrayOf(vec2f, RIBBON_MAX))
      .$usage('storage')
    const bindGroup = root.createBindGroup(sceneLayout, {
      uni: this.uniforms,
      ribbon: this.ribbonBuffer,
    })
    const pipeline = root
      .createRenderPipeline({
        vertex,
        fragment,
        primitive: { topology: 'triangle-strip' },
        targets: { format: this.format },
      })
      .with(bindGroup)
    this.drawScene = (pass) => pipeline.with(pass).draw(4)

    const loop = (): void => {
      if (this.disposed) return
      this.rafId = requestAnimationFrame(loop)
      this.frame(performance.now() / 1000)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  mount(host: HTMLElement): void {
    host.replaceChildren(this.wrapper)
    // getContext('webgpu') can return null pre-mount on iOS Safari — acquire
    // it after the canvas is in the DOM (chaos-master AutoCanvas lesson).
    if (this.context === null) {
      const context = this.gpuCanvas.getContext('webgpu')
      if (context === null) {
        throw new Error('canvas.getContext("webgpu") returned null')
      }
      context.configure({
        device: this.root.device,
        format: this.format,
        // Transparent canvas: the page's cosmos shows through the glass.
        alphaMode: 'premultiplied',
      })
      this.context = context
    }
    this.observer?.disconnect()
    this.observer = new ResizeObserver(() => this.resize(host))
    this.observer.observe(host)
    this.resize(host)
  }

  private resize(host: HTMLElement): void {
    const rect = host.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    this.dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
    this.width = rect.width
    this.height = rect.height
    for (const canvas of [this.gpuCanvas, this.overlay]) {
      canvas.width = Math.round(rect.width * this.dpr)
      canvas.height = Math.round(rect.height * this.dpr)
    }
    this.overlayCtx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  update(state: GlassSceneUpdate): void {
    this.state = state
    if (state.mode === 'calibrate') {
      if (state.offCents === null) {
        this.ribbon.push({ y: 0.5, voiced: 0 })
      } else {
        this.calCenter =
          this.calCenter === null
            ? state.offCents
            : this.calCenter * 0.97 + state.offCents * 0.03
        this.ribbon.push({
          y: this.offToY(state.offCents - this.calCenter),
          voiced: 1,
        })
      }
    } else if (state.mode === 'live' || state.mode === 'playback') {
      this.ribbon.push(
        state.offCents === null
          ? { y: 0.5, voiced: 0 }
          : { y: this.offToY(state.offCents), voiced: 1 },
      )
    }
    if (this.ribbon.length > RIBBON_MAX) this.ribbon.shift()
    this.crackField.sync(state.crackStep)
  }

  beginTake(): void {
    this.ribbon = []
    this.calCenter = null
  }

  shatter(options: { epicness: number; seed: number }): void {
    if (this.width === 0 || this.burst !== null) return
    // Snapshot = the presented GPU frame + the overlay (frame, cracks,
    // label) so all of it travels with the shards. drawImage from a WebGPU
    // canvas returns the last presented image per spec; if a browser hands
    // back a blank, fall back to a painted glass tint so the burst still
    // reads as glass.
    const snapshot = document.createElement('canvas')
    snapshot.width = this.gpuCanvas.width
    snapshot.height = this.gpuCanvas.height
    const sc = snapshot.getContext('2d')
    if (sc !== null) {
      sc.drawImage(this.gpuCanvas, 0, 0)
      const probe = sc.getImageData(
        Math.floor(snapshot.width / 2),
        Math.floor(snapshot.height / 2),
        1,
        1,
      ).data
      if (probe[3] === 0) {
        const tint = sc.createLinearGradient(
          0,
          0,
          snapshot.width,
          snapshot.height,
        )
        tint.addColorStop(0, 'rgba(27, 36, 48, 0.6)')
        tint.addColorStop(1, 'rgba(9, 7, 20, 0.65)')
        sc.fillStyle = tint
        sc.fillRect(0, 0, snapshot.width, snapshot.height)
      }
      sc.drawImage(this.overlay, 0, 0)
    }
    this.burst = new ShardBurst(snapshot, this.width, this.height, {
      epicness: options.epicness,
      seed: options.seed,
      impact: [this.width / 2, this.height / 2],
      reduceMotion: this.reduceMotion,
    })
    // Blank the GPU pane — from here only the shards exist. One clear-only
    // pass; the frame loop skips scene drawing while the burst runs.
    if (this.context !== null) {
      const encoder = this.root.device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'store',
          },
        ],
      })
      pass.end()
      this.root.device.queue.submit([encoder.finish()])
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.observer?.disconnect()
    this.context?.unconfigure()
    // Frees this root's resources. NEVER device.destroy() — the device is
    // shared (src/lib/gpu) and destroying it crashes Firefox's GPU process.
    this.root.destroy()
    this.wrapper.remove()
  }

  private offToY(offCents: number): number {
    return Math.max(0.02, Math.min(0.98, 0.5 - offCents / (VIEW_CENTS * 2)))
  }

  // ── frame ───────────────────────────────────────────────────

  private frame(t: number): void {
    if (this.context === null || this.width === 0) return

    // Burst mode: the GPU pane is blanked; shards animate on the overlay.
    if (this.burst !== null) {
      const c = this.overlayCtx
      if (c !== null) {
        c.clearRect(0, 0, this.width, this.height)
        this.burst.draw(c, t)
      }
      return
    }

    const s = this.state
    const head = this.ribbon[this.ribbon.length - 1]
    const headOffCents =
      s.offCents === null ? Number.POSITIVE_INFINITY : Math.abs(s.offCents)
    const inBand =
      (s.mode === 'live' || s.mode === 'playback') && headOffCents <= 35

    this.uniforms.write({
      time: t,
      resonance: s.resonance,
      mode:
        s.mode === 'calibrate'
          ? 1
          : s.mode === 'live'
            ? 2
            : s.mode === 'playback'
              ? 3
              : 0,
      ribbonCount: this.ribbon.length,
      aspect: this.width / this.height,
      headY: head?.y ?? 0.5,
      headVoiced: head?.voiced ?? 0,
      headInBand: inBand ? 1 : 0,
      level: s.level,
    })
    this.ribbonBuffer.write(
      Array.from({ length: RIBBON_MAX }, (_, i) => {
        const sample = this.ribbon[i]
        return vec2f(sample?.y ?? 0.5, sample?.voiced ?? 0)
      }),
    )

    const encoder = this.root.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store',
        },
      ],
    })
    this.drawScene(pass)
    pass.end()
    this.root.device.queue.submit([encoder.finish()])

    this.drawOverlay(t)
  }

  /** Frame bevel, perimeter resonance meter, target label and cracks —
   *  crisp hairlines and text stay on Canvas2D (plan §5.4). */
  private drawOverlay(t: number): void {
    const c = this.overlayCtx
    if (!c) return
    const W = this.width
    const H = this.height
    const s = this.state
    const radius = Math.min(18, W * 0.05)
    c.clearRect(0, 0, W, H)

    this.crackField.draw(c, W, H, t)

    if ((s.mode === 'live' || s.mode === 'playback') && s.targetLabel !== '') {
      c.font = '600 11px Outfit, system-ui, sans-serif'
      c.fillStyle = 'rgba(255, 233, 168, 0.9)'
      c.fillText(s.targetLabel, 12, H / 2 - 7)
    }

    const frame = c.createLinearGradient(0, 0, W, H)
    frame.addColorStop(0, '#c3ccd6')
    frame.addColorStop(0.4, '#5b6b7b')
    frame.addColorStop(0.7, '#8a97a6')
    frame.addColorStop(1, '#1b2430')
    this.roundedRect(c, 1.5, 1.5, W - 3, H - 3, radius)
    c.strokeStyle = frame
    c.lineWidth = 3
    c.stroke()

    if (s.resonance > 0.01) {
      const perimeter = 2 * (W + H)
      this.roundedRect(c, 5, 5, W - 10, H - 10, Math.max(4, radius - 3))
      c.strokeStyle = s.resonance > 0.85 ? '#2dd4bf' : '#ffe9a8'
      c.shadowColor = c.strokeStyle
      c.shadowBlur = 8
      c.lineWidth = 2
      c.setLineDash([perimeter * s.resonance, perimeter])
      c.stroke()
      c.setLineDash([])
      c.shadowBlur = 0
    }
  }

  private roundedRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
  }
}
