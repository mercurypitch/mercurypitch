import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceCommand } from './types'
import { acquireWakeWordHold, activeVoiceCommands, lastHeardSpeech, registerVoiceCommands, reportHeardSpeech, speechActiveWithin, wakeWordHoldActive, } from './voice-command-registry'

const command = (id: string): VoiceCommand => ({
  id,
  label: id,
  phrases: [id],
  run: () => undefined,
})

describe('registerVoiceCommands', () => {
  it('exposes sources in registration order and removes them on dispose', () => {
    const disposeA = registerVoiceCommands(() => [command('a')])
    const disposeB = registerVoiceCommands(() => [command('b')])
    expect(activeVoiceCommands().map((c) => c.id)).toEqual(['a', 'b'])
    disposeA()
    expect(activeVoiceCommands().map((c) => c.id)).toEqual(['b'])
    disposeB()
    expect(activeVoiceCommands()).toEqual([])
  })
})

describe('wake-word holds', () => {
  it('is active while any holder is live, released when all let go', () => {
    expect(wakeWordHoldActive()).toBe(false)
    const releaseA = acquireWakeWordHold()
    const releaseB = acquireWakeWordHold()
    expect(wakeWordHoldActive()).toBe(true)
    releaseA()
    expect(wakeWordHoldActive()).toBe(true)
    releaseB()
    expect(wakeWordHoldActive()).toBe(false)
  })

  it('releasing twice is safe and cannot drop another hold', () => {
    const releaseA = acquireWakeWordHold()
    const releaseB = acquireWakeWordHold()
    releaseA()
    releaseA()
    expect(wakeWordHoldActive()).toBe(true)
    releaseB()
    expect(wakeWordHoldActive()).toBe(false)
  })
})

describe('heard-speech seam', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('real speech activates the window and keeps the text', () => {
    vi.useFakeTimers()
    reportHeardSpeech('  sing number one  ')
    expect(lastHeardSpeech()).toBe('sing number one')
    expect(speechActiveWithin(2500)).toBe(true)
    vi.advanceTimersByTime(2600)
    expect(speechActiveWithin(2500)).toBe(false)
  })

  it('an empty report is a recognizer recycle, not speech', () => {
    // webspeech fires onInterim('') on every session end — every few
    // seconds of SILENCE. Counting that as speech froze the Mercury Sing
    // wheel repeatedly in a quiet room.
    vi.useFakeTimers()
    reportHeardSpeech('hello there')
    vi.advanceTimersByTime(5000)
    expect(speechActiveWithin(2500)).toBe(false)
    reportHeardSpeech('')
    reportHeardSpeech('   ')
    expect(speechActiveWithin(2500)).toBe(false)
    expect(lastHeardSpeech()).toBe('hello there')
  })
})
