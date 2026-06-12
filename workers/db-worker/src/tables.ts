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
}

export const TABLES: Record<string, TableDef> = {
  userProfiles: { access: 'owner' },
  sessionRecords: { access: 'user', jsonCols: ['results'] },
  challengeDefinitions: { access: 'admin', boolCols: ['isActive'] },
  challengeProgress: { access: 'user', boolCols: ['completed'] },
  badgeDefinitions: { access: 'admin' },
  userBadges: { access: 'user' },
  achievements: { access: 'admin' },
  userAchievements: { access: 'user', boolCols: ['unlocked'] },
  leaderboardEntries: { access: 'public-user' },
  sharedMelodies: { access: 'shared', boolCols: ['isPublic'], jsonCols: ['tags'] },
  sharedSessions: { access: 'shared', boolCols: ['isPublic'] },
  featureFlags: { access: 'admin', boolCols: ['value'] },
  userSettings: { access: 'user' },
  follows: { access: 'user' },
}
