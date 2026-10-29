// ============================================================
// Studio editor leases — transactional epochs reject writes from stale tabs.
// ============================================================

import type { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { DbEntity } from '@/db/types'
import type { StudioEditorLease, StudioEditorToken, } from './studio-storage-types'
import { STUDIO_STORES, StudioStorageError } from './studio-storage-types'

export const STUDIO_EDITOR_LEASE_MS = 30_000

interface StudioLeaseRecord extends DbEntity {
  ownerId: string | null
  epoch: number
  expiresAt: number
}

function validToken(token: StudioEditorToken): boolean {
  return (
    typeof token.ownerId === 'string' &&
    token.ownerId.length > 0 &&
    token.ownerId.length <= 128 &&
    Number.isSafeInteger(token.epoch) &&
    token.epoch > 0
  )
}

function publicLease(record: StudioLeaseRecord): StudioEditorLease {
  return {
    projectId: record.id,
    ownerId: record.ownerId!,
    epoch: record.epoch,
    expiresAt: record.expiresAt,
  }
}

/** The caller must already be inside the same transaction as its project write. */
export async function requireStudioEditor(
  db: DexieAdapter,
  projectId: string,
  token: StudioEditorToken,
  now: number,
): Promise<StudioLeaseRecord> {
  const lease = await db.readByIdStrict<StudioLeaseRecord>(
    STUDIO_STORES.leases,
    projectId,
  )
  if (
    !validToken(token) ||
    !lease ||
    lease.ownerId !== token.ownerId ||
    lease.epoch !== token.epoch ||
    lease.expiresAt <= now
  ) {
    throw new StudioStorageError(
      'lease-lost',
      'This project is no longer editable in this tab. Reload, make a copy, or take over editing.',
    )
  }
  return lease
}

export async function acquireStudioEditor(
  db: DexieAdapter,
  projectId: string,
  ownerId: string,
  clock: () => Date,
  takeover = false,
): Promise<StudioEditorLease> {
  if (!validToken({ ownerId, epoch: 1 }))
    throw new StudioStorageError(
      'lease-lost',
      'The editor identity is invalid.',
    )
  return db.transaction(async () => {
    const now = clock()
    if (!(await db.readByIdStrict(STUDIO_STORES.projects, projectId)))
      throw new StudioStorageError(
        'not-found',
        'The local project was not found.',
      )
    const previous = await db.readByIdStrict<StudioLeaseRecord>(
      STUDIO_STORES.leases,
      projectId,
    )
    if (
      previous &&
      previous.expiresAt > now.getTime() &&
      previous.ownerId !== ownerId &&
      !takeover
    ) {
      throw new StudioStorageError(
        'locked',
        'This project is open for editing in another tab.',
      )
    }
    const keepEpoch =
      previous !== undefined &&
      previous.ownerId === ownerId &&
      previous.expiresAt > now.getTime() &&
      !takeover
    const epoch = keepEpoch ? previous.epoch : (previous?.epoch ?? 0) + 1
    if (!Number.isSafeInteger(epoch))
      throw new StudioStorageError(
        'lease-lost',
        'The project editor epoch cannot be renewed.',
      )
    const record: StudioLeaseRecord = {
      id: projectId,
      ownerId,
      epoch,
      expiresAt: now.getTime() + STUDIO_EDITOR_LEASE_MS,
      createdAt: previous?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    }
    await db.putStrict(STUDIO_STORES.leases, record)
    return publicLease(record)
  })
}

export async function renewStudioEditor(
  db: DexieAdapter,
  projectId: string,
  token: StudioEditorToken,
  clock: () => Date,
): Promise<StudioEditorLease> {
  return db.transaction(async () => {
    const now = clock()
    const previous = await requireStudioEditor(
      db,
      projectId,
      token,
      now.getTime(),
    )
    const record = {
      ...previous,
      updatedAt: now.toISOString(),
      expiresAt: now.getTime() + STUDIO_EDITOR_LEASE_MS,
    }
    await db.putStrict(STUDIO_STORES.leases, record)
    return publicLease(record)
  })
}

/**
 * Extend this tab's own lease even after it lapsed, as long as nobody else
 * has held the project since: the record still carries this token's epoch,
 * and its owner is this tab, or nobody once this tab released it. Any other
 * editor raises the epoch as it acquires, so a match means no write but this
 * tab's can have landed in between, and the tab carries on with the project,
 * its history and the saves it has waiting, all on the same epoch.
 *
 * That is the hidden tab's case: Chrome throttles a hidden tab's timers to
 * about one a minute and a phone freezes them, so renewals run late or not
 * at all, and a page restored from the back-forward cache released its
 * lease on the way in.
 */
export async function reclaimStudioEditor(
  db: DexieAdapter,
  projectId: string,
  token: StudioEditorToken,
  clock: () => Date,
): Promise<StudioEditorLease> {
  return db.transaction(async () => {
    const now = clock()
    const previous = await db.readByIdStrict<StudioLeaseRecord>(
      STUDIO_STORES.leases,
      projectId,
    )
    if (
      !validToken(token) ||
      !previous ||
      previous.epoch !== token.epoch ||
      (previous.ownerId !== token.ownerId && previous.ownerId !== null)
    ) {
      throw new StudioStorageError(
        'lease-lost',
        'This project is no longer editable in this tab. Reload, make a copy, or take over editing.',
      )
    }
    const record: StudioLeaseRecord = {
      ...previous,
      ownerId: token.ownerId,
      updatedAt: now.toISOString(),
      expiresAt: now.getTime() + STUDIO_EDITOR_LEASE_MS,
    }
    await db.putStrict(STUDIO_STORES.leases, record)
    return publicLease(record)
  })
}

export async function releaseStudioEditor(
  db: DexieAdapter,
  projectId: string,
  token: StudioEditorToken,
  clock: () => Date,
): Promise<void> {
  await db.transaction(async () => {
    const previous = await db.readByIdStrict<StudioLeaseRecord>(
      STUDIO_STORES.leases,
      projectId,
    )
    if (
      !previous ||
      previous.ownerId !== token.ownerId ||
      previous.epoch !== token.epoch
    )
      return
    // Retain the epoch tombstone so an old token can never become valid again.
    await db.putStrict(STUDIO_STORES.leases, {
      ...previous,
      ownerId: null,
      expiresAt: 0,
      updatedAt: clock().toISOString(),
    })
  })
}
