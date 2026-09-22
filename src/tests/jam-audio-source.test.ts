// ── Jam audio source tests ───────────────────────────────────────────
// The whole point of this module is that a constraint is a request and
// `getSettings()` is the answer. So the cases that matter are the ones
// where the two disagree -- a browser that kept the processing on, a
// browser that will not say, and a profile whose intent did not survive.

import { describe, expect, it } from 'vitest'
import type { JamAudioProfile } from '@/lib/jam/jam-audio-source'
import { constraintsFor, describeCapture, PROFILE_COPY, } from '@/lib/jam/jam-audio-source'

/** The DOM typings have no `voiceIsolation` yet; read it through a cast. */
const ext = (c: MediaTrackConstraints): Record<string, unknown> =>
  c as unknown as Record<string, unknown>

describe('constraintsFor', () => {
  it('asks for nothing to be done to an instrument', () => {
    const c = constraintsFor('instrument', null)
    expect(c.echoCancellation).toBe(false)
    expect(c.noiseSuppression).toBe(false)
    expect(c.autoGainControl).toBe(false)
  })

  it('sets voiceIsolation false, which will matter later', () => {
    // Already shipping and platform-gated today, so it is the one that
    // will quietly start mangling a guitar as Chrome extends support.
    expect(ext(constraintsFor('instrument', null)).voiceIsolation).toBe(false)
    expect(ext(constraintsFor('voice', null)).voiceIsolation).toBe(false)
  })

  it('keeps the voice profile exactly as the room behaves today', () => {
    const c = constraintsFor('voice', null)
    expect(c.echoCancellation).toBe(true)
    expect(c.noiseSuppression).toBe(true)
    expect(c.autoGainControl).toBe(true)
  })

  it('pins a chosen device EXACTLY, so a stale id fails loudly', () => {
    // The alternative is silently falling back to the built-in mic, which
    // for a guitarist is the difference between "no sound" and "the room
    // can hear my laptop fan".
    const c = constraintsFor('instrument', 'focusrite-1')
    expect(c.deviceId).toEqual({ exact: 'focusrite-1' })
  })

  it('omits deviceId entirely when none is chosen', () => {
    expect(constraintsFor('voice', null).deviceId).toBeUndefined()
    expect(constraintsFor('voice', '').deviceId).toBeUndefined()
  })

  it('asks for mono at 48 kHz', () => {
    const c = constraintsFor('instrument', null)
    expect(c.channelCount).toEqual({ ideal: 1 })
    expect(c.sampleRate).toEqual({ ideal: 48000 })
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
