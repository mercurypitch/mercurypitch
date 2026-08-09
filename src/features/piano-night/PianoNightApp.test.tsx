// Piano Night shell tests protect truthful first paint and preview-only interaction.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoNightApp } from './PianoNightApp'

let originalAudioContext: typeof AudioContext
let originalRequestMidiAccess: Navigator['requestMIDIAccess']
let getUserMedia: ReturnType<typeof vi.spyOn>
let createAudioContext: ReturnType<typeof vi.fn>
let requestMidiAccess: ReturnType<typeof vi.fn>

beforeEach(() => {
  originalAudioContext = globalThis.AudioContext
  createAudioContext = vi.fn()
  globalThis.AudioContext = createAudioContext as unknown as typeof AudioContext

  originalRequestMidiAccess = navigator.requestMIDIAccess
  requestMidiAccess = vi.fn()
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: requestMidiAccess,
  })
  getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
})

afterEach(() => {
  cleanup()
  globalThis.AudioContext = originalAudioContext
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: originalRequestMidiAccess,
  })
  getUserMedia.mockRestore()
})

describe('PianoNightApp', () => {
  it('mounts a silent, honest Performance Horizon shell', () => {
    render(() => <PianoNightApp />)

    expect(screen.getByTestId('piano-night-shell')).toBeInTheDocument()
    expect(screen.getAllByText('Piano Night Preview').length).toBeGreaterThan(0)
    expect(
      screen.getByText('No project loaded · Nocturne Studio'),
    ).toBeVisible()
    expect(screen.getByText('Input off')).toBeVisible()
    expect(screen.getByText('Illustrative performance')).toBeVisible()

    const keyboard = screen.getByTestId('piano-night-keyboard')
    expect(keyboard).toHaveAccessibleName(/Illustrative 88-key piano keyboard/)
    expect(keyboard.querySelectorAll('i')).toHaveLength(88)

    expect(createAudioContext).not.toHaveBeenCalled()
    expect(requestMidiAccess).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('changes only visual preview state through the one transport owner', () => {
    render(() => <PianoNightApp />)

    const play = screen.getByTestId('piano-night-play')
    expect(play).toHaveAccessibleName('Play visual note preview')
    expect(play).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(play)
    expect(play).toHaveAccessibleName('Pause visual note preview')
    expect(play).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Visual note preview started. No audio is playing.',
    )
    expect(createAudioContext).not.toHaveBeenCalled()
  })

  it('projects Fall, Score, and Keys without replacing the staged session', () => {
    render(() => <PianoNightApp />)

    const view = screen.getByRole('button', {
      name: 'Change performance preview. Current view: Fall',
    })
    fireEvent.click(view)
    expect(screen.getByTestId('piano-night-score-view')).toBeInTheDocument()
    expect(screen.getByText('Illustrative notation')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change performance preview. Current view: Score',
      }),
    )
    expect(screen.getByTestId('piano-night-keys-view')).toBeInTheDocument()
    expect(screen.getByText('D minor over A')).toBeVisible()
  })

  it('opens one controls dialog and keeps the legacy runtime available', () => {
    render(() => <PianoNightApp />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open Piano Night controls' })[0],
    )
    const dialog = screen.getByRole('dialog', { name: 'Piano Night controls' })
    expect(dialog).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Open the current Piano tab/ }),
    ).toHaveAttribute('href', '/#/piano')

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toHaveAttribute('aria-hidden', 'true')
  })
})
