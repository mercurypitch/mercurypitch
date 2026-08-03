// ── Achievements admin API ──────────────────────────────────────────
// Thin wrapper over the generic CRUD routes for the `achievements` table.
// That table is `access: 'admin'` in the worker registry: reads are public,
// writes need the X-Admin-Key header. The app's own repository layer cannot
// send that header, so the authoring page talks to the API directly — the
// same shape `scripts/seed-remote-db.mjs` uses when it seeds from
// `src/db/seed-data.json`.
//
// Rows written here are the SAME rows the seed script merges by `name`, so
// an achievement authored in the studio and later added to seed-data.json
// under the same name updates in place rather than duplicating.

import type { Achievement, AchievementCategory } from '@/db/entities'
import { API_BASE_URL } from '@/lib/defaults'

/** Everything an author supplies; the server fills id/createdAt/updatedAt. */
export interface AchievementDraft {
  name: string
  description: string
  icon: string
  points: number
  condition: string
  required: number
  sortOrder: number
  category: AchievementCategory
}

function base(): string {
  return API_BASE_URL ?? ''
}

function adminHeaders(adminKey: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }
}

/**
 * Every achievement definition, newest schema first.
 *
 * Returns null on a transport or auth failure so callers can tell "the API
 * is unreachable" from "there are none" — an empty array is a real answer
 * and must not be produced by a failed request.
 */
export async function listAchievements(): Promise<Achievement[] | null> {
  try {
    const res = await fetch(`${base()}/api/achievements?limit=500`)
    if (!res.ok) return null
    const rows = (await res.json()) as Achievement[]
    return rows.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    )
  } catch {
    return null
  }
}

export async function createAchievement(
  adminKey: string,
  draft: AchievementDraft,
): Promise<Achievement | null> {
  try {
    const res = await fetch(`${base()}/api/achievements`, {
      method: 'POST',
      headers: adminHeaders(adminKey),
      body: JSON.stringify(draft),
    })
    if (!res.ok) return null
    return (await res.json()) as Achievement
  } catch {
    return null
  }
}

export async function updateAchievement(
  adminKey: string,
  id: string,
  draft: AchievementDraft,
): Promise<Achievement | null> {
  try {
    const res = await fetch(
      `${base()}/api/achievements/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: adminHeaders(adminKey),
        body: JSON.stringify(draft),
      },
    )
    if (!res.ok) return null
    return (await res.json()) as Achievement
  } catch {
    return null
  }
}

/**
 * Removes the definition only. Rows in `userAchievements` that pointed at it
 * are left behind deliberately: they are per-user history, and the studio has
 * no business deleting a stranger's record of having earned something.
 */
export async function deleteAchievement(
  adminKey: string,
  id: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${base()}/api/achievements/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { 'X-Admin-Key': adminKey } },
    )
    return res.ok
  } catch {
    return false
  }
}
