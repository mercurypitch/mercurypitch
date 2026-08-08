// Who may put something on the public shelf.
//
// The Community board is the one surface where "has a token" is not a
// good enough answer: anonymous identities are minted on first write and
// discarded by clearing site data, so a post made under one cannot be
// warned, rate limited across sessions, or traced to anybody. Everything
// else about sharing is deliberately left open — a share link carries its
// melody in the URL and never reaches this registry at all.

import { describe, expect, it } from 'vitest'
import { blockedForAnonymous, maskPublicRow, queryableCol, TABLES, } from './tables'

const anon = { provider: 'anonymous' }
const account = { provider: 'password' }

describe('blockedForAnonymous', () => {
  it('stops an anonymous post to either board table', () => {
    expect(blockedForAnonymous(TABLES.sharedMelodies, anon)).toBe(true)
    expect(blockedForAnonymous(TABLES.sharedSessions, anon)).toBe(true)
  })

  it('lets a real account post', () => {
    expect(blockedForAnonymous(TABLES.sharedMelodies, account)).toBe(false)
    expect(
      blockedForAnonymous(TABLES.sharedSessions, { provider: 'google' }),
    ).toBe(false)
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

// The generic CRUD reader is a second door onto tables that a dedicated
// endpoint already guards. /api/billing/pricing withholds stripePriceId and
// hands out a `purchasable` flag instead; GET /api/pricingPlans served the
// column to anyone who asked. These tests pin the door shut.
describe('maskPublicRow — privateCols', () => {
  const plan = {
    id: 'sup-fund',
    kind: 'donation',
    label: 'Chime',
    amount: 500,
    currency: 'eur',
    stripePriceId: 'price_live_secret',
    active: true,
  }

  it('withholds stripePriceId from an anonymous pricing read', () => {
    const seen = maskPublicRow(TABLES.pricingPlans!, plan, null, false)
    expect(seen).not.toHaveProperty('stripePriceId')
    // The price itself is the pricing page — it has to survive.
    expect(seen.amount).toBe(500)
    expect(seen.label).toBe('Chime')
    expect(seen.currency).toBe('eur')
  })

  it('still withholds it from a signed-in reader', () => {
    // 'admin' tables have no owner, but a token must not widen the read.
    const seen = maskPublicRow(TABLES.pricingPlans!, plan, 'user-1', false)
    expect(seen).not.toHaveProperty('stripePriceId')
  })

  it('gives it to the admin studio, which edits these rows', () => {
    const seen = maskPublicRow(TABLES.pricingPlans!, plan, null, true)
    expect(seen.stripePriceId).toBe('price_live_secret')
  })

  it('does not mutate the row it was handed', () => {
    // Both read paths map over rows straight out of D1; a mask that deleted
    // in place would corrupt whatever else read the same object.
    const row = { ...plan }
    maskPublicRow(TABLES.pricingPlans!, row, null, false)
    expect(row.stripePriceId).toBe('price_live_secret')
  })

  it('leaves a table with no privateCols exactly as it was', () => {
    const flag = { id: 'f1', value: true }
    expect(maskPublicRow(TABLES.featureFlags!, flag, null, false)).toEqual(flag)
  })

  it('keeps the owner exemption on publicCols intact', () => {
    // privateCols must not have changed how profiles mask: the owner still
    // sees their whole row, a stranger still gets the public subset only.
    const profile = { id: 'me', displayName: 'Ada', friendCode: 'ABC-123' }
    expect(maskPublicRow(TABLES.userProfiles!, profile, 'me', false)).toEqual(
      profile,
    )
    const stranger = maskPublicRow(TABLES.userProfiles!, profile, 'you', false)
    expect(stranger).not.toHaveProperty('friendCode')
    expect(stranger.displayName).toBe('Ada')
  })

  it('names every column the CRUD reader holds back', () => {
    // Same reasoning as the requiresAccount check above: the registry is the
    // assertion, so a table that starts carrying a secret has to be listed.
    const withPrivate = Object.entries(TABLES)
      .filter(([, def]) => def.privateCols !== undefined)
      .map(([name, def]) => [name, def.privateCols] as const)
    expect(withPrivate).toEqual([['pricingPlans', ['stripePriceId']]])
  })
})

// A masked column is still reachable through the query itself: `where[col]=x`
// answers "is x the value?" and `orderBy=col` sorts by it. Both read the
// column without it ever appearing in a response body.
describe('queryableCol', () => {
  it('refuses a privateCol to a non-admin, whatever the case', () => {
    const plans = TABLES.pricingPlans!
    expect(queryableCol(plans, 'stripePriceId', false)).toBe(false)
    // SQLite matches quoted identifiers case-insensitively, so a guard that
    // did not fold case would be bypassed by shouting the column name.
    expect(queryableCol(plans, 'STRIPEPRICEID', false)).toBe(false)
    expect(queryableCol(plans, 'stripepriceid', false)).toBe(false)
  })

  it('allows the columns the pricing page actually queries', () => {
    const plans = TABLES.pricingPlans!
    expect(queryableCol(plans, 'kind', false)).toBe(true)
    expect(queryableCol(plans, 'active', false)).toBe(true)
    expect(queryableCol(plans, 'sortOrder', false)).toBe(true)
  })

  it('allows an admin everything — the studio edits these rows', () => {
    expect(queryableCol(TABLES.pricingPlans!, 'stripePriceId', true)).toBe(true)
    expect(queryableCol(TABLES.userProfiles!, 'friendCode', true)).toBe(true)
  })

  it('treats a publicCols allowlist as the queryable set too', () => {
    // friendCode is a linking credential that /api/friends/redeem rate limits
    // precisely because it is guessable. Filtering profiles by it would be the
    // same guessing game with no limit at all, against a column a stranger is
    // already forbidden to read.
    const profiles = TABLES.userProfiles!
    expect(queryableCol(profiles, 'friendCode', false)).toBe(false)
    expect(queryableCol(profiles, 'currentLeagueId', false)).toBe(false)
    expect(queryableCol(profiles, 'id', false)).toBe(true)
    expect(queryableCol(profiles, 'displayName', false)).toBe(true)
  })

  it('leaves a table that declares neither list fully queryable', () => {
    expect(queryableCol(TABLES.sessionRecords!, 'userId', false)).toBe(true)
    expect(queryableCol(TABLES.leagues!, 'rank', false)).toBe(true)
  })
})
