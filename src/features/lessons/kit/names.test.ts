// ============================================================
// Lesson names tests — one page-wide choice, every toggle showing it
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { bindModeToggle, createModeStore, Names, namesFor, rareName, spokenNames, } from './names'
import { signName } from './notes'

const toggle = (id: string): HTMLElement => {
  const root = document.createElement('div')
  root.id = id
  root.innerHTML =
    '<button type="button" data-mode="sharps">Sharps</button><button type="button" data-mode="flats">Flats</button><button type="button" data-mode="both">Both</button>'
  document.body.appendChild(root)
  return root
}
const pressed = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('button'))
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.dataset.mode ?? '')

afterEach(() => {
  Names.set('sharps')
  document.body.textContent = ''
})

describe('Names', () => {
  it('opens on Sharps, as the app pitch line names the black keys', () => {
    // Act
    const mode = Names.mode

    // Assert
    expect(mode).toBe('sharps')
  })

  it('lets two toggles write one choice and both show it', () => {
    // Arrange
    const step = toggle('step5')
    const play = toggle('freePlay')
    bindModeToggle(step, Names)
    bindModeToggle(play, Names)

    // Act
    play.querySelector<HTMLButtonElement>('[data-mode="both"]')?.click()

    // Assert
    expect(Names.mode).toBe('both')
    expect(pressed(step)).toEqual(['both'])
    expect(pressed(play)).toEqual(['both'])
  })

  it('tells every subscriber of a change and stops after unsubscribing', () => {
    // Arrange
    const heard: string[] = []
    const stop = Names.subscribe((m) => heard.push(m))

    // Act
    Names.set('flats')
    stop()
    Names.set('both')

    // Assert: the current choice on subscribing, then the one change
    expect(heard).toEqual(['sharps', 'flats'])
  })
})

describe('createModeStore', () => {
  it('keeps another page-wide choice the same way and ignores a mode it does not offer', () => {
    // Arrange
    const syllables = createModeStore(
      ['letters', 'numbers', 'solfege'],
      'letters',
    )

    // Act
    syllables.set('solfege')
    syllables.set('runes' as 'letters')

    // Assert
    expect(syllables.mode).toBe('solfege')
  })
})

describe('namesFor', () => {
  it("names a black key by the page's choice, the sharp first in Both", () => {
    // Act
    const names = (['sharps', 'flats', 'both'] as const).map((mode) =>
      namesFor(61, mode).map((s) => signName(s)),
    )

    // Assert
    expect(names).toEqual([['C♯4'], ['D♭4'], ['C♯4', 'D♭4']])
  })

  it('leaves a white key its own letter in every mode', () => {
    // Act
    const names = (['sharps', 'flats', 'both'] as const).map((mode) =>
      namesFor(64, mode).map((s) => signName(s)),
    )

    // Assert
    expect(names).toEqual([['E4'], ['E4'], ['E4']])
  })

  it('reads the page-wide choice when it is given none', () => {
    // Arrange
    Names.set('flats')

    // Act
    const name = namesFor(70).map((s) => signName(s))

    // Assert
    expect(name).toEqual(['B♭4'])
  })
})

describe('spokenNames', () => {
  it('says both names of a key in words, as its accessible name', () => {
    // Act
    const both = spokenNames(61, 'both')
    const sharp = spokenNames(61, 'sharps')

    // Assert
    expect(both).toBe('C sharp 4, also D flat 4')
    expect(sharp).toBe('C sharp 4')
  })
})

describe('rareName', () => {
  it('gives the four white keys their second names and no other note one', () => {
    // Act
    const rare = [60, 64, 65, 71].map((m) => {
      const r = rareName(m)
      return r === null ? null : signName(r)
    })
    const none = [62, 67, 69, 61].map((m) => rareName(m))

    // Assert
    expect(rare).toEqual(['B♯3', 'F♭4', 'E♯4', 'C♭5'])
    expect(none).toEqual([null, null, null, null])
  })
})
