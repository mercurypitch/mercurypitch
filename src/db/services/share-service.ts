// ============================================================
// Community Share Service — DB-backed share/profile operations
// ============================================================

import { getDb } from '@/db'
import type { UserProfile, SharedMelody, SharedSession } from '@/db/entities'
import { getUserId } from '@/db/seed'

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

export async function loadUserProfile(): Promise<UserProfileView | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profiles = await repo.findAll({ limit: 1 })
    if (profiles.length === 0) return null
    const p = profiles[0]
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
      where: { isPublic: true } as Record<string, unknown>,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    return items.map((m) => ({
      id: m.id,
      name: m.melodyName,
      items: safeJsonParse(m.itemsJson),
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
      where: { isPublic: true } as Record<string, unknown>,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    return items.map((s) => ({
      id: s.id,
      name: s.sessionName,
      items: [],
      author: s.author ?? 'Unknown',
      results: safeJsonParse(s.resultsJson) as number[],
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

export async function saveSharedMelody(data: {
  name: string
  items: unknown[]
  author: string
  tags?: string[]
}): Promise<SharedMelodyView | null> {
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
  try {
    const db = await getDb()
    const repo = db.getRepository<SharedSession>('sharedSessions')
    const created = await repo.create({
      userId: getUserId(),
      sessionId: '',
      sessionName: data.name,
      author: data.author,
      score: data.results.length > 0 ? Math.round(data.results.reduce((a, b) => a + b, 0) / data.results.length) : 0,
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
