// ============================================================
// Community Share Service — DB-backed share/profile operations
// ============================================================

import { z } from 'zod/v4'
import { getDb } from '@/db'
import type { SharedMelody, SharedSession, UserProfile } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { hasUpgradedAccount } from '@/db/services/auth-service'
import { findOwnProfile } from '@/db/services/user-service'

export interface SharedMelodyView {
  id: string
  name: string
  items: unknown[]
  author: string
  tags?: string[]
  date: number
}

export interface SharedSessionView {
  id: string
  name: string
  items: unknown[]
  author: string
  results: number[]
  date: number
}

export interface UserProfileView {
  userId: string
  displayName: string
  bio?: string
  joinDate: number
}

const MelodyItemSchema = z.object({
  midi: z.number().min(21).max(108),
  startBeat: z.number().min(0),
  duration: z.number().positive(),
  freq: z.number().positive(),
})

export async function loadUserProfile(): Promise<UserProfileView | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const p = await findOwnProfile(repo)
    if (p === undefined) return null
    return {
      userId: p.id,
      displayName: p.displayName,
      bio: p.bio,
      joinDate: new Date(p.joinDate).getTime(),
    }
  } catch {
    return null
  }
}

export async function loadSharedMelodies(): Promise<SharedMelodyView[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<SharedMelody>('sharedMelodies')
    const items = await repo.findAll({
      where: { isPublic: true },
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    return items.map((m) => ({
      id: m.id,
      name: m.melodyName,
      items: z.array(MelodyItemSchema).parse(safeJsonParse(m.itemsJson)),
      author: m.author ?? 'Unknown',
      tags: m.tags ?? [],
      date: new Date(m.createdAt).getTime(),
    }))
  } catch {
    return []
  }
}

export async function loadSharedSessions(): Promise<SharedSessionView[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<SharedSession>('sharedSessions')
    const items = await repo.findAll({
      where: { isPublic: true },
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    return items.map((s) => ({
      id: s.id,
      name: s.sessionName,
      items: [],
      author: s.author ?? 'Unknown',
      results: z.array(z.number()).parse(safeJsonParse(s.resultsJson)),
      date: new Date(s.createdAt).getTime(),
    }))
  } catch {
    return []
  }
}

function safeJsonParse(raw: string): unknown[] {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * Whether this singer may put something on the public Community shelf.
 *
 * A listing needs a name that outlives one browser's localStorage, so the
 * board is account-only — the worker enforces it (tables.ts
 * `requiresAccount`) and this is the same rule client-side, so the UI can
 * say so before the press rather than swallowing a 403.
 *
 * Nothing else about sharing is gated: a share link carries the melody in
 * its own URL, needs no account at either end, and never touches a row.
 */
export function canPostToCommunity(): boolean {
  return hasUpgradedAccount()
}

export async function saveSharedMelody(data: {
  name: string
  items: unknown[]
  author: string
  tags?: string[]
}): Promise<SharedMelodyView | null> {
  if (!canPostToCommunity()) return null
  try {
    const db = await getDb()
    const repo = db.getRepository<SharedMelody>('sharedMelodies')
    const created = await repo.create({
      userId: getUserId(),
      melodyId: '',
      melodyName: data.name,
      author: data.author,
      itemsJson: JSON.stringify(data.items),
      tags: data.tags ?? [],
      isPublic: true,
    })
    return {
      id: created.id,
      name: created.melodyName,
      items: safeJsonParse(created.itemsJson),
      author: created.author ?? 'Unknown',
      tags: created.tags ?? [],
      date: new Date(created.createdAt).getTime(),
    }
  } catch {
    return null
  }
}

export async function saveSharedSession(data: {
  name: string
  items: unknown[]
  author: string
  results: number[]
}): Promise<SharedSessionView | null> {
  if (!canPostToCommunity()) return null
  try {
    const db = await getDb()
    const repo = db.getRepository<SharedSession>('sharedSessions')
    const created = await repo.create({
      userId: getUserId(),
      sessionId: '',
      sessionName: data.name,
      author: data.author,
      score:
        data.results.length > 0
          ? Math.round(
              data.results.reduce((a, b) => a + b, 0) / data.results.length,
            )
          : 0,
      accuracy: 0,
      resultsJson: JSON.stringify(data.results),
      isPublic: true,
    })
    return {
      id: created.id,
      name: created.sessionName,
      items: [],
      author: created.author ?? 'Unknown',
      results: safeJsonParse(created.resultsJson) as number[],
      date: new Date(created.createdAt).getTime(),
    }
  } catch {
    return null
  }
}

/**
 * Unpublish a shared melody or session.
 *
 * A share was one-way: publish it and it stayed on the shelf forever,
 * with no way to take back a wrong take or a duplicate. Anyone who can
 * put something up should be able to pull it down.
 *
 * Deletes the row rather than flipping isPublic, because the shelf IS
 * the row — a hidden one is only a leak waiting to happen.
 */
export async function unpublishShared(
  kind: 'melody' | 'session',
  id: string,
): Promise<boolean> {
  try {
    const db = await getDb()
    const table = kind === 'melody' ? 'sharedMelodies' : 'sharedSessions'
    await db.getRepository(table).delete(id)
    return true
  } catch {
    // Local-only shares (never reached the DB) still disappear from the
    // shelf — the caller drops them from its local list either way.
    return false
  }
}
