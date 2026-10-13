// Community melody cards reconcile exact display duplicates without changing stored identity.

import type { MelodyItem } from '@/types'

interface MelodyCard {
  id: string
  userId?: string
  name: string
  author: string
  items: MelodyItem[]
  bpm?: number
  key?: string
  scale?: string
  shareFingerprint?: string
}

/** UI-only annotation: the independently keyed browser record still exists. */
export interface RetainedLocalCopy {
  retainedLocalCopy?: boolean
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  )
}

function contentKey(melody: MelodyCard): string {
  // Note IDs only locate editor blocks. All musical fields, including rests,
  // expression and lyrics, participate; a short fingerprint is not identity.
  const items = melody.items.map(({ id: _id, ...item }) => item)
  return JSON.stringify(stableValue([melody.name, melody.author, items]))
}

function groupByContent<T extends MelodyCard>(
  rows: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = contentKey(row)
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  return groups
}

function withLocalSettings<T extends MelodyCard>(board: T, local: T): T {
  return {
    ...board,
    bpm: board.bpm ?? local.bpm,
    key: board.key ?? local.key,
    scale: board.scale ?? local.scale,
    shareFingerprint: local.shareFingerprint,
  }
}

/**
 * Canonical IDs establish identity. Older copies had unrelated IDs, so exact
 * unique content matches only group their display: never adopt an ID or delete
 * the local record. Multiple candidates and foreign owners stay separate.
 */
export function mergeMelodyCards<T extends MelodyCard>(
  board: readonly T[],
  local: readonly T[],
  currentUserId: string,
): (T & RetainedLocalCopy)[] {
  const localById = new Map(local.map((row) => [row.id, row]))
  const boardIds = new Set(board.map((row) => row.id))
  const ownBoard = groupByContent(
    board.filter((row) => row.userId === currentUserId),
  )
  const ownLocal = groupByContent(
    local.filter(
      (row) => row.userId === undefined || row.userId === currentUserId,
    ),
  )
  const groupedLocalIds = new Set<string>()
  const displayed = board.map((row): T & RetainedLocalCopy => {
    const canonical = localById.get(row.id)
    if (canonical?.userId !== undefined && canonical.userId === row.userId)
      return withLocalSettings(row, canonical)
    if (row.userId !== currentUserId) return row
    const key = contentKey(row)
    const candidates = ownLocal.get(key) ?? []
    if (ownBoard.get(key)?.length !== 1 || candidates.length !== 1) return row
    const candidate = candidates[0]
    if (boardIds.has(candidate.id)) return row
    groupedLocalIds.add(candidate.id)
    return { ...withLocalSettings(row, candidate), retainedLocalCopy: true }
  })
  return [
    ...displayed,
    ...local.filter(
      (row) => !boardIds.has(row.id) && !groupedLocalIds.has(row.id),
    ),
  ]
}

interface SessionCard {
  id: string
  userId?: string
  sourceSessionId?: string
}

function sourceGroups<T extends SessionCard>(
  rows: readonly T[],
  userId: string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    if (
      row.userId !== userId ||
      row.sourceSessionId === undefined ||
      row.sourceSessionId === ''
    )
      continue
    const group = groups.get(row.sourceSessionId) ?? []
    group.push(row)
    groups.set(row.sourceSessionId, group)
  }
  return groups
}

/** Old session cards lack a source run ID. Names, scores and dates cannot establish identity. */
export function mergeSessionCards<T extends SessionCard>(
  board: readonly T[],
  local: readonly T[],
  currentUserId: string,
): (T & RetainedLocalCopy)[] {
  const boardIds = new Set(board.map((row) => row.id))
  const ownBoard = sourceGroups(board, currentUserId)
  const ownLocal = sourceGroups(local, currentUserId)
  const groupedLocalIds = new Set<string>()
  const displayed = board.map((row): T & RetainedLocalCopy => {
    if (row.userId !== currentUserId || row.sourceSessionId === undefined)
      return row
    const candidates = ownLocal.get(row.sourceSessionId) ?? []
    if (
      ownBoard.get(row.sourceSessionId)?.length !== 1 ||
      candidates.length !== 1
    )
      return row
    const candidate = candidates[0]
    if (boardIds.has(candidate.id)) return row
    groupedLocalIds.add(candidate.id)
    return { ...row, retainedLocalCopy: true }
  })
  return [
    ...displayed,
    ...local.filter(
      (row) => !boardIds.has(row.id) && !groupedLocalIds.has(row.id),
    ),
  ]
}

export interface ShareRemoval {
  kind: 'melody' | 'session'
  name: string
  published: boolean
  retainedLocalCopy?: boolean
}

export function removalLabel(share: { userId?: string }): string {
  return share.userId === undefined ? 'Remove from shelf' : 'Unpublish'
}

export function removalMessage(target: ShareRemoval | null): string {
  if (target === null) return ''
  if (!target.published)
    return `Remove "${target.name}" from this shelf? This only removes the browser copy; any Community publication stays on the board. Existing links still work.`
  const localCopy =
    target.retainedLocalCopy === true
      ? ' Your older browser copy stays on this shelf.'
      : ''
  const links =
    target.kind === 'melody' ? ' Existing melody links still work.' : ''
  return `Remove "${target.name}" from the Community board?${localCopy}${links}`
}

export function removalDialog(target: ShareRemoval | null): {
  title: string
  label: string
  message: string
} {
  const published = target?.published === true
  return {
    title: published ? 'Unpublish this?' : 'Remove from shelf?',
    label: published ? 'Unpublish' : 'Remove from shelf',
    message: removalMessage(target),
  }
}

export function removalAriaLabel(share: {
  userId?: string
  name: string
}): string {
  const action = share.userId === undefined ? 'Remove from shelf:' : 'Unpublish'
  return `${action} ${share.name}`
}
