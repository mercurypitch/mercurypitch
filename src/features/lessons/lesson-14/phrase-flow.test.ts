// ============================================================
// Lesson 14 phrase flow — each branch of Sing it's rule
// ============================================================
//
// WEB-SPEC, Toys 4, its states and retry rules: the comfort check first,
// the voice choice after either answer, listening only today, with no
// microphone or no Web Audio; the sound off; take 1 and take 2 with the
// feelings between; Again once; a take with no voice and one abandoned;
// "Effortful" and "Uncomfortable"; Delete and Done for today; a browser
// that can't record; and the lines the flow says.

import { describe, expect, it } from 'vitest'
import { NOT_HEARD_PHRASE_LINE } from '@/features/lessons/kit/take'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { PhraseEvent, PhraseVisit } from './phrase-flow'
import { CLOSING, HINT, MAX_TAKES, nextTake, nextVisit, NOT_HEARD_LINE, openVisit, phraseView, STATUS, } from './phrase-flow'

const open = (o: Partial<Parameters<typeof openVisit>[0]> = {}): PhraseVisit =>
  openVisit({ voice: 'lower', sound: true, webAudio: true, ...o })

const run = (s: PhraseVisit, events: readonly PhraseEvent[]): PhraseVisit =>
  events.reduce(nextVisit, s)

const sing: PhraseEvent = { type: 'comfort', comfort: 'sing' }
const heard: PhraseEvent = {
  type: 'took',
  voiced: true,
  abandoned: false,
  recorded: true,
}
const silent: PhraseEvent = {
  type: 'took',
  voiced: false,
  abandoned: false,
  recorded: false,
}
const left: PhraseEvent = {
  type: 'took',
  voiced: true,
  abandoned: true,
  recorded: false,
}
const feel = (f: 'easy' | 'workable' | 'effortful' | 'uncomfortable') =>
  ({ type: 'feel', feeling: f }) as const
/** One take: Start, the take listening, then how it ended. */
const take = (end: PhraseEvent): PhraseEvent[] => [
  { type: 'begin' },
  { type: 'listen' },
  end,
]

describe("Lesson 14's phrase flow", () => {
  it('opens on the comfort check, every visit, with no Start and the practice card', () => {
    // Act
    const v = phraseView(open())

    // Assert
    expect(v.panels).toEqual(['comfort'])
    expect(v.status).toBe(STATUS.comfort)
    expect([v.start, v.card]).toEqual([null, 'practise'])
  })

  it('asks for a voice after either answer when none is stored, and waits for it', () => {
    // Act
    const none = run(open({ voice: null }), [sing])
    const chosen = nextVisit(none, { type: 'voice', voice: 'higher' })

    // Assert
    expect(phraseView(none).panels).toEqual(['voice'])
    expect(phraseView(none).voiceLine).toBe('none')
    expect(phraseView(none).status).toBe(STATUS.voiceSing)
    expect(phraseView(chosen).panels).toEqual(['voice', 'prepare', 'live'])
    expect(phraseView(run(open(), [sing])).voiceLine).toBe('stored')
  })

  it('listens only today: Move do and Play Merc’s phrase, no warm-up or Start, and the rest card', () => {
    // Act
    const v = phraseView(
      run(open(), [{ type: 'comfort', comfort: 'listen' }, { type: 'begin' }]),
    )

    // Assert
    expect(v.panels).toEqual(['listen', 'voice', 'prepare', 'live'])
    expect(v.listenWhy).toBe('listen')
    expect([v.singParts, v.start, v.moveDo, v.mercPhrase]).toEqual([
      false,
      null,
      true,
      true,
    ])
    expect([v.card, v.status]).toEqual(['rest', STATUS.listen])
  })

  it('offers no Start without Web Audio, and Play Merc’s phrase with its hint, keeping the practice card', () => {
    // Act
    const v = phraseView(run(open({ webAudio: false }), [sing]))

    // Assert
    expect([v.listenWhy, v.start, v.hint, v.card]).toEqual([
      'nomic',
      null,
      'noAudio',
      'practise',
    ])
    expect(HINT.noAudio).toBe("This browser can't play sound here.")
  })

  it('with the sound off shows Start with the hint, and a press begins nothing', () => {
    // Act
    const s = run(open({ sound: false }), [sing, { type: 'begin' }])

    // Assert
    expect(s.taking).toBeNull()
    expect([phraseView(s).start, phraseView(s).hint]).toEqual([
      'start',
      'silent',
    ])
  })

  it('runs take 1: Merc first with the status as it was, then the take’s words, then the feeling', () => {
    // Act
    const begun = run(open(), [sing, { type: 'begin' }])
    const listening = nextVisit(begun, { type: 'listen' })
    const after = nextVisit(listening, heard)

    // Assert
    expect(phraseView(begun).panels).toEqual(['live'])
    expect(phraseView(begun).status).toBeNull()
    expect(phraseView(listening).status).toBe(STATUS.take1)
    expect(phraseView(after).panels).toEqual([
      'voice',
      'prepare',
      'live',
      'feel',
      'after',
    ])
    expect([phraseView(after).status, phraseView(after).start]).toEqual([
      STATUS.feel,
      null,
    ])
    expect(phraseView(after).takeLine).toBe('reading')
  })

  it('gives take 2 after Easy or Workable on take 1, with its plan on the chart and no playback yet', () => {
    // Act
    const s = run(open(), [sing, ...take(heard), feel('workable')])
    const two = run(s, [{ type: 'begin' }, { type: 'listen' }])

    // Assert
    const v = phraseView(s)
    expect([v.closing, v.start, v.plan, v.today]).toEqual([
      'next',
      'take2',
      true,
      false,
    ])
    expect(v.plays).toEqual([])
    expect(phraseView(two).status).toBe(STATUS.take2)
  })

  it('after Easy on take 2 asks for the playback, offers Delete, Done for today and Again once', () => {
    // Act
    const s = run(open(), [
      sing,
      ...take(heard),
      feel('easy'),
      ...take(heard),
      feel('easy'),
    ])
    const again = run(s, [...take(heard), feel('easy')])

    // Assert
    const v = phraseView(s)
    expect([v.closing, v.start, v.del, v.today]).toEqual([
      'back',
      'again',
      true,
      true,
    ])
    expect(v.plays).toEqual([1, 2])
    expect(v.status).toBe(CLOSING.back)
    expect(again.takes).toHaveLength(MAX_TAKES)
    expect(phraseView(again).start).toBeNull()
    expect(nextTake(again)).toBeNull()
  })

  it('a take with no voice asks nothing, brings back the same Start with Done for today, and leaves Again unused', () => {
    // Act
    const first = run(open(), [sing, ...take(silent)])
    const twoOk = run(open(), [
      sing,
      ...take(heard),
      feel('easy'),
      ...take(heard),
      feel('easy'),
    ])
    const quietAgain = run(twoOk, take(silent))

    // Assert
    const v = phraseView(first)
    expect(v.panels).not.toContain('feel')
    expect([v.start, v.startWord, v.takeLine, v.today]).toEqual([
      'retry',
      'Start take 1',
      'notHeard',
      true,
    ])
    expect(v.status).toBe(NOT_HEARD_LINE)
    expect(nextVisit(first, feel('easy'))).toBe(first)
    // three takes made: none comes back
    expect(quietAgain.takes).toHaveLength(MAX_TAKES)
    expect(phraseView(quietAgain).start).toBeNull()
    expect(
      phraseView(
        run(open(), [sing, ...take(heard), feel('easy'), ...take(silent)]),
      ).startWord,
    ).toBe('Start take 2')
  })

  it('discards an abandoned take, asks nothing, and brings its Start back while takes remain', () => {
    // Act
    const s = run(open(), [sing, ...take(left)])

    // Assert
    const v = phraseView(s)
    expect(s.takes[0]).toMatchObject({ abandoned: true, recorded: false })
    expect(v.panels).not.toContain('feel')
    expect([v.start, v.status, v.takeLine]).toEqual([
      'retry',
      STATUS.left,
      null,
    ])
  })

  it('never offers a take after Effortful: the gentle line, the takes kept to play back, the rest card', () => {
    // Act
    const s = run(open(), [sing, ...take(heard), feel('effortful')])

    // Assert
    const v = phraseView(s)
    expect([v.closing, v.start, v.moveDo, v.card]).toEqual([
      'gentle',
      null,
      false,
      'rest',
    ])
    expect([v.plays, v.del, v.today]).toEqual([[1], true, true])
    expect(run(s, take(heard)).takes).toHaveLength(1)
  })

  it('after Uncomfortable takes the line away and shows the doctor lines, for the rest of the visit', () => {
    // Act
    const s = run(open(), [
      sing,
      ...take(heard),
      feel('easy'),
      ...take(heard),
      feel('uncomfortable'),
    ])

    // Assert
    const v = phraseView(s)
    expect([v.closing, v.doctor, v.takeLine, v.card]).toEqual([
      'enough',
      true,
      null,
      'rest',
    ])
    expect(v.plays).toEqual([1, 2])
    expect(phraseView(run(s, [{ type: 'delete' }])).closing).toBe('enough')
  })

  it('deletes both takes: no playback, no lines, and no new take', () => {
    // Act
    const s = run(open(), [
      sing,
      ...take(heard),
      feel('easy'),
      ...take(heard),
      feel('easy'),
      { type: 'delete' },
    ])

    // Assert
    const v = phraseView(s)
    expect([v.plays, v.del, v.closing, v.start, v.takeLine]).toEqual([
      [],
      false,
      null,
      null,
      null,
    ])
    expect(v.status).toBe(STATUS.deleted)
  })

  it('ends the takes for today with Done for today, keeping the playback and the practice card', () => {
    // Act
    const s = run(open(), [
      sing,
      ...take(heard),
      feel('easy'),
      ...take(heard),
      feel('easy'),
      { type: 'done' },
    ])

    // Assert
    const v = phraseView(s)
    expect([v.start, v.today, v.moveDo, v.card]).toEqual([
      null,
      false,
      false,
      'practise',
    ])
    expect(v.plays).toEqual([1, 2])
    expect(v.status).toBe(STATUS.done)
  })

  it("draws the takes and plays nothing back in a browser that can't record, and says so before Start", () => {
    // Act
    const before = run(open(), [sing, { type: 'recordable', can: false }])
    const s = run(before, [
      ...take({ ...heard, recorded: false }),
      feel('easy'),
      ...take({ ...heard, recorded: false }),
      feel('easy'),
    ])

    // Assert
    expect(phraseView(before).cantRecord).toBe(true)
    const v = phraseView(s)
    expect([v.closing, v.plays, v.del]).toEqual(['drawn', [], true])
  })

  it('listens only with no microphone, keeping the practice card, and spends no take on a phrase the sound cut off', () => {
    // Act
    const nomic = run(open(), [sing, { type: 'begin' }, { type: 'nomic' }])
    const silenced = run(open(), [
      sing,
      { type: 'begin' },
      { type: 'silenced' },
    ])

    // Assert
    const v = phraseView(nomic)
    expect([v.listenWhy, v.start, v.card, v.status]).toEqual([
      'nomic',
      null,
      'practise',
      STATUS.nomic,
    ])
    expect(silenced.takes).toEqual([])
    expect(phraseView(silenced).start).toBe('start')
  })

  it('moves do before and between takes, never during one or after the singing ends', () => {
    // Act
    const before = run(open(), [sing, { type: 'move', shift: -2 }])
    const during = run(before, [{ type: 'begin' }, { type: 'move', shift: 3 }])
    const stopped = run(open(), [
      sing,
      ...take(heard),
      feel('effortful'),
      { type: 'move', shift: 1 },
    ])

    // Assert
    expect([before.shift, during.shift, stopped.shift]).toEqual([-2, -2, 0])
  })

  it('changes nothing for an event the card cannot send: an answer before a take, Delete before the playback, Done for today where it is not offered', () => {
    // Arrange
    const s = run(open(), [sing])
    const fine = run(s, [...take(heard), feel('easy')])

    // Act / Assert
    expect(nextVisit(s, feel('easy'))).toBe(s)
    expect(nextVisit(s, { type: 'delete' })).toBe(s)
    expect(nextVisit(s, { type: 'done' })).toBe(s)
    expect(nextVisit(s, { type: 'listen' })).toBe(s)
    expect(nextVisit(s, heard)).toBe(s)
    expect(phraseView(fine).today).toBe(false)
    expect(nextVisit(fine, { type: 'done' })).toBe(fine)
  })

  it("says the kit's not-heard line, and every line passes the claims check without inviting another try", () => {
    // Arrange
    const lines = [
      ...Object.values(STATUS),
      ...Object.values(CLOSING),
      ...Object.values(HINT),
      NOT_HEARD_LINE,
    ]

    // Assert
    expect(NOT_HEARD_LINE).toBe(NOT_HEARD_PHRASE_LINE)
    for (const text of lines)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
    expect(
      lines.filter((t) => /try again|another try|one more/i.test(t)),
    ).toEqual([])
  })
})
