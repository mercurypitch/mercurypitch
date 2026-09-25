// Museum microphone recovery tests — cooperative tab handoff stays distinct from browser and OS failures.

import { describe, expect, it } from 'vitest'
import { microphoneIssue, microphoneTakeoverTimedOut } from './mic-error'

describe('museum microphone recovery', () => {
  it('offers cooperative takeover only for a live app tab claim', () => {
    const issue = microphoneIssue({
      kind: 'held-elsewhere',
      message: 'manager detail',
    })

    expect(issue).toMatchObject({
      kind: 'held-elsewhere',
      action: 'take-over',
    })
    expect(issue.message.toLowerCase()).toContain('another tab')
  })

  it.each([
    ['permission-denied', 'settings'],
    ['device-busy', 'The microphone could not start'],
    ['no-device', 'No microphone was found'],
  ] as const)('makes %s retryable without promising takeover', (kind, copy) => {
    const issue = microphoneIssue({ kind, message: 'manager detail' })

    expect(issue).toMatchObject({ kind, action: 'retry' })
    expect(issue.message.toLowerCase()).toContain(copy.toLowerCase())
    expect(issue.message).not.toContain('Use it here')
  })

  it.each(['NotReadableError', 'AbortError', 'TrackStartError'])(
    'maps a raw %s startup failure to neutral retry guidance',
    (name) => {
      const issue = microphoneIssue(
        new DOMException('Starting audio capture failed', name),
      )

      expect(issue).toMatchObject({
        kind: 'device-busy',
        action: 'retry',
        diagnostic: {
          name,
          message: 'Starting audio capture failed',
        },
      })
      expect(issue.message).toContain('The microphone could not start')
      expect(issue.message).not.toMatch(/another app|another browser/i)
    },
  )

  it('preserves a classified browser diagnostic without trusting unbounded text', () => {
    const issue = microphoneIssue({
      kind: 'device-busy',
      diagnostic: {
        name: 'NotReadableError',
        message: `  ${'capture failed '.repeat(40)}  `,
      },
    })

    expect(issue.diagnostic?.name).toBe('NotReadableError')
    expect(issue.diagnostic?.message.length).toBeLessThanOrEqual(320)
    expect(issue.diagnostic?.message.endsWith('…')).toBe(true)
  })

  it('ignores malformed or throwing diagnostic fields', () => {
    const cause = {
      kind: 'device-busy',
      get diagnostic(): unknown {
        throw new Error('do not read me twice')
      },
    }

    const issue = microphoneIssue(cause)
    expect(issue).toMatchObject({
      kind: 'device-busy',
      action: 'retry',
    })
    expect(issue.diagnostic).toBeUndefined()
  })

  it('does not offer an action when the browser withholds the microphone API', () => {
    expect(
      microphoneIssue({ kind: 'insecure-context', message: 'manager detail' }),
    ).toMatchObject({
      kind: 'insecure-context',
      action: 'none',
    })
  })

  it('explains that an unanswered tab claim can age out and remains cooperative', () => {
    expect(microphoneTakeoverTimedOut()).toMatchObject({
      kind: 'held-elsewhere',
      action: 'take-over',
      message: expect.stringContaining('wait a moment'),
    })
  })
})
