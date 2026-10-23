// ============================================================
// Lesson predict tests — a guess first, and a reveal only once it is heard
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { ANNOUNCE_DELAY_MS } from './announce'
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

  it('enables the controls elsewhere that it unlocks only on the choice, and tells the page the choice', () => {
    // Arrange: a stage's row that would answer the question if it played first
    const root = predictRoot()
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button type="button" id="stagePlay" disabled>Play</button><button type="button" id="stageRock" disabled>Rock</button>',
    )
    const stage = [
      ...document.querySelectorAll<HTMLButtonElement>('#stagePlay, #stageRock'),
    ]
    const chosen: string[] = []
    mountPredict(root, {
      play: () => Promise.resolve(true),
      hints: HINTS,
      unlocks: stage,
      onChoice: (c) => chosen.push(c),
    })

    // Act: a free play before the choice
    click(root, '[data-play="one"]')

    // Assert: disabled, so out of the tab order, and never aria-disabled
    expect(stage.every((b) => b.disabled)).toBe(true)
    expect(stage.some((b) => b.hasAttribute('aria-disabled'))).toBe(false)
    expect(chosen).toEqual([])

    // Act
    click(root, '[data-choice="same"]')

    // Assert
    expect(stage.every((b) => !b.disabled)).toBe(true)
    expect(stage.some((b) => b.hasAttribute('aria-disabled'))).toBe(false)
    expect(chosen).toEqual(['same'])
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

  it('speaks the reveal through the page status line, and drops its own live region', async () => {
    // Arrange: a reveal that starts hidden as a live region, as the pages ship it
    document.body.innerHTML = '<main></main>'
    const root = predictRoot()
    reveal(root)?.setAttribute('aria-live', 'polite')
    mount(root)
    click(root, '[data-choice="lower"]')

    // Act
    click(root, '[data-play="both"]')
    await settle()
    await new Promise((r) => setTimeout(r, ANNOUNCE_DELAY_MS + 10))

    // Assert: said once, where the screen reader already listens; focus stays on the play
    expect(reveal(root)?.hasAttribute('aria-live')).toBe(false)
    expect(document.querySelector('[data-announcer]')?.textContent).toBe(
      'You said: lower',
    )
    expect(document.activeElement).toBe(both(root))
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

  it('reveals nothing after a play cut short, which resolves false, and reveals once a play is heard to its end', async () => {
    // Arrange: the first play is stopped before its end, the second is not
    const root = predictRoot()
    const ends = [false, true]
    mountPredict(root, {
      play: () => Promise.resolve(ends.shift() ?? true),
      hints: HINTS,
    })
    click(root, '[data-choice="same"]')

    // Act
    click(root, '[data-play="both"]')
    await settle()
    const cut = {
      hidden: reveal(root)?.hidden,
      hint: root.querySelector('.lock-hint')?.textContent,
    }
    click(root, '[data-play="both"]')
    await settle()

    // Assert
    expect(cut).toEqual({ hidden: true, hint: HINTS.chosen })
    expect(reveal(root)?.hidden).toBe(false)
  })

  it('reveals after a play that resolves nothing, as the lessons before Lesson 6 play, as after one that resolves true', async () => {
    // Arrange
    const quiet = predictRoot()
    const told = predictRoot()
    mountPredict(quiet, { play: () => Promise.resolve(), hints: HINTS })
    mountPredict(told, { play: () => Promise.resolve(true), hints: HINTS })
    for (const root of [quiet, told]) click(root, '[data-choice="lower"]')

    // Act
    for (const root of [quiet, told]) click(root, '[data-play="both"]')
    await settle()

    // Assert
    expect(reveal(quiet)?.hidden).toBe(false)
    expect(reveal(told)?.hidden).toBe(false)
  })

  it('asks for a choice again when a free example is heard after sound off kept it silent', async () => {
    // Arrange: the page's hint asks for a choice; the free example plays with sound off
    document.body.innerHTML =
      '<div id="toast"><span id="toastText"></span><button id="toastBtn" hidden></button></div>'
    const root = predictRoot()
    const hint = root.querySelector('.lock-hint')
    if (hint !== null)
      hint.textContent = 'Choose an answer to unlock the play buttons.'
    mount(root)
    Sound.set('off')
    click(root, '[data-play="one"]')
    await settle()
    expect(hint?.textContent).toBe(HINTS.silent)
    Sound.set('on')

    // Act
    click(root, '[data-play="one"]')
    await settle()

    // Assert
    expect(hint?.textContent).toBe(
      'Choose an answer to unlock the play buttons.',
    )
    expect(reveal(root)?.hidden).toBe(true)
  })

  it('after a choice, a heard play that does not reveal takes the place of the sound-off hint', async () => {
    // Arrange: a choice, then the answer played with sound off
    document.body.innerHTML =
      '<div id="toast"><span id="toastText"></span><button id="toastBtn" hidden></button></div>'
    const root = predictRoot()
    mount(root)
    click(root, '[data-choice="same"]')
    Sound.set('off')
    click(root, '[data-play="both"]')
    await settle()
    expect(root.querySelector('.lock-hint')?.textContent).toBe(HINTS.silent)
    Sound.set('on')

    // Act: the free example, which answers nothing
    click(root, '[data-play="one"]')
    await settle()

    // Assert
    expect(root.querySelector('.lock-hint')?.textContent).toBe(HINTS.chosen)
    expect(reveal(root)?.hidden).toBe(true)
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
