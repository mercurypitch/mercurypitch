// ============================================================
// Library grouping — partition the karaoke library into groups + loose songs
// ============================================================
//
// The "Your library" rail lists every completed separation. Once the user has
// organised songs into session groups, a flat list buries the structure — this
// pure helper folds the flat, already-sorted song list into a
// group -> song-list hierarchy the rail renders as an indented tree.
//
// Kept dependency-free (no store/db imports) so it is unit-testable in
// isolation and mirrors the queue-builder in `karaoke-playlist-store.ts`.

/** Minimal shape of a library song needed to place it in a group. */
export interface GroupableSong {
  sessionId: string
  /** Optional direct group assignment (mirrors `UvrSession.groupId`). */
  groupId?: string
}

/** Minimal shape of a session group (mirrors `SessionGroupRecord`). */
export interface GroupableGroup {
  id: string
  name: string
  /** Ordered list of member session ids (the curated group order). */
  sessionIds: string[]
}

/** A group header with its resolved, ordered member songs. */
export interface LibraryGroupView<S> {
  id: string
  name: string
  songs: S[]
}

/** The library folded into groups (each with ≥1 song) plus loose songs. */
export interface GroupedLibrary<S> {
  groups: LibraryGroupView<S>[]
  ungrouped: S[]
}

/**
 * Fold a flat library song list into a group -> song hierarchy.
 *
 * Membership resolution mirrors the karaoke queue builder's `groupSessionIds`:
 * a group's members are its ordered `sessionIds` (existing library songs only)
 * followed by any remaining song whose `groupId` points at the group but that
 * the curated order missed — the two can drift. Each song lands in at most one
 * group (first match wins by group order, then by curated order within it), so
 * a song never appears twice. Groups with no library songs are dropped; songs
 * in no group fall through to `ungrouped`. Input order is otherwise preserved,
 * so a createdAt-sorted `songs` list stays sorted everywhere it lands.
 */
export function groupLibrarySongs<S extends GroupableSong>(
  songs: readonly S[],
  groups: readonly GroupableGroup[],
): GroupedLibrary<S> {
  const byId = new Map(songs.map((s) => [s.sessionId, s]))
  const assigned = new Set<string>()
  const outGroups: LibraryGroupView<S>[] = []

  for (const g of groups) {
    const members = resolveGroupMembers(g, songs, byId, assigned)
    if (members.length > 0) {
      outGroups.push({ id: g.id, name: g.name, songs: members })
    }
  }

  const ungrouped = songs.filter((s) => !assigned.has(s.sessionId))
  return { groups: outGroups, ungrouped }
}

/**
 * Resolve one group's member songs, claiming each into `assigned` so no song is
 * placed twice. Curated `sessionIds` order first (existing songs only), then any
 * drifted member (assigned via `groupId` but missing from `sessionIds`) in the
 * caller's `songs` order.
 */
function resolveGroupMembers<S extends GroupableSong>(
  group: GroupableGroup,
  songs: readonly S[],
  byId: ReadonlyMap<string, S>,
  assigned: Set<string>,
): S[] {
  const members: S[] = []
  for (const sid of group.sessionIds) {
    const song = byId.get(sid)
    if (song !== undefined && !assigned.has(sid)) {
      members.push(song)
      assigned.add(sid)
    }
  }
  for (const s of songs) {
    if (s.groupId === group.id && !assigned.has(s.sessionId)) {
      members.push(s)
      assigned.add(s.sessionId)
    }
  }
  return members
}
