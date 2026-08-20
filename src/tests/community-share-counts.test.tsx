// ============================================================
// Community — three counters that used to say "sessions"
// ============================================================
//
// The Sessions tab counts published setlists, the profile counts runs, and
// the share picker lists runs of every kind. All three said "session" and
// meant something different. These tests hold the distinction in place.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '@/db/entities'

const mocks = vi.hoisted(() => ({
  loadSessionRecords: vi.fn(async (_limit?: number) => [] as SessionRecord[]),
  loadSharedSessions: vi.fn(async () => [] as unknown[]),
  loadSharedMelodies: vi.fn(async () => [] as unknown[]),
  storageGet: vi.fn((_key: string, fallback: unknown) => fallback),
}))

vi.mock('@/db/services/session-service', () => ({
  loadSessionRecords: mocks.loadSessionRecords,
  sessionRecordVersion: () => 0,
}))
vi.mock('@/db/services/share-service', () => ({
  canPostToCommunity: async () => true,
  loadSharedMelodies: mocks.loadSharedMelodies,
  loadSharedSessions: mocks.loadSharedSessions,
  loadUserProfile: async () => null,
  saveSharedMelody: async () => {},
  saveSharedSession: async () => {},
  unpublishShared: async () => {},
}))
vi.mock('@/db/services/challenges-service', () => ({
  loadBadgeDefinitions: async () => [],
  loadUserBadges: async () => [],
}))
vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: async () => 0,
}))
vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
  getUserId: () => 'user-0001',
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: async () => [],
}))
// Partial: the stores this component pulls in build persisted signals at
// module scope, so blanking the module takes the whole import graph down.
vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  storageGet: mocks.storageGet,
  storageSet: () => {},
}))

const { CommunityShare } = await import('@/components/CommunityShare')

function cloudRun(id: string, source: SessionRecord['source']): SessionRecord {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    userId: 'u1',
    melodyName: `Run ${id}`,
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: '2026-08-01T10:05:00.000Z',
    score: 64,
    accuracy: 64,
    notesHit: 4,
    notesTotal: 4,
    streak: 1,
    results: [],
    source,
  } as SessionRecord
}

function openTab(name: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  mocks.loadSessionRecords.mockResolvedValue([])
  mocks.loadSharedSessions.mockResolvedValue([])
  mocks.loadSharedMelodies.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Community > Sessions', () => {
  it('says the tab counts published setlists, not runs', async () => {
    render(() => <CommunityShare />)
    openTab(/Sessions/)

    expect(
      await screen.findByText(
        /setlists you published for other people to sing/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/They are\s+not runs/i)).toBeInTheDocument()
  })

  it('opens the guide from that note', async () => {
    render(() => <CommunityShare />)
    openTab(/Sessions/)

    fireEvent.click(
      await screen.findByRole('button', { name: /what counts where\?/i }),
    )

    expect(await screen.findByTestId('what-counts-modal')).toBeInTheDocument()
  })
})

describe('Community > Profile', () => {
  it('counts the account’s runs, of every kind', async () => {
    mocks.loadSessionRecords.mockResolvedValue([
      cloudRun('a', 'exercise'),
      cloudRun('b', 'challenge'),
    ])

    render(() => <CommunityShare />)
    openTab(/Profile/)

    await waitFor(() =>
      expect(screen.getByText('runs').previousElementSibling).toHaveTextContent(
        '2',
      ),
    )
    expect(screen.getByText(/across your account/i)).toBeInTheDocument()
  })
})

describe('Community > share picker', () => {
  it('colour-codes each run by kind instead of inventing its own names', async () => {
    mocks.loadSessionRecords.mockResolvedValue([
      cloudRun('a', 'practice'),
      cloudRun('b', 'weekly'),
    ])

    render(() => <CommunityShare />)
    openTab(/Sessions/)
    fireEvent.click(
      await screen.findByRole('button', { name: /Share a session/i }),
    )

    // The map this replaced called a practice run a "session" — the exact
    // word the tab beneath it used for a published setlist.
    expect(await screen.findByText('Practice')).toBeInTheDocument()
    expect(screen.getByText('Weekly')).toBeInTheDocument()
    expect(screen.queryByText('session')).toBeNull()
  })
})
