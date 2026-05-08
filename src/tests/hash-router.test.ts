// ============================================================
// Hash Router Tests — EARS REQ-RT-001 through REQ-RT-010
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { buildHash, navigateTo, parseHash, replaceHash } from '@/lib/hash-router'

// ── parseHash ─────────────────────────────────────────────────

describe('parseHash', () => {
  // REQ-RT-001: Tab routes
  it('parses simple tab routes', () => {
    expect(parseHash('#/practice')).toEqual({ type: 'tab', tab: 'practice' })
    expect(parseHash('#/editor')).toEqual({ type: 'tab', tab: 'editor' })
    expect(parseHash('#/settings')).toEqual({ type: 'tab', tab: 'settings' })
    expect(parseHash('#/vocal-analysis')).toEqual({ type: 'tab', tab: 'vocal-analysis' })
    expect(parseHash('#/community')).toEqual({ type: 'tab', tab: 'community' })
    expect(parseHash('#/leaderboard')).toEqual({ type: 'tab', tab: 'leaderboard' })
    expect(parseHash('#/vocal-challenges')).toEqual({ type: 'tab', tab: 'vocal-challenges' })
    // #/uvr is treated as uvr-upload by the router, not tab:uvr
    // Test separately in UVR routes below
  })

  // #/uvr is a valid tab name but router intercepts it as uvr-upload
  it('#/uvr is routed as uvr-upload, not tab:uvr', () => {
    expect(parseHash('#/uvr')).toEqual({ type: 'uvr-upload' })
  })

  // REQ-RT-011: Learn routes
  it('parses learn route', () => {
    expect(parseHash('#/learn')).toEqual({ type: 'learn' })
  })

  it('parses learn chapter route with chapter ID', () => {
    expect(parseHash('#/learn/practice-toolbar')).toEqual({
      type: 'learn-chapter',
      chapterId: 'practice-toolbar',
    })
  })

  it('parses learn chapter route with hyphenated IDs', () => {
    expect(parseHash('#/learn/editor-piano-roll')).toEqual({
      type: 'learn-chapter',
      chapterId: 'editor-piano-roll',
    })
  })

  // REQ-RT-012: Guide routes
  it('parses guide selection route', () => {
    expect(parseHash('#/guide')).toEqual({ type: 'guide' })
  })

  it('parses guide all (full tour) route', () => {
    expect(parseHash('#/guide/all')).toEqual({
      type: 'guide-start',
      sectionId: 'all',
    })
  })

  it('parses guide section route for practice', () => {
    expect(parseHash('#/guide/practice')).toEqual({
      type: 'guide-start',
      sectionId: 'practice',
    })
  })

  it('parses guide section route for toolbar', () => {
    expect(parseHash('#/guide/toolbar')).toEqual({
      type: 'guide-start',
      sectionId: 'toolbar',
    })
  })

  it('parses guide section route for editor', () => {
    expect(parseHash('#/guide/editor')).toEqual({
      type: 'guide-start',
      sectionId: 'editor',
    })
  })

  it('parses guide section route for settings', () => {
    expect(parseHash('#/guide/settings')).toEqual({
      type: 'guide-start',
      sectionId: 'settings',
    })
  })

  it('returns unknown for invalid guide section', () => {
    expect(parseHash('#/guide/nonexistent')).toEqual({ type: 'unknown' })
  })

  // Learn/guide take precedence over tab routes
  it('learn routes take precedence over tab named learn', () => {
    expect(parseHash('#/learn').type).toBe('learn')
  })

  it('guide routes take precedence over tab named guide', () => {
    expect(parseHash('#/guide').type).toBe('guide')
  })

  // REQ-RT-002: UVR sub-routes
  it('parses UVR upload route (#/uvr or #/uvr/upload)', () => {
    expect(parseHash('#/uvr')).toEqual({ type: 'uvr-upload' })
    expect(parseHash('#/uvr/upload')).toEqual({ type: 'uvr-upload' })
  })

  it('parses UVR history route', () => {
    expect(parseHash('#/uvr/history')).toEqual({ type: 'uvr-history' })
  })

  it('parses UVR session route with session ID', () => {
    const result = parseHash('#/uvr/session/abc123-def')
    expect(result).toEqual({ type: 'uvr-session', sessionId: 'abc123-def' })
  })

  it('parses UVR session mixer route with session ID', () => {
    const result = parseHash('#/uvr/session/xyz-789/mixer')
    expect(result).toEqual({ type: 'uvr-session-mixer', sessionId: 'xyz-789' })
  })

  it('distinguishes session from session-mixer routes', () => {
    const session = parseHash('#/uvr/session/test-id')
    const mixer = parseHash('#/uvr/session/test-id/mixer')
    expect(session.type).toBe('uvr-session')
    expect(mixer.type).toBe('uvr-session-mixer')
    expect((mixer as { sessionId: string }).sessionId).toBe('test-id')
  })

  // REQ-RT-003: Share routes
  it('parses share route with type and id', () => {
    const result = parseHash('#/share?type=melody&id=abc123')
    expect(result).toEqual({ type: 'share', shareType: 'melody', shareId: 'abc123' })
  })

  it('parses share route with different types', () => {
    const result = parseHash('#/share?type=session&id=session-456')
    expect(result).toEqual({ type: 'share', shareType: 'session', shareId: 'session-456' })
  })

  // REQ-RT-004: Unknown / empty routes
  it('returns unknown for empty hash', () => {
    expect(parseHash('')).toEqual({ type: 'unknown' })
  })

  it('returns unknown for bare #', () => {
    expect(parseHash('#')).toEqual({ type: 'unknown' })
  })

  it('returns unknown for bare slash', () => {
    expect(parseHash('#/')).toEqual({ type: 'unknown' })
  })

  it('returns unknown for invalid tab name', () => {
    expect(parseHash('#/nonexistent')).toEqual({ type: 'unknown' })
  })

  // REQ-RT-005: Edge cases
  it('handles hash without leading #', () => {
    expect(parseHash('/practice')).toEqual({ type: 'tab', tab: 'practice' })
  })

  it('handles hash with session ID containing special chars', () => {
    const validChars = parseHash('#/uvr/session/abc-123_def.456')
    expect(validChars).toEqual({ type: 'uvr-session', sessionId: 'abc-123_def.456' })
  })

  it('returns unknown for malformed UVR session route missing ID', () => {
    const result = parseHash('#/uvr/session/')
    expect(result.type).toBe('unknown')
  })

  it('returns unknown for share route with missing params', () => {
    expect(parseHash('#/share').type).toBe('unknown')
    expect(parseHash('#/share?type=melody').type).toBe('unknown')
  })

  it('session route takes precedence over tab route', () => {
    // /uvr/session/:id beats bare /uvr
    const result = parseHash('#/uvr/session/some-id')
    expect(result.type).toBe('uvr-session')
  })

  it('session-mixer takes precedence over session', () => {
    const result = parseHash('#/uvr/session/some-id/mixer')
    expect(result.type).toBe('uvr-session-mixer')
  })
})

// ── buildHash ──────────────────────────────────────────────────

describe('buildHash', () => {
  it('builds tab hash', () => {
    expect(buildHash({ type: 'tab', tab: 'practice' })).toBe('/practice')
    expect(buildHash({ type: 'tab', tab: 'settings' })).toBe('/settings')
  })

  it('builds UVR upload hash', () => {
    expect(buildHash({ type: 'uvr-upload' })).toBe('/uvr')
  })

  it('builds UVR history hash', () => {
    expect(buildHash({ type: 'uvr-history' })).toBe('/uvr/history')
  })

  it('builds UVR session hash', () => {
    expect(buildHash({ type: 'uvr-session', sessionId: 'abc123' }))
      .toBe('/uvr/session/abc123')
  })

  it('builds UVR session mixer hash', () => {
    expect(buildHash({ type: 'uvr-session-mixer', sessionId: 'xyz' }))
      .toBe('/uvr/session/xyz/mixer')
  })

  it('builds share hash', () => {
    expect(buildHash({ type: 'share', shareType: 'melody', shareId: 'id1' }))
      .toBe('/share?type=melody&id=id1')
  })

  it('builds unknown as root slash', () => {
    expect(buildHash({ type: 'unknown' })).toBe('/')
  })

  it('builds learn hash', () => {
    expect(buildHash({ type: 'learn' })).toBe('/learn')
  })

  it('builds learn-chapter hash', () => {
    expect(buildHash({ type: 'learn-chapter', chapterId: 'practice-toolbar' }))
      .toBe('/learn/practice-toolbar')
  })

  it('builds guide hash', () => {
    expect(buildHash({ type: 'guide' })).toBe('/guide')
  })

  it('builds guide-start all hash', () => {
    expect(buildHash({ type: 'guide-start', sectionId: 'all' })).toBe('/guide/all')
  })

  it('builds guide-start section hash', () => {
    expect(buildHash({ type: 'guide-start', sectionId: 'editor' })).toBe(
      '/guide/editor',
    )
  })
})

// ── Round-trip ─────────────────────────────────────────────────

describe('parseHash ↔ buildHash round-trip', () => {
  const routes = [
    '#/practice',
    '#/settings',
    '#/uvr',
    '#/uvr/history',
    '#/uvr/session/sess-123',
    '#/uvr/session/sess-123/mixer',
    '#/share?type=melody&id=share-456',
    '#/learn',
    '#/learn/practice-toolbar',
    '#/guide',
    '#/guide/all',
    '#/guide/practice',
    '#/guide/editor',
  ]

  for (const hash of routes) {
    it(`round-trips: ${hash}`, () => {
      const parsed = parseHash(hash)
      const built = `#${buildHash(parsed)}`
      expect(built).toBe(hash)
    })
  }
})

// ── navigateTo ─────────────────────────────────────────────────

describe('navigateTo', () => {
  it('sets window.location.hash for a tab route', () => {
    const locationMock = { hash: '' } as Location
    vi.stubGlobal('location', locationMock)

    navigateTo({ type: 'tab', tab: 'editor' })
    expect(locationMock.hash).toBe('#/editor')
  })

  it('does not set hash if already at the same hash', () => {
    let setCount = 0
    const locationMock = {} as Location
    Object.defineProperty(locationMock, 'hash', {
      get: () => '#/practice',
      set: () => { setCount++ },
      configurable: true,
    })
    vi.stubGlobal('location', locationMock)

    navigateTo({ type: 'tab', tab: 'practice' })
    expect(setCount).toBe(0) // same target, no write
  })
})

// ── replaceHash ────────────────────────────────────────────────

describe('replaceHash', () => {
  it('uses replaceState to update URL without new history entry', () => {
    const replaceStateSpy = vi.fn()
    vi.stubGlobal('history', { replaceState: replaceStateSpy })
    vi.stubGlobal('location', { hash: '' })

    replaceHash({ type: 'tab', tab: 'settings' })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#/settings')
  })

  it('skips replace when already at target hash', () => {
    const replaceStateSpy = vi.fn()
    vi.stubGlobal('history', { replaceState: replaceStateSpy })
    vi.stubGlobal('location', { hash: '#/settings' })

    replaceHash({ type: 'tab', tab: 'settings' })
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })
})
