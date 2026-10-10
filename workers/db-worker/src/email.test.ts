import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResendConfig } from './email'
import { maskAddresses, maskEmail, sendAccountNotice, sendLoginCode, sendNewsletterIssue, sendPasswordReset, } from './email'
import { sendSignUpCode } from './email-sign-up-code'
import { sendConfirmMail, sendWelcomeMail } from './email-welcome'

describe('maskEmail', () => {
  it('keeps the first letter and the top-level domain, and nothing else', () => {
    const masked = maskEmail('maria.k@example.com')

    expect(masked).toBe('m***@***.com')
    expect(masked).not.toContain('aria')
    expect(masked).not.toContain('example')
  })

  it('masks a domain with no dot whole', () => {
    expect(maskEmail('ops@localhost')).toBe('o***@***')
  })

  it('shows nothing of a string that is not an address', () => {
    expect(maskEmail('not-an-address')).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
    expect(maskEmail('')).toBe('***')
  })
})

describe('what a sent mail logs', () => {
  const CFG: ResendConfig = {
    apiKey: 're_test_mask',
    from: 'Sample Sender <hello@example.test>',
  }
  const TO = 'maria.k@example.com'
  const ORIGINS = {
    appOrigin: 'https://app.example.test',
    assetOrigin: 'https://assets.example.test',
  }
  const ITEMLESS = { subject: 'Subject', preheader: 'Preview', intro: 'Intro' }
  let logged: string[]

  beforeEach(() => {
    logged = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'stubbed' })),
    )
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const sends: Array<[string, () => Promise<unknown>]> = [
    [
      'a password reset',
      () =>
        sendPasswordReset(CFG, TO, {
          resetUrl: 'https://app.example.test/#/reset-password?token=t',
          ttlHours: 1,
        }),
    ],
    [
      'a sign-in code',
      () => sendLoginCode(CFG, TO, { code: '123456', ttlMinutes: 10 }),
    ],
    [
      'a newsletter',
      () =>
        sendNewsletterIssue(CFG, TO, {
          ...ITEMLESS,
          items: [],
          unsubscribeUrl: 'https://app.example.test/unsubscribe',
        }),
    ],
    [
      'an account notice',
      () =>
        sendAccountNotice(CFG, TO, {
          ...ITEMLESS,
          kind: 'account',
          items: [],
        }),
    ],
    [
      'a sign-up code',
      () => sendSignUpCode(CFG, TO, { code: '123456', ttlMinutes: 10 }),
    ],
    [
      'a welcome',
      () =>
        sendWelcomeMail(CFG, TO, {
          ...ORIGINS,
          voiceprint: null,
          signupSource: null,
        }),
    ],
    [
      'a confirm mail',
      () =>
        sendConfirmMail(CFG, TO, {
          ...ORIGINS,
          verifyUrl: 'https://app.example.test/api/auth/verify-email?token=t',
          voiceprint: null,
          ttlHours: 24,
        }),
    ],
  ]

  it.each(sends)('names the address of %s masked', async (_kind, send) => {
    await send()

    expect(logged).toEqual([expect.stringContaining('sent to m***@***.com')])
    expect(logged.join('\n')).not.toContain(TO)
  })
})

describe('what a mail Resend refuses logs', () => {
  const CFG: ResendConfig = { apiKey: 're_test_mask' }
  const TO = 'maria.k@example.com'
  let logged: string[]

  beforeEach(() => {
    logged = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('masks an address in the body Resend refuses it with', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            statusCode: 422,
            name: 'validation_error',
            message: `The address ${TO} cannot receive mail; try Maria <${TO}> later.`,
          },
          { status: 422 },
        ),
      ),
    )

    await sendPasswordReset(CFG, TO, {
      resetUrl: 'https://app.example.test/#/reset-password?token=t',
      ttlHours: 1,
    })

    expect(logged).toEqual([
      expect.stringContaining('[email] Resend rejected (422)'),
    ])
    expect(logged[0]).toContain('validation_error')
    expect(logged[0]).toContain('m***@***.com')
    expect(logged[0]).not.toContain('maria.k')
    expect(logged[0]).not.toContain('example.com')
  })

  it('masks an address in the error a request that never got through throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError(`fetch failed for ${TO}`)
      }),
    )

    await sendPasswordReset(CFG, TO, {
      resetUrl: 'https://app.example.test/#/reset-password?token=t',
      ttlHours: 1,
    })

    expect(logged).toEqual([
      '[email] Resend request failed: TypeError: fetch failed for m***@***.com',
    ])
  })
})

describe('maskAddresses', () => {
  it('masks every address in a text, and leaves the rest', () => {
    expect(
      maskAddresses('to a.b@example.com and <c+d@mail.example.org>, code 42'),
    ).toBe('to a***@***.com and <c***@***.org>, code 42')
  })
})
