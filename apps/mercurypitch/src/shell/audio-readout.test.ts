// ============================================================
// Audio readout: each row's words, from what the phone reported
// ============================================================
//
// The readings are the shapes AudioOutput sends on each phone, written out
// by hand (packages/mobile-runtime/src/audio-output.test.ts has the same).

import { describe, expect, it } from 'vitest'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import { contextsLine, hardwareLine, leasesLine, outputLine, roomOutputLine, sessionLine, tracksLine, volumeLine, } from './audio-readout'

const IPHONE: NativeAudioOutputReading = {
  volume: 1,
  step: null,
  steps: null,
  route: 'receiver',
  outputs: [{ type: 'Receiver', name: 'Receiver' }],
  detail: {
    category: 'AVAudioSessionCategoryPlayAndRecord',
    mode: 'AVAudioSessionModeVoiceChat',
    options: ['mixWithOthers', 'allowBluetoothHFP'],
    otherAudioPlaying: false,
    silenceHint: false,
    sampleRate: 48_000,
    ioBufferDuration: 0.0213,
    outputLatency: 0.0012,
  },
  reason: null,
}

const ANDROID: NativeAudioOutputReading = {
  volume: 0.2,
  step: 3,
  steps: 15,
  route: 'speaker',
  outputs: [{ type: 'builtin-speaker', name: 'Pixel 8' }],
  detail: {
    stream: 'music',
    mode: 'normal',
    streamMuted: false,
    musicActive: true,
    musicVolume: 0.2,
    callVolume: 0.6,
  },
  reason: null,
}

describe('the phone rows', () => {
  it('names the receiver as the earpiece, with its port', () => {
    expect(outputLine(IPHONE, true)).toBe('Receiver (the earpiece) · Receiver')
  })

  it('says why there is no reading', () => {
    expect(outputLine(null, false)).toBe('not read on the web')
    expect(outputLine(null, true)).toBe(
      'no reading: this build has no AudioOutput',
    )
  })

  it('gives the volume, Android’s steps, and says when the rooms call it low', () => {
    expect(volumeLine(IPHONE)).toBe('1.00')
    expect(volumeLine(ANDROID)).toBe(
      '0.20 · step 3 of 15 · low: the rooms ask for more',
    )
  })

  it('reads an iPhone’s session without its prefixes', () => {
    expect(sessionLine(IPHONE)).toBe(
      'PlayAndRecord · VoiceChat · mixWithOthers, allowBluetoothHFP',
    )
    expect(hardwareLine(IPHONE)).toBe(
      'other audio none · silence hint off · 48000 Hz · buffer 21.3 ms · out 1.2 ms',
    )
  })

  it('reads an Android phone’s mode, stream and both volumes', () => {
    expect(sessionLine(ANDROID)).toBe(
      'mode normal · music stream · music playing',
    )
    expect(hardwareLine(ANDROID)).toBe('music 0.20 · call 0.60')
  })
})

describe('the census rows', () => {
  const track = (echo: boolean) =>
    ({
      getSettings: () => ({
        echoCancellation: echo,
        noiseSuppression: false,
        autoGainControl: false,
      }),
    }) as unknown as MediaStreamTrack

  it('lists each live track with what it was opened with, and who holds the mic', () => {
    expect(
      tracksLine(
        [{ n: 4, track: track(true) }],
        { contexts: 0, closed: 0, tracks: 4, ended: 3 },
        { stream: true, consumers: ['lip-roll'] },
      ),
    ).toBe(
      '1 live (#4 echo on noise off gain off) · 4 opened, 3 ended · mic manager holds a stream, lip-roll',
    )
    expect(
      tracksLine(
        [],
        { contexts: 0, closed: 0, tracks: 0, ended: 0 },
        { stream: false, consumers: [] },
      ),
    ).toBe(
      '0 live · 0 opened, 0 ended · mic manager holds none, no one using it',
    )
  })

  it('lists the open contexts with whose they are, and counts the closed', () => {
    const rooms = { state: 'running', sampleRate: 48_000 } as BaseAudioContext
    const tone = { state: 'suspended', sampleRate: 44_100 } as BaseAudioContext
    expect(
      contextsLine(
        [
          { n: 1, context: rooms },
          { n: 3, context: tone },
        ],
        { contexts: 3, closed: 1, tracks: 0, ended: 0 },
        (context) => (context === rooms ? 'rooms' : null),
      ),
    ).toBe('#1 running 48000 Hz (rooms) · #3 suspended 44100 Hz · 1 closed')
    expect(
      contextsLine(
        [],
        { contexts: 0, closed: 0, tracks: 0, ended: 0 },
        () => null,
      ),
    ).toBe('none made yet')
  })

  it('names the leases on the shared clock', () => {
    expect(leasesLine([])).toBe('none')
    expect(leasesLine(['lip-roll', 'room-tones'])).toBe('lip-roll, room-tones')
  })

  it("reads the rooms' output gain and level", () => {
    expect(roomOutputLine([])).toBe('none yet: open a room')
    expect(
      roomOutputLine([
        {
          context: {} as BaseAudioContext,
          gain: 1,
          peakDb: -10.04,
          rmsDb: null,
        },
      ]),
    ).toBe('gain 1.00 · now -10.0 dBFS peak, silent RMS')
  })
})
