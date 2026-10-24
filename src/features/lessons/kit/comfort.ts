// ============================================================
// Comfort — asked before a voice lesson sings, and after it has
// ============================================================
//
// The safety rules of the app's Guided Voice Check
// (docs/specs/guided-voice-check.ears.md), as the voice lessons apply them.
// Before any singing beyond a comfortable hum, the comfort check: the six
// conditions of REQ-GVC-020 and two answers, singing or just listening, the
// listening path always one tap away (REQ-GVC-021). It is asked on every
// visit and never stored: how a voice is today is not a setting.
//
// After the singing, "How did that feel?" (REQ-GVC-022), and what each
// answer still allows (`afterFeeling`). The singer's report outranks every
// measurement (REQ-GVC-024): "Uncomfortable" takes away the count, any
// retry and any further singing, and leaves the rest card and the doctor
// lines (REQ-GVC-023, REQ-GVC-055); "Effortful" keeps the count but offers
// no retry, since a report of effort suppresses immediate-repeat
// encouragement (REQ-GVC-021). Whether "Effortful" also picks the rest card
// is the vocal coach's call: by default it does not, and a page whose coach
// has chosen it asks for it (`restAfterEffort`), as Lessons 6, 7 and 8 do.
// The answer picks the Wrap's practise card for the visit, held in memory,
// never in storage (`Ending`).

import { qa } from './dom'

export type Feeling = 'easy' | 'workable' | 'effortful' | 'uncomfortable'

export const FEELINGS: readonly Feeling[] = [
  'easy',
  'workable',
  'effortful',
  'uncomfortable',
]

/** What the page may still show and offer after an answer to "How did that feel?". */
export interface AfterFeeling {
  /** The count of notes that landed. */
  readonly count: boolean
  /** "If that felt tricky, good: that's learning.", where the count calls for it. */
  readonly tricky: boolean
  /** Again: the run once more (still offered only once a visit). */
  readonly again: boolean
  /** The closing line: 'gentle' ("Keep it gentle ..."), 'enough' ("Thanks for saying so ..."). */
  readonly closing: 'gentle' | 'enough' | null
  /** The doctor lines. */
  readonly doctor: boolean
  /** The Wrap's practise card: the rest card, not the Voice Mirror card. */
  readonly rest: boolean
}

export interface AfterFeelingOptions {
  /** "Effortful" picks the rest card too (default false: the coach's call). */
  readonly restAfterEffort?: boolean
}

export function afterFeeling(
  f: Feeling,
  o: AfterFeelingOptions = {},
): AfterFeeling {
  if (f === 'uncomfortable')
    return {
      count: false,
      tricky: false,
      again: false,
      closing: 'enough',
      doctor: true,
      rest: true,
    }
  if (f === 'effortful')
    return {
      count: true,
      tricky: false,
      again: false,
      closing: 'gentle',
      doctor: false,
      // the coach decides whether effort leads to the rest card too
      rest: o.restAfterEffort === true,
    }
  return {
    count: true,
    tricky: true,
    again: true,
    closing: null,
    doctor: false,
    rest: false,
  }
}

/** How the visit's singing ended, which picks the Wrap's practise card. */
export type Ending = 'practise' | 'rest'

const endingListeners = new Set<(e: Ending) => void>()
let ending: Ending = 'practise'

/**
 * The visit's ending, in memory only: "Uncomfortable" or "Just listen today",
 * or "Effortful" where the page asks (`restAfterEffort`), set the rest card;
 * skipping Sing it, or singing along with no microphone, leaves the Voice
 * Mirror card.
 */
export const VisitEnding = {
  get ending(): Ending {
    return ending
  },
  set(e: Ending): void {
    ending = e
    endingListeners.forEach((fn) => fn(e))
  },
  /** Calls `fn` now and after every change. */
  subscribe(fn: (e: Ending) => void): void {
    endingListeners.add(fn)
    fn(ending)
  },
}

/**
 * A Wrap's practise card that is one link to a singing room (Lessons 3, 5
 * and 7), or holds that link in its practise version (Lesson 6), in the
 * version the visit's ending picks: each `[data-ending]` part shows for its
 * own ending. After "Uncomfortable" or "Just listen today" nothing may send
 * the learner to sing (REQ-GVC-055), nor after "Effortful" where the page asks
 * (`restAfterEffort`), so the rest card is no longer a link, its eyebrow says
 * "Rest today", and the link's address line (`.addr`, with its new-tab icon)
 * goes; the room's address stays in the rest card's words, for another day.
 */
export function mountPractiseCard(card: HTMLElement): void {
  const link = card instanceof HTMLAnchorElement ? card : null
  const href = link?.getAttribute('href') ?? null
  const target = link?.getAttribute('target') ?? null
  const eyebrow = card.querySelector<HTMLElement>('.eyebrow')
  const practiseWords = eyebrow?.innerHTML ?? ''
  const address = card.querySelector<HTMLElement>('.addr')
  const parts = qa<HTMLElement>('[data-ending]', card)
  VisitEnding.subscribe((now) => {
    for (const el of parts) el.hidden = el.dataset.ending !== now
    if (address !== null) address.hidden = now === 'rest'
    if (eyebrow !== null)
      eyebrow.innerHTML =
        now === 'rest' ? '<span class="fig">Rest today</span>' : practiseWords
    if (link === null || href === null) return
    if (now === 'rest') {
      link.removeAttribute('href')
      link.removeAttribute('target')
    } else {
      link.setAttribute('href', href)
      if (target !== null) link.setAttribute('target', target)
    }
  })
}

export interface ComfortHandlers {
  /** "I'm comfortable: let's sing". */
  readonly onSing: () => void
  /** "Just listen today". */
  readonly onListen: () => void
}

/** Binds a comfort check's `[data-comfort="sing"]` and `[data-comfort="listen"]` buttons inside `root`. */
export function mountComfort(root: ParentNode, h: ComfortHandlers): void {
  for (const b of qa<HTMLButtonElement>('button[data-comfort]', root)) {
    b.addEventListener('click', () => {
      if (b.dataset.comfort === 'sing') h.onSing()
      else if (b.dataset.comfort === 'listen') h.onListen()
    })
  }
}

/**
 * Binds the four `[data-feel]` buttons inside `root`; each answer marks
 * itself pressed. An answer is final unless `changeable` (Lesson 6 asks
 * after every sweep, and an answer can change until the next one): then
 * every button stays enabled and a later tap moves the press, until
 * `lock()` makes the answer final as it stands (Lesson 7's Done for today).
 */
export function mountFeelings(
  root: ParentNode,
  onFeel: (f: Feeling) => void,
  o: { readonly changeable?: boolean } = {},
): { reset(): void; lock(): void } {
  const buttons = qa<HTMLButtonElement>('button[data-feel]', root)
  let locked = false
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const f = FEELINGS.find((x) => x === b.dataset.feel)
      if (f === undefined || locked) return
      for (const other of buttons) {
        other.setAttribute('aria-pressed', String(other === b))
        if (o.changeable !== true) other.disabled = true
      }
      onFeel(f)
    })
  }
  return {
    reset() {
      locked = false
      for (const b of buttons) {
        b.setAttribute('aria-pressed', 'false')
        b.disabled = false
      }
    },
    lock() {
      locked = true
      for (const b of buttons) b.disabled = true
    },
  }
}
