// ============================================================
// Community Share Service — DB-backed share/profile operations
// ============================================================

import { z } from 'zod/v4'
import { getDb } from '@/db'
import type { SharedMelody, SharedSession, UserProfile } from '@/db/entities'
import { hasUpgradedAccount } from '@/db/services/auth-service'
import { authVersion, findOwnProfile, getUserId, } from '@/db/services/user-service'
import { midiToNote } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'

export interface SharedMelodyView {
  id: string
  /** Who published it. The board is everyone's, so this is what tells a
   *  singer's own card (the one they may take down) from anyone else's. */
  userId: string
  name: string
  items: MelodyItem[]
  author: string
  tags?: string[]
  date: number
}

export interface SharedSessionView {
  id: string
  /** Who published it. See SharedMelodyView.userId. */
  userId: string
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

export interface PublishedShareCounts {
  melodies: number
  sessions: number
}

/** Count the owner's complete public collection, independently of the board page.
 * Failed reads must reject so a temporary outage cannot erase known totals. */
export async function loadPublishedShareCounts(
  userId: string,
): Promise<PublishedShareCounts> {
  const db = await getDb()
  const options = { where: { userId, isPublic: true }, throwOnError: true }
  const [melodies, sessions] = await Promise.all([
    db.getRepository<SharedMelody>('sharedMelodies').count(options),
    db.getRepository<SharedSession>('sharedSessions').count(options),
  ])
  return { melodies, sessions }
}

const LegacyMelodyItemSchema = z.object({
  midi: z.number().int().min(0).max(127),
  startBeat: z.number().min(0),
  duration: z.number().positive(),
  freq: z.number().positive(),
})

const MelodyItemSchema: z.ZodType<MelodyItem> = z
  .object({
    id: z.number().int(),
    note: z.object({
      midi: z.number().int().min(0).max(127),
      name: z.enum([
        'C',
        'C#',
        'D',
        'D#',
        'E',
        'F',
        'F#',
        'G',
        'G#',
        'A',
        'A#',
        'B',
      ]),
      octave: z.number().int(),
      freq: z.number().nonnegative(),
    }),
    startBeat: z.number().nonnegative(),
    duration: z.number().positive(),
    velocity: z.number().min(0).max(127).optional(),
    effectType: z
      .enum([
        'slide-up',
        'slide-down',
        'ease-in',
        'ease-out',
        'vibrato',
        'tremolo',
        'trill',
        'staccato',
        'chord',
      ])
      .optional(),
    slideInterval: z.number().optional(),
    vibratoAmplitude: z.number().optional(),
    tremoloRate: z.number().optional(),
    tremoloDepth: z.number().optional(),
    trillInterval: z.number().optional(),
    trillRate: z.number().optional(),
    staccatoRatio: z.number().optional(),
    chordType: z
      .enum([
        'power',
        'major',
        'minor',
        'diminished',
        'augmented',
        'sus2',
        'sus4',
        'octave',
      ])
      .optional(),
    isRest: z.boolean().optional(),
    lyricText: z.string().optional(),
  })
  .refine((item) => item.isRest === true || item.note.freq > 0)

function parseMelodyItems(value: unknown): MelodyItem[] {
  return z
    .array(z.union([MelodyItemSchema, LegacyMelodyItemSchema]))
    .parse(value)
    .map((item, index) => {
      if ('note' in item) return item
      return {
        id: index + 1,
        note: { midi: item.midi, ...midiToNote(item.midi), freq: item.freq },
        startBeat: item.startBeat,
        duration: item.duration,
      }
    })
}

export async function loadUserProfile(): Promise<UserProfileView | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const p = await findOwnProfile(repo)
    if (p === undefined) return null
    return {
      userId: p.id,
      displayName: p.displayName,
      // The column is nullable; the view says `bio?: string`. Collapse the
      // two spellings of "no bio" here, once, so readers need no check.
      bio: p.bio ?? undefined,
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
    return items.flatMap((m) => {
      try {
        return [
          {
            id: m.id,
            userId: m.userId,
            name: m.melodyName,
            items: parseMelodyItems(JSON.parse(m.itemsJson)),
            author: m.author ?? 'Unknown',
            tags: m.tags ?? [],
            date: new Date(m.createdAt).getTime(),
          },
        ]
      } catch {
        // A malformed public row must not hide everyone else's melodies.
        return []
      }
    })
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
      userId: s.userId,
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
  const userId = getUserId()
  const version = authVersion()
  try {
    const items = parseMelodyItems(data.items)
    const db = await getDb()
    if (getUserId() !== userId || authVersion() !== version) return null
    const repo = db.getRepository<SharedMelody>('sharedMelodies')
    const created = await repo.create({
      userId,
      melodyId: '',
      melodyName: data.name,
      author: data.author,
      itemsJson: JSON.stringify(items),
      tags: data.tags ?? [],
      isPublic: true,
    })
    return {
      id: created.id,
      userId: created.userId,
      name: created.melodyName,
      items: parseMelodyItems(JSON.parse(created.itemsJson)),
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
  const userId = getUserId()
  const version = authVersion()
  try {
    const db = await getDb()
    if (getUserId() !== userId || authVersion() !== version) return null
    const repo = db.getRepository<SharedSession>('sharedSessions')
    const created = await repo.create({
      userId,
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
      userId: created.userId,
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
  const userId = getUserId()
  const version = authVersion()
  try {
    const db = await getDb()
    if (getUserId() !== userId || authVersion() !== version) return false
    const table = kind === 'melody' ? 'sharedMelodies' : 'sharedSessions'
    await db.getRepository(table).delete(id)
    return true
  } catch {
    return false
  }
}
