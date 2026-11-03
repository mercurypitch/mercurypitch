// ============================================================
// KaraokeAirPlayHint: Screen Mirroring, once, for a song started on AirPlay
// ============================================================
//
// AirPlay is suspected as the store has it (airplay-suspicion.ts): the app's
// session on its speaker at 48 kHz, and the page's clock made on AirPlay at
// 44.1. The mixer is the part the hint reads: whether the song plays.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { followExternalScreen, notePageAudioContext, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { AIRPLAY_HINT_LINES, KaraokeAirPlayHint, resetAirPlayHintForTests, } from './KaraokeAirPlayHint'

function mixer() {
  const [playing, setPlaying] = createSignal(false)
  const controls = { playing } as unknown as HostedMixerControls
  return { controls, setPlaying }
}

/** A screen connected to the phone, as the device says it. */
function mirroring() {
  let heard: (connected: boolean) => void = () => undefined
  const stop = followExternalScreen((handler) => {
    heard = handler
    return () => undefined
  })
  return { connect: (connected: boolean) => heard(connected), stop }
}

const onAirPlay = (): void => {
  notePageAudioContext({ sampleRate: 44100 })
}

beforeEach(() => {
  resetAirPlayHintForTests()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests('speaker', 'Speaker', 48000)
})

afterEach(() => {
  cleanup()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests(null)
})

describe('KaraokeAirPlayHint', () => {
  it('says plainly, as a song starts on AirPlay, that AirPlay cannot carry its sound to a TV and Screen Mirroring can', () => {
    onAirPlay()
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    m.setPlaying(true)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      "AirPlay cannot carry the room's sound to a TV.",
    )
    expect(status).toHaveTextContent(
      'Screen Mirroring can: open Control Center, tap Screen Mirroring, then choose your TV.',
    )
    expect(AIRPLAY_HINT_LINES).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })

  it('says it too where the route itself says airplay', () => {
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)

    m.setPlaying(true)

    expect(screen.getByTestId('karaoke-airplay-hint')).toBeVisible()
  })

  it('takes no focus from the room as it shows', () => {
    onAirPlay()
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)
    const before = document.activeElement

    m.setPlaying(true)

    expect(screen.getByTestId('karaoke-airplay-hint')).toBeVisible()
    expect(document.activeElement).toBe(before)
  })

  it('shows nothing for a song on the phone’s own speaker', () => {
    notePageAudioContext({ sampleRate: 48000 })
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)

    m.setPlaying(true)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('closes from its button, and shows once a launch, the next room included', () => {
    onAirPlay()
    const m = mixer()
    const first = render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)
    m.setPlaying(true)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    m.setPlaying(false)
    m.setPlaying(true)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    first.unmount()
    const next = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => next.controls} />)
    next.setPlaying(true)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('never shows while a screen is connected, which is Screen Mirroring at work', () => {
    const screenLink = mirroring()
    onAirPlay()
    screenLink.connect(true)
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)

    m.setPlaying(true)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    screenLink.stop()
  })

  it('goes the moment mirroring starts under it', () => {
    const screenLink = mirroring()
    onAirPlay()
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)
    m.setPlaying(true)
    expect(screen.getByTestId('karaoke-airplay-hint')).toBeVisible()

    screenLink.connect(true)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    screenLink.stop()
  })

  it('waits for a song to start: AirPlay suspected between songs shows nothing yet', () => {
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)

    onAirPlay()

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    m.setPlaying(true)
    expect(screen.getByTestId('karaoke-airplay-hint')).toBeVisible()
  })

  it('shows nothing between songs, when there is no mixer', () => {
    onAirPlay()

    render(() => <KaraokeAirPlayHint mixer={() => null} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
