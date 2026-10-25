// ============================================================
// Lesson 10 sing flow — what Sing it shows next, as a pure rule
// ============================================================
//
// Sing it has no microphone: Merc sings do-mi-so, then do-me-so, the viewer
// sings them with the guide, and "How did that feel?" follows every sweep
// (WEB-SPEC, Toys 6). From the comfort answer, the voice, whether Merc's
// notes have been heard with sound on, how many sweeps have run and the
// latest answer, this gives the panels, the controls shown, the line and
// the Wrap's card, so every branch is unit-tested (sing-flow.test.ts), in
// the shape of Lesson 6's flow.
//
// The comfort check comes first on every visit and is never stored. The
// voice choice follows either answer; with none stored, nothing after it
// shows until one is chosen, because the voice picks the Merc who sings.
// "Just listen today" plays Merc's notes on a tap and asks nothing of the
// voice: no guide, no Move do, the doctor lines, and the rest card
// (REQ-GVC-021). Start the guide waits until Merc's notes have been heard
// with sound on (hear it first: playbook rule 16). A sweep hides the
// feeling question while it runs; each sweep that ends asks it afresh, with
// no answer pressed, and there is no cap, since the page has no Again. A
// sweep cut short asks nothing: the card goes back to what it showed
// before the sweep ran, as Lesson 8's flow does.
//
// Easy and Workable give LESSON.md's line and leave the guide as it was.
// Effortful and Uncomfortable give no retry (the kit's `afterFeeling`), so
// they put the guide and Move do away for the visit, and with
// `restAfterEffort`, as Lessons 6 to 8 ask, both pick the rest card
// (REQ-GVC-021, REQ-GVC-023, REQ-GVC-055). The page keeps the kit's lock on
// an answer (Toys 6, state 6), so the flow takes one answer a sweep; with
// the guide away no sweep runs again, so no later answer brings the guide
// or the practise card back. An event the card cannot send in a state
// changes nothing, so the rule holds for events in any order.
//
// Lesson 10's own lines are lines.ts's `SING_LINES`. Where Lesson 10 words
// no status line, the flow takes the line Lessons 6 and 8 share, or, where
// the two differ only in what Merc sings, Lesson 8's with "Merc's notes"
// for "Merc's line" (and "them" for "it"). While a sweep runs it gives
// Lesson 8's line, since Lesson 10 sings with the kit's guide as Lesson 8
// does; Lesson 6's sings with its tune line. The voice choice's two lines
// are markup, as in Lessons 5 to 8, and the flow says which shows. The flow
// writes nothing: only the voice is stored, by the kit's voice choice.

import type { Ending, Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { SING_LINES } from './lines'

export type Comfort = 'sing' | 'listen'

export interface SingState {
  readonly comfort: Comfort | null
  readonly voice: Voice | null
  /** A voice was stored when the visit began: the line over the choice says so. */
  readonly hadVoice: boolean
  /** Merc's notes have been heard to their end with sound on. */
  readonly heard: boolean
  /** Merc's notes last played silently, sound being off. */
  readonly silent: boolean
  /** Sweeps run to their end this visit: from the first, "How did that feel?" is asked. */
  readonly sweeps: number
  /** A sweep is running: the feeling question and its line wait for its end. */
  readonly sweeping: boolean
  /** The answer to the question asked, or null; a sweep's end asks afresh. */
  readonly feeling: Feeling | null
  /** The guide and Move do, put away for the visit. */
  readonly putAway: boolean
  /** The Wrap's rest card, picked for the visit. */
  readonly rest: boolean
  /** The doctor lines under the answers, since "Uncomfortable". */
  readonly doctor: boolean
}

/** The state a visit opens on: only the stored voice is known. */
export const openState = (stored: Voice | null): SingState => ({
  comfort: null,
  voice: stored,
  hadVoice: stored !== null,
  heard: false,
  silent: false,
  sweeps: 0,
  sweeping: false,
  feeling: null,
  putAway: false,
  rest: false,
  doctor: false,
})

export type SingEvent =
  | { readonly type: 'comfort'; readonly comfort: Comfort }
  | { readonly type: 'voice'; readonly voice: Voice }
  /** Merc's notes played to their end: heard with sound on, or silently. */
  | { readonly type: 'played'; readonly heard: boolean }
  | { readonly type: 'sweepStart' }
  | { readonly type: 'sweepEnd' }
  /** A sweep stopped before its end: by its own control, another sound or leaving. */
  | { readonly type: 'sweepCut' }
  | { readonly type: 'feel'; readonly feeling: Feeling }

/** Merc's notes, Start the guide and Move do are on the card: an answer and a voice. */
const notesShown = (s: SingState): boolean =>
  s.comfort !== null && s.voice !== null

const canStart = (s: SingState): boolean =>
  notesShown(s) && s.comfort === 'sing' && !s.putAway && s.heard && !s.sweeping

/** The question is showing and unanswered: the kit locks an answer once given. */
const canFeel = (s: SingState): boolean =>
  s.sweeps > 0 && !s.sweeping && s.feeling === null

export function nextState(s: SingState, e: SingEvent): SingState {
  switch (e.type) {
    case 'comfort':
      return s.comfort === null ? { ...s, comfort: e.comfort } : s
    case 'voice':
      return s.comfort === null ? s : { ...s, voice: e.voice }
    case 'played':
      return notesShown(s)
        ? { ...s, heard: s.heard || e.heard, silent: !e.heard }
        : s
    case 'sweepStart':
      return canStart(s) ? { ...s, sweeping: true } : s
    case 'sweepEnd':
      return s.sweeping
        ? { ...s, sweeping: false, sweeps: s.sweeps + 1, feeling: null }
        : s
    case 'sweepCut':
      return s.sweeping ? { ...s, sweeping: false } : s
    case 'feel': {
      if (!canFeel(s)) return s
      const a = afterFeeling(e.feeling, { restAfterEffort: true })
      return {
        ...s,
        feeling: e.feeling,
        putAway: s.putAway || !a.again,
        rest: s.rest || a.rest,
        doctor: s.doctor || a.doctor,
      }
    }
  }
}

export type Panel = 'comfort' | 'listen' | 'voice' | 'notes' | 'feel'

/** The line after an answer: LESSON.md's for Easy and Workable, or Lesson 3's gentle and enough-for-today lines. */
export type After = 'moved' | 'gentle' | 'enough'

/** The hint under Start the guide: hear Merc's notes first, or turn sound on to. */
export type Hint = 'first' | 'silent'

export interface SingView {
  readonly panels: readonly Panel[]
  /** Which of the voice choice's two lines shows: for a voice stored when the visit began, or for none. */
  readonly voiceLine: 'stored' | 'none'
  /** Your turn, the stop line, Start the guide and Move do: the parts that ask for singing. */
  readonly singParts: boolean
  /** Start the guide answers once Merc's notes have been heard with sound on. */
  readonly startEnabled: boolean
  readonly hint: Hint | null
  readonly after: After | null
  /** The doctor lines under the answers, since "Uncomfortable"; the listen panel holds its own. */
  readonly doctor: boolean
  readonly card: Ending
  /** The status line, which is announced. */
  readonly status: string
}

/** The status lines Lesson 10 does not word: the series' (Lessons 6 and 8). */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voiceSing: "Choose the voice you'll sing with.",
  voiceListen: 'Choose a voice: it picks the Merc who sings.',
  listen: "Just listening today: press Play Merc's notes to hear them.",
  first: "Play Merc's notes first: Merc sings them, then the guide is yours.",
  ready: "Start the guide when you're ready, or play Merc's notes again.",
  guiding: 'Your turn: sing with the guide.',
  feel: 'How did that feel?',
} as const

/** The lines after an answer, LESSON.md's (lines.ts). */
export const AFTER: Readonly<Record<After, string>> = {
  moved: SING_LINES.moved,
  gentle: SING_LINES.gentle,
  enough: SING_LINES.enough,
}

/** The hints under Start the guide, the spec's (lines.ts). */
export const HINT: Readonly<Record<Hint, string>> = {
  first: SING_LINES.first,
  silent: SING_LINES.silent,
}

/** The kit's closing line for an answer, or LESSON.md's for Easy and Workable. */
const afterOf = (f: Feeling): After =>
  afterFeeling(f, { restAfterEffort: true }).closing ?? 'moved'

function statusOf(s: SingState, after: After | null): string {
  if (s.comfort === null) return STATUS.comfort
  if (s.voice === null)
    return s.comfort === 'listen' ? STATUS.voiceListen : STATUS.voiceSing
  if (s.comfort === 'listen') return STATUS.listen
  if (s.sweeping) return STATUS.guiding
  if (after !== null) return AFTER[after]
  if (s.sweeps > 0) return STATUS.feel
  return s.heard ? STATUS.ready : STATUS.first
}

function panelsOf(s: SingState): Panel[] {
  if (s.comfort === null) return ['comfort']
  const panels: Panel[] = []
  if (s.comfort === 'listen') panels.push('listen')
  panels.push('voice')
  if (s.voice !== null) panels.push('notes')
  if (s.sweeps > 0 && !s.sweeping) panels.push('feel')
  return panels
}

export function singView(s: SingState): SingView {
  const singing = s.comfort === 'sing' && !s.putAway
  const after = s.sweeping || s.feeling === null ? null : afterOf(s.feeling)
  return {
    panels: panelsOf(s),
    voiceLine: s.hadVoice ? 'stored' : 'none',
    singParts: singing,
    startEnabled: s.heard,
    hint: !singing || s.heard ? null : s.silent ? 'silent' : 'first',
    after,
    doctor: s.doctor,
    card: s.comfort === 'listen' || s.rest ? 'rest' : 'practise',
    status: statusOf(s, after),
  }
}
