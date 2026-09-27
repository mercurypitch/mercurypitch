// ============================================================
// The fill after signing in: what arrived, counted once
// ============================================================
//
// S6 step 5 (4b, REQ-NAM-043 to 045). Signing in to an account that already
// existed brings its history to the phone: Progress and the Voice list read
// it from the account. The Account screen says so once, with the real
// counts, read the way Progress reads them. A read that fails is a failure
// to be named and retried, never a count of zero.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import { loadProgressSessionRecords } from '@/db/services/session-service'
import { setAuthToken } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { loadProgressVoiceprints } from '@/db/services/voiceprint-service'
import { fillLine } from './account-copy'
import { accountFillDue, forgetAccountFill, loadAccountFill, markAccountFillDue, settleAccountFill, } from './account-fill'

vi.mock('@/db/services/session-service', () => ({
  loadProgressSessionRecords: vi.fn(),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  loadProgressVoiceprints: vi.fn(),
}))

const sessionsMock = vi.mocked(loadProgressSessionRecords)
const voiceprintsMock = vi.mocked(loadProgressVoiceprints)

function token(sub: string): string {
  const body = btoa(
    JSON.stringify({
      sub,
      provider: 'google',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

function record(id: string, endedAt: string): SessionRecord {
  return { id, endedAt } as SessionRecord
}

function voiceprint(id: string): VoiceprintRecord {
  return { id, takenAt: '2026-09-01T10:00:00Z' } as VoiceprintRecord
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(token('user-1'))
  sessionsMock.mockReset()
  voiceprintsMock.mockReset()
  sessionsMock.mockResolvedValue({
    records: [
      record('r-1', '2026-09-20T10:00:00Z'),
      record('r-2', '2026-09-19T10:00:00Z'),
    ],
    available: true,
    complete: true,
    totalAvailable: 2,
  })
  voiceprintsMock.mockResolvedValue({
    records: [voiceprint('v-1')],
    available: true,
    complete: true,
    totalAvailable: 1,
    comparable: true,
  })
})

afterEach(() => {
  setAuthToken(null)
  localStorage.clear()
})

describe('the fill after signing in', () => {
  it("counts the account's runs and voiceprints the way Progress reads them", async () => {
    const fill = await loadAccountFill()

    expect(fill).toEqual({ status: 'ok', runs: 2, voiceprints: 1 })
    expect(sessionsMock).toHaveBeenCalledWith({
      pageSize: 500,
      maxRecords: 5_000,
    })
  })

  it('names a history it could not read as a failure, never as nothing', async () => {
    sessionsMock.mockResolvedValue({
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    })

    expect(await loadAccountFill()).toEqual({ status: 'failed' })
  })

  it('is due once: once it has been shown, it is not due again', () => {
    markAccountFillDue('user-1')
    const before = accountFillDue()

    settleAccountFill()

    expect(before).toBe(true)
    expect(accountFillDue()).toBe(false)
  })

  it('is never due for an account other than the one that signed in', () => {
    markAccountFillDue('user-1')

    setAuthToken(token('user-2'))

    expect(accountFillDue()).toBe(false)
  })

  it('goes with the session on the way out', () => {
    markAccountFillDue('user-1')

    forgetAccountFill()

    expect(accountFillDue()).toBe(false)
  })
})

describe('the fill line', () => {
  it('says the counts in words', () => {
    expect(fillLine(38, 2)).toBe('38 runs and 2 voiceprints.')
    expect(fillLine(1, 1)).toBe('1 run and 1 voiceprint.')
    expect(fillLine(0, 0)).toBe('no runs or voiceprints yet.')
  })
})
