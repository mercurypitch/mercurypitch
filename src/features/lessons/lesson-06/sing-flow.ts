// ============================================================
// Lesson 6 sing flow — what Sing it shows next, as a pure rule
// ============================================================
//
// Sing it has no microphone: Merc sings a version, the viewer sings it with
// the guide, and "How did that feel?" follows every sweep (WEB-SPEC, Toys
// 6). From the comfort answer, the voice, the versions played and sung and
// the latest feeling, this gives the panels, the controls shown, the line
// and the Wrap's card, so every branch is unit-tested (sing-flow.test.ts),
// as Lesson 5's hold flow is.
//
// The comfort check comes first on every visit and is never stored. The
// voice choice follows either answer; with none stored, nothing after it
// shows until one is chosen, because the voice picks the Merc who sings.
// "Just listen today" plays both versions on a tap and asks nothing of the
// voice: no guide, no Move do, the doctor lines, and the rest card
// (REQ-GVC-021). A version counts as sung once a sweep has ended after it.
// Easy and Workable change nothing but the line. Effortful and Uncomfortable
// put the guide and Move do away for the visit and pick the rest card
// (REQ-GVC-021, REQ-GVC-023, REQ-GVC-055); a later change of answer brings
// back neither. The flow writes nothing: only the voice is stored, by the
// kit's voice choice.

import type { Ending, Feeling } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { VersionNo } from './sing-guide'

export type Comfort = 'sing' | 'listen'

export interface SingState {
  readonly comfort: Comfort | null
  readonly voice: Voice | null
  /** A voice was stored when the visit began: the line over the choice says so. */
  readonly hadVoice: boolean
  /** The version last played to its end, or null before any. */
  readonly played: VersionNo | null
  /** The versions a sweep has ended after. */
  readonly sung: readonly VersionNo[]
  /** "How did that feel?" is showing: from a sweep's end to the next sweep's start. */
  readonly asking: boolean
  /** The latest answer while it shows, or null. */
  readonly feeling: Feeling | null
  /** The guide and Move do, put away for the visit. */
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
  played: null,
  sung: [],
  asking: false,
  feeling: null,
  putAway: false,
  rest: false,
  doctor: false,
})

export type SingEvent =
  | { readonly type: 'comfort'; readonly comfort: Comfort }
  | { readonly type: 'voice'; readonly voice: Voice }
  | { readonly type: 'played'; readonly version: VersionNo }
  | { readonly type: 'sweepStart' }
  | { readonly type: 'sweepEnd' }
  | { readonly type: 'feel'; readonly feeling: Feeling }

export function nextState(s: SingState, e: SingEvent): SingState {
  switch (e.type) {
    case 'comfort':
      return s.comfort === null ? { ...s, comfort: e.comfort } : s
    case 'voice':
      return { ...s, voice: e.voice }
    case 'played':
      return { ...s, played: e.version }
    case 'sweepStart':
      return { ...s, asking: false, feeling: null }
    case 'sweepEnd': {
      const v = s.played
      const sung = v === null || s.sung.includes(v) ? s.sung : [...s.sung, v]
      return { ...s, sung, asking: true, feeling: null }
    }
    case 'feel': {
      if (!s.asking) return s
      const hard = e.feeling === 'effortful' || e.feeling === 'uncomfortable'
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

export type Panel = 'comfort' | 'listen' | 'voice' | 'versions' | 'feel'

/** The line after an answer: one version sung, both, or Lesson 3's gentle and enough-for-today lines. */
export type After = 'one' | 'both' | 'gentle' | 'enough'

export interface SingView {
  readonly panels: readonly Panel[]
  /** Which line sits over the voice choice. */
  readonly voiceLine: 'stored' | 'none'
  /** Your turn, the stop line, Start the guide and Move do. */
  readonly singParts: boolean
  /** Start the guide answers once a version has played (hear it first). */
  readonly startEnabled: boolean
  readonly after: After | null
  /** The doctor lines under the answers, since "Uncomfortable". */
  readonly doctor: boolean
  readonly card: Ending
  readonly status: string
}

/** Every line the flow says (the status line, which is announced), and the lines after an answer. */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voiceSing: "Choose the voice you'll sing with.",
  voiceListen: 'Choose a voice: it picks the Merc who sings.',
  listen: 'Just listening today: press a Play button to hear Merc.',
  first: "Play Merc's version first: Merc sings it, then the guide is yours.",
  ready: "Start the guide when you're ready, or play either version.",
  rested: 'Merc can still sing either version for you.',
  feel: 'How did that feel?',
} as const

export const AFTER: Readonly<Record<After, string>> = {
  one: "That's one starting note. Now the other version, from a new note.",
  both: 'One tune, two starting notes: you just transposed it.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
}

function afterOf(s: SingState): After | null {
  const f = s.feeling
  if (f === null) return null
  if (f === 'effortful') return 'gentle'
  if (f === 'uncomfortable') return 'enough'
  // once the guide is put away, no line asks for more singing
  if (s.putAway) return null
  return s.sung.length >= 2 ? 'both' : 'one'
}

function statusOf(s: SingState, after: After | null): string {
  if (s.comfort === null) return STATUS.comfort
  if (s.voice === null)
    return s.comfort === 'listen' ? STATUS.voiceListen : STATUS.voiceSing
  if (s.comfort === 'listen') return STATUS.listen
  if (after !== null) return AFTER[after]
  // a changed answer after a hard one asks nothing again, and offers Merc's versions
  if (s.putAway) return STATUS.rested
  if (s.asking) return STATUS.feel
  return s.played === null ? STATUS.first : STATUS.ready
}

export function singView(s: SingState): SingView {
  const panels: Panel[] = []
  if (s.comfort === null) panels.push('comfort')
  else {
    if (s.comfort === 'listen') panels.push('listen')
    panels.push('voice')
    if (s.voice !== null) panels.push('versions')
    if (s.comfort === 'sing' && s.asking) panels.push('feel')
  }
  const after = s.comfort === 'sing' ? afterOf(s) : null
  return {
    panels,
    voiceLine: s.hadVoice ? 'stored' : 'none',
    singParts: s.comfort === 'sing' && !s.putAway,
    startEnabled: s.played !== null,
    after,
    doctor: s.comfort === 'sing' && s.doctor,
    card: s.comfort === 'listen' || s.rest ? 'rest' : 'practise',
    status: statusOf(s, after),
  }
}
