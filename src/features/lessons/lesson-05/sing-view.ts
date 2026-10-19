// ============================================================
// Lesson 5 Sing it view — the checkpoint card's panels and lines
// ============================================================
//
// The markup holds every state's words (learn/05.html, #singCard); this
// shows the panels a state needs and writes the lines a hold produces. The
// status line above the card says every state in words and is announced
// (role="status"). A button the flow does not offer is hidden, never left
// disabled. Focus moves only to text, never to a button, so a key press
// meant to scroll can never start a take (REQ-GVC-080).

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { q, qa } from '@/features/lessons/kit/dom'
import { A3 } from '@/features/lessons/kit/notes'
import type { Ring, RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'prepare'
  | 'feel'
  | 'after'

/** What the live area shows: a hold (chart, ring, reading), Merc's notes to listen to, or nothing. */
export type LiveMode = 'take' | 'listen' | null

/** A hold's three phases, as the ring and the line above it name them. */
export type HoldPhase = 'listen' | 'breathe' | 'sing'

/** What the card offers after the answer to "How did that feel?". */
export interface AfterLines {
  /** The two holds' readings together: "This time your line was in the band for ...". */
  readonly summary: string | null
  readonly tricky: boolean
  /** 'rest': "Rest for a few easy breaths ..."; 'gentle': "Keep it gentle ..."; 'enough': "Thanks for saying so ...". */
  readonly closing: 'rest' | 'gentle' | 'enough' | null
  readonly doctor: boolean
  readonly hold15: boolean
  readonly again: boolean
  /** 'today': Done for today; 'done': Done; null: neither. */
  readonly done: 'today' | 'done' | null
}

export interface SingView {
  readonly chart: BandChart
  readonly ring: Ring
  status(text: string): void
  show(panels: readonly Panel[], live: LiveMode): void
  /** Which listening line shows: today's choice, or no microphone. */
  listenWhy(why: 'listen' | 'nomic'): void
  holdHead(text: string): void
  /** Lights the hold's phase on the line above the ring; null for none. */
  phase(p: HoldPhase | null): void
  /** The band state in words, beside the chart's mint edge: "in the band". */
  now(text: string): void
  reading(line: string | null, octave: string | null): void
  /** After a take with nothing to ask about (no voice came, or it was cancelled): Again while allowed, and Done for today. */
  takeActions(a: { readonly again: boolean } | null): void
  after(a: AfterLines): void
  /** The note the holds are sung on (markup), and whether it may still move lower and higher. */
  note(label: string, lower: boolean, higher: boolean): void
  /** Keeps the keyboard's place on text: the reading, or a panel's first line. */
  focusText(el: HTMLElement): void
  readonly readingEl: HTMLElement
  readonly headEl: HTMLElement
  readonly noteEl: HTMLElement
}

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
  const listenNotes = q('[data-listen-notes]', live)
  const after = q('[data-panel="after"]', card)
  const noteEl = q('[data-note-now]', card)
  const chart = mountBandChart(q('#singChart'), {
    target: A3,
    window: 10,
    timeTicks: true,
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

  return {
    chart,
    ring,
    readingEl,
    headEl,
    noteEl,
    status(text) {
      statusEl.textContent = text
    },
    show(names, mode) {
      for (const p of panels)
        p.hidden = !names.includes(p.dataset.panel as Panel)
      live.hidden = mode === null
      if (mode !== null) live.dataset.mode = mode
      toggle(listenNotes, mode === 'listen')
      toggle(phases, mode === 'take')
      if (mode !== 'take') {
        toggle(readingEl, false)
        toggle(actionsEl, false)
      }
      // a tall panel giving way to a short one can leave the card above the
      // screen (a phone, after Start): bring its top back at once, before the
      // section's leave watch sees it gone (sing.ts)
      const top = card.getBoundingClientRect().top
      if (top < 0 || top > window.innerHeight * 0.7)
        card.scrollIntoView({ block: 'start', behavior: 'instant' })
    },
    listenWhy(why) {
      for (const el of qa('[data-listen-why]', card))
        el.hidden = el.dataset.listenWhy !== why
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
      toggle(q('[data-sing="hold15"]', after), a.hold15)
      toggle(q('[data-sing="again"]', after), a.again)
      toggle(q('[data-sing="today"]', after), a.done === 'today')
      toggle(q('[data-sing="done"]', after), a.done === 'done')
    },
    note(label, lower, higher) {
      noteEl.innerHTML = label
      toggle(q('[data-note="lower"]', card), lower)
      toggle(q('[data-note="higher"]', card), higher)
    },
    focusText(el) {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    },
  }
}
