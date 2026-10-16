// ============================================================
// Lesson 1 spiral toy — Figs. 5 and 6, the pitch spiral and its keyboard
// ============================================================
//
// One control with three ways in: drag to turn the spiral and tap a bead
// (or, unrolled, a key) to hear it; from the keyboard the canvas is a slider
// over the 37 notes, Shift with Left or Right turning it. Step 6 swaps in the
// keyboard's controls and lets the spiral unroll; on a phone the unrolled
// keyboard shows one octave at a time and pans. Taps are tested against the
// hit lists the last frame drew, snapping to the nearest bead or key within
// 22 px. The helix, beads and keyboard are drawn in toy-spiral-draw.ts; the
// two overlays that answer the viewer, the focus ring and the name tag, are
// drawn here on top of that frame.

import { clamp, q, qa, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, surface } from '@/features/lessons/kit/frame-loop'
import { Motion, reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, fmtHz, hz, nameOf, noteColor, rgba, } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { playTone, Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { BeadHit, KeyHit } from './toy-spiral-draw'
import { drawSpiral, LO, N, roundedRect, WHITE } from './toy-spiral-draw'

/** The phone keyboard's three windows, by pan / 7. */
const WIN = ['A2 to A3', 'A3 to A4', 'A4 to A5']

const say = (m: number): string =>
  `${nameOf(m) ?? 'A note without a letter of its own (Lesson 2)'}, ${fmtHz(hz(m))} hertz`

/** A note's place counted in white keys; a black key sits half a key past the white below it. */
function wIndex(s: number): number {
  const wi = WHITE.indexOf(s)
  return wi >= 0 ? wi : WHITE.indexOf(s - 1) + 0.5
}

export function initSpiralToy(deck: StepDeck): void {
  const canvas = q<HTMLCanvasElement>('#cvSpiral')
  const cv = surface(canvas)
  const hint = q('#spiralHint')
  const driftBtn = q<HTMLButtonElement>('#driftBtn')
  const unrollBtn = q<HTMLButtonElement>('#unrollBtn')
  const panBox = q('#kbPan')
  const panWin = q('#kbWin')
  const roSpiral = q('#roSpiral')
  let yaw = 0
  let vel = 0
  let userDrift = true
  let dragging = false
  let moved = 0
  let lastX = 0
  let u = 0
  let uTarget = 0
  let step6 = false
  let hits: BeadHit[] = []
  let keyHits: KeyHit[] = []
  let hover: number | null = null
  let tapLabel: { s: number; t: number } | null = null
  // the keyboard's own selection (A3 to start); on a phone the unrolled keyboard shows one octave at a time and pans
  let sel = 12
  let focused = false
  let narrow = false
  let pan = 7
  let panTarget = 7
  const pulses = new Map<number, number>()
  const drifting = (): boolean => userDrift && !Motion.paused

  function setSel(s: number): void {
    sel = clamp(s, 0, N - 1)
    tapLabel = null // the label follows the selection (a tap sets it again when it plays)
    canvas.setAttribute('aria-valuenow', String(sel))
    canvas.setAttribute('aria-valuetext', say(LO + sel))
    if (narrow && uTarget > 0.5) {
      const wi = wIndex(sel)
      if (wi < panTarget) panTarget = Math.max(0, panTarget - 7)
      else if (wi > panTarget + 7) panTarget = Math.min(14, panTarget + 7)
      if (reducedMotion()) pan = panTarget
      syncPan()
    }
  }

  function hit(s: number): void {
    const m = LO + s
    pulses.set(m, performance.now())
    tapLabel = { s, t: performance.now() }
    roSpiral.innerHTML = `${nameOf(m) ?? '?'}<small>${fmtHz(hz(m))} Hz</small>`
    roSpiral.style.color = noteColor(m)
  }

  function play(
    m: number,
    audible = Sound.canPlay(),
    dur = 0.9,
  ): Promise<Voice | null> {
    hit(m - LO)
    return playTone(hz(m), dur, { audible })
  }

  // the drift: the viewer's own pause, and never while animations are paused (reduced motion included)
  function syncDrift(): void {
    const on = drifting()
    driftBtn.disabled = Motion.paused
    q('span', driftBtn).textContent = on ? 'Pause turning' : 'Resume turning'
    q<SVGUseElement>('use', driftBtn).setAttribute(
      'href',
      on ? '#i-pause' : '#i-play',
    )
    driftBtn.title = Motion.paused
      ? Motion.locked
        ? 'Paused by your reduced-motion setting'
        : 'Animations are paused'
      : ''
  }
  driftBtn.removeAttribute('aria-pressed')
  driftBtn.addEventListener('click', () => {
    if (Motion.paused) return
    userDrift = !userDrift
    syncDrift()
  })
  Motion.subscribe(syncDrift)
  let asBusy = false

  async function playEveryA(): Promise<void> {
    if (asBusy) return
    asBusy = true
    const au = Sound.canPlay()
    for (const m of [45, 57, 69, 81]) await play(m, au, 0.62)
    asBusy = false
  }
  q('#playAs').addEventListener('click', () => void playEveryA())
  qa('#keysControls [data-key], #keyTickets [data-key]').forEach((b) =>
    b.addEventListener('click', () => {
      setSel(Number(b.dataset.key) - LO)
      void play(Number(b.dataset.key))
    }),
  )
  unrollBtn.addEventListener('click', () => {
    uTarget = uTarget > 0.5 ? 0 : 1
    if (reducedMotion()) u = uTarget
    syncUnroll()
  })

  function syncPan(): void {
    panWin.textContent = WIN[Math.round(panTarget / 7)]
    qa('[data-pan]', panBox).forEach((b) =>
      b.setAttribute(
        'aria-disabled',
        String(Number(b.dataset.pan) < 0 ? panTarget === 0 : panTarget === 14),
      ),
    )
  }
  qa('[data-pan]', panBox).forEach((b) =>
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      panTarget = clamp(panTarget + 7 * Number(b.dataset.pan), 0, 14)
      if (reducedMotion()) pan = panTarget
      syncPan()
    }),
  )

  function syncUnroll(): void {
    const keys = uTarget > 0.5
    q('span', unrollBtn).textContent = keys
      ? 'Roll it back up'
      : 'Unroll the spiral'
    hint.textContent = focused
      ? keys
        ? 'Arrows pick a key · Enter plays it'
        : 'Arrows pick a note · Enter plays · Shift+arrows turn'
      : keys
        ? 'Tap any key to hear it'
        : step6
          ? 'Unroll it, or tap a bead'
          : 'Drag to turn · tap a bead to hear it'
    panBox.hidden = !(narrow && keys)
    syncPan()
  }
  registerToy({
    onStep(n) {
      const six = n === 6
      if (six === step6) return
      step6 = six
      q('#spiralControls').hidden = six
      q('#keysControls').hidden = !six
      q('#keyTickets').hidden = !six
      if (!six) {
        uTarget = 0
        if (reducedMotion()) u = 0
      }
      q('#spiralEyebrow').innerHTML = six
        ? '<span class="fig">Fig. 6</span> The spiral, unrolled'
        : '<span class="fig">Fig. 5</span> The pitch spiral'
      syncUnroll()
    },
  })

  // pointer: drag to turn, tap to play; a tap snaps to the nearest bead or key within 22 px
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    moved = 0
    lastX = e.clientX
    vel = 0
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && !dragging) {
      const r = canvas.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      let best: BeadHit | null = null
      let bd = 1e9
      for (const h of hits) {
        const d = Math.hypot(h.x - x, h.y - y)
        if (d < Math.max(h.r + 8, 16) && d < bd) {
          bd = d
          best = h
        }
      }
      hover = best !== null && u < 0.6 ? best.s : null
      canvas.style.cursor = best !== null || u > 0.6 ? 'pointer' : 'grab'
    }
    if (!dragging) return
    const dx = e.clientX - lastX
    lastX = e.clientX
    moved += Math.abs(dx)
    if (u < 0.5) {
      yaw += dx * 0.011
      vel = dx * 0.011 * 60
    }
  })
  const up = (e: PointerEvent): void => {
    if (!dragging) return
    dragging = false
    if (moved > 6) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (u > 0.6) {
      let k = keyHits.find(
        (kh) =>
          x >= kh.x &&
          x <= kh.x + kh.w &&
          y >= kh.y - 10 &&
          y <= kh.y + kh.h + 10,
      )
      if (!k) {
        let bd = 22
        for (const kk of keyHits) {
          const d = Math.hypot(
            clamp(x, kk.x, kk.x + kk.w) - x,
            clamp(y, kk.y, kk.y + kk.h) - y,
          )
          if (d < bd) {
            bd = d
            k = kk
          }
        }
      }
      if (k) {
        setSel(k.s)
        void play(LO + k.s)
      }
      return
    }
    let best: BeadHit | null = null
    let bd = 1e9
    for (const h of hits) {
      const d = Math.hypot(h.x - x, h.y - y)
      if (d < Math.max(h.r + 10, 22) && d - h.z * 0.02 < bd) {
        bd = d - h.z * 0.02
        best = h
      }
    }
    if (best) {
      setSel(best.s)
      void play(LO + best.s)
    }
  }
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', () => {
    dragging = false
  })
  canvas.addEventListener('pointerleave', () => {
    hover = null
  })

  // keyboard: a slider over the 37 notes. Arrows pick, Enter or Space plays, Shift with Left or Right turns the spiral
  canvas.tabIndex = 0
  canvas.setAttribute('aria-valuemin', '0')
  canvas.setAttribute('aria-valuemax', String(N - 1))
  setSel(sel)
  canvas.addEventListener('focus', () => {
    focused = true
    syncUnroll()
  })
  canvas.addEventListener('blur', () => {
    focused = false
    syncUnroll()
  })
  canvas.addEventListener('keydown', (e) => {
    const k = e.key
    if (e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      if (u < 0.5) yaw += k === 'ArrowLeft' ? -0.26 : 0.26
      e.preventDefault()
      return
    }
    const d =
      k === 'ArrowUp' || k === 'ArrowRight'
        ? 1
        : k === 'ArrowDown' || k === 'ArrowLeft'
          ? -1
          : k === 'PageUp'
            ? 12
            : k === 'PageDown'
              ? -12
              : 0
    if (d !== 0) {
      setSel(sel + d)
      e.preventDefault()
      return
    }
    if (k === 'Home' || k === 'End') {
      setSel(k === 'Home' ? 0 : N - 1)
      e.preventDefault()
      return
    }
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      e.preventDefault()
      void play(LO + sel)
    }
  })

  addDrawer({
    active: deck.toyActive(5),
    draw(now, dt) {
      const { ctx, w: W, h: H } = cv.fit()
      const nar = W < 560
      if (nar !== narrow) {
        narrow = nar
        panTarget = narrow ? 7 : 0
        pan = panTarget
        syncUnroll()
      }
      if (!dragging) {
        if (Math.abs(vel) > 0.01) {
          yaw += vel * dt
          vel *= Math.pow(0.04, dt)
        } else if (drifting() && u < 0.02 && !step6) yaw += dt * 0.2
      }
      const du = uTarget - u
      if (Math.abs(du) > 0.001) {
        u += Math.sign(du) * Math.min(Math.abs(du), dt / 1.7)
      } else u = uTarget
      const dp = panTarget - pan
      pan =
        reducedMotion() || Math.abs(dp) < 0.01
          ? panTarget
          : pan + dp * Math.min(1, dt * 7)
      // face A to the front before unrolling
      if (u > 0 && u < 1 && Math.abs(yaw) > 0.001) {
        const k = Math.round(yaw / TAU) * TAU
        yaw += (k - yaw) * Math.min(1, dt * 4)
      }
      const view = { yaw, u, narrow, pan, focused, sel, step6, pulses }
      const drawn = drawSpiral(ctx, W, H, now, view)
      hits = drawn.hits
      keyHits = drawn.keyHits
      drawOverlays(ctx, W, now)
    },
  })

  function drawOverlays(
    ctx: CanvasRenderingContext2D,
    W: number,
    now: number,
  ): void {
    // the keyboard's own focus on the spiral: an aqua ring round the selected bead
    if (focused && u < 0.6) {
      const h = hits.find((b) => b.s === sel)
      if (h) {
        ctx.strokeStyle = COLOR.aqua
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r + 5, 0, TAU)
        ctx.stroke()
      }
    }
    // every bead carries its letter and number on hover, on tap, or under the keyboard's selection
    const tipS =
      hover ??
      (tapLabel !== null && now - tapLabel.t < 1800
        ? tapLabel.s
        : focused
          ? sel
          : null)
    const th = hits.find((h) => h.s === tipS)
    if (th && u < 0.6) {
      const m = LO + th.s
      const txt = `${nameOf(m) ?? 'unnamed (Lesson 2)'} · ${fmtHz(hz(m))} Hz`
      ctx.font = '600 14px Outfit, sans-serif'
      const tw = ctx.measureText(txt).width + 20
      let tx = th.x - tw / 2
      let ty = th.y - th.r - 36
      tx = clamp(tx, 6, W - tw - 6)
      if (ty < 6) ty = th.y + th.r + 10
      ctx.fillStyle = 'rgba(13,17,23,.92)'
      ctx.strokeStyle = rgba(noteColor(m), 0.7)
      ctx.lineWidth = 1
      ctx.beginPath()
      roundedRect(ctx, tx, ty, tw, 26, 13)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = m === 57 || m === 69 ? noteColor(m) : COLOR.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt, tx + tw / 2, ty + 13.5)
    }
  }
}
