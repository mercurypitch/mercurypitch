// ============================================================
// Drum Night app tests — silent entry and visual-only interactions
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrumNightApp } from './DrumNightApp'

let createAudioContext: ReturnType<typeof vi.fn>
let createWorker: ReturnType<typeof vi.fn>
let requestMidiAccess: ReturnType<typeof vi.fn>
let getUserMedia: ReturnType<typeof vi.fn>
let originalRequestMidiAccess: PropertyDescriptor | undefined
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia

beforeEach(() => {
  window.history.replaceState({}, '', '/drum-night')
  createAudioContext = vi.fn()
  createWorker = vi.fn()
  requestMidiAccess = vi.fn()
  getUserMedia = vi.fn()
  vi.stubGlobal('AudioContext', createAudioContext)
  vi.stubGlobal('Worker', createWorker)

  originalRequestMidiAccess = Object.getOwnPropertyDescriptor(
    navigator,
    'requestMIDIAccess',
  )
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: requestMidiAccess,
  })
  originalGetUserMedia = navigator.mediaDevices.getUserMedia
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: getUserMedia,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalRequestMidiAccess === undefined) {
    Reflect.deleteProperty(navigator, 'requestMIDIAccess')
  } else {
    Object.defineProperty(
      navigator,
      'requestMIDIAccess',
      originalRequestMidiAccess,
    )
  }
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: originalGetUserMedia,
  })
})

function expectSilentBrowserBoundary(): void {
  expect(createAudioContext).not.toHaveBeenCalled()
  expect(createWorker).not.toHaveBeenCalled()
  expect(requestMidiAccess).not.toHaveBeenCalled()
  expect(getUserMedia).not.toHaveBeenCalled()
}

describe('DrumNightApp', () => {
  it('mounts the Pocket Console without audio, input, or model work', () => {
    render(() => <DrumNightApp />)

    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-view',
      'pocket',
    )
    expect(screen.getByTestId('drum-night-pocket-view')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Synthetic preview ready. Audio and input are off.',
    )
    expect(
      screen.getByRole('button', { name: /MIDI not connected/i }),
    ).toBeVisible()
    expectSilentBrowserBoundary()
  })

  it('keeps view and drawer state shareable while restoring focus', async () => {
    render(() => <DrumNightApp />)

    const viewSwitcher = screen.getByRole('group', { name: 'Drum view' })
    fireEvent.click(within(viewSwitcher).getByRole('button', { name: 'Score' }))
    expect(screen.getByTestId('drum-night-score-view')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=score')

    const grooveButton = screen.getAllByRole('button', { name: 'Groove' })[0]
    grooveButton.focus()
    fireEvent.click(grooveButton)
    const drawer = screen.getByRole('dialog')
    expect(drawer).toHaveAttribute('aria-hidden', 'false')
    expect(window.location.search).toContain('drawer=groove')

    await waitFor(() =>
      expect(within(drawer).getByRole('tab', { name: 'Groove' })).toHaveFocus(),
    )
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(grooveButton).toHaveFocus())
    expect(window.location.search).toBe('?view=score')
    expectSilentBrowserBoundary()
  })

  it('visualises pointer and keyboard actions without pretending to play audio', () => {
    render(() => <DrumNightApp />)

    const viewSwitcher = screen.getByRole('group', { name: 'Drum view' })
    fireEvent.click(within(viewSwitcher).getByRole('button', { name: 'Kit' }))
    const kit = screen.getByTestId('drum-night-kit-view')
    fireEvent.pointerDown(
      within(kit).getByRole('button', { name: 'Snare, key 2' }),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Snare visualised. No soundbank is loaded in this preview.',
    )

    fireEvent.keyDown(document, { code: 'Space' })
    expect(
      screen.getAllByRole('button', { name: 'Pause Midnight Pocket' }),
    ).not.toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Visual count-in started. This preview does not load a soundbank.',
    )
    expectSilentBrowserBoundary()
  })
})
