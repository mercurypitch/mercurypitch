// ============================================================
// Analysis takes — unified listing and capability tiers
//
// The capability tier is what stops the page showing spectral numbers for
// data that cannot support them, so it is the thing worth pinning down.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'
import type { SessionResult } from '@/types'

const state = vi.hoisted(() => ({
  uvr: [] as UvrSession[],
  practice: [] as SessionResult[],
}))

vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => state.uvr,
}))

vi.mock('@/stores', () => ({
  getSessionHistory: () => state.practice,
}))

vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  loadPitchAnalysisFromDb: vi.fn(async () => null),
}))

import { listTakes, LIVE_TAKE_ID, supports } from '@/features/analysis/takes'

function makeUvr(overrides: Partial<UvrSession> = {}): UvrSession {
  return {
    sessionId: 'uvr-1',
    status: 'completed',
    progress: 100,
    createdAt: 2000,
    originalFile: { name: 'song.mp3', size: 1000, mimeType: 'audio/mpeg' },
    outputs: { vocal: 'blob:vocal' },
    processingMode: 'local',
    ...overrides,
  } as UvrSession
}

function makePractice(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    sessionId: 'p-1',
    name: 'Warmup',
    sessionName: 'Warmup',
    score: 75,
    itemsCompleted: 2,
    completedAt: 1000,
    practiceItemResult: [],
    ...overrides,
  } as SessionResult
}

beforeEach(() => {
  state.uvr = []
  state.practice = []
})

describe('listTakes', () => {
  it('always offers the live take first', () => {
    state.practice = [makePractice({ completedAt: Number.MAX_SAFE_INTEGER })]

    const takes = listTakes()

    expect(takes[0].id).toBe(LIVE_TAKE_ID)
    expect(takes[0].capability).toBe('audio')
  })

  it('sorts real takes newest first across both sources', () => {
    state.uvr = [makeUvr({ sessionId: 'a', createdAt: 3000 })]
    state.practice = [
      makePractice({ sessionId: 'b', completedAt: 5000 }),
      makePractice({ sessionId: 'c', completedAt: 1000 }),
    ]

    const ids = listTakes()
      .slice(1)
      .map((t) => t.id)

    expect(ids).toEqual(['practice:b', 'uvr:a', 'practice:c'])
  })

  it('excludes UVR sessions that have not finished processing', () => {
    state.uvr = [
      makeUvr({ sessionId: 'done', status: 'completed' }),
      makeUvr({ sessionId: 'busy', status: 'processing' }),
      makeUvr({ sessionId: 'failed', status: 'error' }),
    ]

    const ids = listTakes().map((t) => t.id)

    expect(ids).toContain('uvr:done')
    expect(ids).not.toContain('uvr:busy')
    expect(ids).not.toContain('uvr:failed')
  })
})

describe('capability tiers', () => {
  it('gives a separated song with a vocal stem the audio tier', () => {
    state.uvr = [makeUvr()]

    const take = listTakes().find((t) => t.id === 'uvr:uvr-1')

    expect(take?.capability).toBe('audio')
    expect(take?.loadAudio).toBeDefined()
  })

  it('drops to the notes tier when there is no vocal stem', () => {
    state.uvr = [makeUvr({ outputs: {} })]

    const take = listTakes().find((t) => t.id === 'uvr:uvr-1')

    expect(take?.capability).toBe('notes')
    expect(take?.loadAudio).toBeUndefined()
    expect(take?.loadNotes).toBeDefined()
  })

  it('caps practice sessions at the summary tier — there is no audio', () => {
    state.practice = [makePractice()]

    const take = listTakes().find((t) => t.id === 'practice:p-1')

    expect(take?.capability).toBe('summary')
    expect(take?.loadAudio).toBeUndefined()
    expect(take?.loadNotes).toBeUndefined()
    expect(take?.summary).toBeDefined()
  })
})

describe('supports', () => {
  it('lets a stronger tier satisfy a weaker requirement', () => {
    state.uvr = [makeUvr()]
    const audioTake = listTakes().find((t) => t.id === 'uvr:uvr-1')!

    expect(supports(audioTake, 'audio')).toBe(true)
    expect(supports(audioTake, 'notes')).toBe(true)
    expect(supports(audioTake, 'summary')).toBe(true)
  })

  it('refuses a requirement the take cannot meet', () => {
    state.practice = [makePractice()]
    const summaryTake = listTakes().find((t) => t.id === 'practice:p-1')!

    expect(supports(summaryTake, 'summary')).toBe(true)
    expect(supports(summaryTake, 'notes')).toBe(false)
    expect(supports(summaryTake, 'audio')).toBe(false)
  })

  it('treats a missing take as unsupported', () => {
    expect(supports(null, 'summary')).toBe(false)
  })
})

// ── Stems that outlive the page ────────────────────────────────
//
// Blob URLs die with the document, so `outputs.vocal` is live only for a
// session separated during THIS page load. Reading it as the test for
// "has audio" meant every older session dropped to capability 'notes'
// and silently lost the analysis it is perfectly capable of — a freshly
// uploaded song offered a spectrum, and the same song after a reload did
// not. `stemMeta` is the durable signal.

describe('a UVR session whose blob URL did not survive the reload', () => {
  it('is still analysable when the stems are on disk', () => {
    state.uvr = [
      makeUvr({
        outputs: undefined,
        stemMeta: { vocal: { duration: 42 } },
      } as Partial<UvrSession>),
    ]
    const take = listTakes().find((t) => t.source === 'uvr')!
    expect(take.capability).toBe('audio')
    expect(supports(take, 'audio')).toBe(true)
  })

  it('is analysable with a live URL and no stemMeta, as before', () => {
    state.uvr = [makeUvr()]
    expect(listTakes().find((t) => t.source === 'uvr')!.capability).toBe(
      'audio',
    )
  })

  it('falls back to notes only when there really are no stems', () => {
    state.uvr = [
      makeUvr({
        outputs: undefined,
        stemMeta: undefined,
      } as Partial<UvrSession>),
    ]
    const take = listTakes().find((t) => t.source === 'uvr')!
    expect(take.capability).toBe('notes')
    expect(take.loadAudio).toBeUndefined()
  })
})
