// ============================================================
// Lesson 14 phrase flow, walked — the retry rules on every path
// ============================================================
//
// Every sequence of what the card can send, up to a visit's end, from each
// opening (sound on or off, a browser that can or can't record), held to
// the rules (WEB-SPEC, Toys 4): at most three takes, every take counted;
// take 2 only after "Easy" or "Workable" on a take 1 heard; Again's take 2
// heard at most once; never a take after "Effortful" or "Uncomfortable",
// Delete or Done for today; a feeling asked only after a take with voice;
// a control the flow offers only while it can act; the rest card exactly
// after listening today or a report of effort; and every status, closing
// and hint passing the claims check.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { PhraseEvent, PhraseVisit } from './phrase-flow'
import { CLOSING, MAX_TAKES, nextTake, nextVisit, openVisit, phraseView, } from './phrase-flow'

const TOOK = (voiced: boolean, abandoned: boolean): PhraseEvent => ({
  type: 'took',
  voiced,
  abandoned,
  recorded: voiced && !abandoned,
})

/** What the card can send once it is singing: a take's three ends, the four answers, Delete, Done, Move do. */
const STEPS: readonly (readonly PhraseEvent[])[] = [
  [{ type: 'begin' }, { type: 'listen' }, TOOK(true, false)],
  [{ type: 'begin' }, { type: 'listen' }, TOOK(false, false)],
  [{ type: 'begin' }, TOOK(true, true)],
  [{ type: 'begin' }, { type: 'silenced' }],
  [{ type: 'feel', feeling: 'easy' }],
  [{ type: 'feel', feeling: 'workable' }],
  [{ type: 'feel', feeling: 'effortful' }],
  [{ type: 'feel', feeling: 'uncomfortable' }],
  [{ type: 'delete' }],
  [{ type: 'done' }],
  [{ type: 'move', shift: 1 }],
]

/** Every visit reachable in `depth` steps from `start`, once each. */
function walk(start: PhraseVisit, depth: number): PhraseVisit[] {
  const seen = new Map<string, PhraseVisit>([[JSON.stringify(start), start]])
  let edge = [start]
  for (let d = 0; d < depth; d++) {
    const next: PhraseVisit[] = []
    for (const s of edge)
      for (const step of STEPS) {
        const t = step.reduce(nextVisit, s)
        const key = JSON.stringify(t)
        if (seen.has(key)) continue
        seen.set(key, t)
        next.push(t)
      }
    edge = next
  }
  return [...seen.values()]
}

const OPENINGS: readonly PhraseVisit[] = [true, false].flatMap((sound) =>
  [true, false].map((can) =>
    nextVisit(
      nextVisit(openVisit({ voice: 'lower', sound, webAudio: true }), {
        type: 'comfort',
        comfort: 'sing',
      }),
      { type: 'recordable', can },
    ),
  ),
)

const visits = OPENINGS.flatMap((o) => walk(o, 9))

describe("Lesson 14's phrase flow on every path", () => {
  it('reaches the visit’s ends', () => {
    expect(visits.length).toBeGreaterThan(200)
    expect(visits.some((v) => v.takes.length === MAX_TAKES)).toBe(true)
    expect(visits.some((v) => v.stopped === 'uncomfortable')).toBe(true)
  })

  it('makes at most three takes, and Again’s take 2 is heard at most once', () => {
    for (const v of visits) {
      expect(v.takes.length).toBeLessThanOrEqual(MAX_TAKES)
      expect(
        v.takes.filter((t) => t.again && t.voiced && !t.abandoned).length,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('gives take 2 only after Easy or Workable on a heard take 1, and nothing with the sound off', () => {
    for (const v of visits) {
      v.takes.forEach((t, i) => {
        if (t.id !== 2) return
        expect(
          v.takes
            .slice(0, i)
            .some((p) => p.id === 1 && p.voiced && !p.abandoned),
        ).toBe(true)
      })
      if (!v.sound) expect(v.takes).toEqual([])
    }
  })

  it('never offers a take after Effortful, Uncomfortable, Delete or Done for today', () => {
    for (const v of visits) {
      if (v.stopped !== null || v.deleted || v.done) {
        expect(nextTake(v)).toBeNull()
        expect(phraseView(v).start).toBeNull()
        expect(run(v, STEPS[0]).takes).toHaveLength(v.takes.length)
      }
    }
  })

  it('asks how it felt only after a take with voice, and answers once', () => {
    for (const v of visits) {
      const last = v.takes.at(-1)
      const asked = phraseView(v).panels.includes('feel')
      if (asked) expect(last?.voiced === true && !last.abandoned).toBe(true)
      if (v.feeling !== null)
        expect(nextVisit(v, { type: 'feel', feeling: 'easy' })).toBe(v)
    }
  })

  it('offers each control only where it acts, and the rest card exactly after a report of effort', () => {
    for (const v of visits) {
      const view = phraseView(v)
      if (view.start !== null) expect(nextTake(v)).not.toBeNull()
      if (view.del) expect(nextVisit(v, { type: 'delete' }).deleted).toBe(true)
      if (view.plays.length > 0) expect(v.deleted).toBe(false)
      expect(view.card).toBe(v.stopped === null ? 'practise' : 'rest')
      if (view.closing === 'next') expect(view.start).toBe('take2')
    }
  })

  it('says only what the claims check passes, and no line invites another try without a Start', () => {
    const said = new Set<string>()
    for (const v of visits) {
      const view = phraseView(v)
      if (view.status !== null) said.add(view.status)
      if (view.closing !== null) said.add(CLOSING[view.closing])
    }
    for (const text of said) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
      expect(text).not.toMatch(/try again|another try|one more/i)
    }
  })
})

function run(s: PhraseVisit, events: readonly PhraseEvent[]): PhraseVisit {
  return events.reduce(nextVisit, s)
}
