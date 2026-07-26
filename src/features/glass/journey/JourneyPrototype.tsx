// ============================================================
// Merc's Journey — the first playable slice (game-design.md Part 2).
//
// A side-scrolling stage driven entirely by pitch (voice = joystick):
//   climb 3 note-platforms → shatter the gate pane → cross the melody
//   bridge over the void (glass steps, sung in order, crack if you
//   linger) → land the goal ledge → charge the final wall until it
//   bursts. Silence = rest on the platform under you; resting where
//   nothing holds you = the fall → game over → retry from the
//   checkpoint ledge.
//
// Every tunable lives in journey-config.ts (JOURNEY_CONFIG) — nothing
// here hard-codes game feel.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { playTargetHum } from '@/lib/demo-audio'
import { micManager } from '@/lib/mic-manager'
import { CONF_MIN, centsToMidi, hzToCents } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { JOURNEY_CONFIG as C } from './journey-config'
import './journey.css'

const MIC_ID = 'journey-proto'
const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

type Phase = 'intro' | 'ground' | 'play' | 'fallen' | 'done'

interface Platform {
  midi: number
  x0: number // world units
  x1: number
  kind: 'stone' | 'glass'
  lit: boolean
  dwell: number
  integrity: number
  broken: boolean
  respawnMs: number
  /** Hum this platform's note when it becomes the active objective. */
  hum?: boolean
}

interface Pane {
  wx: number
  midi: number
  kind: 'gate' | 'wall'
  res: number
  burstT: number // -1 until burst
  shards: { x: number; y: number; vx: number; vy: number; r: number }[]
}

type Node =
  | { t: 'land'; p: Platform; hint: string; checkpoint?: boolean }
  | { t: 'pane'; pane: Pane; hint: string }

export const JourneyPrototype: Component = () => {
  const [phase, setPhase] = createSignal<Phase>('intro')
  const [micError, setMicError] = createSignal<string | null>(null)
  const [hint, setHint] = createSignal('')

  let canvas!: HTMLCanvasElement
  let raf = 0
  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null

  // --- world state ---
  let groundMidi = 0
  let platforms: Platform[] = []
  let panes: Pane[] = []
  let nodes: Node[] = []
  let activeIdx = 0
  let checkpointReached = false
  let camX = 0
  const WORLD_MAX = 19

  let mercWX = 1.6
  let mercY = 0.8
  let falling = false
  let fallenMs = 0
  let trail: { wx: number; y: number }[] = []
  let puff: { x: number; y: number; vx: number; vy: number; r: number }[] = []
  let puffT = -1

  // voice-edge hardening + rest state
  let voicedStreak = 0
  let unvoicedMs = 0
  let shownMidi: number | null = null
  let restIdx: number | null = null
  let groundSamples: { t: number; midi: number }[] = []

  const merc = new Image()
  merc.src = '/game/merc.webp'

  const voicedMidi = (): number | null => {
    const fr = f0?.latestSmoothed()
    if (!fr || fr.f0 <= 0 || fr.conf < CONF_MIN) return null
    return centsToMidi(hzToCents(fr.f0))
  }

  const yFor = (midi: number): number => {
    const lo = groundMidi + C.view.windowLoOffset
    const hi = groundMidi + C.view.windowHiOffset
    return 1 - (midi - lo) / (hi - lo)
  }

  const note = (off: number): string => midiToNoteNameOctave(groundMidi + off)

  const buildWorld = (): void => {
    const P = (
      midi: number,
      x0: number,
      x1: number,
      kind: 'stone' | 'glass',
      extra?: Partial<Platform>,
    ): Platform => ({
      midi,
      x0,
      x1,
      kind,
      lit: false,
      dwell: 0,
      integrity: 1,
      broken: false,
      respawnMs: 0,
      ...extra,
    })
    const g = groundMidi
    const ground = P(g, 0.5, 3, 'stone', { lit: true, dwell: 9999 })
    const p1 = P(g + 2, 3, 5.5, 'glass')
    const p2 = P(g + 4, 5.5, 8, 'stone')
    const ledge = P(g + 2, 8.7, 10.3, 'stone')
    const [s1, s2, s3] = C.bridge.stepOffsets
    const step1 = P(g + s1, 11, 12.5, 'glass', { hum: true })
    const step2 = P(g + s2, 12.7, 14.2, 'glass', { hum: true })
    const step3 = P(g + s3, 14.4, 15.9, 'glass', { hum: true })
    const goal = P(g + 3, 16.1, 17.3, 'stone')
    platforms = [ground, p1, p2, ledge, step1, step2, step3, goal]

    const gate: Pane = { wx: 9.2, midi: g + 6, kind: 'gate', res: 0, burstT: -1, shards: [] }
    const wall: Pane = { wx: 17.8, midi: g + 6, kind: 'wall', res: 0, burstT: -1, shards: [] }
    panes = [gate, wall]

    nodes = [
      { t: 'land', p: p1, hint: `Slide up to ${note(2)} — careful, it's icy glass.` },
      { t: 'land', p: p2, hint: `Higher — hold ${note(4)} to land.` },
      { t: 'pane', pane: gate, hint: `The gate rings at ${note(6)}. Hold its note.` },
      { t: 'land', p: ledge, hint: 'Land the ledge — a safe checkpoint.', checkpoint: true },
      { t: 'land', p: step1, hint: 'The bridge: sing each step to cross the void.' },
      { t: 'land', p: step2, hint: 'Next step — keep moving, glass never waits.' },
      { t: 'land', p: step3, hint: 'Last step of the bridge.' },
      { t: 'land', p: goal, hint: 'Solid ground. Breathe.' },
      { t: 'pane', pane: wall, hint: `The wall. ${note(6)}, held until it gives.` },
    ]
    checkpointReached = false
    activeIdx = -1
    advanceTo(0)
    mercWX = 1.6
    mercY = yFor(g) - 0.035
    camX = 0
    trail = []
    falling = false
    fallenMs = 0
    restIdx = null
  }

  const advanceTo = (idx: number): void => {
    activeIdx = idx
    if (idx >= nodes.length) {
      setPhase('done')
      return
    }
    const n = nodes[idx]
    setHint(n.hint)
    if (n.t === 'land' && n.p.hum === true && audioContext !== null) {
      playTargetHum(audioContext, midiToHz(n.p.midi), C.bridge.humSeconds)
    }
  }

  const retry = (): void => {
    if (checkpointReached) {
      // reset everything after the checkpoint ledge (node index 3)
      for (let i = 4; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.t === 'land') {
          n.p.lit = false
          n.p.dwell = 0
          n.p.integrity = 1
          n.p.broken = false
        } else {
          n.pane.res = 0
          n.pane.burstT = -1
          n.pane.shards = []
        }
      }
      const ledge = nodes[3] as Extract<Node, { t: 'land' }>
      mercWX = (ledge.p.x0 + ledge.p.x1) / 2
      mercY = yFor(ledge.p.midi) - 0.035
      falling = false
      fallenMs = 0
      restIdx = null
      shownMidi = null
      advanceTo(4)
    } else {
      buildWorld()
    }
    setPhase('play')
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

    // --- debounced, slew-clamped pitch (silence = rest, never fall) ---
    const raw = voicedMidi()
    if (raw !== null) {
      voicedStreak += 1
      unvoicedMs = 0
      if (voicedStreak >= C.voice.debounceFrames) {
        if (shownMidi === null) shownMidi = raw
        else {
          const maxStep = C.voice.slewSemisPerFrame * (dt / 16.7)
          shownMidi += Math.max(-maxStep, Math.min(maxStep, raw - shownMidi))
        }
      }
    } else {
      voicedStreak = 0
      unvoicedMs += dt
      if (unvoicedMs > C.voice.restGraceMs) shownMidi = null
    }
    const midi = shownMidi

    if (p === 'ground' && midi !== null) {
      const t = now / 1000
      groundSamples.push({ t, midi })
      groundSamples = groundSamples.filter((s) => t - s.t < 0.9)
      if (groundSamples.length > 24) {
        const ms = groundSamples.map((s) => s.midi).sort((a, b) => a - b)
        if (ms[ms.length - 1] - ms[0] < 1.6) {
          groundMidi = Math.round(ms[Math.floor(ms.length / 2)])
          buildWorld()
          setPhase('play')
        }
      }
    }

    if (p === 'play' && !falling && activeIdx < nodes.length) {
      const n = nodes[activeIdx]
      if (n.t === 'land') {
        const pl = n.p
        if (!pl.broken && midi !== null && Math.abs(midi - pl.midi) <= C.land.bandSemis) {
          pl.dwell += dt
          if (pl.dwell >= C.land.dwellMs) {
            pl.lit = true
            if (n.checkpoint === true) checkpointReached = true
            advanceTo(activeIdx + 1)
          }
        } else {
          pl.dwell = Math.max(0, pl.dwell - dt * C.land.decay)
        }
      } else {
        const pane = n.pane
        const cfg = pane.kind === 'gate' ? C.gate : C.wall
        if (pane.burstT < 0) {
          if (midi !== null && Math.abs(midi - pane.midi) <= cfg.tolSemis) {
            pane.res = Math.min(1, pane.res + dt / cfg.riseMs)
          } else {
            pane.res = Math.max(0, pane.res - dt / cfg.fallMs)
          }
          if (pane.res >= 1) {
            pane.burstT = 0
            const gy = yFor(pane.midi)
            pane.shards = Array.from({ length: 26 }, (_, i) => ({
              x: pane.wx,
              y: gy,
              vx: (Math.cos((i / 26) * 6.283) * (0.5 + (i % 5) * 0.13)) / 2.2,
              vy: (Math.sin((i / 26) * 6.283) * (0.5 + (i % 3) * 0.2)) / 2.2 - 0.25,
              r: 2 + (i % 4) * 2,
            }))
          }
        }
      }
    }

    // pane burst animation (world-x shards move in world units horizontally)
    for (const pane of panes) {
      if (pane.burstT >= 0 && pane.burstT < 2) {
        pane.burstT += dt / 1000
        for (const s of pane.shards) {
          s.x += (s.vx * dt) / 1000 / 0.55
          s.y += (s.vy * dt) / 1000
          s.vy += (1.6 * dt) / 1000
        }
        if (pane.burstT > 0.9 && nodes[activeIdx]?.t === 'pane') {
          const n = nodes[activeIdx] as Extract<Node, { t: 'pane' }>
          if (n.pane === pane) advanceTo(activeIdx + 1)
        }
      }
    }

    // --- merc: fly with the voice, rest on what's below, or fall ---
    if (p === 'play' || p === 'fallen') {
      if (falling) {
        mercY += (C.fall.speed * dt) / 1000
        if (mercY > C.fall.yGone) {
          fallenMs += dt
          if (fallenMs > C.fall.cardDelayMs && p === 'play') setPhase('fallen')
        }
      } else if (midi !== null) {
        restIdx = null
        const ty = Math.min(1.05, Math.max(-0.05, yFor(midi)))
        mercY += (ty - mercY) * C.view.flyLerp
      } else if (platforms.length > 0) {
        if (restIdx === null || platforms[restIdx].broken) {
          let best: number | null = null
          let bestD = Infinity
          for (const [i, pl] of platforms.entries()) {
            if (pl.broken) continue
            if (mercWX < pl.x0 - 0.15 || mercWX > pl.x1 + 0.15) continue
            const d = yFor(pl.midi) - mercY
            if (d > -0.06 && d < bestD) {
              bestD = d
              best = i
            }
          }
          restIdx = best
          if (restIdx === null) falling = true // nothing below: the void
        }
        if (restIdx !== null) {
          const pl = platforms[restIdx]
          const sitY = yFor(pl.midi) - 0.035
          mercY += (sitY - mercY) * C.view.restLerp
          if (pl.kind === 'glass' && Math.abs(mercY - sitY) < 0.02) {
            pl.integrity = Math.max(0, pl.integrity - dt / C.glass.crackMs)
            if (pl.integrity === 0 && !pl.broken) {
              pl.broken = true
              pl.respawnMs = C.glass.respawnMs
              const py = yFor(pl.midi)
              puff = Array.from({ length: 14 }, (_, i) => ({
                x: pl.x0 + ((i + 0.5) / 14) * (pl.x1 - pl.x0),
                y: py,
                vx: (i / 14 - 0.5) * 0.5,
                vy: 0.05 + (i % 3) * 0.08,
                r: 2 + (i % 3) * 2,
              }))
              puffT = 0
              restIdx = null
            }
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

      // forward drift toward the objective (or stay on the rest platform)
      if (!falling) {
        let wantWX = mercWX
        if (midi !== null && activeIdx < nodes.length) {
          const n = nodes[activeIdx]
          wantWX = n.t === 'land' ? (n.p.x0 + n.p.x1) / 2 : n.pane.wx - 0.7
        } else if (restIdx !== null) {
          const pl = platforms[restIdx]
          wantWX = Math.min(Math.max(mercWX, pl.x0 + 0.2), pl.x1 - 0.2)
        }
        mercWX += (wantWX - mercWX) * C.view.xLerp
      }

      if (midi !== null) {
        trail.push({ wx: mercWX, y: mercY })
        if (trail.length > 70) trail.shift()
      }

      // camera follows
      const target = Math.min(Math.max(mercWX - 3, 0), WORLD_MAX - C.view.viewUnits)
      camX += (target - camX) * C.view.cameraLerp
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
    if (phase() === 'intro' || phase() === 'ground') return

    const X = (wx: number): number => ((wx - camX) / C.view.viewUnits) * w

    // void shimmer under the bridge span
    ctx.strokeStyle = 'rgba(248,81,73,0.18)'
    ctx.setLineDash([3, 9])
    ctx.beginPath()
    ctx.moveTo(X(10.3), h * 0.96)
    ctx.lineTo(X(16.1), h * 0.96)
    ctx.stroke()
    ctx.setLineDash([])

    for (const [i, pl] of platforms.entries()) {
      const y = yFor(pl.midi) * h
      const x0 = X(pl.x0)
      const x1 = X(pl.x1)
      if (x1 < -40 || x0 > w + 40) continue
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      const isActive =
        activeIdx < nodes.length &&
        nodes[activeIdx].t === 'land' &&
        (nodes[activeIdx] as Extract<Node, { t: 'land' }>).p === pl
      const glassTint = pl.kind === 'glass' ? '#7ee7ff' : '#2dd4bf'
      if (pl.broken) {
        ctx.strokeStyle = 'rgba(126,231,255,0.10)'
        ctx.setLineDash([6, 10])
      } else {
        ctx.strokeStyle = pl.lit
          ? glassTint
          : isActive
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
      if (isActive && pl.dwell > 0 && !pl.lit) {
        ctx.strokeStyle = '#7ee787'
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x0 + (x1 - x0) * Math.min(1, pl.dwell / C.land.dwellMs), y)
        ctx.stroke()
      }
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
      ctx.fillStyle = 'rgba(230,237,243,0.75)'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.fillText(midiToNoteNameOctave(pl.midi), x0, y - 10)
      void i
    }

    for (const pane of panes) {
      const gx = X(pane.wx)
      if (gx < -60 || gx > w + 60) continue
      const gy = yFor(pane.midi) * h
      const tall = pane.kind === 'wall' ? 150 : 108
      const wide = pane.kind === 'wall' ? 34 : 28
      if (pane.burstT < 0.02) {
        ctx.fillStyle = `rgba(188,140,255,${0.25 + pane.res * 0.5})`
        ctx.strokeStyle = '#bc8cff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(gx - wide / 2, gy - tall / 2, wide, tall, 8)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = 'rgba(230,237,243,0.8)'
        ctx.font = '12px JetBrains Mono, monospace'
        ctx.fillText(midiToNoteNameOctave(pane.midi), gx - wide / 2, gy - tall / 2 - 8)
      }
      if (pane.burstT >= 0) {
        ctx.fillStyle = '#bc8cff'
        for (const s of pane.shards) {
          ctx.globalAlpha = Math.max(0, 1 - pane.burstT)
          ctx.fillRect(X(s.x), s.y * h, s.r, s.r)
        }
        ctx.globalAlpha = 1
      }
    }

    if (puffT >= 0) {
      ctx.fillStyle = '#7ee7ff'
      for (const s of puff) {
        ctx.globalAlpha = Math.max(0, 1 - puffT)
        ctx.fillRect(X(s.x), s.y * h, s.r, s.r)
      }
      ctx.globalAlpha = 1
    }

    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(45,212,191,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(X(trail[0].wx), trail[0].y * h)
      for (const t of trail) ctx.lineTo(X(t.wx), t.y * h)
      ctx.stroke()
    }

    const mx = X(mercWX)
    const bob = shownMidi === null && restIdx !== null && !falling ? Math.sin(last / 300) * 1.5 : 0
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
            Climb, shatter the gate, cross the bridge, break the wall.
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
        <Show when={phase() === 'play'}>
          <p class="jp-text">{hint()}</p>
        </Show>
        <Show when={phase() === 'fallen'}>
          <h2 class="jp-title">The glass gave way.</h2>
          <p class="jp-text">The void keeps what it catches.</p>
          <button class="jp-start" onClick={retry}>
            {checkpointReached ? 'Retry from the ledge' : 'Retry'}
          </button>
        </Show>
        <Show when={phase() === 'done'}>
          <h2 class="jp-title">The wall shattered.</h2>
          <p class="jp-text">
            Slice complete — climb, gate, bridge, wall. This becomes chapter one.
          </p>
          <button class="jp-start" onClick={() => buildWorld()}>
            Run it again
          </button>
        </Show>
      </div>
    </div>
  )
}
