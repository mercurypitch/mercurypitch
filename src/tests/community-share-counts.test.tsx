// ============================================================
// Community — three counters that used to say "sessions"
// ============================================================
//
// The Sessions tab counts published results, the profile counts runs, and
// the share picker lists runs of every kind. All three said "session" and
// meant something different. These tests hold the distinction in place.
//
// The board's cards live here too, for the same reason: the board is
// everyone's, and what a card offers depends on whether it is yours.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CloudRequestError } from '@/db/adapters/server-adapter'
import type { SessionRecord } from '@/db/entities'
import { sessionFingerprint } from '@/features/community/share-identity'
import { decodeSharePayload } from '@/lib/share-codec'
import { decodeSharedRunResult } from '@/lib/shared-run-result'

const mocks = vi.hoisted(() => ({
  accountHeld: vi.fn(() => true),
  loadSessionRecords: vi.fn(async (_limit?: number) => [] as SessionRecord[]),
  loadSharedSessions: vi.fn(async () => [] as unknown[]),
  loadSharedMelodies: vi.fn(async () => [] as unknown[]),
  loadPublishedShareCounts: vi.fn(async (_userId: string) => ({
    melodies: 0,
    sessions: 0,
  })),
  saveSharedMelody: vi.fn(),
  saveSharedSession: vi.fn(),
  unpublishShared: vi.fn(),
  notify: vi.fn(),
  libraryMelodies: vi.fn(() => [] as unknown[]),
  copyShareUrl: vi.fn(async (_encoded: string) => true),
  userId: 'user-0001',
  storageGet: vi.fn((_key: string, fallback: unknown) => fallback),
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: mocks.accountHeld,
}))
vi.mock('@/db/services/session-service', () => ({
  loadSessionRecords: mocks.loadSessionRecords,
  sessionRecordVersion: () => 0,
}))
vi.mock('@/db/services/share-service', () => ({
  canPostToCommunity: () => mocks.accountHeld(),
  loadPublishedShareCounts: mocks.loadPublishedShareCounts,
  loadSharedMelodies: mocks.loadSharedMelodies,
  loadSharedSessions: mocks.loadSharedSessions,
  loadUserProfile: async () => null,
  saveSharedMelody: mocks.saveSharedMelody,
  saveSharedSession: mocks.saveSharedSession,
  unpublishShared: mocks.unpublishShared,
}))
vi.mock('@/db/services/challenges-service', () => ({
  loadBadgeDefinitions: async () => [],
  loadUserBadges: async () => [],
}))
vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: async () => 0,
}))
vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authVersion: () => version(),
  getUserId: () => mocks.userId,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.notify,
}))
vi.mock('@/stores/melody-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAllMelodies: mocks.libraryMelodies,
}))
vi.mock('@/lib/share-codec', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  copyShareUrl: mocks.copyShareUrl,
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

const [version, setVersion] = createSignal(0)
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
)
const { CommunityShare } = await import('@/components/CommunityShare')

function switchAccount(userId: string): void {
  mocks.userId = userId
  setVersion((value) => value + 1)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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

/** A melody on the public board, published by `userId`. */
function boardMelody(id: string, userId: string, name: string) {
  return {
    id,
    userId,
    name,
    items: [{ midi: 60, startBeat: 0, duration: 1, freq: 261.63 }],
    author: `Singer ${userId}`,
    tags: [],
    date: Date.parse('2026-09-01T10:00:00.000Z'),
  }
}

/** A result on the public board, published by `userId`. */
function boardResult(id: string, userId: string, name: string) {
  return {
    id,
    userId,
    name,
    items: [],
    author: `Singer ${userId}`,
    results: [72],
    date: Date.parse('2026-09-01T10:00:00.000Z'),
  }
}

beforeEach(() => {
  mocks.userId = 'user-0001'
  mocks.libraryMelodies.mockReturnValue([])
  mocks.accountHeld.mockReturnValue(true)
  mocks.loadSessionRecords.mockResolvedValue([])
  mocks.loadSharedSessions.mockResolvedValue([])
  mocks.loadSharedMelodies.mockResolvedValue([])
  mocks.loadPublishedShareCounts
    .mockReset()
    .mockResolvedValue({ melodies: 0, sessions: 0 })
  mocks.saveSharedSession
    .mockReset()
    .mockResolvedValue(boardResult('s-new', 'user-0001', 'Run a'))
  mocks.saveSharedMelody
    .mockReset()
    .mockResolvedValue(boardMelody('m-new', 'user-0001', 'New melody'))
  mocks.unpublishShared.mockReset().mockResolvedValue(true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  mocks.storageGet.mockImplementation((_key, fallback) => fallback)
})

afterEach(() => {
  cleanup()
  if (originalClipboard !== undefined)
    Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('Community > Sessions', () => {
  it('explains that sharing a result does not record another run', async () => {
    render(() => <CommunityShare />)
    openTab(/Sessions/)

    expect(
      await screen.findByText(
        /results the community has shared from completed runs/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Publishing or viewing a result does not add a run/i),
    ).toBeInTheDocument()
  })

  it("does not call the community's results yours", async () => {
    // The tab is the public board, everyone's results side by side. The
    // note above it used to say "results you published".
    mocks.loadSharedSessions.mockResolvedValue([
      boardResult('s-theirs', 'user-0002', 'Their result'),
    ])

    render(() => <CommunityShare />)
    openTab(/Sessions/)
    await screen.findByRole('button', { name: 'Open Their result' })

    expect(screen.queryByText(/you published/i)).toBeNull()
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

  it('does not promise an account to somebody who has not made one', async () => {
    // An anonymous identity holds a valid token and has real cloud rows, so
    // the runs are right — but they live under an id in this browser's
    // localStorage. "On every device you sign in on" would be false.
    mocks.accountHeld.mockReturnValue(false)
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'exercise')])

    render(() => <CommunityShare />)
    openTab(/Profile/)

    await waitFor(() =>
      expect(screen.getByText('run').previousElementSibling).toHaveTextContent(
        '1',
      ),
    )
    expect(screen.getByText(/on this device only/i)).toBeInTheDocument()
    expect(screen.queryByText(/across your account/i)).toBeNull()
  })

  it("counts only the singer's own shares under Published", async () => {
    mocks.loadPublishedShareCounts.mockResolvedValue({
      melodies: 1,
      sessions: 0,
    })
    // The board is everyone's. Counted whole, it credited each singer with
    // the whole community's shares. The achievement count made the same
    // mistake once; the worker now counts per owner (grants.ts,
    // sharesPosted), and so does this.
    mocks.loadSharedMelodies.mockResolvedValue([
      boardMelody('m-mine', 'user-0001', 'Mine'),
      boardMelody('m-theirs', 'user-0002', 'Theirs'),
      boardMelody('m-also', 'user-0003', 'Also theirs'),
    ])
    mocks.loadSharedSessions.mockResolvedValue([
      boardResult('s-theirs', 'user-0002', 'Their result'),
    ])
    // This browser's own copy of the same share, under its local id. It is
    // the board row above, not a second publication.
    const localCopy = { ...boardMelody('m-local', '', 'Mine') }
    delete (localCopy as { userId?: string }).userId
    mocks.storageGet.mockImplementation((key: string, fallback: unknown) =>
      key === 'pp_shared_melodies' ? [localCopy] : fallback,
    )

    render(() => <CommunityShare />)
    // The board has loaded once somebody else's card is on it.
    await screen.findByRole('button', { name: 'Open Also theirs' })
    openTab(/Profile/)

    expect(screen.getByText('melody').previousElementSibling).toHaveTextContent(
      '1',
    )
    expect(screen.queryByText(/^results?$/)).toBeNull()
  })
})

describe('Community > board cards', () => {
  it('copies and opens canonical public result links', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    mocks.loadSharedSessions.mockResolvedValue([
      boardResult('canonical-id', 'user-0001', 'Published run'),
    ])
    render(() => <CommunityShare />)
    openTab(/Sessions/)
    const open = await screen.findByRole('button', {
      name: 'Open Published run',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    const url = new URL(writeText.mock.calls[0][0])
    expect(url.hash).toBe('#/share?type=session&id=canonical-id')
    fireEvent.click(open)
    expect(window.location.hash).toBe(url.hash)
  })

  it('copies and opens a self-contained local result without source or owner identifiers', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const local = {
      id: 'local-only',
      sourceSessionId: 'private-run-id',
      name: 'Guest result',
      items: [],
      author: 'Guest',
      results: [87],
      date: 12345,
    }
    mocks.storageGet.mockImplementation((key, fallback) =>
      key === 'pp_shared_sessions' ? [local] : fallback,
    )
    render(() => <CommunityShare />)
    openTab(/Sessions/)
    const open = await screen.findByRole('button', {
      name: 'Open Guest result',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    const url = new URL(writeText.mock.calls[0][0])
    expect(url.hash.startsWith('#/result/')).toBe(true)
    expect(decodeSharedRunResult(url.hash.slice('#/result/'.length))).toEqual({
      name: local.name,
      author: local.author,
      results: local.results,
      date: local.date,
    })
    fireEvent.click(open)
    expect(window.location.hash).toBe(url.hash)
  })

  it('keeps local playback settings when its canonical server card is loaded', async () => {
    const server = {
      ...boardMelody('canonical', 'user-0001', 'Server title'),
      items: [
        {
          id: 1,
          note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
          duration: 2,
          startBeat: 0,
        },
      ],
    }
    const local = {
      ...server,
      name: 'Old local title',
      bpm: 87,
      key: 'E',
      scale: 'minor',
    }
    mocks.storageGet.mockImplementation((key, fallback) =>
      key === 'pp_shared_melodies' ? [local] : fallback,
    )
    mocks.loadSharedMelodies.mockResolvedValue([server])
    render(() => <CommunityShare />)
    await screen.findByRole('button', { name: 'Open Server title' })
    expect(
      screen.queryByRole('button', { name: 'Open Old local title' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(mocks.copyShareUrl).toHaveBeenCalledTimes(1)
    expect(
      decodeSharePayload(mocks.copyShareUrl.mock.calls[0][0]),
    ).toMatchObject({
      t: 'melody',
      d: { n: 'Server title', b: 87, k: 'E', s: 'minor', i: [[64, 0, 2]] },
    })
  })

  it('explains that unpublishing a melody cannot revoke its self-contained links', async () => {
    mocks.loadSharedMelodies.mockResolvedValue([
      boardMelody('mine', 'user-0001', 'My melody'),
    ])
    render(() => <CommunityShare />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Unpublish My melody' }),
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Existing melody links still work.')
    expect(dialog).not.toHaveTextContent('stops being able to open it')
    expect(mocks.unpublishShared).not.toHaveBeenCalled()
  })

  it('does not treat a saved local copy from another account as permission to unpublish', async () => {
    const share = boardMelody('m-mine', 'user-0001', 'Saved publication')
    mocks.storageGet.mockImplementation((key, fallback) =>
      key === 'pp_shared_melodies' ? [share] : fallback,
    )
    render(() => <CommunityShare />)
    await screen.findByRole('button', { name: 'Unpublish Saved publication' })
    switchAccount('user-0002')
    expect(
      screen.queryByRole('button', { name: 'Unpublish Saved publication' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Open Saved publication' }),
    ).toBeInTheDocument()
    expect(mocks.unpublishShared).not.toHaveBeenCalled()
  })

  it("offers Unpublish on the singer's own melody and not on anyone else's", async () => {
    mocks.loadSharedMelodies.mockResolvedValue([
      boardMelody('m-mine', 'user-0001', 'My warm-up'),
      boardMelody('m-theirs', 'user-0002', 'Their warm-up'),
    ])

    render(() => <CommunityShare />)
    await screen.findByRole('button', { name: 'Open Their warm-up' })

    expect(
      screen.getByRole('button', { name: 'Unpublish My warm-up' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Unpublish Their warm-up' }),
    ).toBeNull()
  })

  it("offers Unpublish on the singer's own result and not on anyone else's", async () => {
    mocks.loadSharedSessions.mockResolvedValue([
      boardResult('s-mine', 'user-0001', 'My result'),
      boardResult('s-theirs', 'user-0002', 'Their result'),
    ])

    render(() => <CommunityShare />)
    openTab(/Sessions/)
    await screen.findByRole('button', { name: 'Open Their result' })

    expect(
      screen.getByRole('button', { name: 'Unpublish My result' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Unpublish Their result' }),
    ).toBeNull()
  })

  it('keeps Unpublish on a share that only ever lived in this browser', async () => {
    // Shared without an account: it never reached the board, so it carries
    // no owner id, and this browser's list is the only place it exists.
    const localOnly = { ...boardMelody('m-local', '', 'Kept here') }
    delete (localOnly as { userId?: string }).userId
    mocks.storageGet.mockImplementation((key: string, fallback: unknown) =>
      key === 'pp_shared_melodies' ? [localOnly] : fallback,
    )

    render(() => <CommunityShare />)
    await screen.findByRole('button', { name: 'Remove from shelf: Kept here' })

    expect(
      screen
        .getAllByRole('button', { name: /^(Unpublish |Remove from shelf: )/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Remove from shelf: Kept here'])
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
    // word the tab beneath it used for a published result.
    expect(await screen.findByText('Practice')).toBeInTheDocument()
    expect(screen.getByText('Weekly')).toBeInTheDocument()
    expect(screen.queryByText('session')).toBeNull()
  })
})

describe('Community publication lifecycle', () => {
  async function publishRun() {
    openTab(/Sessions/)
    fireEvent.click(
      await screen.findByRole('button', { name: /Share a session/i }),
    )
    await screen.findByText('Run a')
    fireEvent.click(screen.getByRole('button', { name: /^Share$/ }))
  }

  async function unpublish(name: string) {
    fireEvent.click(
      await screen.findByRole('button', { name: `Unpublish ${name}` }),
    )
    fireEvent.click(screen.getByTestId('confirm-delete'))
  }

  function published(label: RegExp, count: number) {
    expect(screen.getByText(label).previousElementSibling).toHaveTextContent(
      String(count),
    )
  }

  it('persists the selected source run identity', async () => {
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    render(() => <CommunityShare />)
    await publishRun()
    await waitFor(() =>
      expect(mocks.saveSharedSession).toHaveBeenCalledWith(
        expect.objectContaining({ sourceSessionId: 'a', results: [64] }),
      ),
    )
  })

  it('allows distinct run IDs with identical names, scores, and completion times', async () => {
    const run = cloudRun('a', 'practice')
    const completedAt = Date.parse(run.endedAt!)
    const previous = {
      ...boardResult('old-share', 'user-0001', 'Run a'),
      sourceSessionId: 'different-run',
      results: [64],
      date: completedAt,
      shareFingerprint: sessionFingerprint({
        name: 'Run a',
        score: 64,
        completedAt,
      }),
    }
    mocks.storageGet.mockImplementation((key, fallback) =>
      key === 'pp_shared_sessions' ? [previous] : fallback,
    )
    mocks.loadSessionRecords.mockResolvedValue([run])
    render(() => <CommunityShare />)
    openTab(/Sessions/)
    fireEvent.click(
      await screen.findByRole('button', { name: /Share a session/i }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /^Share$/ }))
    await waitFor(() =>
      expect(mocks.saveSharedSession).toHaveBeenCalledWith(
        expect.objectContaining({ sourceSessionId: 'a' }),
      ),
    )
  })

  it('blocks the same source run even after its metadata changes or from another device', async () => {
    mocks.loadSharedSessions.mockResolvedValue([
      {
        ...boardResult('already-public', 'user-0001', 'Older title'),
        sourceSessionId: 'a',
      },
    ])
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    render(() => <CommunityShare />)
    openTab(/Sessions/)
    await screen.findByRole('button', { name: 'Open Older title' })
    await publishRun()
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.stringContaining('already shared this run'),
        'info',
      ),
    )
    expect(mocks.saveSharedSession).not.toHaveBeenCalled()
  })

  it('counts older own publications even when the board page has only foreign rows', async () => {
    mocks.loadSharedMelodies.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) =>
        boardMelody(`other-${i}`, 'other', `Foreign ${i}`),
      ),
    )
    mocks.loadPublishedShareCounts.mockResolvedValue({
      melodies: 7,
      sessions: 3,
    })
    render(() => <CommunityShare />)
    await screen.findByRole('button', { name: 'Open Foreign 99' })
    openTab(/Profile/)
    await waitFor(() => {
      published(/^melodies$/, 7)
      published(/^results$/, 3)
    })
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledWith('user-0001')
  })

  it('refreshes after publishing and removes the canonical row after unpublishing', async () => {
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    mocks.loadPublishedShareCounts
      .mockResolvedValueOnce({ melodies: 0, sessions: 1 })
      .mockResolvedValueOnce({ melodies: 0, sessions: 2 })
      .mockResolvedValueOnce({ melodies: 0, sessions: 1 })
    render(() => <CommunityShare />)
    openTab(/Profile/)
    await waitFor(() => published(/^result$/, 1))
    await publishRun()
    await screen.findByRole('button', { name: 'Open Run a' })
    openTab(/Profile/)
    await waitFor(() => published(/^results$/, 2))
    openTab(/Sessions/)
    await unpublish('Run a')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Open Run a' })).toBeNull(),
    )
    expect(mocks.unpublishShared).toHaveBeenCalledWith('session', 's-new')
    openTab(/Profile/)
    await waitFor(() => published(/^result$/, 1))
  })

  it('publishes a melody only after confirmation and refreshes its authoritative total', async () => {
    const save = deferred<ReturnType<typeof boardMelody>>()
    mocks.libraryMelodies.mockReturnValue([
      {
        ...boardMelody('library', '', 'New melody'),
        bpm: 120,
        items: [
          {
            id: 1,
            note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
            startBeat: 0,
            duration: 1,
          },
        ],
      },
    ])
    mocks.loadPublishedShareCounts
      .mockResolvedValueOnce({ melodies: 1, sessions: 0 })
      .mockResolvedValueOnce({ melodies: 2, sessions: 0 })
    mocks.saveSharedMelody.mockReturnValueOnce(save.promise)
    render(() => <CommunityShare />)
    fireEvent.click(screen.getByRole('button', { name: /Share a melody/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Share$/ }))
    expect(screen.getByRole('button', { name: /^Share$/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Open New melody' })).toBeNull()
    save.resolve(boardMelody('m-new', 'user-0001', 'New melody'))
    await screen.findByRole('button', { name: 'Open New melody' })
    expect(mocks.saveSharedMelody).toHaveBeenCalledTimes(1)
    openTab(/Profile/)
    await waitFor(() => published(/^melodies$/, 2))
  })

  it('does not claim or count a melody whose publication failed', async () => {
    mocks.libraryMelodies.mockReturnValue([
      {
        ...boardMelody('library', '', 'New melody'),
        bpm: 120,
        items: [
          {
            id: 1,
            note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
            startBeat: 0,
            duration: 1,
          },
        ],
      },
    ])
    mocks.saveSharedMelody.mockResolvedValueOnce(null)
    render(() => <CommunityShare />)
    fireEvent.click(screen.getByRole('button', { name: /Share a melody/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Share$/ }))
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.stringMatching(/could not publish/i),
        'error',
      ),
    )
    expect(screen.getByRole('button', { name: /^Share$/ })).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Open New melody' })).toBeNull()
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(1)
  })

  /** A write the worker's word filter refused, as ServerAdapter throws it. */
  function wordRefusal(field: string): CloudRequestError {
    const body = `{"error":"${field} uses a word that is not allowed"}`
    return new CloudRequestError(
      400,
      `ServerAdapter: 400 Bad Request on https://api.test/api/x — ${body}`,
      body,
    )
  }

  it.each([
    [
      'melodyName',
      "This melody's title uses a word we don't allow. Rename it, then share it again.",
    ],
    [
      'itemsJson',
      "This melody's lyrics use a word we don't allow. Change them, then share it again.",
    ],
  ])(
    'says what to change when the word filter refuses a melody (%s), not to retry',
    async (field, message) => {
      mocks.libraryMelodies.mockReturnValue([
        {
          ...boardMelody('library', '', 'New melody'),
          bpm: 120,
          items: [
            {
              id: 1,
              note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
              startBeat: 0,
              duration: 1,
            },
          ],
        },
      ])
      mocks.saveSharedMelody.mockRejectedValueOnce(wordRefusal(field))
      render(() => <CommunityShare />)
      fireEvent.click(screen.getByRole('button', { name: /Share a melody/i }))
      fireEvent.click(await screen.findByRole('button', { name: /^Share$/ }))
      await waitFor(() =>
        expect(mocks.notify).toHaveBeenCalledWith(message, 'error'),
      )
      expect(screen.getByRole('button', { name: /^Share$/ })).not.toBeDisabled()
      expect(
        screen.queryByRole('button', { name: 'Open New melody' }),
      ).toBeNull()
    },
  )

  it('says a refused run title cannot go on the board, not to retry', async () => {
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    mocks.saveSharedSession.mockRejectedValueOnce(wordRefusal('sessionName'))
    render(() => <CommunityShare />)
    await publishRun()
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        "This run's title uses a word we don't allow, so it can't go on the board.",
        'error',
      ),
    )
    expect(screen.queryByRole('button', { name: 'Open Run a' })).toBeNull()
  })

  it('keeps a guest share local and removes it without a server write or count refresh', async () => {
    mocks.accountHeld.mockReturnValue(false)
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    render(() => <CommunityShare />)
    await publishRun()
    await screen.findByRole('button', { name: 'Open Run a' })
    expect(mocks.saveSharedSession).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove from shelf: Run a' }),
    )
    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(screen.queryByRole('button', { name: 'Open Run a' })).toBeNull()
    expect(mocks.unpublishShared).not.toHaveBeenCalled()
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(1)
    openTab(/Profile/)
    expect(screen.queryByText('Published')).toBeNull()
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores an older count read that %s after a publication refresh',
    async (settle) => {
      const beforePublish = deferred<{ melodies: number; sessions: number }>()
      mocks.loadPublishedShareCounts
        .mockReturnValueOnce(beforePublish.promise)
        .mockResolvedValueOnce({ melodies: 0, sessions: 2 })
      mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
      render(() => <CommunityShare />)
      await publishRun()
      await screen.findByRole('button', { name: 'Open Run a' })
      openTab(/Profile/)
      await waitFor(() => published(/^results$/, 2))
      mocks.notify.mockClear()
      if (settle === 'resolve')
        beforePublish.resolve({ melodies: 0, sessions: 1 })
      else beforePublish.reject(new Error('old read offline'))
      await beforePublish.promise.catch(() => {})
      published(/^results$/, 2)
      expect(mocks.notify).not.toHaveBeenCalled()
    },
  )

  it('does not restore a deleted card from an earlier board read', async () => {
    const board = deferred<unknown[]>()
    const share = boardMelody('m-mine', 'user-0001', 'My melody')
    mocks.storageGet.mockImplementation((key, fallback) =>
      key === 'pp_shared_melodies' ? [share] : fallback,
    )
    mocks.loadSharedMelodies.mockReturnValueOnce(board.promise)
    render(() => <CommunityShare />)
    await unpublish('My melody')
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Open My melody' }),
      ).toBeNull(),
    )
    board.resolve([share, boardMelody('other', 'other', 'Other melody')])
    await screen.findByRole('button', { name: 'Open Other melody' })
    expect(screen.queryByRole('button', { name: 'Open My melody' })).toBeNull()
  })

  it('does not remove a new account card after an old account deletion finishes', async () => {
    const deletion = deferred<boolean>()
    mocks.loadSharedMelodies
      .mockResolvedValueOnce([boardMelody('mine', 'user-0001', 'Old melody')])
      .mockResolvedValueOnce([boardMelody('new', 'user-0002', 'New melody')])
    mocks.loadPublishedShareCounts
      .mockResolvedValueOnce({ melodies: 1, sessions: 0 })
      .mockResolvedValueOnce({ melodies: 2, sessions: 0 })
    mocks.unpublishShared.mockReturnValueOnce(deletion.promise)
    render(() => <CommunityShare />)
    await unpublish('Old melody')
    switchAccount('user-0002')
    await screen.findByRole('button', { name: 'Open New melody' })
    deletion.resolve(true)
    await deletion.promise
    expect(
      screen.getByRole('button', { name: 'Open New melody' }),
    ).toBeInTheDocument()
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(2)
    openTab(/Profile/)
    published(/^melodies$/, 2)
  })

  it('keeps failed publication retryable without inflating totals or claiming success', async () => {
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    mocks.loadPublishedShareCounts.mockResolvedValue({
      melodies: 0,
      sessions: 1,
    })
    mocks.saveSharedSession.mockResolvedValueOnce(null)
    render(() => <CommunityShare />)
    await publishRun()
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.stringMatching(/could not publish/i),
        'error',
      ),
    )
    expect(screen.queryByRole('button', { name: 'Open Run a' })).toBeNull()
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(1)
    mocks.loadPublishedShareCounts.mockResolvedValue({
      melodies: 0,
      sessions: 2,
    })
    fireEvent.click(screen.getByRole('button', { name: /^Share$/ }))
    await screen.findByRole('button', { name: 'Open Run a' })
    openTab(/Profile/)
    await waitFor(() => published(/^results$/, 2))
  })

  it('keeps a failed unpublish visible and retryable without lowering its total', async () => {
    mocks.loadSharedMelodies.mockResolvedValue([
      boardMelody('m-mine', 'user-0001', 'My melody'),
    ])
    mocks.loadPublishedShareCounts.mockResolvedValue({
      melodies: 1,
      sessions: 0,
    })
    mocks.unpublishShared.mockResolvedValueOnce(false)
    render(() => <CommunityShare />)
    await unpublish('My melody')
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.stringMatching(/could not unpublish/i),
        'error',
      ),
    )
    expect(
      screen.getByRole('button', { name: 'Open My melody' }),
    ).toBeInTheDocument()
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(1)
    mocks.loadPublishedShareCounts.mockResolvedValue({
      melodies: 0,
      sessions: 0,
    })
    fireEvent.click(screen.getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Open My melody' }),
      ).toBeNull(),
    )
    openTab(/Profile/)
    await waitFor(() => expect(screen.queryByText('Published')).toBeNull())
  })

  it('retains known totals when a later refresh fails', async () => {
    mocks.loadPublishedShareCounts
      .mockResolvedValueOnce({ melodies: 5, sessions: 2 })
      .mockRejectedValueOnce(new Error('offline'))
    render(() => <CommunityShare />)
    openTab(/Profile/)
    await waitFor(() => published(/^melodies$/, 5))
    switchAccount('user-0001')
    await waitFor(() =>
      expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(2),
    )
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.stringMatching(/could not update/i),
        'error',
      ),
    )
    published(/^melodies$/, 5)
    published(/^results$/, 2)
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores stale account count responses that %s after switching',
    async (settle) => {
      const old = deferred<{ melodies: number; sessions: number }>()
      mocks.loadPublishedShareCounts
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce({ melodies: 2, sessions: 0 })
      render(() => <CommunityShare />)
      openTab(/Profile/)
      switchAccount('user-0002')
      await waitFor(() => published(/^melodies$/, 2))
      if (settle === 'resolve') old.resolve({ melodies: 91, sessions: 88 })
      else old.reject(new Error('old account offline'))
      await old.promise.catch(() => {})
      published(/^melodies$/, 2)
      expect(screen.queryByText(/^results?$/)).toBeNull()
      expect(mocks.notify).not.toHaveBeenCalled()
    },
  )

  it('clears previous-owner totals while the next account is loading or fails', async () => {
    const next = deferred<{ melodies: number; sessions: number }>()
    mocks.loadPublishedShareCounts
      .mockResolvedValueOnce({ melodies: 5, sessions: 2 })
      .mockReturnValueOnce(next.promise)
    render(() => <CommunityShare />)
    openTab(/Profile/)
    await waitFor(() => published(/^melodies$/, 5))
    switchAccount('user-0002')
    expect(screen.queryByText('Published')).toBeNull()
    next.reject(new Error('offline'))
    await waitFor(() => expect(mocks.notify).toHaveBeenCalled())
    expect(screen.queryByText('Published')).toBeNull()
  })

  it('ignores an in-flight publication after account switching', async () => {
    const save = deferred<ReturnType<typeof boardResult>>()
    mocks.saveSharedSession.mockReturnValueOnce(save.promise)
    mocks.loadSessionRecords.mockResolvedValue([cloudRun('a', 'practice')])
    mocks.loadPublishedShareCounts
      .mockResolvedValueOnce({ melodies: 0, sessions: 1 })
      .mockResolvedValueOnce({ melodies: 0, sessions: 8 })
    render(() => <CommunityShare />)
    await publishRun()
    switchAccount('user-0002')
    save.resolve(boardResult('s-new', 'user-0001', 'Run a'))
    await save.promise
    openTab(/Profile/)
    await waitFor(() => published(/^results$/, 8))
    openTab(/Sessions/)
    expect(screen.queryByRole('button', { name: 'Open Run a' })).toBeNull()
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.loadPublishedShareCounts).toHaveBeenCalledTimes(2)
  })
})
