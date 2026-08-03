// ── Cloud Table Registry ─────────────────────────────────────────────
// Allowlist of entities the generic CRUD API may touch, plus per-table
// access rules. Anything not listed here 404s — this is the guard
// against arbitrary table access. The `users` table is intentionally
// absent: it is only reachable through the /api/auth/* routes.
//
// Access levels:
//   'admin'       — seed/config data (challenge/badge/achievement
//                   definitions, feature flags): public reads, writes
//                   require the X-Admin-Key header.
//   'user'        — private per-user rows: auth required, reads and
//                   writes always scoped to the token's userId.
//   'public-user' — leaderboard: public reads, authed writes forced
//                   to the token's userId.
//   'shared'      — shared content: public reads of isPublic rows
//                   (owners also see their private rows), authed
//                   writes forced to the token's userId.
//   'owner'       — userProfiles: row id IS the user id. Public reads,
//                   writes only to your own row.

export type TableAccess = 'admin' | 'user' | 'public-user' | 'shared' | 'owner'

export interface TableDef {
  access: TableAccess
  /** Columns stored as 0/1 that must round-trip as JS booleans. */
  boolCols?: string[]
  /** Columns stored as JSON text that must round-trip as objects. */
  jsonCols?: string[]
  /**
   * Columns only the server may set. Silently stripped from client create
   * and update payloads (stripped, not rejected, so a client echoing back a
   * whole row it previously read never starts failing). The server writes
   * them through its own prepared statements, which bypass the CRUD layer.
   */
  serverCols?: string[]
  /**
   * Writes require a REAL account (password/Google), not merely a token.
   *
   * An anonymous identity is a UUID in one browser's localStorage: clearing
   * site data mints a new one, so nothing published under it can be warned,
   * rate limited across sessions, or traced back to anybody. That is fine
   * for private rows and fine for reads; it is not fine for a listing
   * everyone sees. Nothing else about sharing changes — a share link
   * carries its content in the URL and touches no row here at all.
   */
  requiresAccount?: boolean
  /**
   * For publicly readable per-user tables ('owner'): the only columns a
   * requester other than the row's owner (or an admin) may see. Everything
   * else — friend codes, opt-in state, league placement, streak/practice
   * telemetry — is the owner's business. Absent means the whole row is
   * public, which is only acceptable for non-personal tables.
   */
  publicCols?: string[]
}

/**
 * Refuse a write that would publish something under no real identity.
 *
 * Anonymous identities are provisioned lazily and hold ordinary tokens, so
 * "authenticated" and "accountable" are different questions — see
 * `requiresAccount` above. Deletes deliberately do not consult this: taking
 * your own post down needs no more standing than putting it up did, and a
 * post made before the rule existed must stay removable.
 */
export function blockedForAnonymous(
  def: TableDef,
  auth: { provider: string } | null,
): boolean {
  return def.requiresAccount === true && auth?.provider === 'anonymous'
}

/**
 * Project a row down to its public columns for a non-owner, non-admin
 * reader. Tables without a publicCols list pass through untouched.
 */
export function maskPublicRow<T extends Record<string, unknown>>(
  def: TableDef,
  row: T,
  requesterId: string | null,
  admin: boolean,
): Partial<T> {
  if (def.publicCols === undefined) return row
  if (admin || (requesterId !== null && row.id === requesterId)) return row
  const masked: Partial<T> = {}
  for (const col of def.publicCols) {
    if (col in row) masked[col as keyof T] = row[col as keyof T]
  }
  return masked
}

export const TABLES: Record<string, TableDef> = {
  // currentLeagueId is placement — only the weekly cut moves players between
  // rungs. friendCode is minted by GET /api/friends/code (registered accounts
  // only); accepting it here would let anyone forge or vanity-pick codes.
  userProfiles: {
    access: 'owner',
    boolCols: ['leaderboardOptIn'],
    serverCols: ['currentLeagueId', 'friendCode'],
    // Public identity only. friendCode is a linking credential, opt-in and
    // league placement are consent/derived state, and the streak/practice
    // columns are activity telemetry — none of it belongs in an
    // unauthenticated profile read. Leaderboards expose streaks only for
    // opted-in users through their own aggregated endpoint.
    publicCols: [
      'id',
      'createdAt',
      'updatedAt',
      'displayName',
      'avatarUrl',
      'bio',
      'joinDate',
    ],
  },
  sessionRecords: { access: 'user', jsonCols: ['results'] },
  challengeDefinitions: { access: 'admin', boolCols: ['isActive'] },
  challengeProgress: { access: 'user', boolCols: ['completed'] },
  badgeDefinitions: { access: 'admin' },
  userBadges: { access: 'user' },
  achievements: { access: 'admin' },
  userAchievements: { access: 'user', boolCols: ['unlocked'] },
  // leaderboardEntries is intentionally NOT exposed: the leaderboard is now
  // server-derived from sessionRecords (see handleLeaderboard), so the table
  // is no longer client-readable or client-writable.
  sharedMelodies: { access: 'shared', boolCols: ['isPublic'], jsonCols: ['tags'], requiresAccount: true, },
  sharedSessions: { access: 'shared', boolCols: ['isPublic'], requiresAccount: true, },
  featureFlags: { access: 'admin', boolCols: ['value'] },
  userSettings: { access: 'user' },
  follows: { access: 'user' },
  userSurveyResponses: { access: 'user', jsonCols: ['answersJson'] },
  // A singer's measured voice over time. Private per-user: the twin and the
  // numbers are yours, and nothing here is a leaderboard.
  voiceprints: { access: 'user', jsonCols: ['summary'] },
  // Private per-user history: reads and writes always scoped to the token.
  userActivity: { access: 'user' },
  // Pricing config: public reads (the pricing page), writes require the
  // X-Admin-Key — so prices/tiers are editable without a deploy. The credit
  // ledger, entitlements, and billing events are deliberately NOT here: only
  // the server (billing webhook) may write them. See src/billing.ts.
  pricingPlans: { access: 'admin', boolCols: ['active'] },
  // Leaderboard rules: public reads so the client can show the same
  // thresholds it will be judged by; writes require the X-Admin-Key, so
  // sources and thresholds are tunable without a deploy.
  leaderboardConfig: { access: 'admin', boolCols: ['requireOptIn'] },
  // League rung config + tunable point weights: public reads (client renders
  // the ladder + trophies), writes require the X-Admin-Key — so names,
  // promote/relegate counts, trophy art, and point weights are editable
  // without a deploy. leagueCohorts / leagueMembership / leaguePointEvents are
  // deliberately NOT here: only the server (points award + weekly cut) writes
  // them, exactly like leaderboardEntries. See migrations/0005_leagues.sql.
  leagues: { access: 'admin', boolCols: ['isMystery'] },
  leaguePointsConfig: { access: 'admin' },
}
