// ============================================================
// Ear game tests — one answer a round, a miss heard again, the count at the end
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { EarGame, EarNote, EarRound } from './ear-game'
import { keyAnswer, mountEarGame, NEW_GAME, scoreAnswer, slowerBy, TRICKY, } from './ear-game'

type Answer = 'step' | 'leap'

const pair = (a: number, b: number): EarNote[] => [
  { midi: a, at: 0, dur: 0.6 },
  { midi: b, at: 0.6, dur: 0.8 },
]

const ROUNDS: readonly EarRound<Answer>[] = [
  { events: pair(60, 62), answer: 'step', words: 'A step: 2 semitones up.' },
  { events: pair(60, 67), answer: 'leap', words: 'A leap: 7 semitones up.' },
  { events: pair(64, 63), answer: 'step', words: 'A step: 1 semitone down.' },
]

/** A game's card: its round line, its Play button, two answers and the feedback line. */
function gameCard(): HTMLElement {
  const root = document.createElement('section')
  root.tabIndex = -1
  root.innerHTML = `<p data-eg-round>Three rounds</p><button type="button" data-eg-play><span>Play a pair</span></button><button type="button" data-eg-answer="step" aria-disabled="true">Step</button><button type="button" data-eg-answer="leap" aria-disabled="true">Leap</button><p data-eg-feedback aria-live="polite"></p>`
  document.body.appendChild(root)
  return root
}

interface Harness {
  readonly root: HTMLElement
  readonly game: EarGame
  /** Every sound the game asked for, in order. */
  readonly played: EarNote[][]
  /** How many sounds the game has stopped. */
  stops(): number
  /** How many runs have taken a seed. */
  seeds(): number
}

/** A game whose sounds end at once, or, `held`, only when stopped. */
function mount(held = false): Harness {
  const root = gameCard()
  const played: EarNote[][] = []
  let stops = 0
  let seeds = 0
  const game = mountEarGame<Answer>(root, {
    answers: ['step', 'leap'],
    deal: () => ROUNDS,
    play: (events) => {
      played.push([...events])
      let end: () => void = () => undefined
      const done = held
        ? new Promise<void>((resolve) => {
            end = resolve
          })
        : Promise.resolve()
      return {
        done,
        stop: () => {
          stops += 1
          end()
        },
      }
    },
    slower: 1.5,
    labels: {
      start: 'Play a pair',
      again: 'Play it again',
      next: 'Next round',
      more: 'Play three more',
    },
    seed: () => {
      seeds += 1
      return seeds
    },
  })
  return { root, game, played, stops: () => stops, seeds: () => seeds }
}

const el = (root: HTMLElement, selector: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}
const playBtn = (root: HTMLElement): HTMLElement => el(root, '[data-eg-play]')
const answerBtn = (root: HTMLElement, a: Answer): HTMLElement =>
  el(root, `[data-eg-answer="${a}"]`)
const text = (root: HTMLElement, selector: string): string =>
  el(root, selector).textContent ?? ''
/** Presses a key on `target`; the event, to read whether the game kept it. */
const key = (target: HTMLElement, k: string, code = ''): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: k,
    code,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

/** Plays every round of a game, answering each one with `answers[i]`. */
function playThrough(root: HTMLElement, answers: readonly Answer[]): void {
  for (const a of answers) {
    playBtn(root).click()
    answerBtn(root, a).click()
  }
}

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('scoreAnswer', () => {
  it('counts a right answer and forgets the misses before it', () => {
    // Arrange
    const missed = scoreAnswer(NEW_GAME, false).score

    // Act
    const { score, tricky } = scoreAnswer(missed, true)

    // Assert
    expect(score.heard).toBe(1)
    expect(score.missesInARow).toBe(0)
    expect(tricky).toBe(false)
  })

  it('earns the tricky line on a second miss in a row, and only once a game', () => {
    // Arrange
    const one = scoreAnswer(NEW_GAME, false)
    const two = scoreAnswer(one.score, false)

    // Act
    const three = scoreAnswer(two.score, false)

    // Assert
    expect(one.tricky).toBe(false)
    expect(two.tricky).toBe(true)
    expect(three.tricky).toBe(false)
    expect(three.score.missesInARow).toBe(3)
  })
})

describe('keyAnswer', () => {
  it('maps the number keys 1 to N onto the answers in order, and nothing else', () => {
    const answers = ['m2', 'M2', 'P4', 'P5'] as const
    expect(keyAnswer('1', answers)).toBe('m2')
    expect(keyAnswer('4', answers)).toBe('P5')
    for (const k of ['0', '5', 'a', ' ', '1.5', ''])
      expect(keyAnswer(k, answers)).toBeNull()
  })
})

describe('slowerBy', () => {
  it('stretches every onset and every length by the same factor', () => {
    expect(slowerBy(pair(60, 67), 2)).toEqual([
      { midi: 60, at: 0, dur: 1.2 },
      { midi: 67, at: 1.2, dur: 1.6 },
    ])
  })
})

describe('mountEarGame', () => {
  it('takes no answer before the first round has played', () => {
    // Arrange
    const { root } = mount()

    // Act
    answerBtn(root, 'step').click()

    // Assert
    expect(text(root, '[data-eg-feedback]')).toBe('')
    expect(answerBtn(root, 'step').getAttribute('aria-disabled')).toBe('true')
    expect(text(root, '[data-eg-play]')).toBe('Play a pair')
  })

  it("plays a round's pair, numbers the round and opens the answers", () => {
    // Arrange
    const { root, played } = mount()

    // Act
    playBtn(root).click()

    // Assert
    expect(played).toEqual([ROUNDS[0].events])
    expect(text(root, '[data-eg-round]')).toBe('Round 1 of 3')
    expect(text(root, '[data-eg-play]')).toBe('Play it again')
    expect(answerBtn(root, 'leap').getAttribute('aria-disabled')).toBe('false')
  })

  it('plays the same pair again, not the next one, while the round waits for an answer', () => {
    // Arrange
    const { root, played } = mount()
    playBtn(root).click()

    // Act
    playBtn(root).click()

    // Assert
    expect(played).toEqual([ROUNDS[0].events, ROUNDS[0].events])
    expect(text(root, '[data-eg-round]')).toBe('Round 1 of 3')
  })

  it('says what a right answer heard, marks it and closes the round', () => {
    // Arrange
    const { root } = mount()
    playBtn(root).click()

    // Act
    answerBtn(root, 'step').click()

    // Assert
    expect(text(root, '[data-eg-feedback]')).toBe(
      'Yes. A step: 2 semitones up.',
    )
    expect(answerBtn(root, 'step').classList.contains('right')).toBe(true)
    expect(answerBtn(root, 'step').classList.contains('picked')).toBe(true)
    expect(answerBtn(root, 'leap').getAttribute('aria-disabled')).toBe('true')
    expect(text(root, '[data-eg-play]')).toBe('Next round')
  })

  it('marks the right answer after a miss and plays the pair again, slower, once its line is said', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { root, played } = mount()
    playBtn(root).click()
    answerBtn(root, 'leap').click()
    vi.advanceTimersByTime(699)
    const early = played.length

    // Act
    vi.advanceTimersByTime(1)

    // Assert
    expect(early).toBe(1)
    expect(played[1]).toEqual(slowerBy(ROUNDS[0].events, 1.5))
    expect(text(root, '[data-eg-feedback]')).toBe(
      'Here it is again, slower. A step: 2 semitones up.',
    )
    expect(answerBtn(root, 'step').classList.contains('right')).toBe(true)
    expect(answerBtn(root, 'leap').classList.contains('picked')).toBe(true)
  })

  it('does not ask a missed round again: Next moves on to the next round', () => {
    // Arrange
    const { root, played } = mount()
    playBtn(root).click()
    answerBtn(root, 'leap').click()

    // Act
    playBtn(root).click()

    // Assert
    expect(text(root, '[data-eg-round]')).toBe('Round 2 of 3')
    expect(played.at(-1)).toEqual(ROUNDS[1].events)
    expect(answerBtn(root, 'step').classList.contains('right')).toBe(false)
  })

  it('says the tricky line after two misses in a row', () => {
    // Arrange
    const { root } = mount()
    playThrough(root, ['leap'])
    playBtn(root).click()

    // Act
    answerBtn(root, 'step').click()

    // Assert
    expect(el(root, '[data-eg-feedback]').innerHTML).toBe(
      `Here it is again, slower. A leap: 7 semitones up.<br>${TRICKY}`,
    )
  })

  it('ends on the count of rounds answered right, and nothing else', () => {
    // Arrange
    const { root } = mount()
    playThrough(root, ['step', 'step'])
    playBtn(root).click()

    // Act
    answerBtn(root, 'step').click()

    // Assert
    expect(text(root, '[data-eg-round]')).toBe('2 of 3')
    expect(el(root, '[data-eg-feedback] b').textContent).toBe('2 of 3')
    expect(text(root, '[data-eg-play]')).toBe('Play three more')
  })

  it('starts a new run on a fresh seed once a game is over', () => {
    // Arrange
    const { root, seeds } = mount()
    playThrough(root, ['step', 'leap', 'step'])
    const before = seeds()

    // Act
    playBtn(root).click()

    // Assert
    expect(before).toBe(1)
    expect(seeds()).toBe(2)
    expect(text(root, '[data-eg-round]')).toBe('Round 1 of 3')
    expect(text(root, '[data-eg-feedback]')).toBe('')
  })

  it('answers with the number keys while the card has focus', () => {
    // Arrange
    const { root } = mount()
    playBtn(root).click()

    // Act
    key(root, '2')

    // Assert
    expect(answerBtn(root, 'leap').classList.contains('picked')).toBe(true)
  })

  it('plays the pair again on Space while the card itself has focus', () => {
    // Arrange
    const { root, played } = mount()
    playBtn(root).click()

    // Act
    const event = key(root, ' ', 'Space')

    // Assert
    expect(event.defaultPrevented).toBe(true)
    expect(played).toEqual([ROUNDS[0].events, ROUNDS[0].events])
  })

  it('leaves Space on a focused button to the button, so it never replays by accident', () => {
    // Arrange
    const { root, played } = mount()
    playBtn(root).click()

    // Act
    const event = key(answerBtn(root, 'leap'), ' ', 'Space')

    // Assert
    expect(event.defaultPrevented).toBe(false)
    expect(played).toHaveLength(1)
  })

  it('leaves a key with a modifier to the browser', () => {
    // Arrange
    const { root } = mount()
    playBtn(root).click()
    const event = new KeyboardEvent('keydown', {
      key: '1',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })

    // Act
    root.dispatchEvent(event)

    // Assert
    expect(event.defaultPrevented).toBe(false)
    expect(text(root, '[data-eg-feedback]')).toBe('')
  })
})

describe('mountEarGame: stop', () => {
  it('stops the pair it is playing and puts out its Play button', () => {
    // Arrange
    const { root, game, stops } = mount(true)
    playBtn(root).click()
    const lit = playBtn(root).classList.contains('is-on')

    // Act
    game.stop()

    // Assert
    expect(lit).toBe(true)
    expect(stops()).toBe(1)
    expect(playBtn(root).classList.contains('is-on')).toBe(false)
  })

  it("cancels a miss's slower replay that is still to come", () => {
    // Arrange: a miss, 300 ms into the 700 ms before its replay
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { root, game, played } = mount()
    playBtn(root).click()
    answerBtn(root, 'leap').click()
    vi.advanceTimersByTime(300)

    // Act
    game.stop()
    vi.advanceTimersByTime(5000)

    // Assert
    expect(played).toEqual([ROUNDS[0].events])
  })
})
