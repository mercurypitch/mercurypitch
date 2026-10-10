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

  // Sign-up takes any address with no whitespace, an @ and a dot after it
  // (EMAIL_RE in auth.ts), and a provider's error text can quote one back
  // (#970 review, F-7).
  it.each([
    ['Invalid `to` field: maria.k@example.com', ['maria', 'example']],
    [
      '{"message":"to: Jane <jane.doe+tag@sub.example.co.uk>"}',
      ['jane.doe', 'example'],
    ],
    ['müller@example.com was refused', ['müller', 'mül', 'ller', 'example']],
    ['josé@example.com was refused', ['josé', 'example']],
    ['user@exämple.com was refused', ['exämple', 'mple']],
    ['"quoted local"@example.com', ['quoted', 'local', 'example']],
    ['user@[192.0.2.1]', ['192.0.2.1', '192']],
  ])('leaves nothing of %s readable', (input, secrets) => {
    const output = maskAddresses(input)

    expect(secrets.filter((secret) => output.includes(secret))).toEqual([])
    expect(output).toContain('***@***')
  })

  it('masks a Unicode address the way it masks an ASCII one', () => {
    expect(maskAddresses('josé@exämple.com was refused')).toBe(
      'j***@***.com was refused',
    )
    expect(maskAddresses('müller@example.com')).toBe('m***@***.com')
    // "é" written as "e" plus a combining accent (NFD).
    expect(maskAddresses('jose\u0301@example.com')).toBe('j***@***.com')
    // A first letter outside the BMP shows whole, never half of it.
    expect(maskAddresses('\u{1D4A5}ane@example.com')).toBe(
      '\u{1D4A5}***@***.com',
    )
    expect(maskAddresses('to <user@[192.0.2.1]>')).toBe('to <u***@***>')
  })

  // RFC 5322 lets a local part hold these as well as letters, digits and
  // dots, and sign-up takes them. Each is masked with the rest of the local
  // part, never read as where an address starts (#970 review, F-7).
  const LOCAL_PART_SPECIALS = "!#$%&'*+-/=?^_`{|}~."

  it.each([...LOCAL_PART_SPECIALS])(
    'shows nothing of a local part after its first character, with %s in it',
    (special) => {
      expect(maskAddresses(`to x${special}secret@example.com`)).toBe(
        'to x***@***.com',
      )
    },
  )

  it('masks a local part with an apostrophe whole', () => {
    expect(maskAddresses("to mary.o'brien@example.com")).toBe('to m***@***.com')
  })

  it('masks an address in single quotes or backticks, quote and all', () => {
    expect(maskAddresses("refused 'jane.doe@example.com' for now")).toBe(
      "refused '***@***.com' for now",
    )
    expect(
      maskAddresses('The `to` field `jane.doe@example.com` is invalid'),
    ).toBe('The `to` field `***@***.com` is invalid')
  })

  // Sign-up takes a local part with any character but a space or an @
  // (EMAIL_RE in auth.ts). A symbol or an emoji next to the @ must not leave
  // the rest of it readable (#970 round-4 review, N-5).
  it.each([
    [
      'an emoji right before the @',
      'smile\u{1F600}@example.com',
      's***@***.com',
    ],
    ['an emoji first', '\u{1F600}smile@example.com', '\u{1F600}***@***.com'],
    ['a symbol right before the @', 'jane\u20AC@example.com', 'j***@***.com'],
    ['a symbol first', '\u20ACjane@example.com', '\u20AC***@***.com'],
  ])('masks a local part with %s whole', (_, input, masked) => {
    expect(maskAddresses(`to ${input} now`)).toBe(`to ${masked} now`)
  })

  // The rest of the round-4 review's cases. A top-level domain shows, as
  // maskEmail means it to.
  it.each([
    ['a!b#c$d&e*f/g=h?i^j`k{l|m}n~o@example.com', 'a***@***.com'],
    ['first/last@example.com', 'f***@***.com'],
    ['tom&jerry@example.com', 't***@***.com'],
    ['ANNA.SMITH@EXAMPLE.COM', 'A***@***.COM'],
    [
      'to=<bob@example.org>; cc=carol@example.net',
      'to=<b***@***.org>; c***@***.net',
    ],
    ['user@sub-domain.example', 'u***@***.example'],
    ['"a\\"b"@example.com', '"***@***.com'],
  ])('masks %s as %s', (input, masked) => {
    expect(maskAddresses(input)).toBe(masked)
  })

  // Text with no address in it was read to its end from every place an
  // address could start in it: 50 KB of base64 or hex in an error text took
  // 1.7 s to mask (#970 round-4 review, N-4), and 50 KB of escaped quotes,
  // or of "a@[" over and over, 1.1 s and 0.65 s (#975 review). An unquoted
  // local part is now read once, from where its run starts, and a quoted
  // local part and an address literal for at most 64 characters.
  const BASE64 =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const RUNS = [
    [
      'base64',
      `${Array.from({ length: 50_000 }, (_, i) => BASE64[(i * 7919) % 64]).join('')}==`,
    ],
    ['hex', '0123456789abcdef'.repeat(3_125)],
    ['escaped quotes', `"${'\\"'.repeat(25_000)}`],
    ['"a@[" over and over', 'a@['.repeat(16_667)],
  ] as const

  /** The fastest of three runs, in milliseconds: one slow run is noise. */
  function fastest(run: () => void): number {
    const times = [0, 1, 2].map(() => {
      const start = performance.now()
      run()
      return performance.now() - start
    })
    return Math.min(...times)
  }

  it('masks an unquoted local part whole, however long it is', () => {
    expect(maskAddresses(`${'a'.repeat(64)}@example.com`)).toBe('a***@***.com')
    // Past the 64 characters RFC 5321 allows.
    expect(maskAddresses(`b${'a'.repeat(64)}@example.com`)).toBe('b***@***.com')
    expect(maskAddresses(`${'n'.repeat(60)}0123456789@example.com`)).toBe(
      'n***@***.com',
    )
  })

  it('masks a quoted local part or an address literal of up to 64 characters whole, and an address with a longer one only where a piece of it reads as an address', () => {
    expect(maskAddresses(`"${'q'.repeat(64)}"@example.com`)).toBe(
      '"***@***.com',
    )
    // An escaped pair counts as one.
    expect(maskAddresses(`"${'\\"'.repeat(64)}"@example.com`)).toBe(
      '"***@***.com',
    )
    expect(maskAddresses(`user@[${'1.'.repeat(32)}]`)).toBe('u***@***')
    for (const longer of [
      `"${'q'.repeat(65)}"@example.com`,
      `user@[${'1.'.repeat(32)}1]`,
    ]) {
      expect(maskAddresses(`to ${longer} now`)).toBe(`to ${longer} now`)
    }
    // Unless a piece of it reads as an address on its own: here its last
    // 64 escaped quotes, a quoted local part from the second quote.
    expect(maskAddresses(`"${'\\"'.repeat(65)}"@example.com`)).toBe(
      '"\\"***@***.com',
    )
  })

  it.each(RUNS)(
    'masks 50 KB of %s with no address in it in time linear in its length',
    (_, run) => {
      const text = `Resend error: ${run}`

      expect(fastest(() => maskAddresses(text))).toBeLessThan(500)
      expect(maskAddresses(text)).toBe(text)
    },
    60_000,
  )
})
