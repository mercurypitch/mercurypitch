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
    ['device-busy', 'another app or browser'],
    ['no-device', 'No microphone was found'],
  ] as const)('makes %s retryable without promising takeover', (kind, copy) => {
    const issue = microphoneIssue({ kind, message: 'manager detail' })

    expect(issue).toMatchObject({ kind, action: 'retry' })
    expect(issue.message.toLowerCase()).toContain(copy.toLowerCase())
    expect(issue.message).not.toContain('Use it here')
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
