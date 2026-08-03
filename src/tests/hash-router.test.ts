// ============================================================
// Hash Router Tests — EARS REQ-RT-001 through REQ-RT-010
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { TAB_COMPOSE, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { buildHash, navigateTo, parseHash, pushHash, replaceHash, } from '@/lib/hash-router'

// ── parseHash ─────────────────────────────────────────────────

describe('parseHash', () => {
  // REQ-RT-001: Tab routes
  it('parses simple tab routes', () => {
    expect(parseHash('#/home')).toEqual({ type: 'tab', tab: 'home' })
    expect(parseHash('#/path')).toEqual({ type: 'tab', tab: 'path' })
    expect(parseHash('#/singing')).toEqual({ type: 'tab', tab: 'singing' })
    expect(parseHash('#/compose')).toEqual({ type: 'tab', tab: 'compose' })
    expect(parseHash('#/settings')).toEqual({ type: 'tab', tab: 'settings' })
    expect(parseHash('#/analysis')).toEqual({
      type: 'tab',
      tab: 'analysis',
    })
    expect(parseHash('#/community')).toEqual({ type: 'tab', tab: 'community' })
    expect(parseHash('#/leaderboard')).toEqual({
      type: 'tab',
      tab: 'leaderboard',
    })
    expect(parseHash('#/challenges')).toEqual({
      type: 'tab',
      tab: 'challenges',
    })
    // Regression: exercises/guitar/piano/jam must round-trip so a reload on
    // those tabs restores them instead of falling back to singing.
    expect(parseHash('#/exercises')).toEqual({ type: 'tab', tab: 'exercises' })
    expect(parseHash('#/guitar')).toEqual({ type: 'tab', tab: 'guitar' })
    expect(parseHash('#/piano')).toEqual({ type: 'tab', tab: 'piano' })
    expect(parseHash('#/jam')).toEqual({ type: 'tab', tab: 'jam' })
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

  it('parses guide section route for effects', () => {
    expect(parseHash('#/guide/effects')).toEqual({
      type: 'guide-start',
      sectionId: 'effects',
    })
  })

  it('parses guide section routes for the per-tab settings tours', () => {
    expect(parseHash('#/guide/settings-general')).toEqual({
      type: 'guide-start',
      sectionId: 'settings-general',
    })
    expect(parseHash('#/guide/settings-practice')).toEqual({
      type: 'guide-start',
      sectionId: 'settings-practice',
    })
    expect(parseHash('#/guide/settings-display')).toEqual({
      type: 'guide-start',
      sectionId: 'settings-display',
    })
  })

  it('returns unknown for invalid guide section', () => {
    expect(parseHash('#/guide/nonexistent')).toEqual({ type: 'unknown' })
    // The old combined 'settings' guide id was split into per-tab tours.
    expect(parseHash('#/guide/settings')).toEqual({ type: 'unknown' })
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
  it('parses legacy share query route as fallback', () => {
    const result = parseHash('#/share?type=melody&id=abc123')
    expect(result).toEqual({
      type: 'share-fallback',
      shareType: 'melody',
      shareId: 'abc123',
    })
  })

  it('parses legacy share route with different types as fallback', () => {
    const result = parseHash('#/share?type=session&id=session-456')
    expect(result).toEqual({
      type: 'share-fallback',
      shareType: 'session',
      shareId: 'session-456',
    })
  })

  it('parses share-load route from base64url payload', () => {
    const payload =
      'eyJ2IjoxLCJ0IjoibWVsb2R5IiwiZCI6eyJuIjoiVGVzdCIsImIiOjEyMCwiaSI6W119fQ'
    const result = parseHash(`#/share/${payload}`)
    expect(result.type).toBe('share-load')
    if (result.type === 'share-load') {
      expect(result.shareType).toBe('melody')
    }
  })

  // REQ-RT-013: Share-short routes
  it('parses share-short route with alphanumeric ID', () => {
    expect(parseHash('#/s/abc123XYZ0')).toEqual({
      type: 'share-short',
      shortId: 'abc123XYZ0',
    })
  })

  it('parses share-short route with mixed case ID', () => {
    expect(parseHash('#/s/AbC1dEf2Gh')).toEqual({
      type: 'share-short',
      shortId: 'AbC1dEf2Gh',
    })
  })

  it('returns unknown for share-short with hyphen in ID', () => {
    expect(parseHash('#/s/abc-123')).toEqual({ type: 'unknown' })
  })

  it('returns unknown for share-short with underscore in ID', () => {
    expect(parseHash('#/s/abc_123')).toEqual({ type: 'unknown' })
  })

  it('returns unknown for invalid base64 share payload', () => {
    const result = parseHash('#/share/!!!not-valid-base64!!!')
    expect(result.type).toBe('unknown')
  })

  // Settings sub-tab deep links (#/settings/<slug>)
  it('parses settings section routes (practice slug maps to singing)', () => {
    expect(parseHash('#/settings/account')).toEqual({
      type: 'settings-section',
      section: 'account',
    })
    expect(parseHash('#/settings/credits')).toEqual({
      type: 'settings-section',
      section: 'credits',
    })
    expect(parseHash('#/settings/practice')).toEqual({
      type: 'settings-section',
      section: 'singing',
    })
    expect(parseHash('#/settings/display')).toEqual({
      type: 'settings-section',
      section: 'display',
    })
  })

  it('unknown settings section falls through to unknown', () => {
    expect(parseHash('#/settings/nonsense')).toEqual({ type: 'unknown' })
  })

  it('plain #/settings still parses as the tab', () => {
    expect(parseHash('#/settings')).toEqual({ type: 'tab', tab: 'settings' })
  })

  // Stripe checkout return routes (success_url / cancel_url in
  // workers/db-worker/src/billing.ts)
  it('parses billing success and cancel returns', () => {
    expect(parseHash('#/billing/success')).toEqual({
      type: 'billing-return',
      outcome: 'success',
      kind: 'credits',
    })
    expect(parseHash('#/pricing')).toEqual({
      type: 'billing-return',
      outcome: 'cancel',
      kind: 'credits',
    })
  })

  // Donations return to their own hash: the app must confirm a donation
  // without polling for credits that are never coming.
  it('parses the donation thank-you return', () => {
    expect(parseHash('#/donate/thanks')).toEqual({
      type: 'billing-return',
      outcome: 'success',
      kind: 'donation',
    })
  })

  // Password reset (emailed link landing + bare request form)
  it('parses reset-password with a token', () => {
    expect(parseHash('#/reset-password?token=abc_DEF-123')).toEqual({
      type: 'reset-password',
      token: 'abc_DEF-123',
    })
  })

  it('parses bare reset-password as the request form', () => {
    expect(parseHash('#/reset-password')).toEqual({
      type: 'reset-password',
      token: null,
    })
  })

  it('url-decodes the reset token', () => {
    expect(parseHash('#/reset-password?token=a%2Bb')).toEqual({
      type: 'reset-password',
      token: 'a+b',
    })
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
    expect(parseHash('/singing')).toEqual({ type: 'tab', tab: 'singing' })
  })

  it('handles hash with session ID containing special chars', () => {
    const validChars = parseHash('#/uvr/session/abc-123_def.456')
    expect(validChars).toEqual({
      type: 'uvr-session',
      sessionId: 'abc-123_def.456',
    })
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

  // Every Content Studio section needs a name in VALID_ADMIN_SECTIONS as
  // well as in the AdminSection union; miss the set and the deep link
  // silently falls through to the tab matcher instead of 404ing.
  it('parses each Content Studio section', () => {
    expect(parseHash('#/admin')).toEqual({
      type: 'admin',
      section: 'exercises',
    })
    for (const section of ['exercises', 'ascent', 'weekly', 'achievements']) {
      expect(parseHash(`#/admin/${section}`)).toEqual({
        type: 'admin',
        section,
      })
    }
  })

  it('rejects an unknown admin section', () => {
    expect(parseHash('#/admin/nonsense')).not.toEqual(
      expect.objectContaining({ type: 'admin' }),
    )
  })
})

// ── buildHash ──────────────────────────────────────────────────

describe('buildHash', () => {
  it('builds tab hash', () => {
    expect(buildHash({ type: 'tab', tab: TAB_SINGING })).toBe('/singing')
    expect(buildHash({ type: 'tab', tab: TAB_SETTINGS })).toBe('/settings')
  })

  it('builds UVR upload hash', () => {
    expect(buildHash({ type: 'uvr-upload' })).toBe('/karaoke')
  })

  it('builds UVR session hash', () => {
    expect(buildHash({ type: 'uvr-session', sessionId: 'abc123' })).toBe(
      '/karaoke/session/abc123',
    )
  })

  it('builds UVR session mixer hash', () => {
    expect(buildHash({ type: 'uvr-session-mixer', sessionId: 'xyz' })).toBe(
      '/karaoke/session/xyz/mixer',
    )
  })

  it('builds share-fallback hash', () => {
    expect(
      buildHash({
        type: 'share-fallback',
        shareType: 'melody',
        shareId: 'id1',
      }),
    ).toBe('/share?type=melody&id=id1')
  })

  it('builds share-short hash', () => {
    expect(buildHash({ type: 'share-short', shortId: 'abc123' })).toBe(
      '/s/abc123',
    )
  })

  it('builds unknown as root slash', () => {
    expect(buildHash({ type: 'unknown' })).toBe('/')
  })

  it('builds learn hash', () => {
    expect(buildHash({ type: 'learn' })).toBe('/learn')
  })

  it('builds learn-chapter hash', () => {
    expect(
      buildHash({ type: 'learn-chapter', chapterId: 'practice-toolbar' }),
    ).toBe('/learn/practice-toolbar')
  })

  it('builds guide hash', () => {
    expect(buildHash({ type: 'guide' })).toBe('/guide')
  })

  it('builds guide-start all hash', () => {
    expect(buildHash({ type: 'guide-start', sectionId: 'all' })).toBe(
      '/guide/all',
    )
  })

  it('builds guide-start section hash', () => {
    expect(buildHash({ type: 'guide-start', sectionId: 'editor' })).toBe(
      '/guide/editor',
    )
  })

  it('builds settings-section hashes (singing -> practice slug)', () => {
    expect(buildHash({ type: 'settings-section', section: 'credits' })).toBe(
      '/settings/credits',
    )
    expect(buildHash({ type: 'settings-section', section: 'singing' })).toBe(
      '/settings/practice',
    )
  })

  it('builds billing-return hashes', () => {
    expect(buildHash({ type: 'billing-return', outcome: 'success' })).toBe(
      '/billing/success',
    )
    expect(buildHash({ type: 'billing-return', outcome: 'cancel' })).toBe(
      '/pricing',
    )
  })

  it('builds reset-password hashes (with and without token)', () => {
    expect(buildHash({ type: 'reset-password', token: 'abc123' })).toBe(
      '/reset-password?token=abc123',
    )
    expect(buildHash({ type: 'reset-password', token: null })).toBe(
      '/reset-password',
    )
  })
})

// ── Round-trip ─────────────────────────────────────────────────

describe('parseHash ↔ buildHash round-trip', () => {
  const routes = [
    '#/singing',
    '#/settings',
    '#/karaoke',
    '#/karaoke/session/sess-123',
    '#/karaoke/session/sess-123/mixer',
    '#/share?type=melody&id=share-456',
    '#/learn',
    '#/learn/practice-toolbar',
    '#/guide',
    '#/guide/all',
    '#/guide/practice',
    '#/guide/editor',
    '#/s/abc123XYZ0',
    '#/reset-password',
    '#/reset-password?token=tok_abc-123',
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

    navigateTo({ type: 'tab', tab: TAB_COMPOSE })
    expect(locationMock.hash).toBe('#/compose')
  })

  it('does not set hash if already at the same hash', () => {
    let setCount = 0
    const locationMock = {} as Location
    Object.defineProperty(locationMock, 'hash', {
      get: () => '#/singing',
      set: () => {
        setCount++
      },
      configurable: true,
    })
    vi.stubGlobal('location', locationMock)

    navigateTo({ type: 'tab', tab: TAB_SINGING })
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

// ── pushHash ───────────────────────────────────────────────────
//
// Every tab change synced the URL with replaceHash, which OVERWRITES the
// current history entry. Ten tab changes left one entry, so Back walked
// off the site instead of returning to the previous tab — the app looked
// like it had no history at all.

describe('pushHash', () => {
  it('uses pushState, so the previous tab stays in history', () => {
    // replaceHash OVERWRITES the entry: ten tab changes left one, and
    // Back walked off the site instead of returning to the last tab.
    const pushStateSpy = vi.fn()
    vi.stubGlobal('history', { pushState: pushStateSpy })
    vi.stubGlobal('location', { hash: '' })

    pushHash({ type: 'tab', tab: 'challenges' })
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#/challenges')
  })

  it('skips the push when already at the target hash', () => {
    // Otherwise every re-render stacks a duplicate entry and Back feels
    // stuck — press it five times to leave one screen.
    const pushStateSpy = vi.fn()
    vi.stubGlobal('history', { pushState: pushStateSpy })
    vi.stubGlobal('location', { hash: '#/challenges' })

    pushHash({ type: 'tab', tab: 'challenges' })
    expect(pushStateSpy).not.toHaveBeenCalled()
  })

  it('does not fire hashchange, so the router cannot re-enter itself', () => {
    // navigateTo sets location.hash and DOES fire it; that is why the
    // sync effect cannot use navigateTo.
    const pushStateSpy = vi.fn()
    vi.stubGlobal('history', { pushState: pushStateSpy })
    vi.stubGlobal('location', { hash: '' })
    const onHashChange = vi.fn()
    window.addEventListener('hashchange', onHashChange)

    pushHash({ type: 'tab', tab: 'piano' })
    window.removeEventListener('hashchange', onHashChange)
    expect(onHashChange).not.toHaveBeenCalled()
  })
})
