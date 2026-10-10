import { describe, expect, it } from 'vitest'
import type { ResendResult } from './email'
import { mailAnswer, mayHaveGone } from './mail-answer'

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

  // Resend's errors page (resend.com/docs/api-reference/errors, read
  // 10 Oct 2026), and two names it has used before: every refusal about our
  // side of the request (our key, its permissions, the sending domain or
  // address, the quota, a request our code built wrong). Once that is fixed
  // the mail goes, so the sweep keeps sending it.
  it.each<[number, string, string]>([
    [
      400,
      'invalid_idempotency_key',
      'Idempotency keys, if present, must have between 1 and 256 characters.',
    ],
    [400, 'validation_error', 'API key is invalid'],
    [401, 'missing_api_key', 'Missing API key in the authorization header.'],
    [
      401,
      'restricted_api_key',
      'This API key is restricted to only send emails.',
    ],
    [403, 'invalid_api_key', 'API key is invalid'],
    [403, 'invalid_permission', 'Access token is missing required scopes.'],
    [403, 'restricted_api_key', 'API key is not active'],
    [403, 'suspended_api_key', 'This API key is suspended'],
    [
      403,
      'validation_error',
      'You can only send testing emails to your own email address (owner@example.test).',
    ],
    [
      403,
      'validation_error',
      'The example.test domain is not verified. Please, add and verify your domain.',
    ],
    [404, 'not_found', 'The requested endpoint does not exist.'],
    [
      405,
      'method_not_allowed',
      'Method is not allowed for the requested path.',
    ],
    [
      409,
      'resource_locked',
      'Another request is already updating this resource.',
    ],
    [
      422,
      'validation_error',
      'Invalid `from` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
    ],
    [
      422,
      'missing_required_field',
      'The request body is missing one or more required fields.',
    ],
    [
      429,
      'daily_quota_exceeded',
      'You have exceeded your daily email sending quota.',
    ],
    [
      429,
      'monthly_quota_exceeded',
      'You have exceeded your monthly email sending quota.',
    ],
  ])(
    'is unknown, to be sent again, after %i %s: %s',
    (status, errorName, errorMessage) => {
      const result = { ok: false, status, errorName, errorMessage }
      const why = `Resend answered ${status} ${errorName}: ${errorMessage}`
      expect(mailAnswer(result, false)).toEqual({ kind: 'unknown', why })
      expect(mailAnswer(result, true)).toEqual({ kind: 'unknown', why })
    },
  )

  // Refused for good: Resend says the message itself cannot go, because of
  // who it goes to or what it says. Sending it again changes nothing.
  it.each<[number, string]>([
    [
      422,
      'Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
    ],
    [
      400,
      'Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
    ],
    [
      422,
      'Invalid `bcc` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
    ],
    [422, 'The `subject` field must be a `string`.'],
  ])(
    'is refused for good after %i validation_error: %s',
    (status, errorMessage) => {
      const result = {
        ok: false,
        status,
        errorName: 'validation_error',
        errorMessage,
      }
      expect(mailAnswer(result, true)).toEqual({
        kind: 'refused',
        why: `Resend answered ${status} validation_error: ${errorMessage}`,
      })
    },
  )

  it('keeps no more of what Resend said than the owner needs', () => {
    const answer = mailAnswer(
      {
        ok: false,
        status: 500,
        errorName: 'application_error',
        errorMessage: `An unexpected\nerror ${'x'.repeat(400)}`,
      },
      false,
    )
    expect(answer.kind).toBe('unknown')
    const why = answer.kind === 'sent' ? '' : answer.why
    expect(why).toMatch(
      /^Resend answered 500 application_error: An unexpected error x+…$/,
    )
    expect(why.length).toBeLessThanOrEqual(260)
  })

  it('counts a 409 invalid_idempotent_request as sent only after a try Resend may have taken', () => {
    const conflict: ResendResult = {
      ok: false,
      status: 409,
      errorName: 'invalid_idempotent_request',
    }
    expect(mailAnswer(conflict, true)).toEqual({ kind: 'sent' })
    // After a refusal: Resend kept the key, nothing went, and the mail goes
    // once the key has expired.
    expect(mailAnswer(conflict, false)).toEqual({
      kind: 'unknown',
      why: 'Resend answered 409 invalid_idempotent_request',
    })
  })

  it.each<[string | null, string | null, boolean]>([
    ['sending', null, true],
    ['failed', 'Resend did not answer', true],
    [
      'failed',
      'Resend answered 500 application_error: An unexpected error occurred.',
      true,
    ],
    ['failed', 'Resend answered 503', true],
    [
      'failed',
      'Resend answered 409 concurrent_idempotent_requests: There is another request in progress with the same idempotency key.',
      true,
    ],
    ['failed', 'the mail could not be sent: TypeError: boom', true],
    ['failed', null, true],
    [
      'failed',
      'Resend answered 403 invalid_api_key: API key is invalid',
      false,
    ],
    [
      'failed',
      'Resend answered 429 daily_quota_exceeded: You have exceeded your daily email sending quota.',
      false,
    ],
    [
      'failed',
      'Resend answered 409 invalid_idempotent_request: Same idempotency key used with a different request payload.',
      false,
    ],
    [null, null, false],
    [
      'refused',
      'Resend answered 422 validation_error: Invalid `to` field.',
      false,
    ],
  ])(
    'knows whether a try left %s (%s) may have gone: %s',
    (status, why, gone) => {
      expect(mayHaveGone(status, why)).toBe(gone)
    },
  )

  it('is refused when there is no address to send it to', () => {
    expect(mailAnswer({ ok: false }, false)).toEqual({
      kind: 'refused',
      why: 'Resend was not asked: no address to send it to',
    })
  })
})
