import { describe, expect, it } from 'vitest'
import type { ResendResult } from './email'
import { mailAnswer } from './mail-answer'

describe("what Resend's answer says of a mail that has to go", () => {
  it('is sent when Resend took it', () => {
    expect(mailAnswer({ ok: true, id: 'stubbed' }, false)).toEqual({
      kind: 'sent',
    })
  })

  it.each<[ResendResult, string]>([
    [{ ok: false, unanswered: true }, 'Resend did not answer'],
    [
      { ok: false, status: 500, errorName: 'internal_server_error' },
      'Resend answered 500 internal_server_error',
    ],
    [{ ok: false, status: 503 }, 'Resend answered 503'],
    [
      { ok: false, status: 429, errorName: 'rate_limit_exceeded' },
      'Resend answered 429 rate_limit_exceeded',
    ],
    [
      { ok: false, status: 409, errorName: 'concurrent_idempotent_requests' },
      'Resend answered 409 concurrent_idempotent_requests',
    ],
  ])('is unknown, to be sent again, after %j', (result, why) => {
    expect(mailAnswer(result, false)).toEqual({ kind: 'unknown', why })
    expect(mailAnswer(result, true)).toEqual({ kind: 'unknown', why })
  })

  it.each([
    [400, 'validation_error'],
    [401, 'missing_api_key'],
    [403, 'invalid_api_key'],
    [404, 'not_found'],
    [422, 'validation_error'],
  ])('is refused for good after a %i', (status, errorName) => {
    expect(mailAnswer({ ok: false, status, errorName }, true)).toEqual({
      kind: 'refused',
      why: `Resend answered ${status} ${errorName}`,
    })
  })

  it('counts a 409 invalid_idempotent_request as sent only after a try whose outcome was unknown', () => {
    const conflict: ResendResult = {
      ok: false,
      status: 409,
      errorName: 'invalid_idempotent_request',
    }
    expect(mailAnswer(conflict, true)).toEqual({ kind: 'sent' })
    expect(mailAnswer(conflict, false)).toEqual({
      kind: 'refused',
      why: 'Resend answered 409 invalid_idempotent_request',
    })
  })

  it('is refused when there is no address to send it to', () => {
    expect(mailAnswer({ ok: false }, false)).toEqual({
      kind: 'refused',
      why: 'Resend was not asked: no address to send it to',
    })
  })
})
