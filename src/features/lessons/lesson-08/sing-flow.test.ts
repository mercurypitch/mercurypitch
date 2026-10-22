// ============================================================
// Lesson 8 sing flow tests — every branch of the sung line, without a page
// ============================================================
//
// WEB-SPEC, Tests 8: with no stored voice the voice choice comes before
// either path, under its first line, and a stored voice starts pressed,
// under its second, and can be changed; "Just listen today" hides Start the
// guide and Move do and picks the rest card; Start the guide waits for
// Merc's line heard with sound on; the feeling question follows every
// guide, asked afresh, and hides while one runs; a guide cut short asks
// nothing and leaves the card as it was, Again included; Easy and Workable
// give the done line and Again once a visit; Effortful and Uncomfortable
// put the guide, Again and Move do away for the visit and pick the rest
// card, and no later answer brings them back. And every line passes the
// app's claims check.

import { describe, expect, it } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { SingEvent, SingState } from './sing-flow'
import { AFTER, HINT, MAX_GUIDES, nextState, openState, singView, STATUS, } from './sing-flow'

const run = (s: SingState, ...events: SingEvent[]): SingState =>
  events.reduce(nextState, s)

const sing: SingEvent = { type: 'comfort', comfort: 'sing' }
const listen: SingEvent = { type: 'comfort', comfort: 'listen' }
const heard: SingEvent = { type: 'played', heard: true }
const silent: SingEvent = { type: 'played', heard: false }
const guide: SingEvent[] = [{ type: 'guideStart' }, { type: 'guideEnd' }]
const feel = (feeling: Feeling): SingEvent => ({ type: 'feel', feeling })

/** A visit that chose to sing in the lower voice, heard Merc's line and sang one guide. */
const sungOnce = (): SingState => run(openState('lower'), sing, heard, ...guide)

describe('before anything plays', () => {
  it('asks the comfort check first on every visit, stored voice or not', () => {
    for (const stored of [null, 'lower', 'higher'] as const) {
      // Act
      const v = singView(openState(stored))

      // Assert
      expect(v.panels).toEqual(['comfort'])
      expect(v.status).toBe(STATUS.comfort)
    }
  })

  it('with no stored voice, shows the choice after either answer, under its first line, and nothing after it until one is chosen', () => {
    for (const answer of [sing, listen]) {
      // Act
      const waiting = run(openState(null), answer)
      const chosen = run(waiting, { type: 'voice', voice: 'higher' })

      // Assert
      expect(singView(waiting).panels).toContain('voice')
      expect(singView(waiting).panels).not.toContain('line')
      expect(singView(waiting).voiceLine).toBe('none')
      expect(singView(chosen).panels).toContain('line')
    }
    expect(singView(run(openState(null), sing)).status).toBe(STATUS.voiceSing)
    expect(singView(run(openState(null), listen)).status).toBe(
      STATUS.voiceListen,
    )
  })

  it('with a stored voice, shows it pressed under its second line, waits on nothing, and lets it change', () => {
    // Act
    const s = run(openState('lower'), sing)
    const changed = run(s, { type: 'voice', voice: 'higher' })

    // Assert
    expect(singView(s).panels).toEqual(['voice', 'line'])
    expect(singView(s).voiceLine).toBe('stored')
    expect(changed.voice).toBe('higher')
  })

  it("keeps Start the guide waiting until Merc's line has been heard with sound on", () => {
    // Act
    const before = singView(run(openState('lower'), sing))
    const quiet = singView(run(openState('lower'), sing, silent))
    const after = singView(run(openState('lower'), sing, heard))

    // Assert
    expect(before.startShown).toBe(true)
    expect(before.startEnabled).toBe(false)
    expect(before.hint).toBe('first')
    expect(before.status).toBe(STATUS.first)
    expect(quiet.startEnabled).toBe(false)
    expect(quiet.hint).toBe('silent')
    expect(after.startEnabled).toBe(true)
    expect(after.hint).toBeNull()
    expect(after.status).toBe(STATUS.ready)
  })

  it("stays heard once heard, though Merc's line plays silently later", () => {
    // Act
    const v = singView(run(openState('lower'), sing, heard, silent))

    // Assert
    expect(v.startEnabled).toBe(true)
    expect(v.hint).toBeNull()
  })

  it('asks nothing of the comfort check twice in a visit', () => {
    // Act
    const s = run(openState('lower'), sing, listen)

    // Assert
    expect(s.comfort).toBe('sing')
  })
})

describe('just listen today', () => {
  it("shows no guide and no Move do, asks nothing, and picks the rest card, with Merc's line still to play", () => {
    // Act
    const v = singView(run(openState('higher'), listen, heard))

    // Assert
    expect(v.panels).toEqual(['listen', 'voice', 'line'])
    expect(v.singParts).toBe(false)
    expect(v.startShown).toBe(false)
    expect(v.moveShown).toBe(false)
    expect(v.againShown).toBe(false)
    expect(v.card).toBe('rest')
    expect(v.status).toBe(STATUS.listen)
  })
})

describe('after each guide', () => {
  it('asks how that felt, afresh each time, with no answer pressed', () => {
    // Act
    const first = sungOnce()
    const second = run(first, feel('easy'), ...guide)

    // Assert
    for (const s of [first, second]) {
      const v = singView(s)
      expect(v.panels).toContain('feel')
      expect(s.feeling).toBeNull()
      expect(v.status).toBe(STATUS.feel)
      expect(v.startShown).toBe(false)
    }
    expect(second.guides).toBe(2)
  })

  it('answers Easy or Workable with the done line and Again, once a visit', () => {
    for (const f of ['easy', 'workable'] as const) {
      // Act
      const once = run(sungOnce(), feel(f))
      const twice = run(once, ...guide, feel(f))

      // Assert
      expect(singView(once).after).toBe('done')
      expect(singView(once).status).toBe(AFTER.done)
      expect(singView(once).againShown).toBe(true)
      expect(singView(once).card).toBe('practise')
      expect(twice.guides).toBe(MAX_GUIDES)
      expect(singView(twice).againShown).toBe(false)
      expect(singView(twice).after).toBe('done')
    }
  })

  it('hides the question, its line and Again while a guide runs, and takes no answer then', () => {
    // Act
    const s = run(sungOnce(), feel('easy'), { type: 'guideStart' })
    const answered = run(s, feel('uncomfortable'))
    const v = singView(s)

    // Assert
    expect(v.panels).not.toContain('feel')
    expect(v.after).toBeNull()
    expect(v.againShown).toBe(false)
    expect(v.status).toBe(STATUS.guiding)
    expect(answered).toEqual(s)
  })

  it('asks nothing of a guide cut short: Start comes back before the first has run, and the answer, its line and Again after it', () => {
    // Act
    const first = run(openState('lower'), sing, heard, { type: 'guideStart' })
    const firstCut = singView(run(first, { type: 'guideCut' }))
    const again = run(sungOnce(), feel('workable'), { type: 'guideStart' })
    const againCut = run(again, { type: 'guideCut' })
    const v = singView(againCut)

    // Assert
    expect(firstCut.startShown).toBe(true)
    expect(firstCut.panels).not.toContain('feel')
    expect(firstCut.status).toBe(STATUS.ready)
    expect(againCut.guides).toBe(1)
    expect(againCut.feeling).toBe('workable')
    expect(v.panels).toContain('feel')
    expect(v.after).toBe('done')
    expect(v.status).toBe(AFTER.done)
    expect(v.againShown).toBe(true)
  })

  it('puts the guide, Again and Move do away after Effortful, with the gentle line and the rest card', () => {
    // Act
    const v = singView(run(sungOnce(), feel('effortful')))

    // Assert
    expect(v.after).toBe('gentle')
    expect(v.status).toBe(AFTER.gentle)
    expect(v.againShown).toBe(false)
    expect(v.moveShown).toBe(false)
    expect(v.singParts).toBe(false)
    expect(v.doctor).toBe(false)
    expect(v.card).toBe('rest')
  })

  it('puts them away after Uncomfortable, with the enough-for-today line, the doctor lines and the rest card', () => {
    // Act
    const v = singView(run(sungOnce(), feel('uncomfortable')))

    // Assert
    expect(v.after).toBe('enough')
    expect(v.status).toBe(AFTER.enough)
    expect(v.doctor).toBe(true)
    expect(v.againShown).toBe(false)
    expect(v.moveShown).toBe(false)
    expect(v.card).toBe('rest')
  })

  it('brings back neither the guide, Again nor the practise card when the answer changes', () => {
    for (const hard of ['effortful', 'uncomfortable'] as const) {
      // Act
      const s = run(sungOnce(), feel(hard), feel('easy'))
      const v = singView(s)

      // Assert
      expect(v.againShown).toBe(false)
      expect(v.moveShown).toBe(false)
      expect(v.startShown).toBe(false)
      expect(v.after).toBeNull()
      expect(v.status).toBe(STATUS.rested)
      expect(v.card).toBe('rest')
    }
  })

  it('ignores an answer while no question is showing', () => {
    // Act
    const s = run(openState('lower'), sing, heard, feel('uncomfortable'))

    // Assert
    expect(s.putAway).toBe(false)
    expect(singView(s).card).toBe('practise')
  })
})

describe("the flow's lines", () => {
  it('pass the claims check, and describe the line and the task, never the voice', () => {
    // Arrange
    const lines = [
      ...Object.values(STATUS),
      ...Object.values(AFTER),
      ...Object.values(HINT),
    ]

    for (const line of lines) {
      // Act
      const result = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })

      // Assert
      expect(result.violations, line).toEqual([])
      expect(line).not.toMatch(
        /\b(in tune|on pitch|sharp|flat|great|perfect)\b/i,
      )
    }
  })
})
