// ============================================================
// KaraokeSoundStopped: the room says why its song stopped by itself
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { playbackCause } from '@/lib/playback-cause'
import { followExternalScreen, notePageAudioContext, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { NativeAudioRoute } from '@/stores/native-shell-store'
import { CHECK_SETTLE_MS, followOutputChecks, resetOutputCheckForTests, } from '@/stores/output-check'
import { KaraokeSoundStopped } from './KaraokeSoundStopped'

/** The part of the mixer the notice reads: whether it stalled, and play. */
function mixer() {
  const [stalled, setStalled] = createSignal(false)
  /** Who each play was said to be by (playback-cause.ts). */
  const playedBy: string[] = []
  const play = vi.fn(() => {
    playedBy.push(playbackCause())
    setStalled(false)
  })
  const controls = { stalled, play } as unknown as HostedMixerControls
  return { controls, setStalled, play, playedBy }
}

beforeEach(() => {
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests('speaker', 'Speaker', 48000)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  resetOutputCheckForTests()
  setAudioRouteForTests(null)
  resetAirPlaySuspicionForTests()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('KaraokeSoundStopped', () => {
  it('shows nothing while the song is fine, its status region waiting', () => {
    const m = mixer()

    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('names the receiver the sound went to over AirPlay, and plays again from its button', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))

    expect(m.play).toHaveBeenCalledTimes(1)
    expect(m.playedBy).toEqual(['notice'])
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  // Web Audio alone reaches an AirPlay TV (the sound check, 6 Nov 2026):
  // the old notice said AirPlay could not carry it, and offered no play.
  it('never says AirPlay cannot carry the sound', () => {
    setAudioRouteForTests('airplay', 'LG C2')
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)

    m.setStalled(true)

    const status = screen.getByRole('status')
    expect(status).not.toHaveTextContent('cannot')
    expect(status).not.toHaveTextContent('Screen Mirroring')
    // Play again is the one thing to press; nothing to close.
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('says the sound stopped on the phone, and plays again from its button', () => {
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)
    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))

    expect(m.play).toHaveBeenCalledTimes(1)
    // The song's line says the notice played it.
    expect(m.playedBy).toEqual(['notice'])
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says AirPlay where the room suspects it, though the route says the speaker, without naming the speaker', () => {
    // The page's clock made on AirPlay: 44.1 kHz, the app's session at 48.
    notePageAudioContext({ sampleRate: 44100 })
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)

    m.setStalled(true)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('The sound went over AirPlay and stopped.')
    // The port the app's session names is its own speaker, never the TV.
    expect(status).not.toHaveTextContent('Speaker')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible()
  })

  it('says the sound stopped, with Play again, while a screen is connected: mirroring is not AirPlay alone', () => {
    setAudioRouteForTests('airplay', 'LG C2')
    let connect: (connected: boolean) => void = () => undefined
    const stop = followExternalScreen((handler) => {
      connect = handler
      return () => undefined
    })
    connect(true)
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)

    m.setStalled(true)

    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')
    expect(screen.getByRole('status')).not.toHaveTextContent('AirPlay')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible()
    stop()
  })

  it('says the sound stopped once the page’s rate is back, AirPlay no longer suspected', () => {
    notePageAudioContext({ sampleRate: 44100 })
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)
    expect(screen.getByRole('status')).toHaveTextContent('over AirPlay')

    notePageAudioContext({ sampleRate: 48000 })

    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')
    expect(screen.getByRole('status')).not.toHaveTextContent('AirPlay')
  })

  it('changes its words once the singer chooses the phone in Control Center', () => {
    setAudioRouteForTests('airplay', 'LG C2')
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)
    expect(screen.getByRole('status')).toHaveTextContent('LG C2')

    setAudioRouteForTests('speaker', 'Speaker')

    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')
    expect(screen.getByRole('status')).not.toHaveTextContent('LG C2')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible()
  })

  it('shows nothing between songs, when there is no mixer', () => {
    render(() => <KaraokeSoundStopped mixer={() => null} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  // An iPhone 11's own session said airplay, at 44.1 kHz, and the page's
  // clock was made there. Chosen in Control Center, the phone's route came
  // back to the speaker at 48 kHz while the page's newest context still
  // said 44.1, so the notice went on saying AirPlay. The route's change has
  // the output read again (output-check.ts), and the words follow it.
  it('says the sound stopped here once the phone is chosen, as the route’s change reads the output again', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    notePageAudioContext({ sampleRate: 44100 })
    let output = 44100
    let routeChanged: (route: NativeAudioRoute) => void = () => undefined
    const stop = followOutputChecks({
      host: {
        makeProbe: () => ({
          sampleRate: output,
          close: async () => Promise.resolve(),
        }),
        inGesture: () => null,
        now: () => Date.now(),
        say: () => undefined,
      },
      output: {
        read: async () => null,
        watch: () => () => undefined,
        watchRoute: (handler) => {
          routeChanged = handler
          return () => undefined
        },
      },
    })
    const m = mixer()
    render(() => <KaraokeSoundStopped mixer={() => m.controls} />)
    m.setStalled(true)
    expect(screen.getByRole('status')).toHaveTextContent(
      'The sound went to LG C2 over AirPlay and stopped.',
    )

    output = 48000
    setAudioRouteForTests('speaker', 'Speaker', 48000)
    routeChanged('speaker')
    vi.advanceTimersByTime(CHECK_SETTLE_MS)

    expect(screen.getByRole('status')).toHaveTextContent('The sound stopped.')
    expect(screen.getByRole('status')).not.toHaveTextContent('AirPlay')
    stop()
  })
})
