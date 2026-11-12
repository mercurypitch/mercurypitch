// ============================================================
// Lesson 16 sing flow tests — every branch of Sing it, with no microphone
// ============================================================
//
// The pure rule from the comfort answer, the voice, sound, Web Audio, the
// microphone, the takes and the answers to the panels, controls, lines and
// the Wrap's card (WEB-SPEC, Toys 6, states 1 to 9 and the retry rules;
// FACTS 49 to 51).

import { describe, expect, it } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import type { SingEvent, SingVisit } from './sing-flow'
import { HINT, MAX_TAKES, nextVisit, openVisit, STATUS, viewOf, } from './sing-flow'

/** A visit after `events`, from a stored lower voice with sound and Web Audio on unless said. */
function after(
  events: readonly SingEvent[],
  o: Partial<Parameters<typeof openVisit>[0]> = {},
): SingVisit {
  return events.reduce(
    nextVisit,
    openVisit({ voice: 'lower', sound: true, webAudio: true, ...o }),
  )
}

const sing: SingEvent = { type: 'comfort', comfort: 'sing' }
const begin: SingEvent = { type: 'begin' }
const listen: SingEvent = { type: 'listen' }
const voiced: SingEvent = { type: 'took', voiced: true, abandoned: false }
const silent: SingEvent = { type: 'took', voiced: false, abandoned: false }
const left: SingEvent = { type: 'took', voiced: true, abandoned: true }
const feel = (feeling: Feeling): SingEvent => ({ type: 'feel', feeling })
/** One take with voice, from its Start to its end. */
const take: readonly SingEvent[] = [begin, listen, voiced]
/** The first phrase read and answered "Easy". */
const first: readonly SingEvent[] = [sing, ...take, feel('easy')]

describe('opening, comfort and voice', () => {
  it('opens on the comfort check every visit, with the practice card', () => {
    // Act
    const v = viewOf(after([]))

    // Assert: states 1
    expect(v.panels).toEqual(['comfort'])
    expect([v.status, v.card, v.start, v.merc]).toEqual([
      STATUS.comfort,
      'practise',
      null,
      false,
    ])
  })

  it('asks for a voice with none stored, and shows nothing past it until one is chosen', () => {
    // Act
    const none = viewOf(after([sing], { voice: null }))
    const listening = viewOf(
      after([{ type: 'comfort', comfort: 'listen' }], { voice: null }),
    )

    // Assert: states 2
    expect([none.panels, none.voiceLine, none.status]).toEqual([
      ['voice'],
      'none',
      STATUS.voiceSing,
    ])
    expect([listening.panels, listening.merc, listening.status]).toEqual([
      ['voice'],
      false,
      STATUS.voiceListen,
    ])
  })

  it('keeps a stored voice pressed and offers Start under Your turn', () => {
    // Act
    const v = viewOf(after([sing]))

    // Assert: states 4
    expect(v.panels).toEqual(['voice', 'prepare'])
    expect([v.voiceLine, v.singParts, v.start, v.phrase, v.status]).toEqual([
      'stored',
      true,
      'start',
      1,
      STATUS.turn,
    ])
    expect([v.stopHere, v.merc, v.playStart, v.closing]).toEqual([
      false,
      false,
      false,
      null,
    ])
  })
})

describe('the start and the take', () => {
  it('starts nothing with sound off, and says so beside Start', () => {
    // Act
    const s = after([sing, begin], { sound: false })
    const v = viewOf(s)

    // Assert: states 5
    expect(s.taking).toBeNull()
    expect([v.start, v.hint]).toEqual(['start', 'silent'])
    expect(HINT.silent).toBe(
      'Sound is off, so nothing played. Turn sound on to hear the start, then press Start.',
    )
  })

  it('leaves the status as it stands while the start sings, then asks for do once the take listens', () => {
    // Act
    const starting = viewOf(after([sing, begin]))
    const taking = viewOf(after([sing, begin, listen]))

    // Assert: states 5 and 6
    expect([starting.status, starting.start, starting.phrase]).toEqual([
      null,
      null,
      1,
    ])
    expect(taking.status).toBe("Your turn: start on do when you're ready.")
  })

  it('ends the start with no take counted when the sound turns off, but not a take already listening', () => {
    // Act
    const cut = after([sing, begin, { type: 'silenced' }])
    const kept = after([sing, begin, listen, { type: 'silenced' }])

    // Assert
    expect([cut.taking, cut.takes.length]).toEqual([null, 0])
    expect(viewOf(cut).start).toBe('start')
    expect(kept.taking).toBe(1)
  })

  it('asks how it felt after a take with voice, its lines kept', () => {
    // Act
    const v = viewOf(after([sing, ...take]))

    // Assert: states 7 and 8
    expect(v.panels).toEqual(['voice', 'prepare', 'feel'])
    expect([v.status, v.readings, v.answer, v.start]).toEqual([
      STATUS.feel,
      true,
      null,
      null,
    ])
  })
})

describe('after the first phrase', () => {
  it.each(['easy', 'workable'] as const)(
    'offers phrase 2 and Stop here after %s',
    (f) => {
      // Act
      const v = viewOf(after([sing, ...take, feel(f)]))

      // Assert
      expect([v.closing, v.start, v.stopHere, v.merc]).toEqual([
        'next',
        'phrase-2',
        true,
        false,
      ])
      expect([v.phrase, v.status, v.card]).toEqual([
        2,
        STATUS.phrase2,
        'practise',
      ])
    },
  )

  it('ends the singing at Stop here: no phrase 2, the lines kept, Play Merc’s phrases, the practice card', () => {
    // Act
    const v = viewOf(after([...first, { type: 'halt' }]))

    // Assert: FACTS 49
    expect([v.start, v.stopHere, v.merc, v.closing]).toEqual([
      null,
      false,
      true,
      null,
    ])
    expect([v.readings, v.card, v.status]).toEqual([
      true,
      'practise',
      STATUS.stopped,
    ])
    expect(v.panels).toContain('after')
  })

  it('reads phrase 2, then ends with both phrases found from do', () => {
    // Act
    const reading = viewOf(after([...first, begin]))
    const v = viewOf(after([...first, ...take, feel('workable')]))

    // Assert
    expect(reading.phrase).toBe(2)
    expect([v.closing, v.start, v.stopHere, v.merc, v.card]).toEqual([
      'done',
      null,
      false,
      true,
      'practise',
    ])
  })

  it('offers no Again after phrase 2', () => {
    // Act
    const s = after([...first, ...take, feel('easy'), begin])

    // Assert
    expect(s.taking).toBeNull()
  })
})

describe('Effortful and Uncomfortable', () => {
  it('stops after Effortful: the gentle line, the lines kept, the rest card', () => {
    // Act
    const v = viewOf(after([sing, ...take, feel('effortful')]))

    // Assert
    expect([v.closing, v.start, v.stopHere, v.merc]).toEqual([
      'gentle',
      null,
      false,
      true,
    ])
    expect([v.readings, v.doctor, v.card]).toEqual([true, false, 'rest'])
  })

  it('takes the lines away after Uncomfortable, with the doctor lines and the rest card', () => {
    // Act
    const v = viewOf(after([...first, ...take, feel('uncomfortable')]))

    // Assert: REQ-GVC-023, REQ-GVC-055
    expect([v.closing, v.readings, v.doctor, v.merc, v.card]).toEqual([
      'enough',
      false,
      true,
      true,
      'rest',
    ])
  })

  it('never offers another take once either is answered', () => {
    // Act
    const s = after([sing, ...take, feel('effortful'), begin, { type: 'halt' }])

    // Assert
    expect([s.taking, s.halted, viewOf(s).start]).toEqual([null, false, null])
  })
})

describe('the retry rules', () => {
  it('counts a take with no voice: the not-heard line with its cue, Start again, no question', () => {
    // Act
    const v = viewOf(after([sing, begin, listen, silent]))

    // Assert: states 7, FACTS 50
    expect([v.closing, v.cue, v.start, v.phrase]).toEqual([
      'silent',
      true,
      'again',
      1,
    ])
    expect(v.panels).not.toContain('feel')
  })

  it('drops the cue after the visit’s last take, and ends the singing', () => {
    // Act
    const s = after([sing, ...[0, 1, 2].flatMap(() => [begin, listen, silent])])
    const v = viewOf(s)

    // Assert
    expect(s.takes).toHaveLength(MAX_TAKES)
    expect([v.closing, v.cue, v.start, v.merc, v.status]).toEqual([
      'silent',
      false,
      null,
      true,
      STATUS.spent,
    ])
  })

  it('counts a take abandoned when the page was hidden, and offers the same phrase again', () => {
    // Act
    const v = viewOf(after([...first, begin, listen, left]))

    // Assert
    expect([v.start, v.phrase, v.status, v.closing]).toEqual([
      'again',
      2,
      STATUS.left,
      null,
    ])
  })

  it('makes three takes at most, the last one’s answer ending the singing', () => {
    // Act
    const asked = viewOf(
      after([sing, begin, listen, silent, ...first.slice(1)]),
    )
    const s = after([sing, begin, listen, silent, ...first.slice(1), ...take])
    const v = viewOf(
      after([
        sing,
        begin,
        listen,
        silent,
        ...first.slice(1),
        ...take,
        feel('easy'),
      ]),
    )

    // Assert
    expect(asked.start).toBe('phrase-2')
    expect(viewOf(s).merc).toBe(false)
    expect([v.start, v.merc, v.closing]).toEqual([null, true, 'done'])
  })
})

describe('listening only', () => {
  it('plays Merc’s phrases at once for Just listen today, asks nothing, and picks the rest card', () => {
    // Act
    const v = viewOf(after([{ type: 'comfort', comfort: 'listen' }]))

    // Assert: states 3, REQ-GVC-021
    expect(v.panels).toEqual(['voice', 'listen', 'after'])
    expect([v.listenWhy, v.merc, v.start, v.singParts]).toEqual([
      'listen',
      true,
      null,
      false,
    ])
    expect([v.doctor, v.card, v.status]).toEqual([true, 'rest', STATUS.listen])
  })

  it('offers Play the start and Play Merc’s phrases with no microphone, keeping the practice card', () => {
    // Act
    const v = viewOf(after([sing, begin, { type: 'nomic' }]))

    // Assert: states 9, FACTS 51
    expect([v.listenWhy, v.playStart, v.merc, v.start]).toEqual([
      'nomic',
      true,
      true,
      null,
    ])
    expect([v.card, v.status]).toEqual(['practise', STATUS.nomic])
  })

  it('offers the no-microphone path at once without Web Audio, saying it can’t play sound', () => {
    // Act
    const v = viewOf(after([sing], { webAudio: false }))

    // Assert
    expect([v.listenWhy, v.playStart, v.merc, v.hint]).toEqual([
      'nomic',
      true,
      true,
      'noAudio',
    ])
    expect(v.status).toBe("This browser can't play sound here.")
  })
})

describe('events in any order', () => {
  it('changes nothing for an event the card cannot send in that state', () => {
    // Arrange
    const open = after([sing])

    // Act / Assert
    expect(nextVisit(open, feel('easy'))).toBe(open)
    expect(nextVisit(open, { type: 'halt' })).toBe(open)
    expect(nextVisit(open, listen)).toBe(open)
    expect(nextVisit(open, voiced)).toBe(open)
    const going = after([sing, begin])
    expect(nextVisit(going, { type: 'voice', voice: 'higher' })).toBe(going)
    expect(nextVisit(going, begin)).toBe(going)
    expect(nextVisit(after([]), { type: 'voice', voice: 'higher' }).voice).toBe(
      'lower',
    )
  })

  it('takes one answer a take', () => {
    // Act
    const s = after([sing, ...take, feel('easy'), feel('uncomfortable')])

    // Assert
    expect([s.feeling, s.stopped]).toEqual(['easy', null])
  })
})
