// ============================================================
// Lesson 12 sing flow tests — every sequence of answers, walked
// ============================================================
//
// WEB-SPEC, Tests 8, by walking every sequence a viewer can make from what
// the card shows, up to three sweeps, from each stored voice: with no
// stored voice the voice choice comes before either path, under its first
// line, and a stored voice starts pressed, under its second, and can be
// changed; "Just listen today" hides Start the guide and Move do and picks
// the rest card; Start the guide waits for Merc's notes heard with sound
// on; the feeling question follows every sweep, asked afresh, and a sweep
// cut short asks nothing and leaves the card as it was; "Easy" and
// "Workable" give LESSON.md's line and keep the guide; "Effortful" and
// "Uncomfortable" put the guide and Move do away and pick the rest card,
// and nothing after brings them back. The walk keeps its own record of
// what the viewer did, and checks the card against the spec from it.
//
// Tests 8's storage clause, that nothing but `fyp-voice` is written,
// belongs to the page once it is built: this rule touches no storage, so
// there is nothing here for it to check.

import { describe, expect, it } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { FEELINGS } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { After, Comfort, SingEvent, SingState, SingView, } from './sing-flow'
import { AFTER, HINT, nextState, openState, singView, STATUS, } from './sing-flow'

/** Sweeps a walk runs to their end at most: enough to ask, answer and ask again. */
const SWEEP_CAP = 3
/** Sweeps a walk starts at most, so it ends whatever the flow does with a cut. */
const START_CAP = SWEEP_CAP + 1
/** More nodes than this, and the flow has grown a state the walk cannot close. */
const NODE_CAP = 20_000

/** The line each answer gives (WEB-SPEC, Toys 6, state 6). */
const AFTER_OF: Readonly<Record<Feeling, After>> = {
  easy: 'roots',
  workable: 'roots',
  effortful: 'gentle',
  uncomfortable: 'enough',
}
const HARD: readonly Feeling[] = ['effortful', 'uncomfortable']

const run = (s: SingState, ...events: SingEvent[]): SingState =>
  events.reduce(nextState, s)

/** What the walk remembers of a visit: what the viewer did and saw, never the flow's state. */
interface Seen {
  readonly stored: Voice | null
  /** The comfort answer: the first, since the check is asked once a visit. */
  readonly comfort: Comfort | null
  readonly voice: boolean
  readonly heardOn: boolean
  readonly lastSilent: boolean
  readonly sweeps: number
  readonly started: number
  readonly sweeping: boolean
  /** The answer since the last sweep ended. */
  readonly answered: Feeling | null
  readonly hard: boolean
  readonly uncomfortable: boolean
  /** The card as it was when the running sweep started. */
  readonly before: SingView | null
}

interface Node {
  readonly s: SingState
  readonly seen: Seen
}

const ALL_EVENTS: readonly SingEvent[] = [
  { type: 'comfort', comfort: 'sing' },
  { type: 'comfort', comfort: 'listen' },
  { type: 'voice', voice: 'lower' },
  { type: 'voice', voice: 'higher' },
  { type: 'played', heard: true },
  { type: 'played', heard: false },
  { type: 'sweepStart' },
  { type: 'sweepEnd' },
  { type: 'sweepCut' },
  ...FEELINGS.map((feeling): SingEvent => ({ type: 'feel', feeling })),
]

/** The events of the controls on the card: what a viewer could press, or a run could end with. */
function shown(v: SingView, seen: Seen): SingEvent[] {
  return ALL_EVENTS.filter((e) => {
    switch (e.type) {
      case 'comfort':
        return v.panels.includes('comfort')
      case 'voice':
        return v.panels.includes('voice')
      case 'played':
        return v.panels.includes('notes')
      case 'sweepStart':
        return !seen.sweeping && v.singParts && v.startEnabled
      case 'feel':
        return v.panels.includes('feel') && seen.answered === null
      default:
        return seen.sweeping
    }
  })
}

/**
 * What a viewer can do next. While a sweep runs, it ends or is cut short:
 * any other press stops it first, then acts, which the walk reaches as a
 * cut and then that press.
 */
function moves(v: SingView, seen: Seen): SingEvent[] {
  if (seen.sweeping) return [{ type: 'sweepEnd' }, { type: 'sweepCut' }]
  return shown(v, seen).filter(
    (e) =>
      e.type !== 'sweepStart' ||
      (seen.sweeps < SWEEP_CAP && seen.started < START_CAP),
  )
}

function remember(seen: Seen, e: SingEvent, v: SingView): Seen {
  switch (e.type) {
    case 'comfort':
      return { ...seen, comfort: seen.comfort ?? e.comfort }
    case 'voice':
      return { ...seen, voice: true }
    case 'played':
      return {
        ...seen,
        heardOn: seen.heardOn || e.heard,
        lastSilent: !e.heard,
      }
    case 'sweepStart':
      return { ...seen, sweeping: true, started: seen.started + 1, before: v }
    case 'sweepEnd':
      return {
        ...seen,
        sweeping: false,
        sweeps: seen.sweeps + 1,
        answered: null,
        before: null,
      }
    case 'sweepCut':
      return { ...seen, sweeping: false, before: null }
    case 'feel':
      return {
        ...seen,
        answered: e.feeling,
        hard: seen.hard || HARD.includes(e.feeling),
        uncomfortable: seen.uncomfortable || e.feeling === 'uncomfortable',
      }
  }
}

/** Every node a viewer can reach from each stored voice, and every move between them. */
function walk(): {
  nodes: Node[]
  edges: { from: Node; e: SingEvent; to: Node }[]
} {
  const roots = ([null, 'lower', 'higher'] as const).map(
    (stored): Node => ({
      s: openState(stored),
      seen: {
        stored,
        comfort: null,
        voice: stored !== null,
        heardOn: false,
        lastSilent: false,
        sweeps: 0,
        started: 0,
        sweeping: false,
        answered: null,
        hard: false,
        uncomfortable: false,
        before: null,
      },
    }),
  )
  const keyOf = (n: Node): string => JSON.stringify([n.s, n.seen])
  const visited = new Map(roots.map((n) => [keyOf(n), n]))
  const edges: { from: Node; e: SingEvent; to: Node }[] = []
  const queue = [...roots]
  for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
    const v = singView(n.s)
    for (const e of moves(v, n.seen)) {
      const to: Node = { s: nextState(n.s, e), seen: remember(n.seen, e, v) }
      edges.push({ from: n, e, to })
      if (!visited.has(keyOf(to))) {
        visited.set(keyOf(to), to)
        queue.push(to)
        if (visited.size > NODE_CAP) throw new Error('the walk did not close')
      }
    }
  }
  return { nodes: [...visited.values()], edges }
}

const { nodes, edges } = walk()
const views = nodes.map((n) => ({ ...n, v: singView(n.s) }))

it('walks to every answer, every play, and sweeps that end and are cut short', () => {
  // Act
  const kinds = new Set(edges.map((x) => JSON.stringify(x.e)))

  // Assert: every event the card offers is pressed somewhere
  expect([...kinds].sort()).toEqual(
    ALL_EVENTS.map((e) => JSON.stringify(e)).sort(),
  )
  expect(nodes.length).toBeGreaterThan(100)
})

describe('before anything plays', () => {
  it('asks the comfort check first on every visit, stored voice or not', () => {
    for (const { v } of views.filter((n) => n.seen.comfort === null)) {
      expect(v.panels).toEqual(['comfort'])
      expect(v.status).toBe(STATUS.comfort)
      expect(v.card).toBe('practise')
    }
  })

  it('keeps no comfort answer from one visit to the next: each opens on the stored voice alone', () => {
    // Arrange: a whole visit, listening, then one singing to the end
    const fresh = [openState(null), openState('lower'), openState('higher')]
    run(
      openState(null),
      { type: 'comfort', comfort: 'listen' },
      { type: 'voice', voice: 'lower' },
    )
    run(
      openState('higher'),
      { type: 'comfort', comfort: 'sing' },
      { type: 'played', heard: true },
      { type: 'sweepStart' },
      { type: 'sweepEnd' },
      { type: 'feel', feeling: 'uncomfortable' },
    )

    // Act
    const next = [openState(null), openState('lower'), openState('higher')]

    // Assert
    expect(next).toEqual(fresh)
    for (const s of next) {
      expect(s.comfort).toBeNull()
      expect(singView(s).panels).toEqual(['comfort'])
    }
  })

  it('with no voice, shows the choice after either answer, under its line for that answer, and nothing to play', () => {
    for (const { seen, v } of views.filter(
      (n) => n.seen.comfort !== null && !n.seen.voice,
    )) {
      const listen = seen.comfort === 'listen'
      expect(v.panels).toEqual(listen ? ['listen', 'voice'] : ['voice'])
      expect(v.status).toBe(listen ? STATUS.voiceListen : STATUS.voiceSing)
    }
  })

  it('shows the voice line for a stored voice, or for none, all visit long', () => {
    for (const { seen, v } of views)
      expect(v.voiceLine).toBe(seen.stored === null ? 'none' : 'stored')
  })

  it('lets a stored voice change', () => {
    // Act
    const s = run(
      openState('lower'),
      { type: 'comfort', comfort: 'sing' },
      { type: 'voice', voice: 'higher' },
    )

    // Assert
    expect(s.voice).toBe('higher')
    expect(singView(s).voiceLine).toBe('stored')
  })
})

describe('just listen today', () => {
  it("shows no guide and no Move do, asks nothing, and picks the rest card, with Merc's notes to play", () => {
    for (const { seen, v } of views.filter(
      (n) => n.seen.comfort === 'listen',
    )) {
      expect(v.singParts).toBe(false)
      expect(v.hint).toBeNull()
      expect(v.after).toBeNull()
      expect(v.panels).not.toContain('feel')
      expect(v.card).toBe('rest')
      if (seen.voice) {
        expect(v.panels).toEqual(['listen', 'voice', 'notes'])
        expect(v.status).toBe(STATUS.listen)
      }
    }
  })
})

describe('the guide', () => {
  it("keeps Start the guide waiting until Merc's notes have been heard with sound on, with the hint saying why", () => {
    for (const { seen, v } of views.filter((n) => n.v.singParts)) {
      expect(v.startEnabled).toBe(seen.heardOn)
      expect(v.hint).toBe(
        seen.heardOn ? null : seen.lastSilent ? 'silent' : 'first',
      )
    }
  })

  it("starts no sweep after a play with sound off: Merc's notes must be heard first", () => {
    // Arrange
    const muted = run(
      openState('lower'),
      { type: 'comfort', comfort: 'sing' },
      { type: 'played', heard: false },
    )

    // Act
    const tried = nextState(muted, { type: 'sweepStart' })

    // Assert
    expect(tried).toBe(muted)
    expect(singView(muted)).toMatchObject({
      startEnabled: false,
      hint: 'silent',
    })
  })

  it('asks how that felt when every sweep ends, afresh with no answer pressed, and hides the question while one runs', () => {
    for (const { seen, v } of views) {
      expect(v.panels.includes('feel')).toBe(seen.sweeps > 0 && !seen.sweeping)
      if (seen.sweeping) {
        expect(v.answer).toBeNull()
        expect(v.after).toBeNull()
        expect(v.status).toBe(STATUS.guiding)
      }
    }
    for (const { to } of edges.filter((x) => x.e.type === 'sweepEnd')) {
      const v = singView(to.s)
      expect(v.answer).toBeNull()
      expect(v.after).toBeNull()
      expect(v.status).toBe(STATUS.feel)
    }
  })

  it('asks nothing of a sweep cut short: the card goes back to what it showed before the sweep', () => {
    // Arrange
    const cuts = edges.filter((x) => x.e.type === 'sweepCut')

    // Assert
    expect(cuts.length).toBeGreaterThan(0)
    for (const { from, to } of cuts)
      expect(singView(to.s)).toEqual(from.seen.before)
  })

  it("gives each answer its line: LESSON.md's for Easy and Workable, Lesson 3's for the others", () => {
    for (const { seen, v } of views.filter(
      (n) => n.seen.comfort === 'sing' && n.seen.voice && !n.seen.sweeping,
    )) {
      const after = seen.answered === null ? null : AFTER_OF[seen.answered]
      expect(v.answer).toBe(seen.answered)
      expect(v.after).toBe(after)
      expect(v.status).toBe(
        after !== null
          ? AFTER[after]
          : seen.sweeps > 0
            ? STATUS.feel
            : seen.heardOn
              ? STATUS.ready
              : STATUS.first,
      )
      expect(v.doctor).toBe(seen.uncomfortable)
    }
  })
})

describe('the Wrap and what stays put away', () => {
  it('shows the guide, Move do and the hint only to a viewer singing who has reported no effort or discomfort', () => {
    for (const { seen, v } of views) {
      expect(v.singParts).toBe(seen.comfort === 'sing' && !seen.hard)
      if (!v.singParts) expect(v.hint).toBeNull()
    }
  })

  it('picks the rest card after "Just listen today", "Effortful" or "Uncomfortable", and the practise card otherwise', () => {
    for (const { seen, v } of views)
      expect(v.card).toBe(
        seen.comfort === 'listen' || seen.hard ? 'rest' : 'practise',
      )
  })

  it('picks the rest card after "Effortful" itself, with the gentle line and no doctor lines', () => {
    // Act
    const s = run(
      openState('higher'),
      { type: 'comfort', comfort: 'sing' },
      { type: 'played', heard: true },
      { type: 'sweepStart' },
      { type: 'sweepEnd' },
      { type: 'feel', feeling: 'effortful' },
    )

    // Assert: WEB-SPEC, Toys 6, state 6, and Decisions 6
    expect(singView(s)).toMatchObject({
      singParts: false,
      after: 'gentle',
      doctor: false,
      card: 'rest',
    })
  })

  it('brings back neither the guide nor the practise card after a hard answer, whatever follows', () => {
    for (const { to } of edges.filter((x) => x.from.seen.hard)) {
      expect(singView(to.s).singParts).toBe(false)
      expect(singView(to.s).card).toBe('rest')
    }
  })

  it('takes one answer a sweep, as the kit locks it: a second changes nothing', () => {
    // Arrange: one sweep, then "Easy"
    const s = run(
      openState('lower'),
      { type: 'comfort', comfort: 'sing' },
      { type: 'played', heard: true },
      { type: 'sweepStart' },
      { type: 'sweepEnd' },
      { type: 'feel', feeling: 'easy' },
    )

    // Act
    const again = nextState(s, { type: 'feel', feeling: 'uncomfortable' })

    // Assert
    expect(again).toBe(s)
    expect(singView(again).answer).toBe('easy')
  })

  it('changes nothing for an event the card does not show', () => {
    for (const { s, seen, v } of views) {
      const offered = shown(v, seen)
      for (const e of ALL_EVENTS.filter((x) => !offered.includes(x)))
        expect(nextState(s, e), JSON.stringify(e)).toBe(s)
    }
  })
})

describe("the flow's lines", () => {
  it("says LESSON.md's lines after an answer and the spec's hints, word for word", () => {
    // Assert: LESSON.md, Sing it; WEB-SPEC, Toys 6, states 5 and 6; FACTS 63
    expect(AFTER).toEqual({
      roots: "Do, so, la, fa, do: you just sang the loop's roots.",
      gentle: 'Keep it gentle: rest before you sing again.',
      enough:
        "Thanks for saying so. That's enough singing for today: rest your voice.",
    })
    expect(HINT).toEqual({
      first: "Play Merc's notes first",
      silent:
        "Sound is off: nothing played. Turn sound on to hear Merc's notes, then start the guide.",
    })
  })

  it('says only the lines it lists, each passing the claims check, with no sign', () => {
    // Arrange
    const lines = [
      ...Object.values(STATUS),
      ...Object.values(AFTER),
      ...Object.values(HINT),
    ]

    // Assert
    for (const { v } of views) expect(lines).toContain(v.status)
    for (const line of lines) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
      expect(line).not.toMatch(/[♯♭]/)
    }
  })
})
