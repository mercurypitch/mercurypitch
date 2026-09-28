// Play review access, from the phone: what it sends, and what Settings says
// for each answer the server can give (workers/db-worker/src/review-access.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ asked: 0 }))
vi.mock('@/db/services/auth-service', () => ({
  requireAuth: vi.fn(async () => {
    auth.asked += 1
    return Promise.resolve(true)
  }),
}))
vi.mock('@/db/services/user-service', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer phone-token' }),
}))

import type { ReviewAccessOutcome } from './karaoke-review-access'
import { redeemReviewAccess, reviewAccessLine } from './karaoke-review-access'

const API = 'https://api.test/'

interface Sent {
  url: string
  init: RequestInit
}
let sent: Sent[] = []

function answer(status: number, body: unknown = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, init })
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
}

beforeEach(() => {
  sent = []
  auth.asked = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('redeeming a review code', () => {
  it('gives the phone its identity, then sends the code as typed', async () => {
    answer(200, { granted: 3, left: 3 })

    const outcome = await redeemReviewAccess('review test code', API)

    expect(outcome).toEqual({ kind: 'granted', songs: 3 })
    expect(auth.asked).toBe(1)
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('https://api.test/api/billing/review-access')
    expect(sent[0].init.method).toBe('POST')
    expect(sent[0].init.headers).toMatchObject({
      Authorization: 'Bearer phone-token',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(sent[0].init.body))).toEqual({
      code: 'review test code',
    })
  })

  it('says so when the account had its songs already', async () => {
    answer(200, { granted: 0, already: true, left: 2 })

    expect(await redeemReviewAccess('REVIEW-TEST-CODE', API)).toEqual({
      kind: 'already',
    })
  })

  it('says why nothing was granted, for each refusal', async () => {
    const cases: Array<[number, string]> = [
      [403, 'That code is not right.'],
      [429, 'Too many tries. Try again in an hour.'],
      [409, 'Review access is used up.'],
      [501, 'Review access is not available yet.'],
      [500, 'The code could not be checked. Try again.'],
    ]
    for (const [status, why] of cases) {
      answer(status, { error: 'server words' })
      expect(await redeemReviewAccess('x', API), String(status)).toEqual({
        kind: 'refused',
        why,
      })
    }
  })

  it('never throws when the server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )

    expect(await redeemReviewAccess('x', API)).toEqual({
      kind: 'refused',
      why: 'The server could not be reached. Try again.',
    })
  })

  it('asks nothing where the build has no server', async () => {
    answer(200, { granted: 3 })

    expect(await redeemReviewAccess('x', '')).toEqual({
      kind: 'refused',
      why: 'Review access is not available yet.',
    })
    expect(sent).toEqual([])
  })
})

describe('what Settings says', () => {
  it('names the songs, one or several', () => {
    const lines = (
      [
        { kind: 'granted', songs: 3 },
        { kind: 'granted', songs: 1 },
        { kind: 'already' },
        { kind: 'refused', why: 'That code is not right.' },
      ] satisfies ReviewAccessOutcome[]
    ).map(reviewAccessLine)

    expect(lines).toEqual([
      '3 songs are yours.',
      '1 song is yours.',
      'This account has its review songs already.',
      'That code is not right.',
    ])
  })

  it('never says credits', () => {
    const lines = (
      [
        { kind: 'granted', songs: 2 },
        { kind: 'already' },
      ] satisfies ReviewAccessOutcome[]
    ).map(reviewAccessLine)

    for (const line of lines) expect(line.toLowerCase()).not.toContain('credit')
  })
})
