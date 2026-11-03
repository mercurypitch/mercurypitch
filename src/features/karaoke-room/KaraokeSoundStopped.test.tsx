// ============================================================
// KaraokeSoundStopped: the room says why its song stopped by itself
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { KaraokeSoundStopped } from './KaraokeSoundStopped'

/** The part of the mixer the notice reads: whether it stalled, and play. */
function mixer() {
  const [stalled, setStalled] = createSignal(false)
  const play = vi.fn(() => setStalled(false))
  const controls = { stalled, play } as unknown as HostedMixerControls
  return { controls, setStalled, play }
}

beforeEach(() => {
  setAudioRouteForTests('speaker', 'Speaker')
})

afterEach(() => {
  cleanup()
  setAudioRouteForTests(null)
})

describe('KaraokeSoundStopped', () => {
  it('shows nothing while the song is fine, its status region waiting', () => {
    const m = mixer()

    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('names the receiver the sound went to over AirPlay, with no Play again', () => {
    setAudioRouteForTests('airplay', 'LG C2')
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)

    m.setStalled(true)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      'The sound went to LG C2 over AirPlay and stopped.',
    )
    expect(status).toHaveTextContent(
      'To hear it here, choose this phone under AirPlay in Control Center.',
    )
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()
  })

  it('closes the AirPlay notice from its button, until the route or the stop changes', () => {
    setAudioRouteForTests('airplay', 'LG C2')
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    // The phone chosen in Control Center: a notice with something to press.
    setAudioRouteForTests('speaker', 'Speaker')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible()
    // Back on AirPlay and a new stop: said again.
    setAudioRouteForTests('airplay', 'LG C2')
    m.setStalled(false)
    m.setStalled(true)
    expect(screen.getByRole('status')).toHaveTextContent('over AirPlay')
  })

  it('says the sound stopped on the phone, and plays again from its button', () => {
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)
    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))

    expect(m.play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('turns into Play again once the singer chooses the phone in Control Center', () => {
    setAudioRouteForTests('airplay', 'LG C2')
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()

    setAudioRouteForTests('speaker', 'Speaker')

    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible()
  })

  it('shows nothing between songs, when there is no mixer', () => {
    render(() => <KaraokeSoundStopped mixer={() => null} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
