// ============================================================
// Merc's Journey — playable prototype (game-design.md Part 2, step 2).
//
// Proves the platformer core: PITCH = HEIGHT. Flow: hum any comfortable
// note (becomes your ground platform) → climb two more note-platforms by
// sliding your voice up (land = hover the band ~0.7s) → a glass gate pane
// waits at the top: hold its note to build resonance until it bursts.
// Everything is relative to YOUR ground note — no calibration screen.
//
// Self-contained canvas scene; no GlassRenderer dependency. Fail states,
// scrolling worlds, and the platform-shatter game-over come later — this
// is the "does singing feel like a joystick?" experiment.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import { CONF_MIN, centsToMidi, hzToCents } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import './journey.css'

const MIC_ID = 'journey-proto'
type Phase = 'intro' | 'ground' | 'climb' | 'gate' | 'done'

interface Platform {
  midi: number
  x0: number // fraction of width
  x1: number
  lit: boolean
  dwell: number
  /** stone platforms are safe to rest on; glass ones crack under Merc. */
  kind: 'stone' | 'glass'
  /** 1 → intact; ticks down while Merc rests on glass; 0 → shattered. */
  integrity: number
  broken: boolean
  respawnMs: number
}

export const JourneyPrototype: Component = () => {
  const [phase, setPhase] = createSignal<Phase>('intro')
  const [micError, setMicError] = createSignal<string | null>(null)
  const [groundLabel, setGroundLabel] = createSignal('')

  let canvas!: HTMLCanvasElement
  let raf = 0
  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null

  // --- world state (imperative; drawn by rAF) ---
  let groundMidi = 0
  let platforms: Platform[] = []
  let activeIdx = 0
  let gateRes = 0
  let burstT = -1 // >=0 while the burst anim runs (seconds)
  let shards: { x: number; y: number; vx: number; vy: number; r: number }[] = []
  let puff: { x: number; y: number; vx: number; vy: number; r: number }[] = []
  let puffT = -1 // platform-crumble burst clock (separate from the gate's)
  let mercX = 0.3
  let mercY = 0.8 // canvas fractions
  let trail: { x: number; y: number }[] = []
  let groundSamples: { t: number; midi: number }[] = []
  // Voice-edge hardening + rest state: raw f0 at voicing edges throws
  // octave-flip artifacts, and silence must NOT read as "fall" — Merc
  // rests on the nearest platform below until the voice returns.
  let voicedStreak = 0
  let unvoicedMs = 0
  let shownMidi: number | null = null
  let restIdx: number | null = null
  const merc = new Image()
  merc.src = '/game/merc.webp'

  const voicedMidi = (): number | null => {
    const fr = f0?.latestSmoothed()
    if (!fr || fr.f0 <= 0 || fr.conf < CONF_MIN) return null
    return centsToMidi(hzToCents(fr.f0))
  }

  // Pitch window: ground−3 … ground+8 semitones → vertical span.
  const yFor = (midi: number): number => {
    const lo = groundMidi - 3
    const hi = groundMidi + 8
    return 1 - (midi - lo) / (hi - lo)
  }

  const start = async (): Promise<void> => {
    setMicError(null)
    try {
      const stream = await micManager.acquire(MIC_ID)
      audioContext = new AudioContext()
      await audioContext.resume()
      f0 = createF0Stream(audioContext, stream)
      f0.startTask()
      setPhase('ground')
    } catch {
      setMicError('Microphone unavailable — check permissions and retry.')
    }
  }

  let last = 0
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(48, now - last)
    last = now
    const p = phase()
    // Debounce voicing edges (3 consecutive voiced frames before trusting
    // pitch) and slew-clamp movement so octave-flip artifacts at the start/
    // end of a phrase can't teleport Merc. Silence never means "fall": after
    // a short grace, shownMidi goes null and Merc rests where he is.
    const raw = voicedMidi()
    if (raw !== null) {
      voicedStreak += 1
      unvoicedMs = 0
      if (voicedStreak >= 3) {
        if (shownMidi === null) shownMidi = raw
        else {
          const maxStep = 0.45 * (dt / 16.7)
          shownMidi += Math.max(-maxStep, Math.min(maxStep, raw - shownMidi))
        }
      }
    } else {
      voicedStreak = 0
      unvoicedMs += dt
      if (unvoicedMs > 280) shownMidi = null
    }
    const midi = shownMidi

    // --- phase logic ---
    if (p === 'ground' && midi !== null) {
      const t = now / 1000
      groundSamples.push({ t, midi })
      groundSamples = groundSamples.filter((s) => t - s.t < 0.9)
      if (groundSamples.length > 24) {
        const ms = groundSamples.map((s) => s.midi).sort((a, b) => a - b)
        const spread = ms[ms.length - 1] - ms[0]
        if (spread < 1.6) {
          groundMidi = Math.round(ms[Math.floor(ms.length / 2)])
          const base = { lit: false, dwell: 0, integrity: 1, broken: false, respawnMs: 0 }
          platforms = [
            { ...base, midi: groundMidi, x0: 0.08, x1: 0.36, lit: true, dwell: 999, kind: 'stone' },
            { ...base, midi: groundMidi + 2, x0: 0.36, x1: 0.62, kind: 'glass' },
            { ...base, midi: groundMidi + 4, x0: 0.62, x1: 0.88, kind: 'stone' },
          ]
          activeIdx = 1
          setGroundLabel(midiToNoteNameOctave(groundMidi))
          setPhase('climb')
        }
      }
    } else if (p === 'climb' && activeIdx < platforms.length) {
      const target = platforms[activeIdx]
      if (!target.broken && midi !== null && Math.abs(midi - target.midi) <= 0.6) {
        target.dwell += dt
        if (target.dwell >= 700) {
          target.lit = true
          activeIdx += 1
          if (activeIdx >= platforms.length) setPhase('gate')
        }
      } else {
        target.dwell = Math.max(0, target.dwell - dt * 2)
      }
    } else if (p === 'gate') {
      const gateMidi = groundMidi + 6
      if (burstT < 0) {
        if (midi !== null && Math.abs(midi - gateMidi) <= 0.5) {
          gateRes = Math.min(1, gateRes + dt / 1600)
        } else {
          gateRes = Math.max(0, gateRes - dt / 900)
        }
        if (gateRes >= 1) {
          burstT = 0
          const gx = 0.93
          const gy = yFor(gateMidi)
          shards = Array.from({ length: 26 }, (_, i) => ({
            x: gx,
            y: gy,
            vx: (Math.cos((i / 26) * 6.283) * (0.5 + (i % 5) * 0.13)) / 2.2,
            vy: (Math.sin((i / 26) * 6.283) * (0.5 + (i % 3) * 0.2)) / 2.2 - 0.25,
            r: 2 + (i % 4) * 2,
          }))
        }
      } else {
        burstT += dt / 1000
        for (const s of shards) {
          s.x += (s.vx * dt) / 1000
          s.y += (s.vy * dt) / 1000
          s.vy += (1.6 * dt) / 1000
        }
        if (burstT > 1.1) setPhase('done')
      }
    }

    // --- merc follows the voice, or rests on the nearest platform below ---
    if (p !== 'intro') {
      if (midi !== null) {
        restIdx = null
        const ty = Math.min(1.05, Math.max(-0.05, yFor(midi)))
        mercY += (ty - mercY) * 0.22
      } else if (platforms.length > 0) {
        if (restIdx === null || platforms[restIdx].broken) {
          let best: number | null = null
          let bestD = Infinity
          for (const [i, pl] of platforms.entries()) {
            if (pl.broken) continue
            const d = yFor(pl.midi) - mercY // canvas y grows downward
            if (d > -0.06 && d < bestD) {
              bestD = d
              best = i
            }
          }
          restIdx = best ?? 0
        }
        const pl = platforms[restIdx]
        const sitY = yFor(pl.midi) - 0.035
        mercY += (sitY - mercY) * 0.15
        // Glass cracks under a resting Merc; stone is safe ground.
        if (pl.kind === 'glass' && Math.abs(mercY - sitY) < 0.02) {
          pl.integrity = Math.max(0, pl.integrity - dt / 3200)
          if (pl.integrity === 0 && !pl.broken) {
            pl.broken = true
            pl.respawnMs = 2600
            const py = yFor(pl.midi)
            puff = Array.from({ length: 14 }, (_, i) => ({
              x: pl.x0 + ((i + 0.5) / 14) * (pl.x1 - pl.x0),
              y: py,
              vx: (i / 14 - 0.5) * 0.3,
              vy: 0.05 + (i % 3) * 0.08,
              r: 2 + (i % 3) * 2,
            }))
            puffT = 0
            restIdx = null // gravity: settle onto whatever is below
          }
        }
      }
      for (const pl of platforms) {
        if (pl.broken) {
          pl.respawnMs -= dt
          if (pl.respawnMs <= 0) {
            pl.broken = false
            pl.integrity = 1
          }
        }
      }
      if (puffT >= 0) {
        puffT += dt / 1000
        for (const s of puff) {
          s.x += (s.vx * dt) / 1000
          s.y += (s.vy * dt) / 1000
          s.vy += (1.4 * dt) / 1000
        }
        if (puffT > 1) puffT = -1
      }
    }
    const wantX =
      p === 'gate' || phase() === 'done'
        ? 0.82
        : platforms.length > 0 && activeIdx < platforms.length
          ? (platforms[activeIdx].x0 + platforms[activeIdx].x1) / 2
          : 0.3
    mercX += (wantX - mercX) * 0.04
    if (midi !== null) {
      trail.push({ x: mercX, y: mercY })
      if (trail.length > 70) trail.shift()
    }

    draw()
  }

  const draw = (): void => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w * devicePixelRatio) {
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (phase() === 'intro') return

    // platforms
    for (const [i, pl] of platforms.entries()) {
      const y = yFor(pl.midi) * h
      const x0 = pl.x0 * w
      const x1 = pl.x1 * w
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      const active = i === activeIdx
      const glassTint = pl.kind === 'glass' ? '#7ee7ff' : '#2dd4bf'
      if (pl.broken) {
        ctx.strokeStyle = 'rgba(126,231,255,0.10)'
        ctx.setLineDash([6, 10])
      } else {
        ctx.strokeStyle = pl.lit
          ? glassTint
          : active
            ? 'rgba(88,166,255,0.9)'
            : pl.kind === 'glass'
              ? 'rgba(126,231,255,0.35)'
              : 'rgba(88,166,255,0.28)'
      }
      if (pl.lit && !pl.broken) {
        ctx.shadowColor = glassTint
        ctx.shadowBlur = 14
      } else ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      // stress cracks while a glass platform is being rested on
      if (pl.kind === 'glass' && !pl.broken && pl.integrity < 1) {
        const n = Math.ceil((1 - pl.integrity) * 6)
        ctx.strokeStyle = 'rgba(230,237,243,0.65)'
        ctx.lineWidth = 1
        for (let c = 0; c < n; c++) {
          const cx = x0 + ((c + 0.7) / 6.4) * (x1 - x0)
          ctx.beginPath()
          ctx.moveTo(cx, y - 3)
          ctx.lineTo(cx + (c % 2 === 0 ? 4 : -4), y + 6 + c * 1.5)
          ctx.stroke()
        }
        ctx.lineWidth = 6
      }
      // dwell progress on the active platform
      if (active && pl.dwell > 0 && !pl.lit) {
        ctx.strokeStyle = '#7ee787'
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x0 + (x1 - x0) * Math.min(1, pl.dwell / 700), y)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(230,237,243,0.75)'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.fillText(midiToNoteNameOctave(pl.midi), x0, y - 10)
    }

    // gate pane
    if ((phase() === 'gate' || phase() === 'done') && burstT < 0.02) {
      const gy = yFor(groundMidi + 6) * h
      const gx = 0.93 * w
      ctx.fillStyle = `rgba(188,140,255,${0.25 + gateRes * 0.5})`
      ctx.strokeStyle = '#bc8cff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(gx - 14, gy - 54, 28, 108, 8)
      ctx.fill()
      ctx.stroke()
      if (gateRes > 0.35) crack(ctx, gx, gy, 1)
      if (gateRes > 0.7) crack(ctx, gx, gy, 2)
      ctx.fillStyle = 'rgba(230,237,243,0.8)'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.fillText(midiToNoteNameOctave(groundMidi + 6), gx - 14, gy - 62)
    }

    // shards
    if (burstT >= 0) {
      ctx.fillStyle = '#bc8cff'
      for (const s of shards) {
        ctx.globalAlpha = Math.max(0, 1 - burstT)
        ctx.fillRect(s.x * w, s.y * h, s.r, s.r)
      }
      ctx.globalAlpha = 1
    }

    // voice trail + merc
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(45,212,191,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(trail[0].x * w, trail[0].y * h)
      for (const t of trail) ctx.lineTo(t.x * w, t.y * h)
      ctx.stroke()
    }
    // platform-crumble puff
    if (puffT >= 0) {
      ctx.fillStyle = '#7ee7ff'
      for (const s of puff) {
        ctx.globalAlpha = Math.max(0, 1 - puffT)
        ctx.fillRect(s.x * w, s.y * h, s.r, s.r)
      }
      ctx.globalAlpha = 1
    }

    const mx = mercX * w
    // gentle idle bob while resting on a platform
    const bob = shownMidi === null && restIdx !== null ? Math.sin(last / 300) * 1.5 : 0
    const my = mercY * h + bob
    if (merc.complete && merc.naturalWidth > 0) {
      ctx.drawImage(merc, mx - 22, my - 22, 44, 44)
    } else {
      ctx.fillStyle = '#2dd4bf'
      ctx.beginPath()
      ctx.arc(mx, my, 14, 0, 6.283)
      ctx.fill()
    }
  }

  const crack = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    seed: number,
  ): void => {
    ctx.strokeStyle = 'rgba(230,237,243,0.7)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 8 * seed, y - 20 * seed)
    ctx.moveTo(x, y)
    ctx.lineTo(x + 6 * seed, y + 16 * seed)
    ctx.stroke()
  }

  onMount(() => {
    raf = requestAnimationFrame(tick)
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    f0?.dispose()
    micManager.release(MIC_ID)
    void audioContext?.close()
  })

  return (
    <div class="jp-root">
      <canvas class="jp-canvas" ref={canvas} />
      <div class="jp-hud">
        <Show when={phase() === 'intro'}>
          <h2 class="jp-title">Merc's Journey</h2>
          <p class="jp-text">
            Your voice is the controller: sing higher to rise, lower to sink.
            Climb the platforms, then hold the gate's note to shatter it.
          </p>
          <button class="jp-start" onClick={() => void start()}>
            Start — allow the mic
          </button>
          <Show when={micError()}>
            <p class="jp-error">{micError()}</p>
          </Show>
        </Show>
        <Show when={phase() === 'ground'}>
          <p class="jp-text jp-pulse">Hum any comfortable note and hold it…</p>
        </Show>
        <Show when={phase() === 'climb'}>
          <p class="jp-text">
            Ground set: {groundLabel()}. Slide UP to each platform and hold.
            Go quiet and Merc rests where he is — but the icy glass platform
            cracks if he lingers.
          </p>
        </Show>
        <Show when={phase() === 'gate'}>
          <p class="jp-text">The gate rings two steps higher — hold its note.</p>
        </Show>
        <Show when={phase() === 'done'}>
          <h2 class="jp-title">Gate shattered.</h2>
          <p class="jp-text">Pitch-as-height: proven. This becomes the campaign.</p>
        </Show>
      </div>
    </div>
  )
}
