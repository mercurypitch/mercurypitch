// ============================================================
// Settings, Karaoke: the room's settings, outside the room (S8 §9)
// ============================================================
//
// The same two settings the room's Options sheet holds, for a singer who
// looks for them in Settings: the lyrics size and the next song. One store
// behind both, so a change in either place is the change in the other. And
// the two that live here only: background play, and the lyrics window that
// Android alone is offered.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { karaokeBackgroundPlay, karaokeLyricsSize, karaokePictureInPicture, karaokePlayNext, resetKaraokeRoomForTests, setKaraokeLyricsSize, } from '@/features/karaoke-room/karaoke-room-store'
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

const mount = (platform?: string): HTMLElement => {
  view = renderShell(() => <KaraokeSettingsScreen platform={platform} />)
  return view.container
}

const WINDOW_SWITCH =
  '[role="switch"][aria-label="Show lyrics in a small window"]'

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

  it('offers the lyrics window on Android, on until it is turned off', () => {
    const root = mount('android')
    const lyricsWindow = root.querySelector<HTMLElement>(WINDOW_SWITCH)
    expect(lyricsWindow?.getAttribute('aria-checked')).toBe('true')
    expect(root.textContent).toContain(
      'When you leave the app during a song, the lyrics stay in a corner of the screen',
    )

    lyricsWindow?.click()

    expect(karaokePictureInPicture()).toBe(false)
    expect(lyricsWindow?.getAttribute('aria-checked')).toBe('false')
  })

  it('does not offer the lyrics window on iOS, or on the web', () => {
    expect(mount('ios').querySelector(WINDOW_SWITCH)).toBeNull()
    view?.unmount()

    expect(mount().querySelector(WINDOW_SWITCH)).toBeNull()
  })
})
