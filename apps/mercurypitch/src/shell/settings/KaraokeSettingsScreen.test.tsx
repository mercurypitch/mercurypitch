// ============================================================
// Settings, Karaoke: the room's settings, outside the room (S8 §9)
// ============================================================
//
// The same two settings the room's Options sheet holds, for a singer who
// looks for them in Settings: the lyrics size and the next song. One store
// behind both, so a change in either place is the change in the other.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { karaokeBackgroundPlay, karaokeLyricsSize, karaokePlayNext, resetKaraokeRoomForTests, setKaraokeLyricsSize, } from '@/features/karaoke-room/karaoke-room-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { KaraokeSettingsScreen } from './KaraokeSettingsScreen'

let view: RenderedShell | null = null

beforeEach(() => {
  localStorage.clear()
  resetKaraokeRoomForTests()
})

afterEach(() => {
  view?.unmount()
  view = null
})

const mount = (): HTMLElement => {
  view = renderShell(() => <KaraokeSettingsScreen />)
  return view.container
}

const choice = (root: HTMLElement, id: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-choice="${id}"]`)

describe('Settings, Karaoke', () => {
  it('offers the three lyrics sizes, with the one in force checked', () => {
    const root = mount()

    const group = root.querySelector('[role="radiogroup"]')
    expect(group?.getAttribute('aria-label')).toBe('Lyrics size')
    expect(
      [...root.querySelectorAll('[role="radio"]')].map(
        (radio) => radio.textContent,
      ),
    ).toEqual(['Small', 'Medium', 'Large'])
    expect(choice(root, 'current')?.getAttribute('aria-checked')).toBe('true')
    expect(choice(root, 'bigger')?.getAttribute('aria-checked')).toBe('false')
  })

  it('sets the lyrics size the room reads', () => {
    const root = mount()

    choice(root, 'smaller')?.click()

    expect(karaokeLyricsSize()).toBe('smaller')
    expect(choice(root, 'smaller')?.getAttribute('aria-checked')).toBe('true')
  })

  it('shows a size set in the room', () => {
    const root = mount()

    setKaraokeLyricsSize('bigger')

    expect(choice(root, 'bigger')?.getAttribute('aria-checked')).toBe('true')
  })

  it('says nothing of a subscription or imported songs in a build without Import', () => {
    const root = mount()

    expect(
      [...root.querySelectorAll('section')].map((group) =>
        group.getAttribute('aria-label'),
      ),
    ).toEqual(['Lyrics', 'Playback'])
    expect(root.textContent).not.toMatch(/subscri|import|songs left/iu)
  })

  it('turns the next song off and on', () => {
    const root = mount()
    const next = root.querySelector<HTMLElement>(
      '[role="switch"][aria-label="Play the next song automatically"]',
    )
    expect(next?.getAttribute('aria-checked')).toBe('true')

    next?.click()

    expect(karaokePlayNext()).toBe(false)
    expect(next?.getAttribute('aria-checked')).toBe('false')
  })

  it('keeps a song playing in the background until that is turned off', () => {
    const root = mount()
    const background = root.querySelector<HTMLElement>(
      '[role="switch"][aria-label="Keep playing in the background"]',
    )
    expect(background?.getAttribute('aria-checked')).toBe('true')

    background?.click()

    expect(karaokeBackgroundPlay()).toBe(false)
    expect(background?.getAttribute('aria-checked')).toBe('false')
  })
})
