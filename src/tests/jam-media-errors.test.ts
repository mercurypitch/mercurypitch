// ── Media error message tests ─────────────────────────────────────────
// Every getUserMedia failure arrives as a DOMException. The message has to
// tell the difference between "tap allow" and "no prompt is coming, change
// your browser settings" — the second is the case that sends people looking
// for a dialog that will never appear.

import { describe, expect, it } from 'vitest'
import { micErrorMessage } from '@/lib/jam/media-errors'

const domErr = (name: string) => new DOMException('nope', name)

describe('micErrorMessage', () => {
  it('names the browser settings when the site is blocked', () => {
    const msg = micErrorMessage(domErr('NotAllowedError'), true)
    expect(msg).toMatch(/blocking/i)
    // Must say a prompt is not coming, or the advice reads as "try again".
    expect(msg).toMatch(/no prompt/i)
  })

  it('tells you to choose Allow when the prompt was merely dismissed', () => {
    const msg = micErrorMessage(domErr('NotAllowedError'), false)
    expect(msg).toMatch(/Allow/)
    expect(msg).not.toMatch(/blocking/i)
  })

  it('separates no-device from no-permission', () => {
    expect(micErrorMessage(domErr('NotFoundError'), false)).toMatch(
      /No microphone was found/i,
    )
  })

  it('says who is holding the device when it is busy', () => {
    expect(micErrorMessage(domErr('NotReadableError'), false)).toMatch(
      /another app or tab/i,
    )
  })

  it('falls back without throwing on an unknown error', () => {
    expect(micErrorMessage(new Error('mystery'), false)).toBeTruthy()
    expect(micErrorMessage(undefined, false)).toBeTruthy()
    expect(micErrorMessage(null, true)).toBeTruthy()
  })

  it('treats SecurityError as a permission problem, not a mystery', () => {
    expect(micErrorMessage(domErr('SecurityError'), true)).toMatch(/blocking/i)
  })
})
