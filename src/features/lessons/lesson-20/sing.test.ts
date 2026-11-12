// ============================================================
// Lesson 20 Sing it tests — the run, Move do, the take and the faster pass
// ============================================================
//
// WEB-SPEC, Toys 6, on the page's markup, with the listener and the runs as
// doubles (sing-take.test-fixtures.ts): the run and the smaller run, the
// run pressed; Move do higher only, three semitones for the lower voice and
// four for the higher, "lower" resting at its end; the chart's beads over
// 0.75 s slots, nine or seven, faint until Merc sings, its summary saying
// where do is; Merc's run a note every 0.75 s; a take read a line a note
// with the run's labels, a 0.75 s slot holding the reader's 0.15 s attack
// and 0.45 s of steady voice; the faster pass after "Easy", Merc's run at
// 0.45 s, the count-in on do and the guide's sweep, nothing listening, the
// last take's lit edges kept, then "How did that feel?" and its own line;
// the pass cut short by the sound going off, unspent, with the one hint;
// and, with no microphone, Merc's run followed by the guide's sweep at the
// take's pace. The kit's rule is the kit's to test (kit/ladder-flow.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import { RUN_LABELS } from './sing'
import type { TakeDouble } from './sing-take.test-fixtures'
import { closeCard, freshTakes, lines, loadCard, mercRun, onCard, press, start, status, summary, sung, take, } from './sing-take.test-fixtures'

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
type Page = Awaited<ReturnType<typeof load>>

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

const D3 = 50
/** The run from D3: do, re, mi, so, la, so, mi, re, do. */
const RUN = [50, 52, 54, 57, 59, 57, 54, 52, 50]
const SMALLER = [50, 52, 54, 57, 54, 52, 50]

const ended = (p: Page, which: string): string | null =>
  p.el(`[data-move-do="${which}"]`).getAttribute('aria-disabled')
const beads = (p: Page) => p.card.chart.run.chart.scene.rungs ?? []
const feel = (p: Page, f: string) => p.el(`[data-feel="${f}"]`).click()

/** The run sung back on every note, each held through its 0.75 s slot. */
const sungRun = (notes: readonly number[] = RUN) =>
  sung(...notes.map((m) => [m, 0.75] as const))

/** A take of the run read, then "Easy". */
async function easyTake(p: Page): Promise<void> {
  await take(p, start(p), sungRun())
  feel(p, 'easy')
}

describe("Lesson 20's Sing it: the run and Move do", () => {
  it('offers the run and the smaller run, the run pressed, and draws its nine beads over 0.75 s slots, faint, do on D3', async () => {
    // Act
    const p = await load()

    // Assert: FACTS 50
    const runs = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-ladder]'),
      (b) => [b.textContent?.trim(), b.getAttribute('aria-pressed')],
    )
    expect(runs).toEqual([
      ['The run: up to la', 'true'],
      ['Smaller: up to so', 'false'],
    ])
    expect(beads(p).map((b) => b.from)).toEqual([
      0, 0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25, 6,
    ])
    expect(beads(p).map((b) => b.c)).toEqual(RUN.map((m) => (m - D3) * 100))
    expect(beads(p).every((b) => b.faint === true)).toBe(true)
    expect(summary(p)).toBe('Do is D3')
  })

  it('moves do higher only, three semitones for the lower voice, "lower" resting at its end', async () => {
    // Arrange
    const p = await load()
    const before = [ended(p, '-1'), ended(p, '1')]

    // Act
    for (let i = 0; i < 4; i++) p.el('[data-move-do="1"]').click()

    // Assert: FACTS 52
    expect(before).toEqual(['true', 'false'])
    expect(p.card.visit.shift).toBe(3)
    expect([ended(p, '-1'), ended(p, '1')]).toEqual(['false', 'true'])
    expect(summary(p)).toBe('Do is F3')
  })

  it('reaches four semitones higher for the higher voice, Tavi from D4', async () => {
    // Arrange
    const p = await load()
    p.el('[data-voice="higher"]').click()

    // Act
    for (let i = 0; i < 5; i++) p.el('[data-move-do="1"]').click()

    // Assert
    expect(p.card.visit.shift).toBe(4)
    expect(ended(p, '1')).toBe('true')
    expect(summary(p)).toBe('Do is F sharp 4')
  })

  it("plays Merc's run a note every 0.75 s, each bead lit as he sings it, and the smaller run's seven", async () => {
    // Arrange
    const p = await load()
    const glow = vi.spyOn(p.card.chart.run, 'glow')

    // Act
    p.el('[data-merc-ladder]').click()
    const full = mercRun(p)
    full.note(0)
    full.end(true)
    await vi.advanceTimersByTimeAsync(0)
    p.el('[data-ladder="smaller"]').click()
    p.el('[data-merc-ladder]').click()
    const smaller = mercRun(p)

    // Assert
    expect(full.notes.map((n) => n.midi)).toEqual(RUN)
    expect(full.notes.map((n) => n.t)).toEqual([
      0, 0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25, 6,
    ])
    expect(new Set(full.notes.map((n) => n.dur))).toEqual(new Set([0.75]))
    expect(glow).toHaveBeenCalledWith(0, 0.75)
    expect(smaller.notes.map((n) => n.midi)).toEqual(SMALLER)
    expect(beads(p)).toHaveLength(7)
  })
})

describe("Lesson 20's Sing it: the take", () => {
  it('reads each note in its 0.75 s slot, a line a note under the run’s labels', async () => {
    // Arrange
    const p = await load()

    // Act
    await take(p, start(p), sungRun())

    // Assert: FACTS 56 and 58
    expect(lines(p)).toHaveLength(9)
    expect(lines(p).map((l) => l.split(' · ')[0])).toEqual(
      RUN_LABELS.full.slice(),
    )
    expect(lines(p)[0]).toMatch(/^Do · Right in the middle/)
    expect(status(p)).toBe('How did that feel?')
    expect(beads(p).every((b) => b.lit === true)).toBe(true)
  })

  it('reads the smaller run in seven slots under its own labels', async () => {
    // Arrange
    const p = await load()
    p.el('[data-ladder="smaller"]').click()

    // Act
    await take(p, start(p), sungRun(SMALLER))

    // Assert
    expect(lines(p).map((l) => l.split(' · ')[0])).toEqual(
      RUN_LABELS.smaller.slice(),
    )
  })
})

describe("Lesson 20's Sing it: Again, faster", () => {
  it('offers Again, faster after "Easy", with its line, and no faster pass before a take', async () => {
    // Arrange
    const p = await load()
    const before = onCard(p, '[data-sing="faster"]')

    // Act
    await easyTake(p)

    // Assert
    expect(before).toBe(false)
    expect(onCard(p, '[data-sing="faster"]')).toBe(true)
    expect(onCard(p, '[data-faster-how]')).toBe(true)
  })

  it("plays Merc's run at 0.45 s a note, the count-in on do, then the guide's sweep at 0.45 s, nothing listening, no line and the lit edges kept", async () => {
    // Arrange
    const p = await load()
    await easyTake(p)
    const opened = takes.opened
    const runsBefore = p.runs.length
    const drawn = p.card.chart.chart.scene.line.length

    // Act
    p.el('[data-sing="faster"]').click()
    const [sings, guide] = p.runs.slice(runsBefore)
    sings.note(0)
    guide.note(0)
    const during = {
      status: status(p),
      lit: beads(p).every((b) => b.lit === true),
      line: p.card.chart.chart.scene.line.length,
      after: onCard(p, '[data-panel="after"]'),
    }

    // Assert: FACTS 63
    expect(sings.notes.map((n) => n.midi)).toEqual([...RUN, D3])
    expect(sings.notes.map((n) => Math.round(n.t * 100) / 100)).toEqual([
      0, 0.45, 0.9, 1.35, 1.8, 2.25, 2.7, 3.15, 3.6, 4.05,
    ])
    expect(sings.notes[9]).toMatchObject({
      dur: 0.8,
      kind: 'soft',
      gain: 0.065,
    })
    expect(guide.o.audible).toBe(false)
    expect(guide.notes.map((n) => Math.round(n.t * 100) / 100)).toEqual([
      5.05, 5.5, 5.95, 6.4, 6.85, 7.3, 7.75, 8.2, 8.65,
    ])
    expect(guide.notes[8].t + guide.notes[8].dur).toBeCloseTo(9.1, 9)
    expect(drawn).toBeGreaterThan(0)
    expect(during).toEqual({
      status: 'Sing along as each bead lights, if you like.',
      lit: true,
      line: 0,
      after: false,
    })
    expect(takes.opened).toBe(opened)
  })

  it('asks how it felt once it runs to its end, and says its own line for "Easy": no count, and no second pass', async () => {
    // Arrange
    const p = await load()
    await easyTake(p)
    const runsBefore = p.runs.length
    p.el('[data-sing="faster"]').click()

    // Act
    for (const r of p.runs.slice(runsBefore)) r.end(true)
    await vi.advanceTimersByTimeAsync(0)
    const asked = status(p)
    feel(p, 'easy')

    // Assert
    expect(asked).toBe('How did that feel?')
    expect(onCard(p, '[data-closing="faster"]')).toBe(true)
    expect(onCard(p, '[data-count-line]')).toBe(false)
    expect(onCard(p, '[data-sing="faster"]')).toBe(false)
    expect(p.card.visit.takes).toHaveLength(1)
    expect(duo.celebrate).toHaveBeenCalledTimes(1)
  })

  it('cut short by the sound going off, is unspent: the hint shows and Again, faster is offered still', async () => {
    // Arrange
    const p = await load()
    await easyTake(p)
    const runsBefore = p.runs.length
    p.el('[data-sing="faster"]').click()

    // Act
    vi.spyOn(p.Sound, 'state', 'get').mockReturnValue('off')
    p.Sound.set('off')
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(p.runs.slice(runsBefore).every((r) => r.stopped)).toBe(true)
    expect(onCard(p, '[data-sing="faster"]')).toBe(true)
    expect(p.el('[data-again-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's run, then press it again.",
    )
    expect(onCard(p, '[data-again-hint]')).toBe(true)
    expect(p.card.visit.fasterUsed).toBe(false)
  })

  it('stops when another sound on the page starts, unspent', async () => {
    // Arrange
    const p = await load()
    await easyTake(p)
    const runsBefore = p.runs.length
    p.el('[data-sing="faster"]').click()

    // Act
    p.NowPlaying.claim(() => undefined)
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(p.runs.slice(runsBefore).every((r) => r.stopped)).toBe(true)
    expect(onCard(p, '[data-sing="faster"]')).toBe(true)
    expect(p.card.visit.passing).toBeNull()
  })
})

describe("Lesson 20's Sing it: no microphone", () => {
  it("plays Merc's run, then the guide's sweep at the take's pace after its gap, nothing listening", async () => {
    // Arrange
    const p = await load()
    vi.mocked(p.Sound.context).mockReturnValue(null)
    await press(p, start(p))
    const runsBefore = p.runs.length

    // Act
    p.el('[data-merc-ladder]').click()
    const [sings, sweep] = p.runs.slice(runsBefore)

    // Assert: WEB-SPEC, Toys 6, state 9
    expect(status(p)).toBe(
      'No microphone? Sing along anyway: Merc sings the run first, and nothing listens.',
    )
    expect(sings.notes.map((n) => n.midi)).toEqual(RUN)
    expect(sweep.o.audible).toBe(false)
    expect(sweep.notes.map((n) => Math.round(n.t * 100) / 100)).toEqual([
      7.15, 7.9, 8.65, 9.4, 10.15, 10.9, 11.65, 12.4, 13.15,
    ])
    expect(takes.opened).toBe(0)
  })
})
