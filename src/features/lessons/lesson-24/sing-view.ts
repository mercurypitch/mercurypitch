// ============================================================
// Lesson 24 Sing it's view — the card's panels, the hold chart and the lines
// ============================================================
//
// The view of Sing it (WEB-SPEC, Toys 6), in the kit's held-note card's
// manner (kit/hold-sing-view.ts) on this page's markup: its panels are the
// comfort check, "Just listen today", the voice choice, Move do with the
// headphones check, the briefing with Start, the sing-along, "How did that
// feel?" and what follows it. The status line above the card says every
// state in words and is announced (role="status"). The hold chart is the
// kit's band chart with the drone painter (kit/band-chart-drone.ts): Lesson
// 5's band on the note being held, with the drone as a chrome line through
// its middle on do, and as a marker pinned to the chart's foot on so and mi,
// where it lies below the window; Lesson 22's painter draws the line's
// middle over it. A button the flow does not offer is hidden, never left
// disabled, and focus moves only to text, never to a button, so a key press
// meant to scroll can never start a take (REQ-GVC-080).

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintDrone } from '@/features/lessons/kit/band-chart-drone'
import type { DroneScene } from '@/features/lessons/kit/band-chart-drone-scene'
import { paintWave } from '@/features/lessons/kit/band-chart-wave'
import { q, qa } from '@/features/lessons/kit/dom'
import type { HoldPhase, HoldView } from '@/features/lessons/kit/hold-run'
import { setMoveEnds } from '@/features/lessons/kit/move-do'
import type { Ring, RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import { D3, MOVE_REACH } from './sing-plan'

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'prepare'
  | 'brief'
  | 'along'
  | 'feel'
  | 'after'

/** What the card offers after the answer to "How did that feel?". */
export interface AfterView {
  /** The ten-second set's two holds together: "This time the middle of your line ...". */
  readonly summary: string | null
  readonly tricky: boolean
  /** 'along': the sing-along's line; 'rest', 'gentle', 'enough': the kit's closings. */
  readonly closing: 'along' | 'rest' | 'gentle' | 'enough' | null
  readonly doctor: boolean
  /** Hold so and mi for 10 seconds. */
  readonly nextSet: boolean
  /** Sing along again, once a visit. */
  readonly alongAgain: boolean
  readonly again: boolean
  /** 'today': Done for today; 'done': the same words on the primary button, after the second set; null: neither. */
  readonly done: 'today' | 'done' | null
}

export interface SingView extends HoldView {
  readonly chart: BandChart
  readonly ring: Ring
  readonly readingEl: HTMLElement
  readonly headEl: HTMLElement
  status(text: string): void
  /** The panels a state needs, and whether the live area (the hold chart and the ring) shows. */
  show(panels: readonly Panel[], live: boolean): void
  holdHead(text: string): void
  /** Lights the hold's phase on the line above the ring; null for none. */
  phase(p: HoldPhase | null): void
  reading(line: string | null, octave: string | null): void
  /** After a set with nothing to ask about (no voice came, or it was cut short): Again while allowed, and Done for today. */
  takeActions(a: { readonly again: boolean } | null): void
  after(a: AfterView): void
  /** Do under Move do (markup), and its two buttons' ends. */
  doNow(html: string, move: number): void
  /** The drone and the band for a hold on `midi`, do at `doMidi`; null leaves the chart's own band. */
  drone(midi: number, doMidi: number | null): void
  /** The quiet check's line on the sing-along, and Start under it to run the check again. */
  quietFailed(on: boolean): void
  /** What Start says under itself: why it asked for nothing. */
  startHint(text: string): void
  /** Keeps the keyboard's place on text: the reading, or a panel's first line. */
  focusText(el: HTMLElement): void
}

/** The hold chart's scene for a hold on `midi` with do at `doMidi`: the band on the note, and the drone a line through it or pinned below. */
export function holdScene(midi: number, doMidi: number): DroneScene {
  return {
    drone: { c: (doMidi - midi) * 100, as: 'line', label: 'drone' },
    band: { c: 0, line: true },
    ticks: [],
    beads: [],
    tops: [],
    bright: null,
  }
}

/** The card's view, its ring holding the singing Merc's still. */
export function createSingView(stills: RingStills): SingView {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const live = q('#singLive')
  const panels = qa('[data-panel]', card)
  const headEl = q('[data-hold-head]', live)
  const phases = q('[data-phases]', live)
  const nowEl = q('[data-sing-now]', live)
  const readingEl = q('[data-reading]', live)
  const lineEl = q('[data-reading-line]', live)
  const octaveEl = q('[data-octave-line]', live)
  const actionsEl = q('[data-take-actions]', live)
  const after = q('[data-panel="after"]', card)
  const along = q('[data-panel="along"]', card)
  const chart = mountBandChart(q('#singChart'), {
    target: D3,
    window: 5,
    timeTicks: true,
    paintRungs: paintDrone,
    paintOver: paintWave,
  })
  const ring = mountRing(q('#ring', live), {
    stills,
    calm: true,
    words: {
      listen: 'Listen',
      breathe: 'Breathe',
      turn: (n) => `Sing · ${n}`,
      done: 'Rest',
    },
  })
  const toggle = (el: Element | null, on: boolean): void => {
    if (el instanceof HTMLElement) el.hidden = !on
  }
  const isPanel = (
    name: string | undefined,
    names: readonly Panel[],
  ): boolean => names.some((n) => n === name)
  return {
    chart,
    ring,
    readingEl,
    headEl,
    status(text) {
      statusEl.textContent = text
    },
    show(names, withLive) {
      for (const p of panels) p.hidden = !isPanel(p.dataset.panel, names)
      live.hidden = !withLive
      toggle(phases, withLive)
      if (!withLive) {
        toggle(readingEl, false)
        toggle(actionsEl, false)
      }
      // a tall panel giving way to a short one can leave the card above the
      // screen (a phone, after Start): bring its top back at once, before
      // the section's leave watch sees it gone
      const top = card.getBoundingClientRect().top
      if (top < 0 || top > window.innerHeight * 0.7)
        card.scrollIntoView({ block: 'start', behavior: 'instant' })
    },
    holdHead(text) {
      headEl.textContent = text
    },
    phase(p) {
      for (const el of qa('[data-phase]', phases))
        el.classList.toggle('is-now', el.dataset.phase === p)
    },
    now(text) {
      nowEl.textContent = text
    },
    reading(line, octave) {
      readingEl.hidden = line === null
      lineEl.textContent = line ?? ''
      octaveEl.hidden = octave === null
      octaveEl.textContent = octave ?? ''
    },
    takeActions(a) {
      actionsEl.hidden = a === null
      toggle(q('[data-sing="again"]', actionsEl), a?.again === true)
    },
    after(a) {
      const summary = q('[data-summary]', after)
      summary.hidden = a.summary === null
      summary.textContent = a.summary ?? ''
      toggle(q('[data-tricky]', after), a.tricky)
      for (const el of qa('[data-closing]', after))
        el.hidden = el.dataset.closing !== a.closing
      toggle(q('[data-after-doctor]', after), a.doctor)
      toggle(q('[data-sing="hold2"]', after), a.nextSet)
      toggle(q('[data-sing="along-again"]', after), a.alongAgain)
      toggle(q('[data-sing="again"]', after), a.again)
      toggle(q('[data-sing="today"]', after), a.done === 'today')
      toggle(q('[data-sing="done"]', after), a.done === 'done')
    },
    doNow(html, move) {
      q('[data-do-now]', card).innerHTML = html
      setMoveEnds(
        qa<HTMLButtonElement>('[data-move-do]', card),
        move,
        MOVE_REACH,
      )
    },
    drone(midi, doMidi) {
      chart.scene.drone = doMidi === null ? null : holdScene(midi, doMidi)
    },
    quietFailed(on) {
      toggle(q('[data-quiet-failed]', along), on)
      toggle(q('[data-start-again]', along), on)
    },
    startHint(text) {
      q('[data-start-hint]', card).textContent = text
    },
    focusText(el) {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    },
  }
}
