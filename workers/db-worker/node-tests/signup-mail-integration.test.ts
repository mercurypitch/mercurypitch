// @vitest-environment node
//
// ── What a new account's first mail says ─────────────────────────────
//
// The first mail is rendered inside the sign-up request, before the app hands
// the device's voiceprints to the new account. So the app sends a hint: the
// newest twin the sign-up will adopt, and whether it started on Karaoke Night.
// This file pins the hint's whole trip through every sign-up route that mails:
// password (the confirm mail), a mailed sign-up code and Google, through the
// redirect flow's signed state too. And the rules around it: a bad hint never
// fails a sign-up, a returning singer gets no welcome, and a mail's links go
// back to the app the sign-up came from, never to an origin off the list.
//
// Run against real SQLite with the real migrations, driving the worker through
// its own HTTP surface. Only Resend and Google are stubbed.

import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VOICE_LEGENDS } from '../../../src/lib/mirror/legend-catalog'
import type { Env } from '../src/auth'
import { MAIL_ART, WORDMARK_PATH } from '../src/email-layout'
import { legendPortraitPath } from '../src/email-welcome'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const DEV = 'https://dev.mercurypitch.com'
const SINATRA = {
  twin: 'Frank Sinatra',
  lowMidi: 40,
  highMidi: 67,
  accuracy: 80,
  steadiness: 85,
}

interface Mailed {
  to: string
  subject: string
  html: string
  text: string
}

let sqlite: DatabaseSync
let env: Env
let mailed: Mailed[]
/** Who Google says signed in, for the next tokeninfo call. */
let googleSub: string

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'signup-mail-integration-secret',
    // localhost keeps the CAPTCHA out of the way; the other two are origins a
    // request may come from at all, which is not the same as being an app the
    // mail may link to.
    ALLOWED_ORIGINS: `localhost,${DEV},https://elsewhere.test`,
    APP_FALLBACK_ORIGIN: DEV,
    RESEND_API_KEY: 'test-resend-key',
    GOOGLE_CLIENT_ID: 'test-google-client',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
  }
  mailed = []
  googleSub = 'google-singer'
  vi.spyOn(console, 'log').mockImplementation(() => {})
  // Only Resend and Google are answered. A stub that swallowed everything
  // would hide a request going somewhere it should not.
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://api.resend.com/emails') {
        const body = JSON.parse(String(init?.body)) as {
          to: string[]
          subject: string
          html: string
          text: string
        }
        mailed.push({ ...body, to: body.to[0] as string })
        return Response.json({ id: `re_${mailed.length}` })
      }
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ id_token: 'redirect-id-token' })
      }
      if (url === 'https://www.googleapis.com/oauth2/v3/tokeninfo') {
        return Response.json({
          aud: 'test-google-client',
          sub: googleSub,
          email: `${googleSub}@example.com`,
          email_verified: 'true',
          name: 'Google Singer',
        })
      }
      throw new Error(`unexpected fetch to ${url}`)
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

function call(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function onlyMail(): Mailed {
  expect(mailed).toHaveLength(1)
  return mailed[0] as Mailed
}

async function register(
  email: string,
  extra: Record<string, unknown> = {},
  origin = DEV,
): Promise<{ token: string; userId: string }> {
  const response = await post(
    '/api/auth/register',
    { email, password: 'Sup3rSecret!x', displayName: 'New Singer', ...extra },
    { Origin: origin },
  )
  expect(response.status).toBe(200)
  return (await response.json()) as { token: string; userId: string }
}

describe('a password sign-up', () => {
  it('names the twin from its hint in the confirm mail', async () => {
    await register('twin@example.com', { voiceprintHint: SINATRA })

    const mail = onlyMail()
    expect(mail.to).toBe('twin@example.com')
    expect(mail.subject).toBe(
      'Confirm your email, then meet Frank Sinatra again',
    )
    expect(mail.html).toContain(
      `src="${DEV}/email/legends/frank-sinatra-v1.jpg"`,
    )
    expect(mail.html).toContain(`src="${DEV}/email/banner-07-letter-v1.jpg"`)
    expect(mail.html).toContain(`href="${DEV}/#/exercises"`)
    // The confirm link lands back on the app the sign-up came from.
    expect(mail.text).toContain(`returnTo=${encodeURIComponent(DEV)}`)
    expect(mail.text).toContain('The link works for 24 hours.')
  })

  it('still signs up with a hint that makes no sense, and mails the plain confirm', async () => {
    const { userId } = await register('junk@example.com', {
      voiceprintHint: { twin: 'Nobody Famous', lowMidi: 'low', highMidi: 999 },
      signupSource: 'somewhere',
    })

    expect(userId).toBeTruthy()
    const mail = onlyMail()
    expect(mail.subject).toBe('Confirm your email for Mercury Pitch')
    expect(mail.html).toContain('Who shares your range?')
    expect(mail.html).not.toContain('Nobody Famous')
  })

  it("links an unlisted app's sign-up to this environment's app instead", async () => {
    await register('elsewhere@example.com', {}, 'https://elsewhere.test')

    const mail = onlyMail()
    expect(mail.html).not.toContain('elsewhere.test')
    expect(mail.text).not.toContain('elsewhere.test')
    expect(mail.html).toContain(`href="${DEV}/#/path"`)
  })

  it('links a local sign-up to the local app but loads its pictures from a deployed one', async () => {
    await register('local@example.com', {}, 'http://localhost:3000')

    const mail = onlyMail()
    expect(mail.html).toContain('href="http://localhost:3000/#/path"')
    expect(mail.html).toContain(`src="${DEV}/email/banner-07-letter-v1.jpg"`)
    expect(mail.html).not.toContain('src="http://localhost')
  })
})

describe('a mailed sign-up code', () => {
  it('sends a welcome that knows where the sign-up started', async () => {
    const asked = await post(
      '/api/auth/email-code/request',
      { email: 'karaoke@example.com', signUp: true },
      { Origin: DEV },
    )
    const { ceremony } = (await asked.json()) as { ceremony: string }
    const code = /^(\d{6}) /.exec(onlyMail().subject)?.[1]
    expect(code).toBeDefined()
    mailed = []

    const verified = await post(
      '/api/auth/email-code/verify',
      { ceremony, code, signupSource: 'karaoke' },
      { Origin: DEV },
    )

    expect(verified.status).toBe(200)
    const mail = onlyMail()
    expect(mail.subject).toBe("Welcome to Mercury Pitch. Let's hear you.")
    expect(mail.html).toContain(
      `src="${DEV}/email/hero-06-karaoke-night-v1.jpg"`,
    )
    expect(mail.html).toContain(
      `<a href="${DEV}/#/home" aria-label="Open Mercury Pitch"`,
    )
  })
})

describe('Google', () => {
  it('carries the hint through the signed state of the redirect flow', async () => {
    const started = await post(
      '/api/auth/google/start',
      {
        returnTo: `${DEV}/`,
        voiceprintHint: SINATRA,
        signupSource: 'karaoke',
      },
      { Origin: DEV },
    )
    const { url } = (await started.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') as string
    const packed = JSON.parse(
      Buffer.from(state.split('.')[0] as string, 'base64url').toString(),
    ) as Record<string, unknown>
    expect(packed.vp).toEqual(['Frank Sinatra', 40, 67, 80, 85])
    expect(packed.src).toBe('karaoke')

    const callback = await call(
      `/api/auth/google/callback?code=valid&state=${encodeURIComponent(state)}`,
    )

    expect(callback.status).toBe(302)
    expect(callback.headers.get('Location')).toMatch(/#gauth=/)
    const mail = onlyMail()
    expect(mail.to).toBe('google-singer@example.com')
    expect(mail.subject).toBe('You share a range with Frank Sinatra')
    // A twin beats Karaoke Night for the picture.
    expect(mail.html).toContain(
      `src="${DEV}/email/hero-04-constellation-v1.jpg"`,
    )
    expect(mail.html).toContain(`href="${DEV}/#/voice-constellation"`)
  })

  it('refuses a state whose hint was edited on the way', async () => {
    const started = await post(
      '/api/auth/google/start',
      { returnTo: `${DEV}/`, voiceprintHint: SINATRA },
      { Origin: DEV },
    )
    const { url } = (await started.json()) as { url: string }
    const [body, sig] = (
      new URL(url).searchParams.get('state') as string
    ).split('.')
    const edited = JSON.parse(
      Buffer.from(body as string, 'base64url').toString(),
    ) as Record<string, unknown>
    edited.vp = ['Freddie Mercury', 40, 67, 80, 85]
    const forged = `${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${sig}`

    const callback = await call(
      `/api/auth/google/callback?code=valid&state=${encodeURIComponent(forged)}`,
    )

    expect(callback.headers.get('Location')).toContain(
      '#gauth_error=expired_state',
    )
    expect(mailed).toEqual([])
  })

  it('welcomes a native sign-up from the hint in its body, and a returning singer not at all', async () => {
    const first = await post(
      '/api/auth/google',
      { idToken: 'native-token', voiceprintHint: SINATRA },
      { Origin: DEV },
    )
    expect(first.status).toBe(200)
    expect(onlyMail().subject).toBe('You share a range with Frank Sinatra')

    const again = await post(
      '/api/auth/google',
      { idToken: 'native-token', voiceprintHint: SINATRA },
      { Origin: DEV },
    )
    expect(again.status).toBe(200)
    expect(mailed).toHaveLength(1)
  })
})

describe('the confirm link sent again', () => {
  it("names the account's own twin, with no hint needed", async () => {
    const { token, userId } = await register('again@example.com')
    const takenAt = new Date().toISOString()
    sqlite
      .prepare(
        'INSERT INTO voiceprints (id, createdAt, updatedAt, userId, summary, twin, source, takenAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'vp-1',
        takenAt,
        takenAt,
        userId,
        JSON.stringify({
          lowMidi: 40,
          highMidi: 67,
          semitones: 27,
          accuracy: 80,
          steadiness: 85,
        }),
        'Frank Sinatra',
        'mirror',
        takenAt,
      )
    mailed = []

    const response = await call('/api/auth/resend-verification', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Origin: DEV },
    })

    expect(response.status).toBe(200)
    expect(onlyMail().subject).toBe(
      'Confirm your email, then meet Frank Sinatra again',
    )
  })
})

describe('the pictures a mail points at', () => {
  it('all exist in public/email, each under 200 KB', () => {
    const paths = [
      ...Object.values(MAIL_ART).map((art) => art.path),
      WORDMARK_PATH,
      ...VOICE_LEGENDS.map((legend) => legendPortraitPath(legend.id)),
    ]
    for (const path of paths) {
      const bytes = readFileSync(
        new URL(`../../../public${path}`, import.meta.url),
      )
      expect(bytes.length, path).toBeGreaterThan(0)
      expect(bytes.length, path).toBeLessThan(200 * 1024)
    }
  })
})
