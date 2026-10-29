import { describe, expect, it } from 'vitest'
import { describeFormat, describeSwitch, holderName, processingNames, } from './check-copy'
import type { RosterInput } from './mic-roster'

const HEADSET: RosterInput = {
  deviceId: 'headset',
  groupId: 'h',
  name: 'Headset',
  kind: 'headset',
  isDefault: false,
  isCommunications: false,
  isListening: false,
}

describe('describeSwitch', () => {
  it('reports a switch that took', () => {
    expect(describeSwitch(HEADSET, true, 'Headset')).toEqual({
      tone: 'info',
      text: 'Switched to Headset',
    })
  })

  it('does not dress up a fallback as a switch', () => {
    expect(describeSwitch(HEADSET, false, 'Built-in Mic')).toEqual({
      tone: 'warn',
      text: 'Headset would not open, so MercuryPitch went back to the system default, Built-in Mic',
    })
  })

  it('reports a return to the default that was asked for', () => {
    expect(describeSwitch(null, false, 'Built-in Mic').text).toBe(
      'Back on the system default, Built-in Mic',
    )
  })
})

describe('holderName', () => {
  it('names the surfaces it knows, suffix or not', () => {
    expect(holderName('stem-mixer')).toBe('Karaoke')
    expect(holderName('voice-control')).toBe('Voice control')
    expect(holderName('guitar-night-listening')).toBe('Guitar')
    expect(holderName('voice-history-freeform-3')).toBe('Hear Yourself')
  })

  it('reads an unknown id as words', () => {
    expect(holderName('exercise-capture')).toBe('Exercise capture')
    expect(holderName('--')).toBe('Another part of MercuryPitch')
  })
})

describe('describeFormat', () => {
  it('reads a clean analysis capture', () => {
    expect(
      describeFormat({
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }),
    ).toBe('48 kHz · mono · no processing')
  })

  it('names the processing a browser applied anyway', () => {
    const settings = {
      sampleRate: 16000,
      channelCount: 1,
      noiseSuppression: true,
      autoGainControl: true,
    }
    expect(processingNames(settings)).toEqual([
      'noise suppression',
      'automatic gain',
    ])
    expect(describeFormat(settings)).toBe(
      '16 kHz · mono · noise suppression, automatic gain on',
    )
  })

  it('leaves out what the track does not report', () => {
    expect(describeFormat({})).toBe('no processing')
    expect(describeFormat({ sampleRate: 44100, channelCount: 2 })).toBe(
      '44.1 kHz · stereo · no processing',
    )
  })
})
