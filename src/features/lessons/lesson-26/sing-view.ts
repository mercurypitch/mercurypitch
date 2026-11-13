// ============================================================
// Lesson 26 Sing it's view — the card's panels, the status line and the lines
// ============================================================
//
// The view of Sing it (WEB-SPEC, Toys 5), on this page's markup: its
// panels are the comfort check, "Just listen today", the voice choice, the
// headphones check, the briefing with Start, the sing-along, "How did that
// feel?" and what follows it; the figure (sing-figure.ts) shows from the
// briefing, "Just listen today" and the sing-along on, beside the still of
// the one who sings, Merc for the lower voice and Tavi for the higher; and
// after a run, one line a note. The status line above the card says every
// state in words and is announced (role="status"). Every "Merc" in the
// card's lines reads "Tavi" for the higher voice. A button the flow does
// not offer is hidden, never left disabled, and focus moves only to text,
// never to a button, so a key press meant to scroll can never start a run
// (REQ-GVC-080).

import { q, qa } from '@/features/lessons/kit/dom'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import type { SingFigure } from './sing-figure'
import { mountSingFigure } from './sing-figure'
import { partName, singerOf } from './sing-plan'

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'phones'
  | 'brief'
  | 'start'
  | 'along'
  | 'feel'
  | 'after'

/** What the card says and offers after a run or a sing-along. */
export interface AfterView {
  /** The no-voice line, the swap's, Effortful's, Uncomfortable's, or none. */
  readonly closing: 'silent' | 'swap' | 'gentle' | 'enough' | null
  readonly tricky: boolean
  readonly doctor: boolean
  readonly swap: boolean
  readonly again: boolean
  /** Start again, after a run with no voice or one cut short. */
  readonly restart: boolean
  readonly alongAgain: boolean
  readonly today: boolean
}

/** Nothing said and nothing offered. */
export const NO_AFTER: AfterView = {
  closing: null,
  tricky: false,
  doctor: false,
  swap: false,
  again: false,
  restart: false,
  alongAgain: false,
  today: false,
}

export interface SingView {
  readonly figure: SingFigure
  status(text: string): void
  /** The panels a state needs, the figure, and the lines after a run. */
  show(
    panels: readonly Panel[],
    o?: { readonly fig?: boolean; readonly lines?: boolean },
  ): void
  /** Who sings for `v`, in every line and in the still. */
  voice(v: Voice): void
  /** The voice choice's line: a voice stored, or none. */
  voiceLine(stored: boolean): void
  /** Your turn's first line: the part the set sings. */
  turn(text: string): void
  startHint(text: string): void
  /** The quiet check's line on the sing-along, and Start under it to run the check again. */
  quietFailed(on: boolean): void
  /** A run's lines, one a note, said once too; null takes them away. */
  readings(lines: readonly string[] | null): void
  after(a: AfterView): void
  /** Keeps the keyboard's place on text: a panel's first line, or the status line. */
  focusText(el: HTMLElement): void
}

/** The view on `#singCard`. */
export function createSingView(): SingView {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const fig = q('#singFig')
  const live = q('#singLive')
  const list = q('[data-readings]', live)
  const said = q('[data-sing-said]', fig)
  const still = q<HTMLImageElement>('.sing-merc', fig)
  const panels = qa('[data-panel]', card)
  const afterEl = q('[data-panel="after"]', card)
  const along = q('[data-panel="along"]', card)
  const toggle = (el: Element | null, on: boolean): void => {
    if (el instanceof HTMLElement) el.hidden = !on
  }
  return {
    figure: mountSingFigure(),
    status(text) {
      statusEl.textContent = text
    },
    show(names, o = {}) {
      for (const p of panels)
        p.hidden = !names.some((n) => n === p.dataset.panel)
      fig.hidden = o.fig !== true
      live.hidden = o.lines !== true
      // a tall panel giving way to a short one can leave the card above the
      // screen (a phone, after Start): bring its top back at once, before
      // the section's leave watch sees it gone
      const top = card.getBoundingClientRect().top
      if (top < 0 || top > window.innerHeight * 0.7)
        window.scrollBy({ top: top - 16, behavior: 'instant' })
    },
    voice(v) {
      for (const el of qa('[data-who]', card)) el.textContent = singerOf(v)
      for (const el of qa('[data-who-part]', card)) el.textContent = partName(v)
      still.src = v === 'lower' ? mercBlue : mercOrange
      still.alt =
        v === 'lower'
          ? 'Merc, who sings for the lower voice'
          : 'Tavi, who sings for the higher voice'
    },
    voiceLine(stored) {
      q('[data-voice-line]', card).textContent = stored
        ? 'Keep the voice you chose before, or change it:'
        : 'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:'
    },
    turn(text) {
      q('[data-turn-first]', card).textContent = text
    },
    startHint(text) {
      q('[data-start-hint]', card).textContent = text
    },
    quietFailed(on) {
      toggle(q('[data-quiet-failed]', along), on)
      toggle(q('[data-start-again]', along), on)
    },
    readings(lines) {
      list.replaceChildren(
        ...(lines ?? []).map((l) => {
          const li = document.createElement('li')
          li.textContent = l
          return li
        }),
      )
      list.hidden = lines === null || lines.length === 0
      said.textContent = lines === null ? '' : lines.join(' ')
    },
    after(a) {
      for (const el of qa('[data-after]', afterEl))
        el.hidden = el.dataset.after !== a.closing
      toggle(q('[data-tricky]', afterEl), a.tricky)
      toggle(q('[data-after-doctor]', afterEl), a.doctor)
      toggle(q('[data-sing="swap"]', afterEl), a.swap)
      toggle(q('[data-sing="again"]', afterEl), a.again)
      toggle(q('[data-sing="restart"]', afterEl), a.restart)
      toggle(q('[data-sing="along-again"]', afterEl), a.alongAgain)
      toggle(q('[data-sing="today"]', afterEl), a.today)
    },
    focusText(el) {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    },
  }
}
