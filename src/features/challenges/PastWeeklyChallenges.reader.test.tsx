// ============================================================
// The web's past Legends, read for whoever holds the browser
// ============================================================
//
// The worker withholds from each reader the singers in a block with them
// (REQ-RB-014), so the archive is read again when another account signs in
// (not for a refreshed token), and after a block made from a podium here;
// the list stays on screen while that read is out. The session is real; the
// archive read is a stand-in.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WeeklyService from './weekly-service'

const reads = vi.hoisted(() => ({
  count: 0,
  /** Holds the next read back until let go. */
  hold: null as null | Promise<void>,
}))

vi.mock('./weekly-service', async (importOriginal) => ({
  ...(await importOriginal<typeof WeeklyService>()),
  getWeeklyArchive: async () => {
    reads.count += 1
    if (reads.hold !== null) await reads.hold
    return [
      {
        id: 'p1',
        slug: 'p1',
        title: 'Nessun dorma',
        description: 'A closed one',
        featType: 'money-note',
        difficulty: 'advanced',
        targetItems: [],
        targetScore: 70,
        endsAt: '2026-10-21T00:00:00.000Z',
        results: {
          version: 2,
          top3: [{ rank: 1, userId: 'iva', displayName: 'Iva', best: 91 }],
          attemptedCount: 12,
          completedCount: 4,
          closedAt: '2026-10-21T08:00:00Z',
        },
      },
    ]
  },
}))

import { setAuthToken } from '@/db/services/user-service'
import { closeSingerSheet, singerSheetSubject, } from '@/stores/singer-sheet-store'
import { PastWeeklyChallenges } from './PastWeeklyChallenges'

function token(sub: string): string {
  const body = btoa(
    JSON.stringify({
      sub,
      provider: 'password',
      exp: Math.floor(Date.now() / 1000) + 3600 + Math.random() * 60,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  reads.count = 0
  reads.hold = null
  localStorage.clear()
  setAuthToken(token('acc-1'))
})

afterEach(() => {
  closeSingerSheet()
  cleanup()
  setAuthToken(null)
})

describe('the past Legends, read for whoever holds the browser', () => {
  it('are read again when another account signs in, not for a refreshed token', async () => {
    render(() => <PastWeeklyChallenges />)
    await waitFor(() => screen.getByText('Nessun dorma'))
    expect(reads.count).toBe(1)

    setAuthToken(token('acc-1'))
    await settle()
    expect(reads.count).toBe(1)

    setAuthToken(token('acc-2'))
    await settle()
    expect(reads.count).toBe(2)
  })

  it('stay on screen while the read after a block is out', async () => {
    render(() => <PastWeeklyChallenges />)
    const more = await waitFor(() =>
      screen.getByRole('button', { name: 'More about Iva' }),
    )
    more.click()
    let letGo: () => void = () => {}
    reads.hold = new Promise<void>((resolve) => {
      letGo = resolve
    })

    singerSheetSubject()?.onBlocked?.()
    await settle()

    expect(reads.count).toBe(2)
    expect(screen.queryByText('Loading past challenges…')).toBeNull()
    expect(screen.getByTestId('podium-p1').textContent).toContain('Iva')
    letGo()
    await settle()
    expect(screen.getByTestId('podium-p1').textContent).toContain('91%')
  })
})
