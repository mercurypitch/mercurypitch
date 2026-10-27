// ============================================================
// Lesson 10 Sing it sweep tests — the count-in, the guide, the feelings, the Wrap's card
// ============================================================
//
// WEB-SPEC, Toys 6 states 5 and 6 and Tests 8's page half, on the page's
// own markup, each visit loaded afresh and its runs the kit's recorder
// (sing.test-fixtures.ts), on fake timers: Start the guide counts in on do
// where Move do left it, once and softly, at half a tapped note's level for
// 0.8 s, then 0.2 s of quiet, then sweeps for 10.0 s with Merc silent and
// the ring holding the still of the Merc last heard; "How did that feel?"
// follows each sweep that ends, asked afresh, under the kit's lock; Easy
// and Workable keep the guide, Effortful and Uncomfortable put it and Move
// do away for the visit, the doctor lines after Uncomfortable only, and
// Merc's notes still play at the last do; the keyboard's place is always
// text; and the Wrap's card the ending picks, in memory, never stored.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { COUNT_IN, COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import type * as RingModule from '@/features/lessons/kit/sing'
import type * as GuideModule from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { SING_LINES } from './lines'
import type { Step, Visit } from './sing.test-fixtures'
import { choose, closeSing, comfortStep, heardStep, hearMerc, lastRun, loadSing, offered, onCard, shows, status, voiceStep, } from './sing.test-fixtures'
import { AFTER, nextState, openState, STATUS } from './sing-flow'
import { BREATH_SEC, guidePath, guideRows, SING_SEC, singNotes, } from './sing-guide'

vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

// the kit's guide and ring as they are, each mount seen with its options
vi.mock('@/features/lessons/kit/slide-guide', async (actual) => {
  const real = await actual<typeof GuideModule>()
  return { ...real, mountGuide: vi.fn(real.mountGuide) }
})
vi.mock('@/features/lessons/kit/sing', async (actual) => {
  const real = await actual<typeof RingModule>()
  return { ...real, mountRing: vi.fn(real.mountRing) }
})

/** The count-in and the sweep, ms: the feeling question is asked once they have gone. */
const TURN_MS = (COUNT_IN_SEC + SING_SEC) * 1000

/** Sing it ready on fake timers: "I'm comfortable", a voice, and Merc's notes heard. */
async function ready(voice: Voice = 'lower'): Promise<Visit> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const p = await loadSing()
  choose(p, 'sing', voice)
  await hearMerc(p)
  return p
}

/** Start the guide pressed, and the count-in and the sweep run to their end. */
async function sweep(p: Visit): Promise<void> {
  p.el('[data-guide-start]').click()
  await vi.advanceTimersByTimeAsync(TURN_MS + 1)
}

/** A sweep run to its end, then `f` answered. */
async function sweepThenFeel(p: Visit, f: Feeling): Promise<void> {
  await sweep(p)
  p.el(`[data-feel="${f}"]`).click()
}

/** The count-in's note, as the kit plays it: one soft voice, which a test can see stopped. */
function countInVoice(p: Visit) {
  const stop = vi.fn()
  const voice = vi.spyOn(p.Sound, 'voice').mockReturnValue({
    alive: true,
    setFreq: () => undefined,
    setGain: () => undefined,
    stop,
  })
  return { voice, stop }
}

/** An element's words as one line, as the markup's wrapping leaves them. */
const words = (el: HTMLElement): string =>
  (el.textContent ?? '').replace(/\s+/g, ' ').trim()

const feelings = (): string[] =>
  Array.from(document.querySelectorAll('[data-feel]'), (b) =>
    String(b.getAttribute('aria-pressed')),
  )

afterEach(closeSing)

describe("Lesson 10's Sing it: the guide", () => {
  it("draws Merc's path on the rows from do to so with its breath mark 4.2 s in, and mounts the ring in its reduced-motion form", async () => {
    // Arrange, Act
    await loadSing()
    const { mountGuide } = await import('@/features/lessons/kit/slide-guide')
    const { mountRing } = await import('@/features/lessons/kit/sing')

    // Assert
    const [root, o] = vi.mocked(mountGuide).mock.calls.at(-1) ?? []
    expect(root?.id).toBe('chordGuide')
    expect(o).toMatchObject({
      rows: guideRows(52),
      path: guidePath(52),
      rest: 'amber',
      breaths: [BREATH_SEC],
    })
    expect(BREATH_SEC).toBeCloseTo(4.2, 9)
    expect(vi.mocked(mountRing).mock.calls.at(-1)?.[1]).toMatchObject({
      calm: true,
    })
  })

  it("counts in on do once, softly, at half a tapped note's level for 0.8 s, and asks how that felt only after 0.2 s of quiet and the 10.0 s sweep", async () => {
    // Arrange
    const p = await ready()
    const { voice } = countInVoice(p)

    // Act: Start the guide, then the clock to just before the sweep's end, then past it
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(TURN_MS - 10)
    const before = {
      asked: onCard(p, '[data-panel="feel"]'),
      line: status(p),
    }
    await vi.advanceTimersByTimeAsync(20)

    // Assert
    expect(voice).toHaveBeenCalledTimes(1)
    expect(voice).toHaveBeenCalledWith(hz(52), { dur: 0.8, gain: 0.065 })
    expect(COUNT_IN.gain).toBeCloseTo(0.13 / 2, 9)
    expect(COUNT_IN_SEC - COUNT_IN.note).toBeCloseTo(0.2, 9)
    expect(TURN_MS).toBeCloseTo(11000, 6)
    expect(before).toEqual({ asked: false, line: STATUS.guiding })
    expect(onCard(p, '[data-panel="feel"]')).toBe(true)
    expect(status(p)).toBe(STATUS.feel)
  })

  it.each([
    [2, 54],
    [-4, 48],
  ])(
    'counts in on do where Move do left it, %i semitones',
    async (shift, midi) => {
      // Arrange: Merc's notes heard, then do moved
      const p = await ready()
      const step = p.el(`[data-move-do="${Math.sign(shift)}"]`)
      for (let k = 0; k < Math.abs(shift); k++) step.click()
      const { voice } = countInVoice(p)

      // Act
      p.el('[data-guide-start]').click()

      // Assert
      expect(voice).toHaveBeenCalledWith(hz(midi), { dur: 0.8, gain: 0.065 })
    },
  )

  it("sings nothing of Merc's through the sweep, lights Start the guide, and holds the still of the Merc last heard in the ring", async () => {
    // Arrange: Merc heard, then the higher voice chosen
    const p = await ready('lower')
    p.el('[data-voice="higher"]').click()
    const runs = p.runs.length

    // Act
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(500)
    const counting = p.el('.ring-state').textContent
    await vi.advanceTimersByTimeAsync(4000)

    // Assert
    expect(p.runs).toHaveLength(runs)
    expect(p.el('[data-guide-start]').classList.contains('is-on')).toBe(true)
    expect(counting).toBe('Get ready')
    expect(p.el<HTMLImageElement>('.ring-merc').getAttribute('src')).toBe(
      'blue.png',
    )
    expect(status(p)).toBe(STATUS.guiding)
  })

  it('starts nothing at a press of Start the guide before Merc has been heard', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await loadSing()
    choose(p, 'sing', 'lower')
    const { voice } = countInVoice(p)

    // Act
    p.el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(TURN_MS + 1)

    // Assert
    expect(voice).not.toHaveBeenCalled()
    expect(onCard(p, '[data-panel="feel"]')).toBe(false)
    expect(status(p)).toBe(STATUS.first)
  })

  it('moves the keyboard to the question when a sweep ends, and to its line after an answer, never to a button', async () => {
    // Arrange
    const p = await ready()
    await sweep(p)
    const asked = document.activeElement

    // Act
    p.el('[data-feel="workable"]').click()

    // Assert
    expect(asked).toBe(p.el('.feel-q'))
    expect(document.activeElement).toBe(p.el('[data-after="moved"]'))
    expect(document.activeElement?.tagName).toBe('P')
  })
})

describe("Lesson 10's Sing it: how did that feel?", () => {
  it.each(['easy', 'workable'] as const)(
    '%s gives "Do-mi-so, then do-me-so: you just moved the third." and leaves the guide as it was',
    async (f) => {
      // Arrange
      const p = await ready()

      // Act
      await sweepThenFeel(p, f)

      // Assert
      expect(onCard(p, '[data-after="moved"]')).toBe(true)
      expect(words(p.el('[data-after="moved"]'))).toBe(SING_LINES.moved)
      expect(status(p)).toBe(AFTER.moved)
      expect(onCard(p, '[data-guide-start]')).toBe(true)
      expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
        'false',
      )
      expect(onCard(p, '.move-do')).toBe(true)
      expect(onCard(p, '[data-after-doctor]')).toBe(false)
      expect(p.VisitEnding.ending).toBe('practise')
    },
  )

  it.each([
    ['effortful', 'gentle', false],
    ['uncomfortable', 'enough', true],
  ] as const)(
    '%s gives its line, puts the guide and Move do away for the visit, and Merc still sings at the last do',
    async (f, after, doctor) => {
      // Arrange: do two lower, then a sweep run to its end
      const p = await ready()
      for (let k = 0; k < 2; k++) p.el('[data-move-do="-1"]').click()
      await sweep(p)

      // Act: the answer, then Merc's notes
      p.el(`[data-feel="${f}"]`).click()
      p.el('[data-notes-play]').click()

      // Assert
      expect(onCard(p, `[data-after="${after}"]`)).toBe(true)
      expect(words(p.el(`[data-after="${after}"]`))).toBe(SING_LINES[after])
      expect(onCard(p, '[data-after-doctor]')).toBe(doctor)
      for (const part of ['[data-guide-start]', '.move-do', '.turn'])
        expect(onCard(p, part)).toBe(false)
      expect(lastRun(p).notes).toEqual(singNotes(50))
      expect(p.VisitEnding.ending).toBe('rest')
    },
  )

  it('asks afresh after every sweep that ends, with no answer pressed', async () => {
    // Arrange: one sweep answered "Easy"
    const p = await ready()
    await sweepThenFeel(p, 'easy')

    // Act
    await sweep(p)

    // Assert
    expect(feelings()).toEqual(['false', 'false', 'false', 'false'])
    expect(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-feel]'),
        (b) => b.disabled,
      ),
    ).toEqual([false, false, false, false])
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-after]'),
        (el) => el.hidden,
      ),
    ).toEqual([true, true, true])
    expect(status(p)).toBe(STATUS.feel)
  })

  it('keeps the kit\'s lock: a later "Easy" after "Effortful" changes nothing, and the Wrap keeps the rest card', async () => {
    // Arrange
    const p = await ready()
    await sweepThenFeel(p, 'effortful')

    // Act
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(feelings()).toEqual(['false', 'false', 'true', 'false'])
    expect(p.el<HTMLButtonElement>('[data-feel="easy"]').disabled).toBe(true)
    expect(onCard(p, '[data-after="gentle"]')).toBe(true)
    expect(onCard(p, '[data-after="moved"]')).toBe(false)
    expect(p.VisitEnding.ending).toBe('rest')
  })
})

describe("Lesson 10's Sing it: the Wrap's card", () => {
  /** The Wrap's card, as a viewer reads it. */
  function wrapCard(p: Visit) {
    return {
      eyebrow: p.el('#practiseCard .eyebrow').textContent?.trim(),
      practise: onCard(p, '#practiseCard [data-ending="practise"]'),
      rest: onCard(p, '#practiseCard [data-ending="rest"]'),
      links: Array.from(
        document.querySelectorAll<HTMLAnchorElement>('#practiseCard a'),
      )
        .filter((a) => a.closest('[hidden]') === null)
        .map((a) => [a.getAttribute('href'), a.getAttribute('target')]),
    }
  }

  // after a rest answer nothing may send the learner to sing (REQ-GVC-055):
  // Stack, which needs no voice, is the card's one link
  const RESTED = {
    eyebrow: 'Rest today',
    practise: false,
    rest: true,
    links: [['/ear-lab?lesson=10', '_blank']],
  }

  it.each([
    [
      '"Just listen today"',
      async () => {
        const p = await loadSing()
        choose(p, 'listen', 'lower')
        return p
      },
    ],
    [
      '"Effortful"',
      async () => {
        const p = await ready()
        await sweepThenFeel(p, 'effortful')
        return p
      },
    ],
    [
      '"Uncomfortable"',
      async () => {
        const p = await ready()
        await sweepThenFeel(p, 'uncomfortable')
        return p
      },
    ],
  ])(
    'shows the rest card after %s, Drone Intonation for another day, its address in words alone, and Stack still offered',
    async (_, visit) => {
      // Arrange, Act
      const p = await visit()

      // Assert
      expect(wrapCard(p)).toEqual(RESTED)
      expect(words(p.el('#practiseCard [data-ending="rest"]'))).toContain(
        'Rest today. Drone Intonation will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Drone Intonation.',
      )
    },
  )

  it('keeps the practise card after "Easy", and opens the next visit on it again after "Effortful", storing no ending', async () => {
    // Arrange: a visit answered "Easy", then a visit answered "Effortful"
    const easy = await ready()
    await sweepThenFeel(easy, 'easy')
    const kept = wrapCard(easy)
    closeSing()
    const hard = await ready()
    await sweepThenFeel(hard, 'effortful')

    // Act: the next visit
    const p = await loadSing({ again: true })

    // Assert
    const practise = {
      eyebrow: 'Practise in MercuryPitch',
      practise: true,
      rest: false,
      links: [
        ['/pitch-training?lesson=10', '_blank'],
        ['/ear-lab?lesson=10', '_blank'],
      ],
    }
    expect(kept).toEqual(practise)
    expect(wrapCard(p)).toEqual(practise)
    expect(p.VisitEnding.ending).toBe('practise')
  })
})

describe("Lesson 10's Sing it: every state of a sweep", () => {
  /** Start the guide pressed, and the sweep 3 s in. */
  const startStep: Step = {
    act: async (p) => {
      p.el('[data-guide-start]').click()
      await vi.advanceTimersByTimeAsync(3000)
    },
    e: { type: 'sweepStart' },
  }
  /** The sweep running on to its end. */
  const endStep: Step = {
    act: async () => {
      await vi.advanceTimersByTimeAsync(TURN_MS)
    },
    e: { type: 'sweepEnd' },
  }
  const feelStep = (f: Feeling): Step => ({
    act: (p) => p.el(`[data-feel="${f}"]`).click(),
    e: { type: 'feel', feeling: f },
  })
  const singing = [comfortStep('sing'), voiceStep('lower'), heardStep(true)]

  it.each([
    ['a sweep running', [...singing, startStep]],
    ['a sweep ended', [...singing, startStep, endStep]],
    ['"Easy"', [...singing, startStep, endStep, feelStep('easy')]],
    [
      'a second sweep running after "Workable"',
      [...singing, startStep, endStep, feelStep('workable'), startStep],
    ],
    ['"Effortful"', [...singing, startStep, endStep, feelStep('effortful')]],
    [
      '"Uncomfortable"',
      [...singing, startStep, endStep, feelStep('uncomfortable')],
    ],
    [
      'Merc heard again after "Effortful"',
      [...singing, startStep, endStep, feelStep('effortful'), heardStep(true)],
    ],
  ])(
    'shows exactly what the flow offers, and its line, for %s',
    async (_, steps: readonly Step[]) => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const p = await loadSing()
      let s = openState(null)

      // Act
      for (const step of steps) {
        await step.act(p)
        s = nextState(s, step.e)
      }

      // Assert
      expect(shows(p)).toEqual(offered(s))
    },
  )
})
