// ============================================================
// Sing flow — what a sung line's Sing it shows next, as a pure rule
// ============================================================
//
// A Sing it with no microphone: Merc sings a short line, the viewer sings
// it with the guide, and "How did that feel?" follows every sweep. From the
// comfort answer, the voice, whether Merc's notes have been heard with
// sound on, how many sweeps have run and the latest answer, this gives the
// panels, the controls shown, the line and the Wrap's card, so every
// branch is unit-tested. Lesson 12's flow, moved into the kit when Lesson
// 15 took it (its sing-flow.ts binds it with its own line); a page's guide,
// its drawing and Lesson 12's Move do are the page's controller's, and the
// flow holds none of them.
//
// The comfort check comes first on every visit and is never stored, so a
// visit opens on the stored voice alone. The voice choice follows either
// answer; with none stored, nothing after it shows until one is chosen,
// because the voice picks the Merc who sings. "Just listen today" plays
// Merc's notes on a tap and asks nothing of the voice: no guide, the
// doctor lines, and the rest card (REQ-GVC-021). Start the guide waits
// until Merc's notes have been heard with sound on (hear it first:
// playbook rule 16); a play with sound off lights the notes in silence and
// says so. A sweep hides the feeling question while it runs; each sweep
// that ends asks it afresh, with no answer pressed. A sweep cut short, by
// its own stop, another sound or leaving, asks nothing: the card goes back
// to what it showed before the sweep.
//
// Easy and Workable give the page's own line (`sung`) and leave the guide
// as it was. Effortful and Uncomfortable offer no retry (the kit's
// `afterFeeling`), so they put the guide away for the visit, and with
// `restAfterEffort`, as on Lessons 6, 7 and 10, both pick the rest card
// (REQ-GVC-021, REQ-GVC-023, REQ-GVC-055). A page keeps the kit's lock on an
// answer until the vocal coach settles it for the series, so the flow
// takes one answer a sweep; with the guide away no sweep runs again, so no
// later answer brings back the guide or the practise card. An event the
// card cannot send in a state changes nothing, so the rule holds for
// events in any order.
//
// The status lines and the two hints are the series' (Lessons 6, 8, 10 and
// 12), naming what Merc sings as the page's button does (`notes`, "Merc's
// notes" unless a page names it, as Lesson 17's "Merc's bars"). A page may
// also cap the sweeps a visit holds (`guides`), as Lesson 8 holds two:
// Start the guide shows until the first sweep, and then Again, once Easy or
// Workable answers a sweep, until the cap; a sweep cut short counts for
// nothing. Without a cap, as on Lessons 12 and 15, Start the guide stays
// and no Again shows. The voice choice's two lines are markup, and the flow
// says which shows. The flow writes nothing: only the voice is stored, by
// the kit's voice choice.

import type { Ending, Feeling } from './comfort'
import { afterFeeling } from './comfort'
import type { Voice } from './voice-choice'

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
  /** The guide (and a page's own guide controls), put away for the visit. */
  readonly putAway: boolean
  /** The Wrap's rest card, picked for the visit. */
  readonly rest: boolean
  /** The doctor lines under the answers, since "Uncomfortable". */
  readonly doctor: boolean
}

/** The state a visit opens on: only the stored voice is known, never an earlier visit's comfort answer. */
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

/** The rest card after "Effortful" too, as Lessons 6, 7, 10 and 12 have it, for the coach to confirm. */
const AFTER_OPTIONS = { restAfterEffort: true } as const

/** Merc's notes and Start the guide are on the card: an answer and a voice. */
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
      const a = afterFeeling(e.feeling, AFTER_OPTIONS)
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

/** The line after an answer: the page's own for Easy and Workable (`K`), or Lesson 3's gentle and enough-for-today lines. */
export type After<K extends string = string> = K | 'gentle' | 'enough'

/** The hint under Start the guide: hear Merc's notes first, or turn sound on to. */
export type Hint = 'first' | 'silent'

export interface SingView<K extends string = string> {
  readonly panels: readonly Panel[]
  /** Which of the voice choice's two lines shows: for a voice stored when the visit began, or for none. */
  readonly voiceLine: 'stored' | 'none'
  /** Your turn, the stop line and Start the guide (and a page's own guide controls): the parts that ask for singing. */
  readonly singParts: boolean
  /** Start the guide answers once Merc's notes have been heard with sound on; until then it is aria-disabled. */
  readonly startEnabled: boolean
  readonly hint: Hint | null
  /** Start the guide is on the card: while singing, and with a cap only until the first sweep. */
  readonly startShown: boolean
  /** Again, the guide once more: with a cap, after a sweep Easy or Workable answered, until the cap. */
  readonly againShown: boolean
  /** The answer pressed in the question showing: none when a sweep's end asks afresh. */
  readonly answer: Feeling | null
  readonly after: After<K> | null
  /** The doctor lines under the answers, since "Uncomfortable"; the listen panel holds its own. */
  readonly doctor: boolean
  readonly card: Ending
  /** The status line, which is announced. */
  readonly status: string
}

/** The status lines the series words them (Lessons 6, 8, 10 and 12), for what Merc sings, `notes`. */
function statusFor(notes: string) {
  return {
    comfort: 'Before you sing: how is your voice today?',
    voiceSing: "Choose the voice you'll sing with.",
    voiceListen: 'Choose a voice: it picks the Merc who sings.',
    listen: `Just listening today: press Play ${notes} to hear them.`,
    first: `Play ${notes} first: Merc sings them, then the guide is yours.`,
    ready: `Start the guide when you're ready, or play ${notes} again.`,
    guiding: 'Your turn: sing with the guide.',
    feel: 'How did that feel?',
  } as const
}

/** The hints under Start the guide (Lesson 12's WEB-SPEC, Toys 6, state 5), for what Merc sings, `notes`. */
function hintFor(notes: string): Readonly<Record<Hint, string>> {
  return {
    first: `Play ${notes} first`,
    silent: `Sound is off: nothing played. Turn sound on to hear ${notes}, then start the guide.`,
  }
}

/** What Merc sings unless a page names it. */
const NOTES = "Merc's notes"

/** The status lines, with "Merc's notes". */
export const STATUS = statusFor(NOTES)

/** Lesson 3's lines after Effortful and Uncomfortable. */
const CLOSING = {
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
} as const

/** The hints, with "Merc's notes". */
export const HINT: Readonly<Record<Hint, string>> = hintFor(NOTES)

export interface SingFlowOptions<K extends string> {
  /** The key of the line Easy and Workable give, as the page's markup marks it (`data-after`). */
  readonly sung: K
  /** That line's words. */
  readonly line: string
  /** What Merc sings, as the page's button names it: "Merc's notes" by default. */
  readonly notes?: string
  /** The sweeps a visit holds, Start the guide's and then Again's: no cap by default. */
  readonly guides?: number
}

export interface SingFlow<K extends string> {
  /** The lines after an answer: the page's own, then Lesson 3's two. */
  readonly AFTER: Readonly<Record<After<K>, string>>
  /** The status lines and the hints, naming what Merc sings as the page does. */
  readonly STATUS: Readonly<Record<keyof typeof STATUS, string>>
  readonly HINT: Readonly<Record<Hint, string>>
  /** The kit's rule, with the page's cap: a sweep past it, or after an unanswered one, does not start. */
  nextState(s: SingState, e: SingEvent): SingState
  singView(s: SingState): SingView<K>
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

/** A page's flow: the one rule, with the line its Easy and Workable give. */
export function singFlow<K extends string>(o: SingFlowOptions<K>): SingFlow<K> {
  const AFTER = { [o.sung]: o.line, ...CLOSING } as Readonly<
    Record<After<K>, string>
  >
  const status = statusFor(o.notes ?? NOTES)
  const cap = o.guides ?? null

  /** With a cap, a sweep after the first waits for Easy or Workable (a hard answer puts the guide away), and none runs past the cap. */
  const another = (s: SingState): boolean =>
    cap === null || s.sweeps === 0 || (s.sweeps < cap && s.feeling !== null)

  /** The kit's closing line for an answer, or the page's own for Easy and Workable. */
  const afterOf = (f: Feeling): After<K> =>
    afterFeeling(f, AFTER_OPTIONS).closing ?? o.sung

  function statusOf(s: SingState, after: After<K> | null): string {
    if (s.comfort === null) return status.comfort
    if (s.voice === null)
      return s.comfort === 'listen' ? status.voiceListen : status.voiceSing
    if (s.comfort === 'listen') return status.listen
    if (s.sweeping) return status.guiding
    if (after !== null) return AFTER[after]
    if (s.sweeps > 0) return status.feel
    return s.heard ? status.ready : status.first
  }

  return {
    AFTER,
    STATUS: status,
    HINT: hintFor(o.notes ?? NOTES),
    nextState(s, e) {
      return e.type === 'sweepStart' && !another(s) ? s : nextState(s, e)
    },
    singView(s) {
      const singing = s.comfort === 'sing' && !s.putAway
      const answer = s.sweeping ? null : s.feeling
      const after = answer === null ? null : afterOf(answer)
      const again = cap !== null && s.sweeps > 0
      return {
        panels: panelsOf(s),
        voiceLine: s.hadVoice ? 'stored' : 'none',
        singParts: singing,
        startEnabled: s.heard,
        hint: !singing || s.heard ? null : s.silent ? 'silent' : 'first',
        startShown: singing && !again,
        againShown: singing && again && !s.sweeping && another(s),
        answer,
        after,
        doctor: s.doctor,
        card: s.comfort === 'listen' || s.rest ? 'rest' : 'practise',
        status: statusOf(s, after),
      }
    },
  }
}
