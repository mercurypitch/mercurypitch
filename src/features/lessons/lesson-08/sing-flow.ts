// ============================================================
// Lesson 8 sing flow — what the sung line shows next, as a pure rule
// ============================================================
//
// Sing it's second part has no microphone: Merc sings the line, the viewer
// sings it with the guide, and "How did that feel?" follows every guide
// (WEB-SPEC, Toys 6). From the comfort answer, the voice, whether Merc's
// line has been heard, how many guides have run and the latest answer,
// this gives the panels, the controls shown, the line and the Wrap's card,
// so every branch is unit-tested (sing-flow.test.ts), as Lesson 6's is.
//
// The comfort check comes first on every visit and is never stored. The
// voice choice follows either answer; with none stored, nothing after it
// shows until one is chosen, because the voice picks the Merc who sings.
// "Just listen today" plays Merc's line on a tap and asks nothing of the
// voice: no guide, no Move do, the doctor lines, and the rest card
// (REQ-GVC-021). Start the guide waits until Merc's line has been heard
// with sound on (hear it first: playbook rule 16), and gives way to the
// feeling question once a guide has run: from then on only Again sings
// again, once a visit, after "Easy" or "Workable", so a visit holds at
// most two guides. Effortful and Uncomfortable put the guide, Again and
// Move do away for the visit and pick the rest card (REQ-GVC-021,
// REQ-GVC-023, REQ-GVC-055); a later change of answer brings back neither.
// A guide hides the feeling question while it runs, and one cut short asks
// nothing: the card goes back to what it showed before it ran, so an Again
// stopped part way leaves its answer, its line and Again itself. The tap
// take is outside this flow: it uses no voice. The flow writes nothing:
// only the voice is stored, by the kit's voice choice.

import type { Ending, Feeling } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'

export type Comfort = 'sing' | 'listen'

/** A visit's guides at most: the first, and Again once. */
export const MAX_GUIDES = 2

export interface SingState {
  readonly comfort: Comfort | null
  readonly voice: Voice | null
  /** A voice was stored when the visit began: the line over the choice says so. */
  readonly hadVoice: boolean
  /** Merc's line has been heard to its end with sound on. */
  readonly heard: boolean
  /** Merc's line last played silently, sound being off. */
  readonly silent: boolean
  /** Guides run to their end this visit. */
  readonly guides: number
  /** A guide is running: the feeling question, its line and Again wait for its end. */
  readonly guiding: boolean
  /** "How did that feel?" is asked: from a guide's end on, hidden while the next one runs. */
  readonly asking: boolean
  /** The answer to the question asked, or null; a guide's end asks afresh. */
  readonly feeling: Feeling | null
  /** The guide, Again and Move do, put away for the visit. */
  readonly putAway: boolean
  /** The Wrap's rest card, picked for the visit. */
  readonly rest: boolean
  /** The doctor lines, shown since "Uncomfortable". */
  readonly doctor: boolean
}

/** The state a visit opens on: only the stored voice is known. */
export const openState = (stored: Voice | null): SingState => ({
  comfort: null,
  voice: stored,
  hadVoice: stored !== null,
  heard: false,
  silent: false,
  guides: 0,
  guiding: false,
  asking: false,
  feeling: null,
  putAway: false,
  rest: false,
  doctor: false,
})

export type SingEvent =
  | { readonly type: 'comfort'; readonly comfort: Comfort }
  | { readonly type: 'voice'; readonly voice: Voice }
  /** Merc's line played to its end: heard with sound on, or silently. */
  | { readonly type: 'played'; readonly heard: boolean }
  | { readonly type: 'guideStart' }
  | { readonly type: 'guideEnd' }
  /** A guide stopped before its end: by its own control, another sound or leaving. */
  | { readonly type: 'guideCut' }
  | { readonly type: 'feel'; readonly feeling: Feeling }

const isHard = (f: Feeling): boolean =>
  f === 'effortful' || f === 'uncomfortable'

export function nextState(s: SingState, e: SingEvent): SingState {
  switch (e.type) {
    case 'comfort':
      return s.comfort === null ? { ...s, comfort: e.comfort } : s
    case 'voice':
      return { ...s, voice: e.voice }
    case 'played':
      return { ...s, heard: s.heard || e.heard, silent: !e.heard }
    case 'guideStart':
      return { ...s, guiding: true }
    case 'guideEnd':
      return {
        ...s,
        guiding: false,
        guides: s.guides + 1,
        asking: true,
        feeling: null,
      }
    case 'guideCut':
      return { ...s, guiding: false }
    case 'feel': {
      if (!s.asking || s.guiding) return s
      const hard = isHard(e.feeling)
      return {
        ...s,
        feeling: e.feeling,
        putAway: s.putAway || hard,
        rest: s.rest || hard,
        doctor: s.doctor || e.feeling === 'uncomfortable',
      }
    }
  }
}

export type Panel = 'comfort' | 'listen' | 'voice' | 'line' | 'feel'

/** The line after an answer: done, or Lesson 3's gentle and enough-for-today lines. */
export type After = 'done' | 'gentle' | 'enough'

/** The hint under Start the guide: hear Merc's line first, or turn sound on to. */
export type Hint = 'first' | 'silent'

export interface SingView {
  readonly panels: readonly Panel[]
  /** Which line sits over the voice choice. */
  readonly voiceLine: 'stored' | 'none'
  /** Your turn, the stop line and the guide's note: the parts that ask for singing. */
  readonly singParts: boolean
  /** Start the guide, until the first guide has run. */
  readonly startShown: boolean
  /** Start the guide answers once Merc's line has been heard. */
  readonly startEnabled: boolean
  readonly hint: Hint | null
  /** Again: the guide once more, after "Easy" or "Workable", once a visit. */
  readonly againShown: boolean
  readonly moveShown: boolean
  readonly after: After | null
  /** The doctor lines under the answers, since "Uncomfortable". */
  readonly doctor: boolean
  readonly card: Ending
  readonly status: string
}

/** Every line the flow says (the status line, which is announced). */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voiceSing: "Choose the voice you'll sing with.",
  voiceListen: 'Choose a voice: it picks the Merc who sings.',
  listen: "Just listening today: press Play Merc's line to hear it.",
  first: "Play Merc's line first: Merc sings it, then the guide is yours.",
  ready: "Start the guide when you're ready, or play Merc's line again.",
  rested: 'Merc can still sing the line for you.',
  guiding: 'Your turn: sing with the guide.',
  feel: 'How did that feel?',
} as const

/** The lines after an answer, LESSON.md's. */
export const AFTER: Readonly<Record<After, string>> = {
  done: "That's it: one line over the backbeat, done.",
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
}

/** The hints under Start the guide. */
export const HINT: Readonly<Record<Hint, string>> = {
  first: "Play Merc's line first.",
  silent: "Sound is off: turn it on to hear Merc's line, then start the guide.",
}

function afterOf(s: SingState): After | null {
  const f = s.feeling
  if (f === null) return null
  if (f === 'effortful') return 'gentle'
  if (f === 'uncomfortable') return 'enough'
  // once the guide is put away, no line asks for more singing
  return s.putAway ? null : 'done'
}

function statusOf(s: SingState, after: After | null): string {
  if (s.comfort === null) return STATUS.comfort
  if (s.voice === null)
    return s.comfort === 'listen' ? STATUS.voiceListen : STATUS.voiceSing
  if (s.comfort === 'listen') return STATUS.listen
  if (s.guiding) return STATUS.guiding
  if (after !== null) return AFTER[after]
  // a changed answer after a hard one asks nothing again, and offers Merc's line
  if (s.putAway) return STATUS.rested
  if (s.asking) return STATUS.feel
  return s.heard ? STATUS.ready : STATUS.first
}

function panelsOf(s: SingState): Panel[] {
  if (s.comfort === null) return ['comfort']
  const panels: Panel[] = []
  if (s.comfort === 'listen') panels.push('listen')
  panels.push('voice')
  if (s.voice !== null) panels.push('line')
  if (s.comfort === 'sing' && s.asking && !s.guiding) panels.push('feel')
  return panels
}

export function singView(s: SingState): SingView {
  const singing = s.comfort === 'sing' && !s.putAway
  const after = s.comfort === 'sing' && !s.guiding ? afterOf(s) : null
  const startShown = singing && s.guides === 0
  const fine = s.feeling === 'easy' || s.feeling === 'workable'
  return {
    panels: panelsOf(s),
    voiceLine: s.hadVoice ? 'stored' : 'none',
    singParts: singing,
    startShown,
    startEnabled: s.heard,
    hint: !startShown || s.heard ? null : s.silent ? 'silent' : 'first',
    againShown:
      singing && s.asking && !s.guiding && fine && s.guides < MAX_GUIDES,
    moveShown: singing,
    after,
    doctor: s.comfort === 'sing' && s.doctor,
    card: s.comfort === 'listen' || s.rest ? 'rest' : 'practise',
    status: statusOf(s, after),
  }
}
