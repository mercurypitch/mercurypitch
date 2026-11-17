// The key picker of Playback Setup: the twelve keys of the chosen scale
// type, and what picking one does on the Singing tab and on Compose.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlaybackSetupPanel } from '@/features/sidebar/panels/PlaybackSetupPanel'
import { SidebarHostProvider } from '@/features/sidebar/sidebar-host'
import { TAB_COMPOSE, TAB_SINGING } from '@/features/tabs/constants'
import { keyName, scaleType, setKeyName, setScaleType, } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import { setActiveTab } from '@/stores/ui-store'

const HOST = {
  onOctaveShift: () => {},
  onOpenScaleBuilder: () => {},
  noteList: {
    melody: () => [],
    currentNoteIndex: () => -1,
    noteResults: () => [],
    isPlaying: () => false,
  },
}

/** The panel, opened: it is folded until its header is pressed. */
function openPanel(): { key: HTMLSelectElement; scale: HTMLSelectElement } {
  const { container } = render(() => (
    <SidebarHostProvider host={HOST}>
      <PlaybackSetupPanel />
    </SidebarHostProvider>
  ))
  fireEvent.click(screen.getByText('Playback Setup'))
  return {
    key: container.querySelector<HTMLSelectElement>('#key-select')!,
    scale: container.querySelector<HTMLSelectElement>('#scale-select')!,
  }
}

const labels = (select: HTMLSelectElement): string =>
  [...select.options].map((option) => option.textContent).join(' ')

const melodyMidis = (): number[] =>
  melodyStore.getCurrentItems().map((item) => item.note.midi)

beforeEach(() => {
  localStorage.clear()
  melodyStore.setCurrentMelody(null)
  melodyStore.seedDefaultSession()
  setKeyName('C')
  setScaleType('major')
  setActiveTab(TAB_SINGING)
})

afterEach(() => {
  cleanup()
})

describe("Playback Setup's key picker", () => {
  it('lists the twelve major keys round the circle, flats by their real sign', () => {
    const { key } = openPanel()

    expect(labels(key)).toBe('C G D A E B F♯ F B♭ E♭ A♭ D♭')
    expect([...key.options].map((option) => option.value)).toEqual(
      'C G D A E B F# F Bb Eb Ab Db'.split(' '),
    )
  })

  it('lists their relative minors once a minor scale is chosen: A first, not C', () => {
    const { key, scale } = openPanel()

    fireEvent.change(scale, { target: { value: 'harmonic-minor' } })

    expect(labels(key)).toBe('A E B F♯ C♯ G♯ D♯ D G C F B♭')
  })

  it('keeps the same do under a minor scale, by its minor name', async () => {
    const { key, scale } = openPanel()
    fireEvent.change(key, { target: { value: 'Ab' } })

    fireEvent.change(scale, { target: { value: 'natural-minor' } })

    expect(keyName()).toBe('G#')
    await Promise.resolve()
    expect(key.value).toBe('G#')
    expect(key.selectedOptions[0].textContent).toBe('G♯')
  })

  it("shows an old melody's key by its name on the list", async () => {
    const { key } = openPanel()

    setKeyName('A#')

    await Promise.resolve()
    expect(key.selectedOptions[0].textContent).toBe('B♭')
  })

  it('leaves the melody where it is on the Singing tab: the key is how it is read', () => {
    const { key } = openPanel()
    const before = melodyMidis()

    fireEvent.change(key, { target: { value: 'Eb' } })

    expect([keyName(), scaleType()]).toEqual(['Eb', 'major'])
    expect(melodyMidis()).toEqual(before)
  })

  it('moves the melody by the gap between the two keys on Compose', () => {
    setActiveTab(TAB_COMPOSE)
    const { key } = openPanel()
    const before = melodyMidis()

    fireEvent.change(key, { target: { value: 'F#' } })

    expect(before.length).toBeGreaterThan(0)
    expect(melodyMidis()).toEqual(before.map((midi) => midi + 6))
  })
})
