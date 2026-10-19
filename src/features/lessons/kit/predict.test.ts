// ============================================================
// Lesson predict tests — a guess first, and a reveal only once it is heard
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import type { PredictOptions } from './predict'
import { mountPredict } from './predict'
import { Sound } from './sound'

const HINTS = {
  chosen: 'Now play it',
  silent: 'Sound is off, so nothing was heard yet',
  again: 'Play it again whenever you like',
}

/** A predict's markup: three choices, a free example, the answering play, the hint and the reveal. */
function predictRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<button type="button" class="choice" data-choice="higher">Higher</button><button type="button" class="choice" data-choice="same">The same</button><button type="button" class="choice" data-choice="lower">Lower</button><button type="button" data-play="one" data-free>One note</button><button type="button" data-play="both" disabled>Both</button><p class="lock-hint"></p><div class="reveal" hidden><p class="mono"></p></div>`
  document.body.appendChild(root)
  return root
}

function mount(root: HTMLElement, played: string[] = []): void {
  const opts: PredictOptions = {
    play: (what) => {
      played.push(what)
      return Promise.resolve()
    },
    hints: HINTS,
    guess: (choice) => `You said: ${choice}`,
  }
  mountPredict(root, opts)
}

function click(root: HTMLElement, selector: string): void {
  root.querySelector<HTMLButtonElement>(selector)?.click()
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const reveal = (root: HTMLElement): HTMLElement | null =>
  root.querySelector('.reveal')
const both = (root: HTMLElement): HTMLButtonElement | null =>
  root.querySelector('[data-play="both"]')

afterEach(() => {
  Sound.set('unset')
  document.body.textContent = ''
})

describe('mountPredict', () => {
  it('unlocks only its own copy when a choice locks in', () => {
    // Arrange
    const a = predictRoot()
    const b = predictRoot()
    mount(a)
    mount(b)

    // Act
    click(a, '[data-choice="higher"]')

    // Assert
    expect(both(a)?.disabled).toBe(false)
    expect(
      a.querySelector('[data-choice="lower"]')?.hasAttribute('disabled'),
    ).toBe(true)
    expect(both(b)?.disabled).toBe(true)
    expect(
      b.querySelector('[data-choice="lower"]')?.hasAttribute('disabled'),
    ).toBe(false)
  })

  it('reveals only the copy whose answering sound was heard, saying what was chosen', async () => {
    // Arrange
    const a = predictRoot()
    const b = predictRoot()
    mount(a)
    mount(b)
    click(a, '[data-choice="lower"]')
    click(b, '[data-choice="higher"]')

    // Act
    click(a, '[data-play="both"]')
    await settle()

    // Assert
    expect(reveal(a)?.hidden).toBe(false)
    expect(a.querySelector('.reveal .mono')?.textContent).toBe(
      'You said: lower',
    )
    expect(a.querySelector('.lock-hint')?.textContent).toBe(HINTS.again)
    expect(reveal(b)?.hidden).toBe(true)
  })

  it('keeps the reveal back after a play that sound off kept silent', async () => {
    // Arrange: sound off says so in the toast
    document.body.innerHTML =
      '<div id="toast"><span id="toastText"></span><button id="toastBtn" hidden></button></div>'
    Sound.set('off')
    const root = predictRoot()
    mount(root)
    click(root, '[data-choice="same"]')

    // Act
    click(root, '[data-play="both"]')
    await settle()

    // Assert
    expect(reveal(root)?.hidden).toBe(true)
    expect(root.querySelector('.lock-hint')?.textContent).toBe(HINTS.silent)
  })

  it('waits for both answering sounds when the reveal compares two of them', async () => {
    // Arrange: Lesson 2's step 3, B to C and C to D, each with its own button
    const root = document.createElement('div')
    root.innerHTML = `<button type="button" class="choice" data-choice="same">The same</button><button type="button" data-play="bc" disabled>B to C</button><button type="button" data-play="cd" disabled>C to D</button><p class="lock-hint"></p><div class="reveal" hidden><p class="mono"></p></div>`
    document.body.appendChild(root)
    mountPredict(root, {
      play: () => Promise.resolve(),
      hints: { ...HINTS, next: 'Now the other one' },
      revealOn: ['bc', 'cd'],
      revealAfter: 'all',
    })
    click(root, '[data-choice="same"]')

    // Act
    click(root, '[data-play="bc"]')
    await settle()
    const afterOne = reveal(root)?.hidden
    const hintAfterOne = root.querySelector('.lock-hint')?.textContent
    click(root, '[data-play="cd"]')
    await settle()

    // Assert
    expect(afterOne).toBe(true)
    expect(hintAfterOne).toBe('Now the other one')
    expect(reveal(root)?.hidden).toBe(false)
  })

  it('lets a free example play before a choice, and never reveals with it', async () => {
    // Arrange
    const root = predictRoot()
    const played: string[] = []
    mount(root, played)

    // Act
    click(root, '[data-play="one"]')
    await settle()

    // Assert
    expect(played).toEqual(['one'])
    expect(reveal(root)?.hidden).toBe(true)
    expect(both(root)?.disabled).toBe(true)
  })
})
