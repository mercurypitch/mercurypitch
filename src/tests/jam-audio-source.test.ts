// ── Jam audio source tests ───────────────────────────────────────────
// The whole point of this module is that a constraint is a request and
// `getSettings()` is the answer. So the cases that matter are the ones
// where the two disagree -- a browser that kept the processing on, a
// browser that will not say, and a profile whose intent did not survive.

import { describe, expect, it, vi } from 'vitest'
import type { JamAudioProfile } from '@/lib/jam/jam-audio-source'
import type { JamAudioInput } from '@/lib/jam/jam-audio-source'
import { captureConstraints, describeCapture, isLoopbackLabel, listJamAudioInputs, PROFILE_COPY, resolveDeviceId, } from '@/lib/jam/jam-audio-source'

/** The DOM typings have no `voiceIsolation` yet; read it through a cast. */
const ext = (c: MediaTrackConstraints): Record<string, unknown> =>
  c as unknown as Record<string, unknown>

describe('captureConstraints', () => {
  it('asks for nothing to be done to the capture, whatever is being played', () => {
    // Raw for BOTH profiles, and the reason is not tone. The capture feeds
    // the pitch detector, and `makeTransmitTrack` reads
    // `echoCancellation` back off it to spot a device that applied the
    // clone's constraints to the shared source. Capturing a voice already
    // cancelled trips that guard, stops the clone, and puts the mic
    // feedback bug back. The PROCESSED CLONE is what the peers hear.
    const c = captureConstraints(null)
    expect(c.echoCancellation).toBe(false)
    expect(c.noiseSuppression).toBe(false)
    expect(c.autoGainControl).toBe(false)
  })

  it('sets voiceIsolation false, which will matter later', () => {
    // Already shipping and platform-gated today, so it is the one that
    // will quietly start mangling a guitar as Chrome extends support.
    expect(ext(captureConstraints(null)).voiceIsolation).toBe(false)
  })

  it('pins a chosen device EXACTLY, so a stale id fails loudly', () => {
    // The alternative is silently falling back to the built-in mic, which
    // for a guitarist is the difference between "no sound" and "the room
    // can hear my laptop fan".
    const c = captureConstraints('focusrite-1')
    expect(c.deviceId).toEqual({ exact: 'focusrite-1' })
  })

  it('omits deviceId entirely when none is chosen', () => {
    expect(captureConstraints(null).deviceId).toBeUndefined()
    expect(captureConstraints('').deviceId).toBeUndefined()
  })

  it('leaves the channel count to the device, so its inputs stay separable', () => {
    // Asking for one channel is what left a 4-in interface with no
    // channels to choose between: a guitar on input 1 and a mic on input 2
    // arrived already summed. Guitar Night takes the native count on the
    // same hardware, which is why it can offer "Input 1 / Input 2".
    expect(captureConstraints(null).channelCount).toBeUndefined()
  })

  it('still asks for 48 kHz, which costs nothing and avoids a resample', () => {
    expect(captureConstraints(null).sampleRate).toEqual({ ideal: 48000 })
  })
})

describe('describeCapture', () => {
  const settings = (over: Partial<MediaTrackSettings> = {}) =>
    ({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      sampleRate: 48000,
      ...over,
    }) as MediaTrackSettings

  it('accepts a raw instrument capture', () => {
    const r = describeCapture('instrument', settings(), 'Scarlett Solo')
    expect(r.asRequested).toBe(true)
    expect(r.warnings).toEqual([])
    expect(r.deviceLabel).toBe('Scarlett Solo')
  })

  it('names exactly which processors stayed on, in a sentence a musician can act on', () => {
    const r = describeCapture(
      'instrument',
      settings({ noiseSuppression: true, autoGainControl: true }),
    )
    expect(r.asRequested).toBe(false)
    expect(r.warnings[0]).toContain(
      'noise suppression and automatic gain control',
    )
    expect(r.warnings[0]).not.toContain('echo cancellation')
  })

  it('uses a plain list for a single processor', () => {
    const r = describeCapture(
      'instrument',
      settings({ echoCancellation: true }),
    )
    expect(r.warnings[0]).toContain('kept echo cancellation on')
  })

  it('says so when the browser will not report the processing at all', () => {
    // Safari omits most of this block. "Did not say" is a different fact
    // from "it is off" -- the first cannot be acted on, the second can.
    const r = describeCapture('instrument', {} as MediaTrackSettings)
    expect(r.echoCancellation).toBeNull()
    expect(r.warnings.some((w) => w.includes('does not report'))).toBe(true)
    // Unknown is not a failure: nothing was observed to be ON.
    expect(r.asRequested).toBe(true)
  })

  it('flags a resampling capture, which is a hidden latency cost', () => {
    const r = describeCapture('instrument', settings({ sampleRate: 44100 }))
    expect(r.warnings.some((w) => w.includes('44100 Hz'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('48 kHz'))).toBe(true)
  })

  it('does not warn about a voice capture that is doing its job', () => {
    const r = describeCapture(
      'voice',
      settings({ echoCancellation: true, noiseSuppression: true }),
    )
    expect(r.asRequested).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('notices a voice capture whose echo cancellation did not take', () => {
    // This is the case that makes a room howl, and today it is silent.
    const r = describeCapture('voice', settings({ echoCancellation: false }))
    expect(r.asRequested).toBe(false)
  })

  it('survives a null capture rather than throwing mid-session', () => {
    const r = describeCapture('instrument', null)
    expect(r.channelCount).toBeNull()
    expect(r.sampleRate).toBeNull()
    expect(() => r.warnings.join('')).not.toThrow()
  })

  it('reads a missing number as null, never as zero', () => {
    const r = describeCapture('instrument', {
      channelCount: undefined,
    } as MediaTrackSettings)
    expect(r.channelCount).toBeNull()
  })
})

describe('isLoopbackLabel', () => {
  it('spots the PipeWire and PulseAudio monitor sources', () => {
    // These enumerate as ordinary capture devices on Linux. Picking one in
    // a jam room captures the room's own output and sends it back -- a
    // feedback loop with a network round trip in the middle.
    expect(isLoopbackLabel('Monitor of Built-in Audio Analog Stereo')).toBe(
      true,
    )
    expect(isLoopbackLabel('monitor of Scarlett 4i4 USB')).toBe(true)
    expect(isLoopbackLabel('Loopback Capture')).toBe(true)
  })

  it('names an unlabelled device as a device, not as a channel', async () => {
    // "Input 1" is what Guitar Night calls a CHANNEL, so using it here for
    // a device the browser has not named yet sent a guitarist looking for
    // their interface into the wrong kind of list.
    const devices = [
      { kind: 'audioinput', deviceId: 'a', label: '' },
      { kind: 'audioinput', deviceId: 'b', label: '' },
    ]
    vi.stubGlobal('navigator', {
      mediaDevices: { enumerateDevices: async () => devices },
    })
    const listed = await listJamAudioInputs()
    expect(listed.map((d) => d.label)).toEqual(['Device 1', 'Device 2'])
    expect(listed.some((d) => d.label.startsWith('Input'))).toBe(false)
    vi.unstubAllGlobals()
  })

  it('leaves real inputs alone, including ones with monitor in the name', () => {
    // "Monitor" on its own is a legitimate word for studio hardware, so
    // the match is on the full "monitor of" phrase rather than the word.
    expect(isLoopbackLabel('Scarlett 4i4 USB Analogue 1 + 2')).toBe(false)
    expect(isLoopbackLabel('Studio Monitor Input')).toBe(false)
    expect(isLoopbackLabel('Default')).toBe(false)
    expect(isLoopbackLabel('')).toBe(false)
  })
})

describe('resolveDeviceId', () => {
  const dev = (
    deviceId: string,
    label: string,
    isLoopback = false,
  ): JamAudioInput => ({ deviceId, label, isLoopback })
  const devices = [
    dev('hash-a', 'Scarlett 4i4 USB Pro Audio'),
    dev('hash-b', 'Built-in Audio'),
    dev('hash-c', 'Monitor of Built-in Audio', true),
  ]

  it('takes the saved id when it still names something', () => {
    expect(
      resolveDeviceId('hash-a', 'Scarlett 4i4 USB Pro Audio', devices),
    ).toBe('hash-a')
  })

  it('falls back to the label when the id has changed underneath', () => {
    // Switching a Scarlett from Analogue Stereo to Pro Audio changes the
    // PulseAudio source name, and therefore the hashed deviceId. Without
    // this the room silently falls back to a laptop microphone.
    expect(
      resolveDeviceId('stale-id', 'Scarlett 4i4 USB Pro Audio', devices),
    ).toBe('hash-a')
  })

  it('never resolves to a loopback, even on an exact label match', () => {
    expect(
      resolveDeviceId('gone', 'Monitor of Built-in Audio', devices),
    ).toBeNull()
  })

  it('gives up rather than guessing when nothing matches', () => {
    // Null means "take the default", which is a recoverable outcome. A
    // guess would be an unrecoverable one nobody could diagnose.
    expect(resolveDeviceId('gone', 'Some Old Interface', devices)).toBeNull()
    expect(resolveDeviceId(null, null, devices)).toBeNull()
    expect(resolveDeviceId('gone', '', devices)).toBeNull()
  })

  it('handles an empty device list', () => {
    expect(resolveDeviceId('hash-a', 'Scarlett', [])).toBeNull()
  })
})

describe('PROFILE_COPY', () => {
  it('tells an instrument player the one thing that matters', () => {
    // No echo cancellation means an open mic on speakers will feed back.
    expect(PROFILE_COPY.instrument.hint).toContain('headphones')
  })

  it('covers every profile', () => {
    const profiles: JamAudioProfile[] = ['voice', 'instrument']
    for (const p of profiles) {
      expect(PROFILE_COPY[p].label).not.toBe('')
      expect(PROFILE_COPY[p].hint).not.toBe('')
    }
  })
})
