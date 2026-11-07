// ============================================================
// FirstNoteAirPlayNotice: over AirPlay alone, where the room plays nothing
// ============================================================
//
// The guess is the store's (airplay-suspicion.ts), moved here as the device
// moves it: the app's session's route and rate, the page's rate, a screen
// connected. The app is told from the web by its device
// (native-shell-store.ts), and whether the phone streams by the streams the
// screen hands the room.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { followExternalScreen, notePageAudioContext, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import { FirstNoteAirPlayNotice } from './FirstNoteAirPlayNotice'
import type { SongStreams } from './web-audio-song-player'

const WORDS =
  'Over AirPlay this room plays nothing. Screen Mirroring carries its sound: open Control Center, tap Screen Mirroring, then choose your TV.'

/** Karaoke's streams as the screen hands them, on a phone that can stream or not. */
function streams(canStream: boolean): SongStreams {
  return {
    canStream: () => canStream,
    open: async () => null,
    voice: () => {
      throw new Error('nothing plays here')
    },
  }
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

/** What the notice's region says now. */
const said = (): string | null => screen.getByRole('status').textContent

let unregister: () => void = () => undefined

beforeEach(() => {
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests('speaker', 'Speaker', 48000)
  unregister = registerNativeDevice({
    keepAwake: () => undefined,
  } as unknown as NativeDeviceApi)
})

afterEach(() => {
  cleanup()
  unregister()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests(null)
})

describe('FirstNoteAirPlayNotice', () => {
  it('says the room plays nothing, and that Screen Mirroring carries its sound, once the sound is on AirPlay alone where the phone cannot stream', () => {
    render(() => <FirstNoteAirPlayNotice streams={streams(false)} show />)
    expect(said()).toBe('')

    // The page's clock made on AirPlay, at its 44.1 kHz.
    notePageAudioContext({ sampleRate: 44100 })

    expect(said()).toBe(WORDS)
  })

  it('follows the sound: gone as Screen Mirroring connects or the phone is chosen again, back as AirPlay alone returns', () => {
    const screenWatch = mirroring()
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    render(() => <FirstNoteAirPlayNotice streams={streams(false)} show />)
    expect(said()).toBe(WORDS)

    screenWatch.connect(true)
    expect(said()).toBe('')
    screenWatch.connect(false)
    expect(said()).toBe(WORDS)
    setAudioRouteForTests('speaker', 'Speaker', 48000)
    expect(said()).toBe('')

    screenWatch.stop()
  })

  it('says nothing where the phone streams: the room plays through Web Audio there', () => {
    setAudioRouteForTests('airplay', 'LG C2', 44100)

    render(() => <FirstNoteAirPlayNotice streams={streams(true)} show />)

    expect(said()).toBe('')
  })

  it('says nothing on the web, where no device is registered', () => {
    unregister()
    setAudioRouteForTests('airplay', 'LG C2', 44100)

    render(() => <FirstNoteAirPlayNotice streams={streams(false)} show />)

    expect(said()).toBe('')
  })

  it('waits while the result or the demo has the head of the room', () => {
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    const [show, setShow] = createSignal(false)
    render(() => (
      <FirstNoteAirPlayNotice streams={streams(false)} show={show()} />
    ))
    expect(said()).toBe('')

    setShow(true)

    expect(said()).toBe(WORDS)
  })
})
