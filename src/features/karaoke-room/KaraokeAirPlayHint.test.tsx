// ============================================================
// KaraokeAirPlayHint: where the song and the lyrics are, once, on AirPlay
// ============================================================
//
// AirPlay is suspected as the store has it (airplay-suspicion.ts): the app's
// session on its speaker at 48 kHz, and the page's clock made on AirPlay at
// 44.1. The mixer is the part the hint reads: whether the song plays.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { followExternalScreen, notePageAudioContext, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { airPlayHintLines, KaraokeAirPlayHint, resetAirPlayHintForTests, } from './KaraokeAirPlayHint'

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
  vi.unstubAllGlobals()
})

describe('KaraokeAirPlayHint', () => {
  it('says, as a song starts on AirPlay, that it plays there, the lyrics stay on the phone, and Screen Mirroring puts the stage on the TV', () => {
    onAirPlay()
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    m.setPlaying(true)

    const lines = screen
      .getAllByRole('paragraph')
      .map((line) => line.textContent)
    expect(lines).toEqual([
      'The song is playing over AirPlay.',
      'The lyrics stay on this phone.',
      'Screen Mirroring puts the stage on the TV: open Control Center, tap Screen Mirroring, then choose your TV.',
    ])
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })

  it('names the TV where the route itself says airplay', () => {
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)

    m.setPlaying(true)

    expect(screen.getByRole('status')).toHaveTextContent(
      'The song is playing on LG C2 over AirPlay.',
    )
  })

  // Web Audio alone reaches an AirPlay TV (the sound check, 6 Nov 2026):
  // the old hint said AirPlay could not carry the room's sound.
  it('never says AirPlay cannot carry the sound', () => {
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    const m = mixer()
    render(() => <KaraokeAirPlayHint mixer={() => m.controls} />)

    m.setPlaying(true)

    expect(screen.getByRole('status')).not.toHaveTextContent('cannot')
  })

  it('names the iPad on an iPad, and no receiver for a blank port name', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    })

    const lines = airPlayHintLines('  ')

    expect(lines[0]).toBe('The song is playing over AirPlay.')
    expect(lines[1]).toBe('The lyrics stay on this iPad.')
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
    expect(screen.getByRole('status')).toHaveTextContent('Screen Mirroring')

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
    expect(screen.getByRole('status')).toHaveTextContent(
      'The song is playing over AirPlay.',
    )
  })

  it('shows nothing between songs, when there is no mixer', () => {
    onAirPlay()

    render(() => <KaraokeAirPlayHint mixer={() => null} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
