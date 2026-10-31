// ── A share's author, from the profile ───────────────────────────────
// `author` on the two share tables is the poster's display name. The client
// used to send it, so a share could go out under any name at all. Now the
// worker writes it from the profile when a share is created (it is a server
// column, tables.ts) and reads the current profile name over it whenever a
// share is read, so a rename reaches every share the singer posted, and a
// name stored before the name filter existed is not what anyone sees. The
// stored column stays, filled, for the row's own sake: it is NOT NULL.

type Row = Record<string, unknown>

/** The share tables whose `author` is the poster's display name. */
export const AUTHORED_TABLES: ReadonlySet<string> = new Set([
  'sharedMelodies',
  'sharedSessions',
])

/** The boards' handle for a singer with no name: "Singer-" and six of the id. */
function handle(userId: string): string {
  return `Singer-${userId.slice(0, 6)}`
}

/** The name a new share goes out under. */
export async function authorFor(
  db: D1Database,
  userId: string,
): Promise<string> {
  const row = await db
    .prepare('SELECT displayName FROM userProfiles WHERE id = ?')
    .bind(userId)
    .first<{ displayName: string | null }>()
  const name = row?.displayName?.trim() ?? ''
  return name === '' ? handle(userId) : name
}

/** Writes each share's poster's current name over its stored `author`. */
export async function withProfileAuthors(
  db: D1Database,
  rows: Row[],
): Promise<void> {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.userId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ]
  if (ids.length === 0) return
  // One bind for any number of posters: D1 caps the bound values a query
  // takes, and a list page can carry a thousand rows.
  const { results } = await db
    .prepare(
      `SELECT id, displayName FROM userProfiles
       WHERE id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(ids))
    .all<{ id: string; displayName: string | null }>()
  const names = new Map(
    (results ?? []).map((row) => [row.id, row.displayName?.trim() ?? '']),
  )
  for (const row of rows) {
    if (typeof row.userId !== 'string') continue
    const name = names.get(row.userId)
    if (name === undefined) continue
    row.author = name === '' ? handle(row.userId) : name
  }
}
