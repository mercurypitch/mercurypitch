import { describe, expect, it } from 'vitest'
import { micErrorLine } from './mic-error'

describe('micErrorLine', () => {
  it('tells a refused permission apart from a busy device', () => {
    expect(micErrorLine({ kind: 'permission-denied' })).toMatch(/refused/i)
    expect(micErrorLine({ kind: 'device-busy' })).toMatch(/another app/i)
    expect(micErrorLine({ kind: 'permission-denied' })).not.toBe(
      micErrorLine({ kind: 'device-busy' }),
    )
  })

  it('names the missing hardware case without asking for permissions', () => {
    const line = micErrorLine({ kind: 'no-device' })
    expect(line).toMatch(/no microphone/i)
    expect(line).not.toMatch(/permission/i)
  })

  // The failure that used to reach the player as "undefined is not an
  // object (evaluating 'navigator.mediaDevices.getUserMedia')" -- a true
  // sentence about the wrong thing, and one nobody can act on.
  it('names the secure connection when the browser hides the API', () => {
    const line = micErrorLine({ kind: 'insecure-context' })
    expect(line).toMatch(/https/i)
    expect(line).toMatch(/localhost/i)
    // Not advice to grant a permission: there is no permission to grant.
    expect(line).not.toMatch(/allow/i)
  })

  it('carries the engine message through for an unclassified failure', () => {
    expect(
      micErrorLine({
        kind: 'unknown',
        message: 'The mixer refused the device',
      }),
    ).toBe('The mixer refused the device')
  })

  it('still says something useful for a plain Error', () => {
    const line = micErrorLine(new Error('boom'))
    expect(line).toMatch(/did not start/i)
    expect(line).toContain('boom')
  })

  it('survives a thrown non-object', () => {
    expect(micErrorLine('nope')).toMatch(/did not start/i)
    expect(micErrorLine(undefined)).toMatch(/did not start/i)
  })
})
