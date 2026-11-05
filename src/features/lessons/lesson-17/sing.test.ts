// ============================================================
// Lesson 17 sung bars tests — the flow on the page, Merc's bars, the guide, Move the note
// ============================================================
//
// On the page's own markup, each test a visit with the page's modules
// loaded afresh, so a stored voice is what the test stores (WEB-SPEC, Toys
// 7, part 2; Tests 6; FACTS 50 to 63): the comfort check first, every
// visit; the voice choice before anything plays, picking the Merc who sings
// and the still; Merc's bars after a bar counted in, the nine notes on A3
// or A4 in Merc's "ooh" over the click, each lit as it sounds; the guide
// only once they have been heard with sound on, its count-in with the note
// once and softly on beat 1, each note lit in ink over the click; "How did
// that feel?" after it, this page's line and Again once after Easy, the
// guide put away after Effortful or Uncomfortable, and the rest card; Move
// the note a semitone a press, four either way; one sound at a time, and
// leaving.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { COUNT_IN } from '@/features/lessons/kit/move-do'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { STATUS } from '@/features/lessons/kit/sing-flow'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import type * as PageDom from './page-dom.test-fixtures'
import { TAKE_ONSETS } from './take-judge'

/** What the visit sounded: its knocks, and its notes on the voice. */
const rec = vi.hoisted(() => ({
  wood: [] as unknown[][],
  notes: [] as unknown[][],
}))

// the recorder rides on the mocked clock, so a visit reads the runs the
// clock it loaded recorded, whatever copy of the fixtures made them
vi.mock('@/features/lessons/kit/beat-clock', async (actual) => {
  const fake = await import('./page-dom.test-fixtures')
  return {
    ...(await actual<typeof BeatClockModule>()),
    BeatClock: fake.FakeBeatClock,
    fake,
  }
})
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (...a: unknown[]) => {
    rec.wood.push(a)
  },
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (...a: unknown[]) => {
    rec.notes.push(a)
    return null
  },
}))

/** A visit: the page's modules loaded afresh, the sung part mounted on the page's markup, the sound on. */
async function visit(voice: Voice | null = null) {
  vi.resetModules()
  localStorage.clear()
  if (voice !== null) localStorage.setItem('fyp-voice', JSON.stringify(voice))
  rec.wood.length = 0
  rec.notes.length = 0
  const dom = await import('./page-dom.test-fixtures')
  const sing = await import('./sing')
  const comfort = await import('@/features/lessons/kit/comfort')
  const sound = await import('@/features/lessons/kit/sound')
  const owner = await import('@/features/lessons/kit/now-playing')
  const { fake } =
    (await import('@/features/lessons/kit/beat-clock')) as unknown as {
      readonly fake: typeof PageDom
    }
  fake.resetRuns()
  dom.loadPage()
  dom.soundOn()
  comfort.VisitEnding.set('practise')
  sing.initSing(dom.el('#singCard'))
  const { runs, drive, finish } = fake
  return {
    ...dom,
    ...comfort,
    ...sound,
    ...owner,
    ...sing,
    runs,
    drive,
    finish,
  }
}

type Visit = Awaited<ReturnType<typeof visit>>

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
  localStorage.clear()
})

/** Shown on the card: neither it nor any box around it hidden. */
function shown(p: Visit, selector: string): boolean {
  for (
    let el: HTMLElement | null = p.el<HTMLElement>(selector);
    el;
    el = el.parentElement
  )
    if (el.hidden) return false
  return true
}

const status = (p: Visit): string => p.words(p.el('#singStatus'))
const click = (p: Visit, selector: string): void =>
  p.el<HTMLButtonElement>(selector).click()
const guideFig = (p: Visit): HTMLElement => p.el('#lineGuide')
const count = (p: Visit, selector: string): number =>
  guideFig(p).querySelectorAll(selector).length
const lit = (p: Visit, selector: string, attr: string): number[] =>
  Array.from(guideFig(p).querySelectorAll(selector), (g) =>
    Number(g.getAttribute(attr)),
  )

function choose(p: Visit, comfort: 'sing' | 'listen', voice?: Voice): void {
  click(p, `[data-comfort="${comfort}"]`)
  if (voice !== undefined) click(p, `[data-voice="${voice}"]`)
}

/** Play Merc's bars pressed, and the bars heard to their end. */
async function hearMerc(p: Visit): Promise<void> {
  click(p, '[data-line-play]')
  await p.finish()
}

/** A guide started from `from` and run to its end. */
async function guide(p: Visit, from = '[data-guide-start]'): Promise<void> {
  click(p, from)
  await p.finish()
}

/** Each note booked on the voice: its pitch and options. */
const booked = (): { hz: number; o: Record<string, unknown> }[] =>
  rec.notes.map(([f, o]) => ({
    hz: f as number,
    o: o as Record<string, unknown>,
  }))

describe('before singing', () => {
  it('opens on the comfort check every visit, a voice stored or not, the bars drawn and nothing read', async () => {
    // Act
    const p = await visit('higher')

    // Assert (FACTS 50)
    expect(status(p)).toBe(STATUS.comfort)
    expect(shown(p, '[data-panel="comfort"]')).toBe(true)
    for (const panel of ['listen', 'voice', 'notes', 'feel'])
      expect(shown(p, `[data-panel="${panel}"]`), panel).toBe(false)
    expect(count(p, '.rb-sym:not(.is-hidden)')).toBe(9)
    expect(count(p, '.rb-read:not(.is-hidden)')).toBe(0)
  })

  it('asks for a voice under its first line with none stored, and offers nothing to play until one is chosen', async () => {
    // Arrange
    const p = await visit()

    // Act
    choose(p, 'sing')
    click(p, '[data-line-play]')

    // Assert (FACTS 52): the voice picks the Merc who sings
    expect(p.runs).toHaveLength(0)
    expect(status(p)).toBe("Choose the voice you'll sing with.")
    expect(shown(p, '[data-voice-line="none"]')).toBe(true)
    expect(shown(p, '[data-voice-line="stored"]')).toBe(false)
    expect(shown(p, '[data-panel="notes"]')).toBe(false)
    expect(document.activeElement?.closest('[data-panel="voice"]')).not.toBe(
      null,
    )
  })

  it("keeps a stored voice under its second line, and asks for Merc's bars before the guide", async () => {
    // Arrange
    const p = await visit('lower')

    // Act
    choose(p, 'sing')

    // Assert (WEB-SPEC, Toys 7, part 2, state 5)
    expect(shown(p, '[data-voice-line="stored"]')).toBe(true)
    expect(shown(p, '[data-panel="notes"]')).toBe(true)
    expect(status(p)).toBe(
      "Play Merc's bars first: Merc sings them, then the guide is yours.",
    )
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.words(p.el('[data-guide-hint]'))).toBe("Play Merc's bars first")
    expect(p.words(p.el('[data-do-readout]'))).toBe('note: as written')
  })
})

describe("Merc's bars", () => {
  it("counts a bar in on the click, then sings the nine notes in Merc's ooh on A3 over it, each lit as it sounds", async () => {
    // Arrange
    const p = await visit()
    choose(p, 'sing', 'lower')

    // Act
    vi.mocked(p.Sound.canPlay).mockClear()
    click(p, '[data-line-play]')
    const asked = vi.mocked(p.Sound.canPlay).mock.calls.length
    const run = p.runs[0]
    const countIn = run.o.bar(0)
    const singing = status(p)
    p.drive(5)
    const first = lit(p, '.rb-sym.is-sounding', 'data-i')
    await p.finish()

    // Assert (FACTS 58, 61, 63): 4 s counted in, then 8 s
    expect(countIn?.beats).toBe(4)
    expect(
      countIn?.hits.every((h) => (h.data as { k: string }).k === 'click'),
    ).toBe(true)
    expect(singing).toBe(p.MERC_SINGS)
    // the Sound switch asked once, so its toast shows once
    expect(asked).toBe(1)
    expect(first).toEqual([0])
    expect(booked()).toHaveLength(9)
    expect(booked().every((n) => n.hz === hz(A3) && n.o.kind === 'merc')).toBe(
      true,
    )
    expect(rec.wood).toHaveLength(12)
    expect(rec.wood.every((a) => a[3] === WOOD_LEVEL)).toBe(true)
    expect(guideFig(p).dataset.voice).toBe('merc')
    expect(status(p)).toBe(
      "Start the guide when you're ready, or play Merc's bars again.",
    )
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'false',
    )
    expect(shown(p, '[data-guide-hint]')).toBe(false)
  })

  it("sings on A4 as Tavi for the higher voice, the still and the notes' colour following the choice", async () => {
    // Arrange
    const p = await visit()
    choose(p, 'sing', 'higher')

    // Act
    await hearMerc(p)

    // Assert (FACTS 57; Merc and Tavi)
    expect(p.el<HTMLImageElement>('[data-guide-merc]').src).toContain(
      'merc-orange',
    )
    expect(guideFig(p).dataset.voice).toBe('tavi')
    expect(booked().every((n) => n.hz === hz(A4))).toBe(true)
  })

  it('lights in silence with sound off and says so, the guide still waiting', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    vi.spyOn(p.Sound, 'canPlay').mockReturnValue(false)

    // Act
    await hearMerc(p)

    // Assert
    expect(p.runs[0].o.audible).toBe(false)
    expect(p.words(p.el('[data-guide-hint]'))).toBe(p.FLOW.HINT.silent)
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'true',
    )
  })

  it('has not been heard when another sound cuts it short', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    click(p, '[data-line-play]')
    p.drive(3)

    // Act
    p.NowPlaying.claim(() => undefined)
    await p.settle()

    // Assert
    expect(p.runs[0].stopped).toBe(true)
    expect(status(p)).toBe(p.FLOW.STATUS.first)
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.el('[data-line-play]').classList.contains('is-on')).toBe(false)
  })
})

describe('the guide', () => {
  it('counts in with the note once and softly on beat 1, then lights each beat and each note in ink over the click, Merc silent', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)
    rec.notes.length = 0
    rec.wood.length = 0

    // Act
    click(p, '[data-guide-start]')
    const guiding = [status(p), guideFig(p).classList.contains('is-guide')]
    const run = p.runs[1]
    p.drive(6)
    const mid = [
      lit(p, '.rb-pad.is-now', 'data-beat'),
      lit(p, '.rb-sym.is-sounding', 'data-i'),
    ]
    await p.finish()

    // Assert (FACTS 58): 4 s counted in, then 8 s
    expect(guiding).toEqual([STATUS.guiding, true])
    expect(run.o.bar(0)?.hits.map((h) => h.data)).toContainEqual({
      k: 'tone',
    })
    expect(
      [1, 2].flatMap(
        (b) =>
          run.o
            .bar(b)
            ?.hits.filter((h) => (h.data as { k: string }).k === 'note')
            .map((h) => b * 4 - 4 + h.beat) ?? [],
      ),
    ).toEqual(TAKE_ONSETS)
    expect(booked()).toEqual([
      {
        hz: hz(A3),
        o: { when: 0, dur: 1, gain: COUNT_IN.gain, to: undefined },
      },
    ])
    expect(rec.wood.map((a) => a[2])).toEqual(
      Array.from({ length: 12 }, (_, b) => b % 4 === 0),
    )
    expect(mid).toEqual([[1], [1]])
    expect(guideFig(p).classList.contains('is-guide')).toBe(false)
    expect(lit(p, '.rb-pad.is-now', 'data-beat')).toEqual([])
    expect(status(p)).toBe(STATUS.feel)
    expect(shown(p, '[data-panel="feel"]')).toBe(true)
    expect(document.activeElement).toBe(p.el('.feel-q'))
    expect(shown(p, '[data-guide-start]')).toBe(false)
    expect(shown(p, '[data-guide-again]')).toBe(false)
  })

  it('does not start with sound off', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)
    vi.spyOn(p.Sound, 'canPlay').mockReturnValue(false)

    // Act
    click(p, '[data-guide-start]')

    // Assert (Audio, "Sound off")
    expect(p.runs).toHaveLength(1)
    expect(p.Sound.canPlay).toHaveBeenCalledWith({ needsSound: true })
    expect(status(p)).toBe(p.FLOW.STATUS.ready)
  })

  it('asks nothing when cut short, and leaves Start the guide on offer', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)
    click(p, '[data-guide-start]')
    p.drive(5)

    // Act
    p.NowPlaying.claim(() => undefined)
    await p.settle()

    // Assert
    expect(p.runs[1].stopped).toBe(true)
    expect(shown(p, '[data-panel="feel"]')).toBe(false)
    expect(status(p)).toBe(p.FLOW.STATUS.ready)
    expect(shown(p, '[data-guide-start]')).toBe(true)
    expect(lit(p, '.rb-sym.is-sounding', 'data-i')).toEqual([])
  })
})

describe('How did that feel?', () => {
  it("gives this page's line and Again after Easy, once a visit, Again's guide asking afresh", async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)
    await guide(p)

    // Act
    click(p, '[data-feel="easy"]')
    const easy = [
      status(p),
      shown(p, '[data-after="done"]'),
      shown(p, '[data-guide-again]'),
    ]
    click(p, '[data-guide-again]')
    const focused = document.activeElement === p.el('#singStatus')
    await p.finish()
    const asked = p.el('[data-feel="easy"]').getAttribute('aria-pressed')
    click(p, '[data-feel="workable"]')

    // Assert (FACTS 56, 58): at most two guides a visit
    expect(easy).toEqual(["That's it: two bars on one note, done.", true, true])
    expect(focused).toBe(true)
    expect(asked).toBe('false')
    expect(p.runs).toHaveLength(3)
    expect(shown(p, '[data-guide-again]')).toBe(false)
    expect(shown(p, '[data-guide-start]')).toBe(false)
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it('puts the guide, Again and Move the note away after Effortful or Uncomfortable, picks the rest card, and adds the doctor lines after Uncomfortable', async () => {
    for (const [f, line] of [
      ['effortful', 'gentle'],
      ['uncomfortable', 'enough'],
    ] as const) {
      // Arrange
      const p = await visit('lower')
      choose(p, 'sing')
      await hearMerc(p)
      await guide(p)

      // Act
      click(p, `[data-feel="${f}"]`)

      // Assert
      expect(shown(p, `[data-after="${line}"]`), f).toBe(true)
      expect(status(p), f).toBe(p.FLOW.AFTER[line])
      for (const sel of [
        '[data-guide-start]',
        '[data-guide-again]',
        '[data-move-part]',
        '.turn',
      ])
        expect(shown(p, sel), `${f} ${sel}`).toBe(false)
      expect(shown(p, '[data-line-play]'), f).toBe(true)
      expect(shown(p, '[data-after-doctor]'), f).toBe(f === 'uncomfortable')
      expect(p.VisitEnding.ending, f).toBe('rest')
      window.dispatchEvent(new Event('pagehide'))
    }
  })
})

describe('Move the note', () => {
  it("moves Merc's bars and the guide a semitone a press, up to four either way, its readout in semitones", async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    const lower = p.el<HTMLButtonElement>('[data-move-do="-1"]')
    const higher = p.el<HTMLButtonElement>('[data-move-do="1"]')

    // Act
    for (let i = 0; i < 5; i++) lower.click()
    const lowest = [
      p.words(p.el('[data-do-readout]')),
      lower.getAttribute('aria-disabled'),
    ]
    await hearMerc(p)
    const mercHz = booked()[0].hz
    // a press past the reach does nothing: Merc's bars play on
    click(p, '[data-line-play]')
    lower.click()
    const past = [p.runs[1].stopped, p.words(p.el('[data-do-readout]'))]
    for (let i = 0; i < 5; i++) higher.click()
    const one = p.words(p.el('[data-do-readout]'))
    rec.notes.length = 0
    click(p, '[data-guide-start]')
    p.drive(1)

    // Assert (FACTS 57, 61)
    expect(lowest).toEqual(['note: 4 semitones lower, the lowest', 'true'])
    expect(mercHz).toBeCloseTo(174.61, 2)
    expect(past).toEqual([false, 'note: 4 semitones lower, the lowest'])
    expect(p.runs[1].stopped).toBe(true)
    expect(one).toBe('note: 1 semitone higher')
    expect(booked()[0].hz).toBeCloseTo(233.08, 2)
  })

  it('reads every step in semitones, the far ends named, never a letter', async () => {
    // Arrange
    const { noteReadout } = await visit()

    // Act
    const read = [0, -1, 2, 4, -4].map(noteReadout)

    // Assert (FACTS 57)
    expect(read).toEqual([
      'note: as written',
      'note: 1 semitone lower',
      'note: 2 semitones higher',
      'note: 4 semitones higher, the highest',
      'note: 4 semitones lower, the lowest',
    ])
  })
})

describe('Just listen today', () => {
  it("plays Merc's bars with nothing asked of the voice: no guide, no Move the note, the doctor lines and the rest card", async () => {
    // Arrange
    const p = await visit()

    // Act
    choose(p, 'listen', 'higher')
    const before = status(p)
    click(p, '[data-line-play]')
    const playing = status(p)
    await p.finish()

    // Assert (FACTS 51, 55, 56)
    expect(before).toBe(
      "Just listening today: press Play Merc's bars to hear them.",
    )
    expect(playing).toBe(p.MERC_SINGS)
    expect(status(p)).toBe(before)
    expect(shown(p, '[data-panel="listen"] .doctor')).toBe(true)
    for (const sel of [
      '[data-guide-start]',
      '[data-move-part]',
      '[data-do-readout]',
      '.turn',
    ])
      expect(shown(p, sel), sel).toBe(false)
    expect(booked()).toHaveLength(9)
    expect(p.VisitEnding.ending).toBe('rest')
  })
})

describe('leaving', () => {
  it("stops Merc's bars or the guide once the card has been off screen for 600 ms", async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await visit('lower')
    const doubles =
      await import('@/features/lessons/kit/browser-doubles.test-fixtures')
    choose(p, 'sing')
    click(p, '[data-line-play]')

    // Act
    doubles.scrollOutOfView(p.el('#singCard'))
    await vi.advanceTimersByTimeAsync(AWAY_MS)
    const bars = p.runs[0].stopped
    doubles.scrollIntoViewAgain(p.el('#singCard'))
    click(p, '[data-line-play]')
    await p.finish()
    click(p, '[data-guide-start]')
    doubles.scrollOutOfView(p.el('#singCard'))
    await vi.advanceTimersByTimeAsync(AWAY_MS)

    // Assert (Lesson 3's rule)
    expect(bars).toBe(true)
    expect(p.runs[2].stopped).toBe(true)
    expect(shown(p, '[data-panel="feel"]')).toBe(false)
  })
})
