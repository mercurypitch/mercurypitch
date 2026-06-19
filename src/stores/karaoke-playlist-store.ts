// ============================================================
// Karaoke Playlist Store — persisted set lists + playback transport
// ============================================================
//
// A playlist is a saved, reusable set list built from session groups and/or
// individual sessions, with an optional singer per entry and shuffle options.
// At play time the playlist is expanded into a flat queue and stepped through
// by the StemMixer (overlay → countdown → play → score → next → summary).

import { createSignal } from 'solid-js'
import type { KaraokePlaylistItem, KaraokePlaylistRecord } from '@/db'
import { getDb } from '@/db'
import { IS_DEV } from '@/lib/defaults'
import { getAllUvrSessions, getGroupsReactive, getUvrSession, } from '@/stores/app-store'

// ── Types ──────────────────────────────────────────────────────

/** One resolved, playable song in the flattened playback queue. */
export interface QueueEntry {
  sessionId: string
  songTitle: string
  groupName?: string
  singerName?: string
}

export type KaraokePhase =
  | 'idle'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'scoring'
  | 'summary'

/** Mirrors the StemMixer MicScore shape (structurally assignable). */
export interface KaraokeSongScore {
  totalNotes: number
  matchedNotes: number
  accuracyPct: number
  avgCentsOff: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

interface BuildQueueDeps {
  groupSessionIds: (groupId: string) => string[]
  groupName: (groupId: string) => string | undefined
  sessionTitle: (sessionId: string) => string | undefined
}

// ── Pure queue builder (unit-tested) ───────────────────────────

/** Fisher–Yates shuffle, returns a new array. */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Expand one playlist item into its ordered list of playable songs (a "player"
 * in round-robin terms). Groups expand to their members (shuffled within when
 * flagged); a standalone session is a single-song player.
 */
function expandItem(
  item: KaraokePlaylistItem,
  deps: BuildQueueDeps,
): QueueEntry[] {
  if (item.kind === 'session') {
    return [
      {
        sessionId: item.refId,
        songTitle: deps.sessionTitle(item.refId) ?? 'Unknown',
        singerName: item.singerName,
      },
    ]
  }
  const ids =
    item.shuffleWithinGroup === true
      ? shuffle(deps.groupSessionIds(item.refId))
      : deps.groupSessionIds(item.refId)
  const groupName = deps.groupName(item.refId)
  return ids.map((sid) => ({
    sessionId: sid,
    songTitle: deps.sessionTitle(sid) ?? 'Unknown',
    groupName,
    singerName: item.singerName,
  }))
}

/**
 * Expand a playlist into a flat, ordered queue of playable songs.
 *
 * - 'sequential' (default): each group/song plays fully, in (optionally
 *   shuffled) item order.
 * - 'roundRobin': turn-based — one song per group per round, looping until
 *   every song is played (a standalone session is a one-song group). When
 *   `shuffleOrder` is on, the group turn order is re-shuffled each round; when a
 *   group's `shuffleWithinGroup` is on, its songs are taken in random order
 *   (already-played ones are naturally skipped since the order is fixed here).
 */
export function buildQueue(
  playlist: KaraokePlaylistRecord,
  deps: BuildQueueDeps,
): QueueEntry[] {
  if ((playlist.playMode ?? 'sequential') === 'roundRobin') {
    const players = playlist.items
      .map((item) => ({ entries: expandItem(item, deps), idx: 0 }))
      .filter((p) => p.entries.length > 0)
    const out: QueueEntry[] = []
    // Each round: every player with songs left contributes one, in (optionally
    // re-shuffled) order, until all are exhausted.
    while (players.some((p) => p.idx < p.entries.length)) {
      const active = players.filter((p) => p.idx < p.entries.length)
      const order = playlist.shuffleOrder === true ? shuffle(active) : active
      for (const p of order) {
        out.push(p.entries[p.idx])
        p.idx += 1
      }
    }
    return out
  }

  const items =
    playlist.shuffleOrder === true ? shuffle(playlist.items) : playlist.items
  const out: QueueEntry[] = []
  for (const item of items) out.push(...expandItem(item, deps))
  return out
}

// ── Persistence ────────────────────────────────────────────────

const REPO = 'karaokePlaylists'

const [_playlists, _setPlaylists] = createSignal<KaraokePlaylistRecord[]>([])
const [playlistsVersion, setPlaylistsVersion] = createSignal(0)
const bump = () => setPlaylistsVersion((v) => v + 1)

/** All playlists, reactively (tracks playlistsVersion). */
export function getPlaylistsReactive(): KaraokePlaylistRecord[] {
  playlistsVersion()
  return _playlists()
}

export function getPlaylist(id: string): KaraokePlaylistRecord | undefined {
  return _playlists().find((p) => p.id === id)
}

let _ready = false

/** Load playlists from IndexedDB into the in-memory cache. Call once at startup. */
export async function initKaraokePlaylistStore(): Promise<void> {
  if (_ready) return
  try {
    const db = await getDb()
    const repo = db.getRepository<KaraokePlaylistRecord>(REPO)
    _setPlaylists(await repo.findAll({}))
  } catch (err) {
    if (IS_DEV) console.warn('[KaraokePlaylistStore] init failed:', err)
  }
  _ready = true
}

export async function createPlaylist(
  name: string,
): Promise<KaraokePlaylistRecord> {
  const db = await getDb()
  const repo = db.getRepository<KaraokePlaylistRecord>(REPO)
  const pl = await repo.create({
    name,
    items: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  _setPlaylists((prev) => [...prev, pl])
  bump()
  return pl
}

/** Create a playlist with a full set of items at once (used by import). New
 *  item ids are generated; original singer/shuffle metadata is preserved. */
export async function createPlaylistWithItems(
  name: string,
  items: Omit<KaraokePlaylistItem, 'id'>[],
  shuffleOrder?: boolean,
): Promise<KaraokePlaylistRecord> {
  const db = await getDb()
  const repo = db.getRepository<KaraokePlaylistRecord>(REPO)
  const pl = await repo.create({
    name,
    items: items.map((it) => ({ ...it, id: globalThis.crypto.randomUUID() })),
    ...(shuffleOrder !== undefined ? { shuffleOrder } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  _setPlaylists((prev) => [...prev, pl])
  bump()
  return pl
}

async function patchPlaylist(
  id: string,
  changes: Partial<KaraokePlaylistRecord>,
): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<KaraokePlaylistRecord>(REPO)
  const updated = await repo.update(
    id,
    changes as Partial<KaraokePlaylistRecord>,
  )
  _setPlaylists((prev) => prev.map((p) => (p.id === id ? updated : p)))
  bump()
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  await patchPlaylist(id, { name })
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<KaraokePlaylistRecord>(REPO)
  await repo.delete(id)
  _setPlaylists((prev) => prev.filter((p) => p.id !== id))
  bump()
  if (activePlaylistId() === id) stopPlaylist()
}

function mutateItems(
  id: string,
  fn: (items: KaraokePlaylistItem[]) => KaraokePlaylistItem[],
): Promise<void> {
  const pl = getPlaylist(id)
  if (!pl) return Promise.resolve()
  return patchPlaylist(id, { items: fn(pl.items) })
}

export async function addItem(
  playlistId: string,
  item: Omit<KaraokePlaylistItem, 'id'>,
): Promise<void> {
  await mutateItems(playlistId, (items) => [
    ...items,
    { ...item, id: globalThis.crypto.randomUUID() },
  ])
}

export async function removeItem(
  playlistId: string,
  itemId: string,
): Promise<void> {
  await mutateItems(playlistId, (items) =>
    items.filter((it) => it.id !== itemId),
  )
}

/** Move an item to a new index within the playlist. */
export async function reorderItems(
  playlistId: string,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  await mutateItems(playlistId, (items) => {
    if (
      fromIndex < 0 ||
      fromIndex >= items.length ||
      toIndex < 0 ||
      toIndex >= items.length
    )
      return items
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
  })
}

export async function setItemSinger(
  playlistId: string,
  itemId: string,
  singerName: string,
): Promise<void> {
  const trimmed = singerName.trim()
  await mutateItems(playlistId, (items) =>
    items.map((it) =>
      it.id === itemId ? { ...it, singerName: trimmed || undefined } : it,
    ),
  )
}

export async function setItemShuffleWithinGroup(
  playlistId: string,
  itemId: string,
  shuffle: boolean,
): Promise<void> {
  await mutateItems(playlistId, (items) =>
    items.map((it) =>
      it.id === itemId ? { ...it, shuffleWithinGroup: shuffle } : it,
    ),
  )
}

export async function setPlaylistShuffleOrder(
  playlistId: string,
  shuffleOrder: boolean,
): Promise<void> {
  await patchPlaylist(playlistId, { shuffleOrder })
}

export async function setPlaylistPlayMode(
  playlistId: string,
  playMode: 'sequential' | 'roundRobin',
): Promise<void> {
  await patchPlaylist(playlistId, { playMode })
}

// ── Playback transport ─────────────────────────────────────────

const [activePlaylistId, setActivePlaylistId] = createSignal<string | null>(
  null,
)
const [queue, setQueue] = createSignal<QueueEntry[]>([])
const [currentIndex, setCurrentIndex] = createSignal(0)
const [phase, setPhase] = createSignal<KaraokePhase>('idle')
const [perSongScores, setPerSongScores] = createSignal<
  (KaraokeSongScore | null)[]
>([])

export { activePlaylistId, queue, currentIndex, phase, perSongScores }

/** True whenever a playlist run is in progress (overlay/playback/summary). */
export function isPlaylistActive(): boolean {
  return phase() !== 'idle'
}

export function currentSong(): QueueEntry | null {
  return queue()[currentIndex()] ?? null
}

export function nextSong(): QueueEntry | null {
  return queue()[currentIndex() + 1] ?? null
}

const runtimeDeps: BuildQueueDeps = {
  // Resolve a group's songs to *existing* sessions only, merging the group's
  // ordered `sessionIds` with any session assigned via `session.groupId` (the
  // two can drift). This keeps stale/deleted ids out of the queue so playback
  // doesn't silently skip straight to the summary.
  groupSessionIds: (gid) => {
    const all = getAllUvrSessions()
    const exists = (sid: string) => all.some((s) => s.sessionId === sid)
    const ordered =
      getGroupsReactive().find((g) => g.id === gid)?.sessionIds ?? []
    const fromGroup = ordered.filter(exists)
    const extra = all
      .filter((s) => s.groupId === gid && !ordered.includes(s.sessionId))
      .map((s) => s.sessionId)
    return [...fromGroup, ...extra]
  },
  groupName: (gid) => getGroupsReactive().find((g) => g.id === gid)?.name,
  sessionTitle: (sid) => getUvrSession(sid)?.originalFile?.name,
}

/** Build the queue and arm the first song's "get ready" overlay. */
export function startPlaylist(id: string): void {
  const pl = getPlaylist(id)
  if (!pl) return
  const q = buildQueue(pl, runtimeDeps)
  if (q.length === 0) return
  setActivePlaylistId(id)
  setQueue(q)
  setCurrentIndex(0)
  setPerSongScores(new Array(q.length).fill(null))
  setPhase('ready')
}

export function beginCountdown(): void {
  if (phase() === 'ready') setPhase('countdown')
}

/** Called when the countdown finishes — playback should start now. */
export function beginCurrentSong(): void {
  setPhase('playing')
}

/** Record the score for the current song (mic was active). */
export function reportSongScore(score: KaraokeSongScore | null): void {
  if (score) {
    setPerSongScores((prev) => {
      const next = [...prev]
      next[currentIndex()] = score
      return next
    })
  }
  setPhase('scoring')
}

/** Advance to the next song's overlay, or the final summary if exhausted. */
export function advance(): void {
  const next = currentIndex() + 1
  if (next >= queue().length) {
    setPhase('summary')
    return
  }
  setCurrentIndex(next)
  setPhase('ready')
}

export function prev(): void {
  const p = currentIndex() - 1
  if (p < 0) return
  setCurrentIndex(p)
  setPhase('ready')
}

export function restartPlaylist(): void {
  if (queue().length === 0) return
  setCurrentIndex(0)
  setPerSongScores(new Array(queue().length).fill(null))
  setPhase('ready')
}

export function stopPlaylist(): void {
  setActivePlaylistId(null)
  setQueue([])
  setCurrentIndex(0)
  setPerSongScores([])
  setPhase('idle')
}
