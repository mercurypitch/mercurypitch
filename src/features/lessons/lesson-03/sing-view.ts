// ============================================================
// Lesson 3 Sing it view — the checkpoint card's panels and lines
// ============================================================
//
// The markup holds every state's words (learn/03.html, #singCard); this
// shows the panels a state needs and writes the lines a take produces. The
// status line above the card says every state in words and is announced
// (role="status"). Focus moves only to text, never to a button, so a key
// press meant to scroll can never start a take (REQ-GVC-080).

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { q, qa } from '@/features/lessons/kit/dom'
import type { Ring, RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'prepare'
  | 'feel'
  | 'after'

/** What the live area shows: a take (chart, ring, gap, reading), Merc's notes to listen to, or nothing. */
export type LiveMode = 'take' | 'listen' | null

export interface NoteActions {
  readonly again: boolean
  readonly next: boolean
  readonly done: boolean
}

export interface AfterLines {
  readonly count: string | null
  readonly tricky: boolean
  readonly closing: 'gentle' | 'enough' | null
  readonly doctor: boolean
  readonly again: boolean
}

export interface SingView {
  readonly chart: BandChart
  readonly ring: Ring
  status(text: string): void
  show(panels: readonly Panel[], live: LiveMode): void
  /** Which listening line shows: today's choice, or no microphone. */
  listenWhy(why: 'listen' | 'nomic'): void
  noteHead(text: string): void
  gap(text: string): void
  octaveTag(text: string | null): void
  /** The ring's own line, between its runs: "Your turn" while a take waits for the voice. */
  ringState(text: string): void
  reading(line: string | null, octave: string | null): void
  actions(a: NoteActions | null): void
  listenNames(names: readonly string[]): void
  after(a: AfterLines): void
  /** Keeps the keyboard's place on text: the reading, or a panel's first line. */
  focusText(el: HTMLElement): void
  readonly readingEl: HTMLElement
  readonly headEl: HTMLElement
}

export function createSingView(stills: RingStills): SingView {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const live = q('#singLive')
  const panels = qa('[data-panel]', card)
  const headEl = q('[data-note-head]', live)
  const gapEl = q('[data-sing-gap]', live)
  const tag = q('[data-octave-tag]', live)
  const readingEl = q('[data-reading]', live)
  const lineEl = q('[data-reading-line]', live)
  const octaveEl = q('[data-octave-line]', live)
  const actionsEl = q('[data-note-actions]', live)
  const listenNotes = q('[data-listen-notes]', live)
  const after = q('[data-panel="after"]', card)
  const chart = mountBandChart(q('#singChart'), { target: 57 })
  const ring = mountRing(q('#ring', live), {
    stills,
    calm: true,
    words: {
      listen: 'Listen',
      turn: (n) => `Sing · ${n}`,
      done: 'Ready',
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
    status(text) {
      statusEl.textContent = text
    },
    show(names, mode) {
      for (const p of panels)
        p.hidden = !names.includes(p.dataset.panel as Panel)
      live.hidden = mode === null
      if (mode !== null) live.dataset.mode = mode
      toggle(listenNotes, mode === 'listen')
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
    noteHead(text) {
      headEl.textContent = text
    },
    gap(text) {
      gapEl.textContent = text
    },
    ringState(text) {
      q('[data-ring-state]', live).textContent = text
    },
    octaveTag(text) {
      tag.hidden = text === null
      tag.textContent = text ?? ''
    },
    reading(line, octave) {
      readingEl.hidden = line === null
      lineEl.textContent = line ?? ''
      octaveEl.hidden = octave === null
      octaveEl.textContent = octave ?? ''
    },
    actions(a) {
      actionsEl.hidden = a === null
      toggle(q('[data-sing="again"]', actionsEl), a?.again === true)
      toggle(q('[data-sing="next"]', actionsEl), a?.next === true)
      toggle(q('[data-sing="done"]', actionsEl), a?.done === true)
    },
    listenNames(names) {
      qa('[data-listen-label]', listenNotes).forEach((el, i) => {
        el.textContent = names[i] ?? ''
      })
    },
    after(a) {
      const count = q('[data-count]', after)
      count.hidden = a.count === null
      count.textContent = a.count ?? ''
      toggle(q('[data-tricky]', after), a.tricky)
      for (const el of qa('[data-closing]', after))
        el.hidden = el.dataset.closing !== a.closing
      toggle(q('[data-after-doctor]', after), a.doctor)
      toggle(q('[data-sing="rerun"]', after), a.again)
    },
    focusText(el) {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    },
  }
}
