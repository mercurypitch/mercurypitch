// ============================================================
// Lesson 6 sing flow tests — every branch of Sing it, without a page
// ============================================================
//
// WEB-SPEC, Tests 7: with no stored voice the voice choice comes before
// either path, and a stored voice starts chosen and can be changed; "Just
// listen today" hides the guide and Move do and picks the rest card; the
// feeling question follows every sweep, asked afresh; with one version
// sung, Easy and Workable give the one-version line and change nothing
// else, and with both sung the transposed line; Effortful and Uncomfortable
// put the guide and Move do away for the visit and pick the rest card, and
// a later change of answer brings back neither. And every line passes the
// app's claims check.

import { describe, expect, it } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { SingEvent, SingState } from './sing-flow'
import { AFTER, nextState, openState, singView, STATUS } from './sing-flow'

const run = (s: SingState, ...events: SingEvent[]): SingState =>
  events.reduce(nextState, s)

const sing: SingEvent = { type: 'comfort', comfort: 'sing' }
const listen: SingEvent = { type: 'comfort', comfort: 'listen' }
const played = (version: 1 | 2): SingEvent => ({ type: 'played', version })
const sweep: SingEvent[] = [{ type: 'sweepStart' }, { type: 'sweepEnd' }]
const feel = (feeling: Feeling): SingEvent => ({ type: 'feel', feeling })

describe('before anything plays', () => {
  it('asks the comfort check first on every visit, stored voice or not', () => {
    for (const stored of [null, 'lower', 'higher'] as const) {
      const v = singView(openState(stored))
      expect(v.panels).toEqual(['comfort'])
      expect(v.status).toBe(STATUS.comfort)
    }
  })

  it('with no stored voice, shows the choice after either answer and nothing after it until one is chosen', () => {
    for (const answer of [sing, listen]) {
      // Act
      const waiting = run(openState(null), answer)
      const chosen = run(waiting, { type: 'voice', voice: 'higher' })

      // Assert
      expect(singView(waiting).panels).not.toContain('versions')
      expect(singView(waiting).panels).toContain('voice')
      expect(singView(waiting).voiceLine).toBe('none')
      expect(singView(chosen).panels).toContain('versions')
    }
  })

  it('with a stored voice, shows it chosen, waits on nothing, and lets it change', () => {
    // Act
    const s = run(openState('lower'), sing)
    const changed = run(s, { type: 'voice', voice: 'higher' })

    // Assert
    expect(singView(s).panels).toEqual(['voice', 'versions'])
    expect(singView(s).voiceLine).toBe('stored')
    expect(changed.voice).toBe('higher')
  })

  it('keeps Start the guide waiting until a version has played', () => {
    const s = run(openState('lower'), sing)
    expect(singView(s).startEnabled).toBe(false)
    expect(singView(s).status).toBe(STATUS.first)
    expect(singView(run(s, played(2))).startEnabled).toBe(true)
  })
})

describe('just listen today', () => {
  it('shows no guide and no Move do, asks nothing, and picks the rest card', () => {
    // Act
    const s = run(openState('lower'), listen, played(1), played(2))
    const v = singView(s)

    // Assert
    expect(v.panels).toEqual(['listen', 'voice', 'versions'])
    expect(v.singParts).toBe(false)
    expect(v.card).toBe('rest')
    expect(v.status).toBe(STATUS.listen)
  })
})

describe('after each sweep', () => {
  it('asks how that felt, afresh each time, with no answer pressed', () => {
    // Act
    const first = run(openState('lower'), sing, played(1), ...sweep)
    const answered = run(first, feel('easy'))
    const second = run(answered, played(2), ...sweep)

    // Assert
    expect(singView(first).panels).toContain('feel')
    expect(first.feeling).toBeNull()
    expect(singView(first).status).toBe(STATUS.feel)
    expect(second.feeling).toBeNull()
    expect(singView(second).after).toBeNull()
    // while the next sweep runs the question is gone
    expect(
      singView(run(answered, { type: 'sweepStart' })).panels,
    ).not.toContain('feel')
  })

  it('answers Easy or Workable after one version with the one-version line, and changes nothing else', () => {
    for (const f of ['easy', 'workable'] as const) {
      // Act
      const s = run(openState('lower'), sing, played(1), ...sweep, feel(f))
      const v = singView(s)

      // Assert
      expect(v.after).toBe('one')
      expect(v.status).toBe(AFTER.one)
      expect(v.singParts).toBe(true)
      expect(v.card).toBe('practise')
      expect(v.doctor).toBe(false)
    }
  })

  it('counts a version sung only once a sweep has ended after it, whichever came first', () => {
    // Arrange: version 2 first, then version 1
    const s = run(openState('higher'), sing, played(2), ...sweep, feel('easy'))

    // Act
    const both = run(s, played(1), ...sweep, feel('workable'))
    const same = run(s, played(2), ...sweep, feel('workable'))

    // Assert
    expect(singView(both).after).toBe('both')
    expect(singView(both).status).toBe(AFTER.both)
    expect(singView(same).after).toBe('one')
  })

  it('puts the guide and Move do away after Effortful, with the gentle line and the rest card', () => {
    const s = run(
      openState('lower'),
      sing,
      played(1),
      ...sweep,
      feel('effortful'),
    )
    const v = singView(s)
    expect(v.singParts).toBe(false)
    expect(v.after).toBe('gentle')
    expect(v.card).toBe('rest')
    expect(v.doctor).toBe(false)
    // the versions still play
    expect(v.panels).toContain('versions')
  })

  it('puts them away after Uncomfortable, with the enough-for-today line, the doctor lines and the rest card', () => {
    const v = singView(
      run(openState('lower'), sing, played(1), ...sweep, feel('uncomfortable')),
    )
    expect(v.singParts).toBe(false)
    expect(v.after).toBe('enough')
    expect(v.doctor).toBe(true)
    expect(v.card).toBe('rest')
  })

  it('brings back neither the guide nor the Interval Trainer card when the answer changes', () => {
    for (const hard of ['effortful', 'uncomfortable'] as const) {
      // Act
      const s = run(
        openState('lower'),
        sing,
        played(1),
        ...sweep,
        feel(hard),
        feel('easy'),
      )
      const v = singView(s)

      // Assert
      expect(s.feeling).toBe('easy')
      expect(v.singParts).toBe(false)
      expect(v.card).toBe('rest')
      // and no line asks for more singing
      expect(v.after).toBeNull()
      expect(v.status).toBe(STATUS.rested)
    }
  })

  it('ignores an answer while no question is showing', () => {
    const s = run(openState('lower'), sing, played(1), feel('uncomfortable'))
    expect(s.feeling).toBeNull()
    expect(singView(s).card).toBe('practise')
  })
})

describe("the flow's lines", () => {
  it('pass the claims check, and describe the tune and the task, never the voice', () => {
    for (const line of [...Object.values(STATUS), ...Object.values(AFTER)]) {
      const result = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })
      expect(result.violations, line).toEqual([])
      expect(line).not.toMatch(/[♯♭]/)
    }
  })
})
