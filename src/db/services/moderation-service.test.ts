// ============================================================
// The moderation service — every answer the worker gives, in the words a
// sheet can say
// ============================================================
//
// What the worker answers is pinned by its own suites (node-tests,
// reports-and-blocks-integration.test.ts); this pins how the phone reads
// each answer, and that it asks the worker only what the worker's own
// parser would take.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
}))
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

import { blockSinger, listBlockedSingers, REPORT_NOTE_MAX, REPORT_REASONS, reportContent, unblockSinger, } from '@/db/services/moderation-service'
import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { showNotification } from '@/stores/notifications-store'
import { REPORT_REASONS as WORKER_REASONS } from '../../../workers/db-worker/src/report-rules'

function makeToken(provider: string): string {
  const payload = {
    sub: 'user-1',
    provider,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

/** Every request the worker was sent. */
let sent: Array<{ url: string; init: RequestInit }> = []

function answer(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, init })
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

const REPORT = {
  targetKind: 'user' as const,
  targetId: 'singer-2',
  reason: 'offensive' as const,
}

beforeEach(() => {
  sent = []
  localStorage.clear()
  setAuthToken(makeToken('apple'))
  vi.mocked(showNotification).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a report', () => {
  it('offers the reasons the worker takes, and its note limit', () => {
    expect(REPORT_REASONS).toEqual(WORKER_REASONS)
    expect(REPORT_NOTE_MAX).toBe(500)
  })

  it('is sent as the worker reads it, under the session, and comes back sent', async () => {
    answer(201, { id: 'r1', status: 'open' })

    const outcome = await reportContent({ ...REPORT, note: '  The name  ' })

    expect(outcome).toEqual({ status: 'sent' })
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('http://api.test/api/reports')
    expect(sent[0].init.method).toBe('POST')
    expect(JSON.parse(String(sent[0].init.body))).toEqual({
      targetKind: 'user',
      targetId: 'singer-2',
      reason: 'offensive',
      note: 'The name',
    })
    expect(new Headers(sent[0].init.headers).get('Authorization')).toBe(
      `Bearer ${getAuthToken()}`,
    )
  })

  it('says so when the singer already has a report open on it', async () => {
    answer(200, { status: 'open' })
    expect(await reportContent(REPORT)).toEqual({ status: 'already-open' })
  })

  it('asks the worker nothing it would refuse', async () => {
    answer(201, { id: 'r1', status: 'open' })

    const tooLong = await reportContent({
      ...REPORT,
      note: 'a'.repeat(REPORT_NOTE_MAX + 1),
    })
    const noReason = await reportContent({
      ...REPORT,
      reason: 'bored' as unknown as 'offensive',
    })

    expect(tooLong).toEqual({ status: 'invalid' })
    expect(noReason).toEqual({ status: 'invalid' })
    expect(sent).toEqual([])
  })

  it.each([
    [400, 'self'],
    [401, 'refused'],
    [404, 'missing'],
    [429, 'busy'],
    [500, 'server'],
    [503, 'server'],
    [413, 'server'],
  ] as const)('reads a %i as %s', async (status, problem) => {
    answer(status, { error: 'No' })
    expect(await reportContent(REPORT)).toEqual({ status: problem })
  })

  it('reads the account rule as needing an account, and signs nobody out', async () => {
    answer(403, { error: 'Create an account to report a singer' })

    expect(await reportContent(REPORT)).toEqual({ status: 'account' })
    expect(getAuthToken()).not.toBeNull()
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('reads a suspension as suspended, and signs the account out', async () => {
    answer(403, { error: 'Suspended', code: 'account_suspended' })

    expect(await reportContent(REPORT)).toEqual({ status: 'suspended' })
    expect(getAuthToken()).toBeNull()
    // The sheet that asked says so itself, with the contact form.
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('names a lost connection as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await reportContent(REPORT)).toEqual({ status: 'unreachable' })
  })
})

describe('a block', () => {
  it('names the singer, and is blocked whether it is new or already stood', async () => {
    answer(201, { userId: 'singer-2', blocked: true })
    expect(await blockSinger('singer-2')).toEqual({ status: 'blocked' })
    expect(sent[0].url).toBe('http://api.test/api/blocks')
    expect(JSON.parse(String(sent[0].init.body))).toEqual({
      userId: 'singer-2',
    })

    answer(200, { userId: 'singer-2', blocked: true })
    expect(await blockSinger('singer-2')).toEqual({ status: 'blocked' })
  })

  it('reads a full list as full', async () => {
    answer(409, { error: 'You have blocked as many singers as you can.' })
    expect(await blockSinger('singer-2')).toEqual({ status: 'full' })
  })

  it('is lifted by the singer’s id, in the address', async () => {
    answer(200, { userId: 'a b', blocked: false })

    expect(await unblockSinger('a b')).toEqual({ status: 'unblocked' })
    expect(sent[0].url).toBe('http://api.test/api/blocks/a%20b')
    expect(sent[0].init.method).toBe('DELETE')
  })

  it('never asks the worker about nobody', async () => {
    answer(200, {})
    expect(await blockSinger('')).toEqual({ status: 'invalid' })
    expect(await unblockSinger('')).toEqual({ status: 'invalid' })
    expect(sent).toEqual([])
  })
})

describe('the blocked list', () => {
  it('lists each singer by the name they go by now, and drops what it cannot read', async () => {
    answer(200, {
      blocks: [
        { userId: 'singer-2', displayName: 'Ada', createdAt: '2026-11-01' },
        { userId: 7, displayName: 'Broken' },
      ],
    })

    expect(await listBlockedSingers()).toEqual({
      status: 'ok',
      blocks: [
        { userId: 'singer-2', displayName: 'Ada', createdAt: '2026-11-01' },
      ],
    })
  })

  it('takes an answer with no list for the server’s fault', async () => {
    answer(200, { nothing: true })
    expect(await listBlockedSingers()).toEqual({ status: 'server' })
  })

  it('tells a suspension the app’s way, as a board reads it unseen', async () => {
    answer(403, { error: 'Suspended', code: 'account_suspended' })

    expect(await listBlockedSingers()).toEqual({ status: 'suspended' })
    expect(getAuthToken()).toBeNull()
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('reads a refused session as refused', async () => {
    answer(401, { error: 'Unauthorized' })
    expect(await listBlockedSingers()).toEqual({ status: 'refused' })
  })
})
