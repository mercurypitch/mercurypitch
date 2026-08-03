// Who may put something on the public shelf.
//
// The Community board is the one surface where "has a token" is not a
// good enough answer: anonymous identities are minted on first write and
// discarded by clearing site data, so a post made under one cannot be
// warned, rate limited across sessions, or traced to anybody. Everything
// else about sharing is deliberately left open — a share link carries its
// melody in the URL and never reaches this registry at all.

import { describe, expect, it } from 'vitest'
import { blockedForAnonymous, TABLES } from './tables'

const anon = { provider: 'anonymous' }
const account = { provider: 'password' }

describe('blockedForAnonymous', () => {
  it('stops an anonymous post to either board table', () => {
    expect(blockedForAnonymous(TABLES.sharedMelodies, anon)).toBe(true)
    expect(blockedForAnonymous(TABLES.sharedSessions, anon)).toBe(true)
  })

  it('lets a real account post', () => {
    expect(blockedForAnonymous(TABLES.sharedMelodies, account)).toBe(false)
    expect(blockedForAnonymous(TABLES.sharedSessions, { provider: 'google' })).toBe(false)
  })

  it('leaves private tables alone for everyone', () => {
    // Practising without an account has to keep working — the gate is
    // about publishing, not about tracking your own singing.
    expect(blockedForAnonymous(TABLES.sessionRecords, anon)).toBe(false)
    expect(blockedForAnonymous(TABLES.userBadges, anon)).toBe(false)
    expect(blockedForAnonymous(TABLES.voiceprints, anon)).toBe(false)
    expect(blockedForAnonymous(TABLES.userSettings, anon)).toBe(false)
  })

  it('does not fire for an admin request, which carries no auth', () => {
    expect(blockedForAnonymous(TABLES.sharedMelodies, null)).toBe(false)
  })

  it('gates exactly the tables that are listed publicly', () => {
    // A new 'shared' table that forgets requiresAccount is the way this
    // hole reopens, so the registry itself is the assertion.
    const gated = Object.entries(TABLES)
      .filter(([, def]) => def.requiresAccount === true)
      .map(([name]) => name)
      .sort()
    expect(gated).toEqual(['sharedMelodies', 'sharedSessions'])

    const shared = Object.entries(TABLES)
      .filter(([, def]) => def.access === 'shared')
      .map(([name]) => name)
      .sort()
    expect(shared).toEqual(gated)
  })
})
