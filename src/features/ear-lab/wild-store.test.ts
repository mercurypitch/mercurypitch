// ============================================================
// Tests: wild-store — a song's book is read once and kept; its
// decoded stems stay warm only for the last MAX_WARM_STEMS songs
// and are let go when the Ear Lab is left. A cooled song reads its
// stems again, and only them.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'
import type * as WildAnalysis from './wild-analysis'
import type { WildAnalysisDeps, WildReading, WildStems } from './wild-analysis'
import { loadWildStems, readWildSession } from './wild-analysis'
import { ensureWildReading, MAX_WARM_STEMS, releaseWildStems, resetWildStore, setFieldBookSessionId, wildReadingState, } from './wild-store'

vi.mock('./wild-analysis', async (importOriginal) => ({
  ...(await importOriginal<typeof WildAnalysis>()),
  readWildSession: vi.fn(),
  loadWildStems: vi.fn(),
}))

const stems = {} as WildStems
const bookOf = (id: string) =>
  ({
    key: id,
    home: [],
    echo: [],
    bassline: [],
  }) as unknown as WildReading['book']
const session = (id: string) => ({ sessionId: id }) as UvrSession
const deps = {} as WildAnalysisDeps

beforeEach(() => {
  resetWildStore()
  vi.mocked(readWildSession).mockImplementation(async (s) => ({
    book: bookOf(s.sessionId),
    stems,
  }))
  vi.mocked(loadWildStems).mockResolvedValue(stems)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('reading a song', () => {
  it('reads once, and shares the reading in flight', async () => {
    const first = ensureWildReading(session('a'), deps)
    const second = ensureWildReading(session('a'), deps)
    expect(second).toBe(first)
    await first
    await ensureWildReading(session('a'), deps)
    expect(readWildSession).toHaveBeenCalledTimes(1)
    expect(wildReadingState('a').status).toBe('ready')
  })

  it('keeps the book of a song whose stems were let go', async () => {
    expect(MAX_WARM_STEMS).toBe(1)
    await ensureWildReading(session('a'), deps)
    await ensureWildReading(session('b'), deps)
    const cooled = wildReadingState('a')
    expect(cooled.status).toBe('unread')
    expect(cooled.reading).toBeNull()
    expect(cooled.book?.key).toBe('a')
    expect(wildReadingState('b').reading?.book.key).toBe('b')
  })

  it('reads only the stems of a song whose book it kept', async () => {
    await ensureWildReading(session('a'), deps)
    await ensureWildReading(session('b'), deps)
    const again = await ensureWildReading(session('a'), deps)
    expect(again.book.key).toBe('a')
    expect(loadWildStems).toHaveBeenCalledTimes(1)
    expect(readWildSession).toHaveBeenCalledTimes(2)
    expect(wildReadingState('a').status).toBe('ready')
    expect(wildReadingState('b').status).toBe('unread')
  })

  it('reports a song whose stems are gone', async () => {
    await ensureWildReading(session('a'), deps)
    await ensureWildReading(session('b'), deps)
    vi.mocked(loadWildStems).mockResolvedValue(null)
    await expect(ensureWildReading(session('a'), deps)).rejects.toThrow(
      /no vocal and instrumental stems/,
    )
    expect(wildReadingState('a').status).toBe('error')
    expect(wildReadingState('a').book?.key).toBe('a')
  })
})

describe('a slow reading of another song', () => {
  it('never lets the open song go, and lands cold itself', async () => {
    let finishA: (reading: WildReading) => void = () => undefined
    vi.mocked(readWildSession).mockImplementationOnce(
      () =>
        new Promise<WildReading>((resolve) => {
          finishA = resolve
        }),
    )
    const slow = ensureWildReading(session('a'), deps)
    setFieldBookSessionId('b')
    await ensureWildReading(session('b'), deps)
    expect(wildReadingState('b').status).toBe('ready')

    finishA({ book: bookOf('a'), stems })
    await slow
    // The drill running on b keeps its stems; a arrives as a book only.
    expect(wildReadingState('b').status).toBe('ready')
    expect(wildReadingState('a').status).toBe('unread')
    expect(wildReadingState('a').book?.key).toBe('a')
  })
})

describe('leaving the lab', () => {
  it('lands a reading still running as a book without stems', async () => {
    let finish: (reading: WildReading) => void = () => undefined
    vi.mocked(readWildSession).mockImplementationOnce(
      () =>
        new Promise<WildReading>((resolve) => {
          finish = resolve
        }),
    )
    const pending = ensureWildReading(session('a'), deps)
    releaseWildStems()
    finish({ book: bookOf('a'), stems })
    await pending
    expect(wildReadingState('a').status).toBe('unread')
    expect(wildReadingState('a').reading).toBeNull()
    expect(wildReadingState('a').book?.key).toBe('a')
  })

  it('lets every warm song go and keeps its book', async () => {
    await ensureWildReading(session('a'), deps)
    releaseWildStems()
    expect(wildReadingState('a').status).toBe('unread')
    expect(wildReadingState('a').reading).toBeNull()
    expect(wildReadingState('a').book?.key).toBe('a')
    await ensureWildReading(session('a'), deps)
    expect(loadWildStems).toHaveBeenCalledTimes(1)
    expect(wildReadingState('a').status).toBe('ready')
  })
})
