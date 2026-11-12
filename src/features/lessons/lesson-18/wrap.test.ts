// ============================================================
// Lesson 18 Wrap tests — the practice card, the tease still and free play
// ============================================================
//
// On the page's own markup (WEB-SPEC, Sections 8, Practice links and Toys
// 2 and 6; FACTS 5, 60): the practice card shows Sight-Singing's link and
// The Chart's, each in a new tab, and after "Effortful", "Uncomfortable"
// or "Just listen today" takes the rest form, Sight-Singing no longer a
// link and The Chart kept; the tease still is six pads numbered 1 to 6,
// nothing written, grouped or lit, aria-hidden, with no button. Free play,
// with the beat clock a recorder, shows every play from the steps at once,
// keeps Step 1's two reads under the lock line until the predict's choice
// or opens them for a learner who has done the lesson, plays a tune, and
// stops what it plays when the learner leaves it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { Done } from '@/features/lessons/kit/progress'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { Choice, resetChoice } from './choice'
import { initFreePlay } from './free-play'
import { el, loadPage, resetRuns, runs, soundOn, words, } from './page-dom.test-fixtures'
import { initWrap } from './wrap'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: () => null,
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))
vi.mock('@/lib/drum-voices', () => ({ triggerDrumVoice: () => undefined }))

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  resetChoice()
  soundOn()
  loadPage()
})

afterEach(() => {
  VisitEnding.set('practise')
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Shown: neither it nor any box around it hidden. */
function shown(e: Element): boolean {
  for (let n: Element | null = e; n; n = n.parentElement)
    if (n instanceof HTMLElement && n.hidden) return false
  return true
}

const card = () => el('#practiseCard')
const links = () =>
  Array.from(card().querySelectorAll<HTMLAnchorElement>('a'))
    .filter(shown)
    .map((a) => [a.getAttribute('href'), a.getAttribute('target')])

describe('the practice card', () => {
  it('links Sight-Singing and The Chart, each in a new tab', () => {
    // Act
    initWrap()

    // Assert (WEB-SPEC, Practice links)
    expect(links()).toEqual([
      ['/pitch-training?lesson=18', '_blank'],
      ['/ear-lab?lesson=18', '_blank'],
    ])
    expect(shown(el('#practiseCard [data-ending="rest"]'))).toBe(false)
  })

  it('takes the rest form after Effortful, Uncomfortable or Just listen today: Sight-Singing no longer a link, The Chart kept', () => {
    // Arrange
    initWrap()

    // Act
    VisitEnding.set('rest')

    // Assert (FACTS 60)
    expect(links()).toEqual([['/ear-lab?lesson=18', '_blank']])
    expect(words(el('#practiseCard [data-ending="rest"]'))).toBe(
      'Rest today. Sight-Singing will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Sight-Singing.',
    )
    expect(shown(el('#practiseCard [data-ending="rest"]'))).toBe(true)
    expect(words(card().querySelector('.eyebrow'))).toBe('Rest today')
  })
})

describe('the tease still', () => {
  it('draws six pads numbered 1 to 6, nothing written, grouped or lit, hidden from a screen reader, with no button', () => {
    // Act
    initWrap()

    // Assert (WEB-SPEC, Toys 6; FACTS 5)
    const tease = el('.l18-tease')
    expect(
      Array.from(tease.querySelectorAll('.rb-pad-n'), (n) => words(n)),
    ).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(tease.querySelectorAll('.rb-arc')).toHaveLength(0)
    expect(tease.querySelectorAll('.rb-sym:not(.is-hidden)')).toHaveLength(0)
    expect(tease.querySelectorAll('.is-now, .is-sounding')).toHaveLength(0)
    expect(tease.getAttribute('aria-hidden')).toBe('true')
    expect(
      tease.closest('[data-next-card]')?.querySelector('button'),
    ).toBeNull()
  })
})

describe('free play', () => {
  const play = (id: string) =>
    el<HTMLButtonElement>(`#freePlay [data-read-play="${id}"]`)

  it('shows every play from the steps at once, Step 1’s two reads locked under the lock line until the predict’s choice', () => {
    // Act
    initFreePlay()
    const before = [
      play('by-name').disabled,
      play('way').disabled,
      shown(el('#freePlay [data-read-lock]')),
    ]
    Choice.make()

    // Assert (WEB-SPEC, Toys 2, state 5)
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '#freePlay [data-read-play], #freePlay [data-read-mark]',
        ),
      )
        .filter(shown)
        .map((b) => b.dataset.readPlay ?? b.dataset.readMark),
    ).toEqual([
      'by-name',
      'way',
      'tune-a',
      'tune-b',
      'count-in',
      'dynamics',
      'hairpins',
      'staccato',
      'slur',
      'breath',
    ])
    expect(before).toEqual([true, true, true])
    expect([play('by-name').disabled, play('way').disabled]).toEqual([
      false,
      false,
    ])
    expect(shown(el('#freePlay [data-read-lock]'))).toBe(false)
    expect(document.querySelector('#freePlay [data-read-tap]')).toBeNull()
  })

  it('opens Step 1’s reads at once for a learner who has done the lesson, or who chose before it loaded', () => {
    // Arrange
    vi.spyOn(Done, 'has').mockImplementation((n) => n === 18)

    // Act
    initFreePlay()

    // Assert
    expect(play('by-name').disabled).toBe(false)
  })

  it('plays tune A, and stops what it plays when the learner leaves it', () => {
    // Arrange
    initFreePlay()
    play('tune-a').click()
    const run = runs[runs.length - 1]

    // Act
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    })

    // Assert
    expect(runs).toHaveLength(1)
    expect(run.stopped).toBe(true)
  })
})
