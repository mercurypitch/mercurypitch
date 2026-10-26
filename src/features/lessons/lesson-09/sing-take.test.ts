// ============================================================
// Lesson 9 Sing it take tests — Start, Merc's ladder, the take and its reading
// ============================================================
//
// WEB-SPEC, Toys 4 states 5 to 8 and Tests 6, the parts on the page's
// markup: the listener loads only inside Start's tap, asking for the
// microphone as `lesson-09`, and none of Sing it's first-paint modules
// imports more than types from it, the reader or the take; the take opens
// 0.4 s after Merc's last note, with every sound held off and both Mercs
// listening; the reader's slots run from the take's own first voiced frame,
// 1.5 s each as the kit's ladder slots, a line a rung through `rungLine`
// with no advice to try again, the count's line after the answer, the drawn
// line folded around each glowing rung with its octave tag, the lit edges
// and the chart's summary in words; the guide out once a take ends, with
// or without a voice; a voice heard with no note kept is a sung ladder,
// never "didn't hear you start"; Merc celebrates once a visit;
// "Effortful" and "Uncomfortable" end the singing, the second taking the
// lines, the count and the drawn line away; and the Agains carry their names
// and their ladders. The listener and the runs are doubles
// (sing-take.test-fixtures.ts); leaving and the sound are
// sing-leave.test.ts's.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import { LADDER_SLOT_SEC } from '@/features/lessons/kit/take'
import type { TakeDouble } from './sing-take.test-fixtures'
import { closeCard, freshTakes, lines, loadCard, mercRun, mercRuns, onCard, press, start, status, summary, sung, take, } from './sing-take.test-fixtures'
import { LADDER_NOTE_SEC, mercLadderNotes } from './sounds'

const duo = vi.hoisted(() => ({
  sing: vi.fn(),
  listen: vi.fn(),
  celebrate: vi.fn(),
}))
const takes = vi.hoisted(() => ({}) as TakeDouble)

vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
  mercListen: duo.listen,
  mercCelebrate: duo.celebrate,
}))

vi.mock('@/features/lessons/kit/listen', async (actual) =>
  (await import('./sing-take.test-fixtures')).listenDouble(
    await actual(),
    takes,
  ),
)

const load = () => loadCard(takes)
const feelings = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[data-feel]'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  localStorage.clear()
  Object.assign(takes, freshTakes())
})

afterEach(() => {
  closeCard()
  duo.sing.mockReset()
  duo.listen.mockReset()
  duo.celebrate.mockReset()
})

describe("Lesson 9's Sing it: the microphone and Merc's ladder", () => {
  it("loads the listener only inside Start's tap, asking for the microphone as lesson-09", async () => {
    // Arrange: everything the briefing offers, pressed first
    const p = await load()
    p.el('[data-merc-ladder]').click()
    p.el('[data-warm="sigh"]').click()
    p.el('[data-ladder="smaller"]').click()
    p.el('[data-move-do="1"]').click()
    const before = [takes.loaded, takes.asked.length]

    // Act
    await press(p, start(p))

    // Assert
    expect(before).toEqual([0, 0])
    expect([takes.loaded, takes.asked]).toEqual([1, ['lesson-09']])
    expect(mercRun(p).notes).toEqual(mercLadderNotes('smaller', 51))
  })

  it('keeps the listener, the reader and the take out of the first paint: Sing it imports only their types', () => {
    // Arrange
    const files = [
      'main.ts',
      'sing.ts',
      'sing-take.ts',
      'ladder-flow.ts',
      'ladder-chart.ts',
      'sounds.ts',
    ]
    const loads =
      /^import (?!type )[^\n]*from '(@\/features\/lessons\/kit\/(listen|take)|\.\/sing-take)'/m

    // Act
    const offenders = files.filter((f) =>
      loads.test(readFileSync(resolve(__dirname, f), 'utf8')),
    )

    // Assert
    expect(offenders).toEqual([])
  })

  it("opens the take 0.4 s after Merc's last note, holding every sound off while it listens", async () => {
    // Arrange
    const p = await load()
    let hushed: boolean | null = null
    takes.inside = () => {
      hushed = p.Sound.hushed
    }
    takes.frames = sung([57, 6])
    await press(p, start(p))
    const singing = [takes.opened, status(p)]

    // Act
    mercRun(p).end(true)
    await vi.advanceTimersByTimeAsync(399)
    const early = takes.opened
    await vi.advanceTimersByTimeAsync(1)

    // Assert
    expect(singing).toEqual([0, 'Your turn: do-mi-so-do, slowly.'])
    expect([early, takes.opened]).toEqual([0, 1])
    expect(hushed).toBe(true)
    expect(p.Sound.hushed).toBe(false)
    expect(duo.listen).toHaveBeenCalledWith('orange', true)
  })

  it('says the take line once the take listens, and lets the microphone go when it ends', async () => {
    // Arrange
    const p = await load()
    let said = ''
    takes.inside = () => {
      said = status(p)
    }

    // Act
    await take(p, start(p), sung([57, 6]))

    // Assert
    expect(said).toBe(
      "Your turn: start on do when you're ready. Move on each time the next band lights up.",
    )
    expect([takes.released, takes.releasedNow]).toEqual([1, 0])
  })

  it("times the reader's slots as the kit's ladder slots", () => {
    expect(LADDER_NOTE_SEC).toBe(LADDER_SLOT_SEC)
  })
})

describe("Lesson 9's Sing it: a take's reading", () => {
  it('reads a steady A3 on the lower full ladder a rung at a time, with no advice to try again, then the count and the tricky line', async () => {
    // Arrange
    const p = await load()
    await take(p, start(p), sung([57, 6]))
    const read = lines(p)
    const asked = [status(p), onCard(p, '[data-panel="feel"]')]
    const count = onCard(p, '[data-count-line]')

    // Act
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(read).toEqual([
      'Do · About five semitones below, nearer a different note.',
      'Mi · About three semitones above, nearer a different note.',
      "So · Right in the middle: on Merc's note.",
      'Top do · About five semitones below, nearer a different note.',
    ])
    expect(asked).toEqual(['How did that feel?', true])
    expect(count).toBe(false)
    expect(p.el('[data-count-line]').textContent).toBe(
      'This time, 1 of your 4 notes landed in the band.',
    )
    expect(onCard(p, '[data-closing="tricky"]')).toBe(true)
    expect(status(p)).toBe(
      "This time, 1 of your 4 notes landed in the band. If that felt tricky, good: that's learning.",
    )
    expect(summary(p)).toBe(
      'Your ladder, drawn as a line: do outside the band, mi outside the band, so right in the middle, top do outside the band',
    )
    expect(p.card.chart.chart.scene.rungs?.map((r) => r.lit)).toEqual([
      false,
      false,
      true,
      false,
    ])
  })

  it('reads a steady D3 at the top do as an octave lower and landed, the live line folded onto each rung with its octave tag', async () => {
    // Arrange
    const p = await load()
    let tag = ''
    takes.inside = () => {
      tag = p.el('[data-octave-tag]').textContent ?? ''
    }

    // Act
    await take(p, start(p), sung([50, 6]))

    // Assert
    expect(lines(p)[3]).toBe(
      "Top do · Right in the middle: on Merc's note. You sang it an octave lower: same note.",
    )
    expect(tag).toBe('octave lower')
    expect(p.el('[data-octave-tag]').hidden).toBe(true)
    const line = p.card.chart.chart.scene.line ?? []
    expect([line[0]?.c, line.at(-1)?.c]).toEqual([0, 1200])
    p.el('[data-feel="workable"]').click()
    expect(p.el('[data-count-line]').textContent).toBe(
      'This time, 2 of your 4 notes landed in the band.',
    )
  })

  it('reads D3, F sharp 3, A3 and D4 for 1.5 s each, begun late in the wait, as four landed notes, and Merc celebrates once a visit', async () => {
    // Arrange: the voice starts 2 s into the take, its slots timed from there
    const p = await load()
    const ladder = sung([null, 1.5], [50, 1.5], [54, 1.5], [57, 1.5], [62, 1.5])
    await take(p, start(p), ladder)
    const read = lines(p)

    // Act: "Easy", do moved up and back (the card drawn twice more), Again,
    // the same again, "Easy"
    p.el('[data-feel="easy"]').click()
    const count = p.el('[data-count-line]').textContent
    p.el('[data-move-do="1"]').click()
    p.el('[data-move-do="-1"]').click()
    await take(p, p.el('[data-sing="again"]'), ladder)
    const freed = feelings().map((b) => [
      b.disabled,
      b.getAttribute('aria-pressed'),
    ])
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(read.map((l) => l.split(' · ')[1])).toEqual(
      Array(4).fill("Right in the middle: on Merc's note."),
    )
    expect(count).toBe('This time, 4 of your 4 notes landed in the band.')
    expect(onCard(p, '[data-closing="tricky"]')).toBe(false)
    expect(freed).toEqual(Array(4).fill([false, 'false']))
    expect(duo.celebrate.mock.calls).toEqual([['blue']])
  })

  it('calls a take that heard a voice but kept no steady note a sung ladder, asking how it felt', async () => {
    // Arrange
    const p = await load()

    // Act: frames the reader keeps none of, though the listener heard a voice start
    await take(p, start(p), sung([null, 6]), 0.5)

    // Assert
    expect(p.card.visit.takes).toEqual([{ ladder: 'full', kind: 'unsteady' }])
    expect(lines(p)).toEqual(
      ['Do', 'Mi', 'So', 'Top do'].map(
        (l) => `${l} · We didn't hear a steady note there.`,
      ),
    )
    expect(status(p)).toBe('How did that feel?')
    p.el('[data-feel="workable"]').click()
    expect(p.el('[data-count-line]').textContent).toBe(
      "We didn't hear a steady note this time.",
    )
  })

  it('asks no feeling after a take with no voice, saying so with its cue, beside Start again', async () => {
    // Arrange
    const p = await load()

    // Act
    await take(p, start(p), sung([null, 6]))

    // Assert
    expect(p.card.visit.takes).toEqual([{ ladder: 'full', kind: 'none' }])
    expect(status(p)).toBe(
      "We didn't hear you start that time. Start on do when its band lights.",
    )
    expect(onCard(p, '[data-panel="feel"]')).toBe(false)
    expect(onCard(p, '[data-sing="start-again"]')).toBe(true)
    expect(lines(p)).toEqual([])
  })

  it('leaves no rung glowing or lit once a take with no voice ends, so the chart no longer looks as if it listens, and a voiced take lights only its landed rungs', async () => {
    // Arrange
    const p = await load()
    const guide = () =>
      (p.card.chart.chart.scene.rungs ?? []).map((r) => [r.glow, r.lit])

    // Act
    await take(p, start(p), sung([null, 6]))
    const unheard = guide()
    await take(p, p.el('[data-sing="start-again"]'), sung([57, 6]))

    // Assert
    expect(unheard).toEqual([
      [0, false],
      [0, false],
      [0, false],
      [0, false],
    ])
    expect(guide()).toEqual([
      [0, false],
      [0, false],
      [0, true],
      [0, false],
    ])
  })
})

describe("Lesson 9's Sing it: the answers", () => {
  it('takes the lines, the count and the drawn line away after "Uncomfortable", the chart back to Merc\'s rungs', async () => {
    // Arrange
    const p = await load()
    await take(p, start(p), sung([57, 6]))

    // Act
    p.el('[data-feel="uncomfortable"]').click()

    // Assert
    expect(p.el('[data-readings]').hidden).toBe(true)
    expect(onCard(p, '[data-count-line]')).toBe(false)
    expect(p.card.chart.chart.scene.line ?? []).toEqual([])
    expect(summary(p)).toBe('Do is D3')
    expect(onCard(p, '[data-closing="enough"]')).toBe(true)
    expect(onCard(p, '[data-after-doctor]')).toBe(true)
    expect(onCard(p, '[data-sing="again"]')).toBe(false)
    expect(p.VisitEnding.ending).toBe('rest')
  })

  it('keeps the count after "Effortful" with the gentle line, no Again, the feelings locked and the rest card', async () => {
    // Arrange
    const p = await load()
    await take(p, start(p), sung([57, 6]))

    // Act
    p.el('[data-feel="effortful"]').click()

    // Assert
    expect(onCard(p, '[data-count-line]')).toBe(true)
    expect(onCard(p, '[data-closing="gentle"]')).toBe(true)
    expect(onCard(p, '[data-sing="again"]')).toBe(false)
    expect(onCard(p, '[data-sing="again-smaller"]')).toBe(false)
    expect(onCard(p, '[data-sing="today"]')).toBe(true)
    expect(feelings().every((b) => b.disabled)).toBe(true)
    expect(p.VisitEnding.ending).toBe('rest')
  })

  it("names both Agains after the full ladder, and Again, smaller sings the smaller ladder, using the visit's one Again", async () => {
    // Arrange
    const p = await load()
    await take(p, start(p), sung([57, 6]))
    p.el('[data-feel="easy"]').click()
    const names = ['again', 'again-smaller'].map((b) =>
      p.el(`[data-sing="${b}"]`).getAttribute('aria-label'),
    )

    // Act
    await take(p, p.el('[data-sing="again-smaller"]'), sung([57, 7.5]))
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(names).toEqual(['Again: do-mi-so-do', 'Again, smaller ladder'])
    expect(mercRuns(p).at(-1)?.notes).toEqual(mercLadderNotes('smaller', 50))
    expect(lines(p)).toHaveLength(5)
    expect(onCard(p, '[data-sing="again"]')).toBe(false)
    expect(onCard(p, '[data-sing="again-smaller"]')).toBe(false)
    expect(p.VisitEnding.ending).toBe('practise')
  })
})
