// Community shelf reconciliation preserves local records and publication ownership.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import { decodeSharePayload } from '@/lib/share-codec'

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
  storageSet: vi.fn(),
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
  storageSet: mocks.storageSet,
}))

const [version, setVersion] = createSignal(0)
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

/** A setlist on the public board, published by `userId`. */
function boardSetlist(id: string, userId: string, name: string) {
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
    .mockResolvedValue(boardSetlist('s-new', 'user-0001', 'Run a'))
  mocks.saveSharedMelody
    .mockReset()
    .mockResolvedValue(boardMelody('m-new', 'user-0001', 'New melody'))
  mocks.unpublishShared.mockReset().mockResolvedValue(true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  mocks.storageGet.mockImplementation((_key, fallback) => fallback)
  mocks.storageSet.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function historicalMelody() {
  return {
    id: 'legacy-local',
    name: 'Kept melody',
    author: 'Singer user-0001',
    date: 100,
    items: [
      {
        id: 7,
        note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
        startBeat: 0,
        duration: 2,
      },
    ],
    bpm: 87,
    key: 'E',
    scale: 'minor',
  }
}

function canonicalMelody() {
  return {
    ...historicalMelody(),
    id: 'canonical',
    userId: 'user-0001',
    date: 200,
    bpm: undefined,
    key: undefined,
    scale: undefined,
  }
}

function persistedShelf(local = [historicalMelody()]) {
  const saved: Record<string, unknown> = { pp_shared_melodies: local }
  mocks.storageGet.mockImplementation((key, fallback) => saved[key] ?? fallback)
  mocks.storageSet.mockImplementation((key: string, value: unknown) => {
    saved[key] = value
  })
  return saved
}

function melodyCards(container: HTMLElement) {
  return [...container.querySelectorAll('[data-share-type="melody"]')].map(
    (card) => card.getAttribute('data-share-id'),
  )
}

describe('Community historical local copies', () => {
  it('groups a unique exact own match after loading and after reload without rewriting local identity', async () => {
    const saved = persistedShelf()
    const original = JSON.stringify(saved)
    const pending = deferred<unknown[]>()
    mocks.loadSharedMelodies
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue([canonicalMelody()])
    const first = render(() => <CommunityShare />)
    expect(melodyCards(first.container)).toEqual(['legacy-local'])
    pending.resolve([canonicalMelody()])
    await waitFor(() =>
      expect(melodyCards(first.container)).toEqual(['canonical']),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(
      decodeSharePayload(mocks.copyShareUrl.mock.calls[0][0]),
    ).toMatchObject({
      t: 'melody',
      d: { b: 87, k: 'E', s: 'minor', i: [[64, 0, 2]] },
    })
    expect(JSON.stringify(saved)).toBe(original)
    expect(mocks.storageSet).not.toHaveBeenCalled()
    cleanup()
    const reloaded = render(() => <CommunityShare />)
    await waitFor(() =>
      expect(melodyCards(reloaded.container)).toEqual(['canonical']),
    )
    expect(JSON.stringify(saved)).toBe(original)
  })

  it('recomputes display matches on account changes and ignores a stale account load', async () => {
    persistedShelf()
    const stale = deferred<unknown[]>()
    mocks.loadSharedMelodies
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValue([canonicalMelody()])
    const view = render(() => <CommunityShare />)
    switchAccount('user-0002')
    await waitFor(() =>
      expect(melodyCards(view.container)).toEqual([
        'canonical',
        'legacy-local',
      ]),
    )
    stale.resolve([{ ...canonicalMelody(), id: 'stale-owner-card' }])
    await stale.promise
    expect(melodyCards(view.container)).toEqual(['canonical', 'legacy-local'])
    switchAccount('user-0001')
    await waitFor(() =>
      expect(melodyCards(view.container)).toEqual(['canonical']),
    )
    expect(mocks.storageSet).not.toHaveBeenCalled()
  })

  it('unpublishes only the canonical row and keeps the historical local copy until explicitly removed', async () => {
    const saved = persistedShelf()
    const original = JSON.stringify(saved.pp_shared_melodies)
    mocks.loadSharedMelodies.mockResolvedValue([canonicalMelody()])
    mocks.unpublishShared
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const view = render(() => <CommunityShare />)
    await waitFor(() =>
      expect(melodyCards(view.container)).toEqual(['canonical']),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Unpublish Kept melody' }),
    )
    expect(
      screen.getByText(/Your older browser copy stays on this shelf/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.stringMatching(/could not unpublish/i),
        'error',
      ),
    )
    expect(melodyCards(view.container)).toEqual(['canonical'])
    expect(JSON.stringify(saved.pp_shared_melodies)).toBe(original)
    fireEvent.click(screen.getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(melodyCards(view.container)).toEqual(['legacy-local']),
    )
    expect(mocks.unpublishShared.mock.calls).toEqual([
      ['melody', 'canonical'],
      ['melody', 'canonical'],
    ])
    expect(JSON.stringify(saved.pp_shared_melodies)).toBe(original)
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove from shelf: Kept melody' }),
    )
    expect(
      screen.getByText(/This only removes the browser copy/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(melodyCards(view.container)).toEqual([])
    expect(saved.pp_shared_melodies).toEqual([])
    expect(mocks.unpublishShared).toHaveBeenCalledTimes(2)
    mocks.loadSharedMelodies.mockResolvedValue([])
    cleanup()
    const reloaded = render(() => <CommunityShare />)
    await waitFor(() =>
      expect(mocks.loadSharedMelodies).toHaveBeenCalledTimes(2),
    )
    expect(melodyCards(reloaded.container)).toEqual([])
  })

  it('does not upgrade a local-only confirmation into a server delete after a same-ID board row loads', async () => {
    const saved = persistedShelf()
    const pending = deferred<unknown[]>()
    mocks.loadSharedMelodies.mockReturnValueOnce(pending.promise)
    const view = render(() => <CommunityShare />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove from shelf: Kept melody' }),
    )
    pending.resolve([{ ...canonicalMelody(), id: 'legacy-local' }])
    await screen.findByRole('button', { name: 'Unpublish Kept melody' })
    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(mocks.unpublishShared).not.toHaveBeenCalled()
    expect(saved.pp_shared_melodies).toEqual([])
    expect(melodyCards(view.container)).toEqual(['legacy-local'])
    expect(
      screen.getByRole('button', { name: 'Unpublish Kept melody' }),
    ).toBeInTheDocument()
  })

  it('removes a local copy while loading without deleting or suppressing the later board publication', async () => {
    const saved = persistedShelf()
    const pending = deferred<unknown[]>()
    mocks.loadSharedMelodies.mockReturnValueOnce(pending.promise)
    const view = render(() => <CommunityShare />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove from shelf: Kept melody' }),
    )
    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(saved.pp_shared_melodies).toEqual([])
    expect(mocks.unpublishShared).not.toHaveBeenCalled()
    pending.resolve([canonicalMelody()])
    await waitFor(() =>
      expect(melodyCards(view.container)).toEqual(['canonical']),
    )
    expect(mocks.unpublishShared).not.toHaveBeenCalled()
  })
})
