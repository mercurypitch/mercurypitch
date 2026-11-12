// ============================================================
// Ladder flow tests — Lesson 20's two options: Move do's reach, the faster pass
// ============================================================
//
// The kit's rule (ladder-flow.ts) is walked route by route on Lesson 9's
// ladders, where it began (lesson-09/ladder-flow*.test.ts). These are the
// two options Lesson 20's run adds (its WEB-SPEC, Toys 6; FACTS 52, 57 and
// 63): Move do higher only, three semitones for the lower voice and four for
// the higher, do brought back within reach when the voice changes; and
// Again, faster, once a visit after "Easy" or "Workable", which spends no
// take, asks how it felt again, says its own line in place of the count, is
// never celebrated, and is not spent when the sound is off or it is cut
// short.

import { describe, expect, it } from 'vitest'
import type { Feeling } from './comfort'
import type { LadderEvent, LadderId, LadderVisit, TakeKind, VisitStart, } from './ladder-flow'
import { next, offers, openVisit } from './ladder-flow'

/** Lesson 20's reach: higher only, three semitones for the lower voice, four for the higher (FACTS 52). */
const RUN_REACH = {
  lower: { lower: 0, higher: 3 },
  higher: { lower: 0, higher: 4 },
} as const

const run = (events: readonly LadderEvent[], from: LadderVisit): LadderVisit =>
  events.reduce(next, from)

/** A visit on Lesson 20's options: the lower voice stored, the sound on, Web Audio. */
const visit = (o: Partial<VisitStart> = {}): LadderVisit =>
  openVisit({
    voice: 'lower',
    sound: true,
    webAudio: true,
    reach: RUN_REACH,
    fasterPass: true,
    ...o,
  })

const SING: LadderEvent = { type: 'comfort', sing: true }
const FASTER: LadderEvent = { type: 'faster' }
const SOUND_OFF: LadderEvent = { type: 'sound', on: false }
const HIGHER_VOICE: LadderEvent = { type: 'voice', voice: 'higher' }
const LOWER_VOICE: LadderEvent = { type: 'voice', voice: 'lower' }
const up: LadderEvent = { type: 'move', step: 1 }
const down: LadderEvent = { type: 'move', step: -1 }
const passed = (whole: boolean): LadderEvent => ({ type: 'passed', whole })
const feel = (feeling: Feeling): LadderEvent => ({ type: 'feel', feeling })
const take = (ladder: LadderId, kind: TakeKind): LadderEvent[] => [
  { type: 'begin', ladder },
  { type: 'took', kind },
]

/** A run sung, read as `kind`, and answered `feeling`. */
const sung = (
  feeling: Feeling = 'easy',
  kind: TakeKind = 'some',
  from: LadderVisit = visit(),
): LadderVisit => run([SING, ...take('full', kind), feel(feeling)], from)

describe("Move do's reach for each voice (Lesson 20 FACTS 52)", () => {
  it('goes higher only for the lower voice, three semitones: "lower" at do does nothing, and a fourth "higher" stays at three', () => {
    // Act
    const lower = run([SING, down], visit())
    const higher = run([SING, up, up, up, up], visit())

    // Assert
    expect([lower.shift, higher.shift]).toEqual([0, 3])
  })

  it('reaches four semitones higher for the higher voice', () => {
    // Act
    const v = run([SING, up, up, up, up, up], visit({ voice: 'higher' }))

    // Assert
    expect(v.shift).toBe(4)
  })

  it("brings do back within the new voice's reach when the voice changes: four higher is three for the lower voice", () => {
    // Arrange
    const high = run([SING, up, up, up, up], visit({ voice: 'higher' }))

    // Act
    const v = next(high, LOWER_VOICE)

    // Assert
    expect([high.shift, v.voice, v.shift]).toEqual([4, 'lower', 3])
  })

  it("leaves do where it is when the new voice's reach holds it", () => {
    // Act
    const v = run([SING, up, up, HIGHER_VOICE], visit())

    // Assert
    expect([v.voice, v.shift]).toEqual(['higher', 2])
  })

  it("keeps the kit's four semitones either way when a page gives no reach, as Lesson 9's", () => {
    // Act
    const v = run(
      [SING, down, down, down, down, down],
      openVisit({ voice: 'lower', sound: true, webAudio: true }),
    )

    // Assert
    expect(v.shift).toBe(-4)
  })
})

describe('the faster pass (Lesson 20 FACTS 57 and 63)', () => {
  it.each(['easy', 'workable'] as const)(
    'offers Again, faster after "%s", beside the Again buttons',
    (feeling) => {
      // Act
      const o = offers(sung(feeling))

      // Assert
      expect([o.faster, o.again, o.done]).toEqual([
        true,
        ['full', 'smaller'],
        true,
      ])
    },
  )

  it.each(['effortful', 'uncomfortable'] as const)(
    'offers no Again, faster after "%s"',
    (feeling) => {
      // Act
      const o = offers(sung(feeling))

      // Assert
      expect(o.faster).toBe(false)
    },
  )

  it("offers no Again, faster on a page that has none, as Lesson 9's", () => {
    // Act
    const o = offers(sung('easy', 'some', visit({ fasterPass: false })))

    // Assert
    expect(o.faster).toBe(false)
  })

  it('sings the ladder last sung, with no control on the card, and spends no take', () => {
    // Arrange
    const before = run(
      [SING, { type: 'ladder', ladder: 'smaller' }, ...take('smaller', 'all')],
      visit(),
    )

    // Act
    const v = run([feel('easy'), FASTER], before)
    const o = offers(v)

    // Assert
    expect([v.passing, v.takes.length]).toEqual(['smaller', 1])
    expect(o).toMatchObject({
      stage: 'faster',
      ask: false,
      again: [],
      faster: false,
      moveDo: false,
      start: false,
      done: false,
      // the take's lines and lit edges stay: the pass reads nothing
      lines: true,
      count: false,
    })
  })

  it('asks how it felt once it runs to its end, and says its own line for "Easy": no count, no tricky line', () => {
    // Arrange
    const ran = run([FASTER, passed(true)], sung('easy', 'some'))

    // Act
    const asked = offers(ran)
    const answered = offers(next(ran, feel('easy')))

    // Assert
    expect([asked.stage, asked.ask, asked.locked, asked.lines]).toEqual([
      'reading',
      true,
      false,
      true,
    ])
    expect(answered).toMatchObject({
      locked: true,
      lines: true,
      count: false,
      tricky: false,
      closing: 'faster',
      faster: false,
      again: ['full', 'smaller'],
      done: true,
    })
  })

  it('is offered once a visit: after it has run, an Again sung and felt "Easy" offers it no more', () => {
    // Act
    const v = run(
      [
        FASTER,
        passed(true),
        feel('easy'),
        ...take('full', 'some'),
        feel('easy'),
      ],
      sung('easy'),
    )
    const o = offers(v)

    // Assert
    expect([v.fasterUsed, o.faster, o.count, o.closing]).toEqual([
      true,
      false,
      true,
      null,
    ])
  })

  it('ends the singing after "Effortful", the lines kept with no count, and picks the rest card', () => {
    // Act
    const o = offers(run([FASTER, passed(true), feel('effortful')], sung()))

    // Assert
    expect(o).toMatchObject({
      lines: true,
      count: false,
      closing: 'gentle',
      again: [],
      faster: false,
      moveDo: false,
      done: true,
      card: 'rest',
    })
  })

  it('ends the singing after "Uncomfortable", the lines gone, with the doctor lines', () => {
    // Act
    const o = offers(run([FASTER, passed(true), feel('uncomfortable')], sung()))

    // Assert
    expect(o).toMatchObject({
      lines: false,
      count: false,
      closing: 'enough',
      doctor: true,
      again: [],
      faster: false,
      done: false,
      card: 'rest',
    })
  })

  it('with the sound off plays nothing, spends nothing, and shows the hint beside the Agains', () => {
    // Act
    const v = run([SOUND_OFF, FASTER], sung())
    const o = offers(v)

    // Assert
    expect([v.passing, v.fasterUsed, o.faster, o.hint]).toEqual([
      null,
      false,
      true,
      'soundOffAgain',
    ])
  })

  it('cut short, is not spent: the card is as it was before its button', () => {
    // Arrange
    const before = sung()

    // Act
    const v = run([FASTER, passed(false)], before)

    // Assert
    expect(v).toEqual(before)
  })

  it('cut short by the sound going off, shows the hint and is still offered', () => {
    // Act
    const v = run([FASTER, SOUND_OFF, passed(false)], sung())
    const o = offers(v)

    // Assert
    expect([v.fasterUsed, o.faster, o.hint]).toEqual([
      false,
      true,
      'soundOffAgain',
    ])
  })

  it("never celebrates the pass: Merc's one celebration stays the take's", () => {
    // Arrange
    const celebrated = sung('easy', 'all')

    // Act
    const during = run([FASTER], celebrated)
    const asked = next(during, passed(true))
    const answered = next(asked, feel('easy'))

    // Assert
    expect(offers(celebrated).celebrate).toBe(true)
    expect([during, asked, answered].map((v) => offers(v).celebrate)).toEqual([
      false,
      false,
      false,
    ])
    expect(answered.celebrated).toBe(0)
  })

  it('reads a take after the pass as a take again: the count, and no faster line', () => {
    // Act
    const o = offers(
      run(
        [
          FASTER,
          passed(true),
          feel('easy'),
          ...take('full', 'some'),
          feel('workable'),
        ],
        sung(),
      ),
    )

    // Assert
    expect([o.count, o.tricky, o.closing]).toEqual([true, true, null])
  })

  it('leaves the visit as it was for Again, faster during a take, and for a pass ending with none open', () => {
    // Arrange
    const taking = run([SING, { type: 'begin', ladder: 'full' }], visit())
    const answered = sung()

    // Act
    const pressed = next(taking, FASTER)
    const ended = next(answered, passed(true))

    // Assert
    expect([pressed, ended]).toEqual([taking, answered])
  })

  it('takes Again, faster away once Done for today is pressed', () => {
    // Act
    const o = offers(run([{ type: 'done' }], sung()))

    // Assert
    expect([o.faster, o.again]).toEqual([false, []])
  })
})
