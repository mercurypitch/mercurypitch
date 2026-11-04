// ============================================================
// Lesson 13 Sing it view — the checkpoint card's panels and lines
// ============================================================
//
// The markup holds every state's words (learn/13.html, #singCard); this
// shows the panels a state needs and writes the lines a hold produces. The
// hold's chart is the vowel figure in hold mode (figure.ts): the band chart
// on a fixed ten-second frame, its seconds named under the plot, with the
// strip under it, lit while Merc sings and dark while the viewer does.
// Under it the names row, the vowel of the moment bold, underlined and
// `aria-current`, never announced as it changes. The status line above the
// card says every state in words and is announced (role="status"). A
// button the flow does not offer is hidden, never left disabled. Focus
// moves only to text, never to a button, so a key press meant to scroll can
// never start a take (REQ-GVC-080).

import { q, qa } from '@/features/lessons/kit/dom'
import type { HoldPhase, HoldView } from '@/features/lessons/kit/hold-run'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import type { VowelFigure } from './figure'
import { mountFigure } from './figure'

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'prepare'
  | 'feel'
  | 'after'

/** What the live area shows: a hold (chart, ring, reading), Merc's ten seconds to listen to, the note being found, or nothing. */
export type LiveMode = 'take' | 'listen' | 'note' | null

/** What the card offers after the answer to "How did that feel?". */
export interface AfterLines {
  readonly tricky: boolean
  /** 'rest': "Rest for a few easy breaths ..."; 'gentle': "Keep it gentle ..."; 'enough': "Thanks for saying so ...". */
  readonly closing: 'rest' | 'gentle' | 'enough' | null
  readonly doctor: boolean
  readonly again: boolean
  /** Done for today. */
  readonly done: boolean
}

/** The voice choice's line, by whether a voice was stored before (LESSON.md). */
export const VOICE_LINE = {
  none: 'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
  stored: 'Keep the voice you chose before, or change it:',
} as const

export interface SingView extends HoldView {
  readonly figure: VowelFigure
  /** The names row under the chart. */
  readonly names: HTMLElement
  status(text: string): void
  show(panels: readonly Panel[], live: LiveMode): void
  /** Which listening line shows: today's choice, or no microphone. */
  listenWhy(why: 'listen' | 'nomic'): void
  /** Play Merc's ten seconds, beside a take's reading (after "Effortful"). */
  listenPlay(on: boolean): void
  /** Lights the hold's phase on the line above the ring; null for none. */
  phase(p: HoldPhase | null): void
  reading(line: string | null, octave: string | null): void
  /** After a take with nothing to ask about (no voice came, or it was cut short): Again while allowed, and Done for today. */
  takeActions(a: { readonly again: boolean } | null): void
  after(a: AfterLines): void
  /** The note the hold is sung on (markup), and whether it may still move lower and higher. */
  note(label: string, lower: boolean, higher: boolean): void
  voiceLine(stored: boolean): void
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
  const names = q('[data-names]', live)
  const figure = mountFigure(q('#singChart'), {
    owner: NowPlaying,
    ticks: true,
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
    figure,
    chart: figure.chart,
    ring,
    names,
    readingEl,
    headEl,
    noteEl,
    status(text) {
      statusEl.textContent = text
    },
    show(list, mode) {
      for (const p of panels)
        p.hidden = !list.includes(p.dataset.panel as Panel)
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
    listenPlay(on) {
      toggle(listenNotes, on)
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
      toggle(q('[data-tricky]', after), a.tricky)
      for (const el of qa('[data-closing]', after))
        el.hidden = el.dataset.closing !== a.closing
      toggle(q('[data-after-doctor]', after), a.doctor)
      toggle(q('[data-sing="again"]', after), a.again)
      toggle(q('[data-sing="today"]', after), a.done)
    },
    note(label, lower, higher) {
      noteEl.innerHTML = label
      toggle(q('[data-note="lower"]', card), lower)
      toggle(q('[data-note="higher"]', card), higher)
    },
    voiceLine(stored) {
      q('[data-voice-line]', card).textContent = stored
        ? VOICE_LINE.stored
        : VOICE_LINE.none
    },
    focusText(el) {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    },
  }
}
