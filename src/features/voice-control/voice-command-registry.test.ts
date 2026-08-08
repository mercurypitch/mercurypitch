import { describe, expect, it } from 'vitest'
import type { VoiceCommand } from './types'
import { acquireWakeWordHold, activeVoiceCommands, registerVoiceCommands, wakeWordHoldActive, } from './voice-command-registry'

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
