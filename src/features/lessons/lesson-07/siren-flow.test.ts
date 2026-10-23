// ============================================================
// Lesson 7 siren flow tests — every branch of Sing it, with no microphone
// ============================================================
//
// The WEB-SPEC's Tests 7: Start waits for Merc's siren and says why; a take
// with no voice asks nothing and leaves the visit's one Again; "Easy" and
// "Workable" offer Again once a visit; "Try again" never shows without
// Again; an abandoned take counts, uses the one Again if it had voice, and
// leaves Done for today when it was the visit's last;
// "Effortful" and "Uncomfortable" end the singing and pick the rest card,
// and a later "Easy" brings none of it back. A walk over every sequence of
// takes and answers never reaches a fourth take or a third sung siren.

import { describe, expect, it } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { FEELINGS } from '@/features/lessons/kit/comfort'
import type { SirenEvent, SirenVisit, TakeMark } from './siren-flow'
import { freshVisit, MAX_SUNG, MAX_TAKES, next, offers, SIREN_LINES, sungCount, } from './siren-flow'

const run = (events: readonly SirenEvent[], from = freshVisit()): SirenVisit =>
  events.reduce(next, from)

const TAKE: Readonly<Record<string, TakeMark>> = {
  band: { kind: 'band', abandoned: false, voiced: true },
  unsteady: { kind: 'unsteady', abandoned: false, voiced: true },
  none: { kind: 'none', abandoned: false, voiced: false },
  leftVoiced: { kind: 'none', abandoned: true, voiced: true },
  leftSilent: { kind: 'none', abandoned: true, voiced: false },
}

const took = (t: keyof typeof TAKE): SirenEvent => ({
  type: 'took',
  take: TAKE[t],
})
const feel = (f: Feeling): SirenEvent => ({ type: 'feel', feeling: f })
const SING: SirenEvent = { type: 'comfort', sing: true }
const HEARD: SirenEvent = { type: 'played', audible: true }
const AGAIN: SirenEvent = { type: 'again' }

describe('the briefing', () => {
  it('shows Start waiting for Merc’s siren, with the hint to play it first', () => {
    // Act
    const o = offers(run([SING]))

    // Assert
    expect([o.start, o.startReady, o.startHint]).toEqual([true, false, 'first'])
  })

  it('keeps Start unavailable after a play with the sound off, and says why', () => {
    // Act
    const o = offers(run([SING, { type: 'played', audible: false }]))

    // Assert
    expect([o.start, o.startReady, o.startHint]).toEqual([true, false, 'off'])
    expect(SIREN_LINES.startOff).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's siren, then press Start.",
    )
  })

  it('readies Start once Merc’s siren has sounded with the sound on', () => {
    const o = offers(run([SING, { type: 'played', audible: false }, HEARD]))
    expect([o.start, o.startReady, o.startHint]).toEqual([true, true, null])
  })

  it('offers no Start and the rest card after "Just listen today"', () => {
    // Act
    const o = offers(run([{ type: 'comfort', sing: false }, HEARD]))

    // Assert
    expect([o.start, o.again, o.restCard]).toEqual([false, false, true])
  })

  it('offers no Start, and keeps the Vocal Range Test card, with no microphone or no Web Audio', () => {
    const o = offers(run([SING, { type: 'nomic' }]))
    expect([o.start, o.again, o.restCard]).toEqual([false, false, false])
  })
})

describe('after a take', () => {
  it('asks nothing after a take with no voice, offering a fresh start that leaves the one Again', () => {
    // Act
    const v = run([SING, HEARD, took('none')])
    const o = offers(v)

    // Assert
    expect([o.ask, o.again, o.done]).toEqual([false, true, true])
    const after = run([AGAIN, took('band'), feel('easy')], v)
    expect(after.againUsed).toBe(false)
    expect(offers(after).again).toBe(true)
  })

  it('asks "How did that feel?" after a sung siren, and offers nothing else until it is answered', () => {
    const o = offers(run([SING, HEARD, took('band')]))
    expect([o.ask, o.again, o.done, o.closing]).toEqual([
      true,
      false,
      false,
      null,
    ])
  })

  it('offers Again once a visit after "Easy" or "Workable" and a band', () => {
    for (const f of ['easy', 'workable'] as const) {
      // Act
      const first = run([SING, HEARD, took('band'), feel(f)])
      const second = run([AGAIN, took('band'), feel(f)], first)

      // Assert
      expect(offers(first)).toMatchObject({
        again: true,
        done: true,
        closing: 'band',
        tryAgain: false,
        keepBand: true,
        restCard: false,
      })
      expect(offers(second)).toMatchObject({ again: false, closing: 'band' })
    }
  })

  it('says only "That\'s it" after an unsteady take, with "Try again" only beside Again', () => {
    // Act
    const first = run([SING, HEARD, took('unsteady'), feel('easy')])
    const second = run([AGAIN, took('unsteady'), feel('workable')], first)

    // Assert
    expect(offers(first)).toMatchObject({
      closing: 'plain',
      again: true,
      tryAgain: true,
    })
    expect(first.againUsed).toBe(false)
    expect(second.againUsed).toBe(true)
    expect(offers(second)).toMatchObject({
      closing: 'plain',
      again: false,
      tryAgain: false,
    })
  })

  it('counts an abandoned take, back to the briefing, and uses the one Again if it had voice', () => {
    // Act
    const voiced = run([SING, HEARD, took('leftVoiced')])
    const silent = run([SING, HEARD, took('leftSilent')])

    // Assert
    expect(offers(voiced)).toMatchObject({ start: true, ask: false })
    expect(voiced.againUsed).toBe(true)
    expect(offers(run([took('band'), feel('easy')], voiced)).again).toBe(false)
    expect(silent.againUsed).toBe(false)
    expect(offers(run([took('band'), feel('easy')], silent)).again).toBe(true)
  })

  it('offers Done for today in Start’s place once an abandoned take leaves none to take', () => {
    // Act: three takes, the last abandoned; two sung, the second abandoned
    const three = offers(
      run([SING, HEARD, took('none'), took('none'), took('leftSilent')]),
    )
    const sung = offers(
      run([SING, HEARD, took('band'), feel('easy'), AGAIN, took('leftVoiced')]),
    )

    // Assert
    expect([three.start, three.again, three.done]).toEqual([false, false, true])
    expect([sung.start, sung.again, sung.done]).toEqual([false, false, true])
  })

  it('ends the singing after "Effortful", with the rest card, keeping the band', () => {
    // Act
    const o = offers(run([SING, HEARD, took('band'), feel('effortful')]))

    // Assert
    expect(o).toMatchObject({
      again: false,
      start: false,
      closing: 'gentle',
      doctor: false,
      keepBand: true,
      restCard: true,
    })
  })

  it('ends the singing after "Uncomfortable", with the doctor lines and no band', () => {
    // Act
    const o = offers(run([SING, HEARD, took('band'), feel('uncomfortable')]))

    // Assert
    expect(o).toMatchObject({
      again: false,
      start: false,
      closing: 'enough',
      doctor: true,
      keepBand: false,
      restCard: true,
    })
  })

  it('brings back neither Again, Start nor the Vocal Range Test card after a later "Easy"', () => {
    for (const hard of ['effortful', 'uncomfortable'] as const) {
      const o = offers(
        run([SING, HEARD, took('band'), feel(hard), feel('easy')]),
      )
      expect([o.again, o.start, o.restCard]).toEqual([false, false, true])
    }
  })

  it('takes Again away when the answer changes to "Effortful"', () => {
    const o = offers(
      run([SING, HEARD, took('band'), feel('easy'), feel('effortful')]),
    )
    expect([o.again, o.closing]).toEqual([false, 'gentle'])
  })

  it('offers neither Start nor Again after Done for today', () => {
    const o = offers(
      run([SING, HEARD, took('band'), feel('easy'), { type: 'done' }]),
    )
    expect([o.start, o.again]).toEqual([false, false])
  })
})

describe('every visit', () => {
  /**
   * Every route through a visit: at each point the viewer may take any
   * offered action, a take may come to any outcome, and an answer may be
   * any of the four; walked to a depth past any limit.
   */
  function walk(
    v: SirenVisit,
    depth: number,
    seen: (v: SirenVisit) => void,
  ): void {
    seen(v)
    if (depth === 0) return
    const o = offers(v)
    const taking = o.startReady || o.again
    const moves: SirenEvent[][] = []
    if (taking)
      for (const t of Object.keys(TAKE))
        moves.push(o.again ? [AGAIN, took(t)] : [took(t)])
    if (o.ask) for (const f of FEELINGS) moves.push([feel(f)])
    for (const m of moves) walk(run(m, v), depth - 1, seen)
  }

  it('never reaches a fourth take or a third sung siren, and never shows "Try again" without Again', () => {
    // Arrange
    let visits = 0
    const problems: string[] = []

    // Act
    walk(run([SING, HEARD]), 9, (v) => {
      visits++
      const o = offers(v)
      if (v.takes.length > MAX_TAKES) problems.push('a fourth take')
      if (sungCount(v) > MAX_SUNG) problems.push('a third sung siren')
      if (o.tryAgain && !o.again) problems.push('"Try again" without Again')
      if (v.effort && (o.again || o.start))
        problems.push('a retry after effort')
    })

    // Assert
    expect(visits).toBeGreaterThan(1000)
    expect(problems).toEqual([])
  })

  it("speaks LESSON.md's lines, word for word", () => {
    expect(SIREN_LINES.band).toBe(
      "That's it: one gentle siren, done. The lit band shows where its middle notes sat today.",
    )
    expect(SIREN_LINES.plain).toBe("That's it: one gentle siren, done.")
    expect(SIREN_LINES.tryAgain).toBe('Try again at about speaking volume.')
    expect(SIREN_LINES.gentle).toBe(
      'Keep it gentle: rest before you sing again.',
    )
    expect(SIREN_LINES.enough).toBe(
      "Thanks for saying so. That's enough singing for today: rest your voice.",
    )
  })
})
