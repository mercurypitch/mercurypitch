// ============================================================
// Follow Service — social graph for the Friends leaderboard
// ============================================================
//
// Rows live in the cloud `follows` table (private, JWT-scoped: you can
// only read/write your own follow list). The worker joins it server-side
// for the Friends leaderboard view.

import { getDb } from '@/db'
import type { Follow } from '@/db/entities'
import { getUserId } from '@/db/services/user-service'

/** User ids the current user follows. Empty when signed out/offline. */
export async function getFollowing(): Promise<string[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll()
    return rows.map((r) => r.followedUserId)
  } catch {
    return []
  }
}

export async function isFollowing(userId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll({ where: { followedUserId: userId } })
    return rows.length > 0
  } catch {
    return false
  }
}

/** Follow a user. Returns false when it failed (signed out, self, …). */
export async function follow(userId: string): Promise<boolean> {
  if (userId === '' || userId === getUserId()) return false
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    if (await isFollowing(userId)) return true
    await repo.create({ userId: getUserId(), followedUserId: userId })
    return true
  } catch {
    return false
  }
}

export async function unfollow(userId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Follow>('follows')
    const rows = await repo.findAll({ where: { followedUserId: userId } })
    await Promise.all(rows.map((r) => repo.delete(r.id)))
    return true
  } catch {
    return false
  }
}
