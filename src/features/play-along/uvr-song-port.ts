// Shared UVR song sources keep catalog selection metadata-only and hydrate durable audio only on explicit load.
// ============================================================

import type { UvrSessionRecord } from '@/db/entities'
import { readUvrSessionRecords, readUvrStemManifest, readUvrStemSelectionWithinBudget, } from '@/db/services/uvr-read-service'
import { openUvrStemLease } from '@/lib/uvr-stem-lease'
import type { PlayAlongBackingLease, PlayAlongBackingLoadOptions, PlayAlongBackingLoadResult, PlayAlongBackingSource, PlayAlongDefaultMix, PlayAlongSongSourcePort, PlayAlongStemAsset, PlayAlongStemKind, PlayAlongTargetPolicy, PlayAlongTargetStemKind, } from './song-port'
import { defaultPlayAlongEncodedByteBudget, hasUsablePlayAlongParts, isPlayAlongStemKind, planPlayAlongBacking, resolvePlayAlongDefaultMix, } from './song-port'

interface PersistedStemMetadata {
  durationSeconds?: number
}

function songTitle(name: string | undefined): string {
  return name !== undefined && name.trim() !== '' ? name : 'Prepared song'
}

function latestSessionRecords(
  records: readonly UvrSessionRecord[],
): readonly UvrSessionRecord[] {
  const latestBySession = new Map<string, UvrSessionRecord>()
  for (const record of records) {
    const existing = latestBySession.get(record.appSessionId)
    if (existing === undefined || record.updatedAt > existing.updatedAt) {
      latestBySession.set(record.appSessionId, record)
    }
  }
  return [...latestBySession.values()]
}

function sessionCreatedAt(record: UvrSessionRecord): number {
  return record.appCreatedAt ?? Date.parse(record.createdAt)
}

function persistedStemMetadata(
  stemMetaJson: string | undefined,
): ReadonlyMap<PlayAlongStemKind, PersistedStemMetadata> {
  const metadata = new Map<PlayAlongStemKind, PersistedStemMetadata>()
  if (stemMetaJson === undefined) return metadata
  try {
    const parsed: unknown = JSON.parse(stemMetaJson)
    if (typeof parsed !== 'object' || parsed === null) return metadata
    for (const [kind, value] of Object.entries(parsed)) {
      if (
        !isPlayAlongStemKind(kind) ||
        typeof value !== 'object' ||
        value === null
      ) {
        continue
      }
      const duration = (value as { duration?: unknown }).duration
      metadata.set(kind, {
        durationSeconds:
          typeof duration === 'number' &&
          Number.isFinite(duration) &&
          duration > 0
            ? duration
            : undefined,
      })
    }
  } catch {
    // Corrupt optional metadata cannot hide otherwise playable local stems.
  }
  return metadata
}

function plannedDurationSeconds(
  requested: readonly PlayAlongStemKind[],
  metadata: ReadonlyMap<PlayAlongStemKind, PersistedStemMetadata>,
): number | null {
  let longest: number | null = null
  for (const kind of requested) {
    const duration = metadata.get(kind)?.durationSeconds
    if (duration !== undefined) longest = Math.max(longest ?? 0, duration)
  }
  return longest
}

function encodedBudget(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return defaultPlayAlongEncodedByteBudget()
  }
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)))
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function sourcePlan<TTarget extends PlayAlongTargetStemKind>(
  available: readonly PlayAlongStemKind[],
  policy: PlayAlongTargetPolicy<TTarget>,
): {
  requested: readonly PlayAlongStemKind[]
  mix: PlayAlongDefaultMix<TTarget>
} | null {
  const plan = planPlayAlongBacking(available, policy)
  if (plan.requested.length === 0) return null
  const mix = resolvePlayAlongDefaultMix(plan.requested, policy, {
    reconstructionProven: plan.kind === 'parts',
  })
  return mix === null ? null : { requested: plan.requested, mix }
}

function hydratedSourcePlan<TTarget extends PlayAlongTargetStemKind>(
  available: readonly PlayAlongStemKind[],
  policy: PlayAlongTargetPolicy<TTarget>,
  initial: {
    requested: readonly PlayAlongStemKind[]
    mix: PlayAlongDefaultMix<TTarget>
  },
): {
  requested: readonly PlayAlongStemKind[]
  mix: PlayAlongDefaultMix<TTarget>
} | null {
  const availableKinds = new Set(available)
  if (
    initial.mix.kind === 'parts' &&
    policy.reconstructBackingFromInstrumental === true &&
    initial.requested.every((kind) => availableKinds.has(kind))
  ) {
    const mix = resolvePlayAlongDefaultMix(initial.requested, policy, {
      reconstructionProven: true,
    })
    return mix === null ? null : { requested: initial.requested, mix }
  }
  return sourcePlan(available, policy)
}

function createBackingSource<TTarget extends PlayAlongTargetStemKind>(
  session: UvrSessionRecord,
  available: readonly PlayAlongStemKind[],
  policy: PlayAlongTargetPolicy<TTarget>,
): PlayAlongBackingSource<TTarget> | null {
  const initialPlan = sourcePlan(available, policy)
  if (initialPlan === null) return null

  const sessionId = session.appSessionId
  const title = songTitle(session.originalFileName)
  const metadata = persistedStemMetadata(session.stemMetaJson)
  const lifetimeAbort = new AbortController()
  let released = false
  let hydratedLease: PlayAlongBackingLease<TTarget> | null = null
  let loadPromise: Promise<PlayAlongBackingLoadResult<TTarget>> | null = null

  const hydrate = async (
    options: PlayAlongBackingLoadOptions,
  ): Promise<PlayAlongBackingLoadResult<TTarget>> => {
    if (released || options.signal.aborted) {
      return { ok: false, code: 'aborted' }
    }
    const budgetBytes = encodedBudget(options.encodedByteBudget)
    const loadAbort = new AbortController()
    const abortLoad = (): void => loadAbort.abort()
    options.signal.addEventListener('abort', abortLoad, { once: true })
    lifetimeAbort.signal.addEventListener('abort', abortLoad, { once: true })

    try {
      let loadPlan = initialPlan
      if (
        initialPlan.mix.kind === 'parts' &&
        policy.reconstructBackingFromInstrumental === true
      ) {
        const currentManifest = (await readUvrStemManifest(sessionId)).filter(
          isPlayAlongStemKind,
        )
        if (loadAbort.signal.aborted) return { ok: false, code: 'aborted' }
        if (!hasUsablePlayAlongParts(currentManifest, policy)) {
          const replanned = sourcePlan(currentManifest, policy)
          if (replanned === null) {
            return { ok: false, code: 'missing-local-audio' }
          }
          loadPlan = replanned
        }
      }
      let selection = await readUvrStemSelectionWithinBudget(
        sessionId,
        loadPlan.requested,
        { signal: loadAbort.signal, budgetBytes },
      )
      if (!selection.ok) {
        return {
          ok: false,
          code: 'encoded-budget',
          requiredBytes: selection.requiredBytes,
          budgetBytes: selection.budgetBytes,
        }
      }
      if (loadAbort.signal.aborted) return { ok: false, code: 'aborted' }

      let snapshot = selection.snapshot
      let hydratedPlan = hydratedSourcePlan(
        snapshot.flatMap<PlayAlongStemKind>((stem) =>
          isPlayAlongStemKind(stem.kind) ? [stem.kind] : [],
        ),
        policy,
        loadPlan,
      )

      // A part row may disappear after manifest discovery. Do not present a
      // partial reconstruction: release that snapshot and retry the durable
      // two-stem fallback within the same encoded-byte ceiling.
      if (loadPlan.mix.kind === 'parts' && hydratedPlan?.mix.kind !== 'parts') {
        snapshot = []
        selection = await readUvrStemSelectionWithinBudget(
          sessionId,
          ['vocal', 'instrumental'],
          { signal: loadAbort.signal, budgetBytes },
        )
        if (!selection.ok) {
          return {
            ok: false,
            code: 'encoded-budget',
            requiredBytes: selection.requiredBytes,
            budgetBytes: selection.budgetBytes,
          }
        }
        snapshot = selection.snapshot
        hydratedPlan = sourcePlan(
          snapshot.flatMap<PlayAlongStemKind>((stem) =>
            isPlayAlongStemKind(stem.kind) ? [stem.kind] : [],
          ),
          policy,
        )
      }

      if (
        loadAbort.signal.aborted ||
        hydratedPlan === null ||
        hydratedPlan.requested.length === 0
      ) {
        return loadAbort.signal.aborted
          ? { ok: false, code: 'aborted' }
          : { ok: false, code: 'missing-local-audio' }
      }

      const stemLease = await openUvrStemLease(
        sessionId,
        hydratedPlan.requested,
        { signal: loadAbort.signal, snapshot },
      )
      if (loadAbort.signal.aborted) {
        stemLease?.release()
        return { ok: false, code: 'aborted' }
      }
      if (stemLease === null || stemLease.assets.length === 0) {
        return { ok: false, code: 'missing-local-audio' }
      }
      // The lease minted its Blob URLs from these rows; dropping the snapshot
      // now releases the IndexedDB-read ArrayBuffers (one full stem each)
      // instead of keeping them pinned alongside the Blob copies for as long
      // as any closure from this scope survives.
      snapshot = []

      const stems = stemLease.assets.flatMap<PlayAlongStemAsset>((asset) => {
        if (!isPlayAlongStemKind(asset.kind)) return []
        return [
          {
            kind: asset.kind,
            url: asset.url,
            blob: asset.blob,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            durationSeconds:
              asset.durationSeconds ??
              metadata.get(asset.kind)?.durationSeconds,
          },
        ]
      })
      const defaultMix = resolvePlayAlongDefaultMix(
        stems.map((stem) => stem.kind),
        policy,
        { reconstructionProven: hydratedPlan.mix.kind === 'parts' },
      )
      if (defaultMix === null) {
        stemLease.release()
        return { ok: false, code: 'missing-local-audio' }
      }

      let leaseReleased = false
      const lease: PlayAlongBackingLease<TTarget> = {
        sessionId,
        title,
        stems: Object.freeze(stems),
        defaultMix,
        source: 'device',
        release: () => {
          if (leaseReleased) return
          leaseReleased = true
          stemLease.release()
          if (hydratedLease === lease) hydratedLease = null
          loadPromise = null
        },
      }
      hydratedLease = lease
      return { ok: true, lease }
    } catch (error) {
      if (isAbortError(error) || loadAbort.signal.aborted) {
        return { ok: false, code: 'aborted' }
      }
      throw error
    } finally {
      options.signal.removeEventListener('abort', abortLoad)
      lifetimeAbort.signal.removeEventListener('abort', abortLoad)
    }
  }

  const source: PlayAlongBackingSource<TTarget> = {
    sessionId,
    title,
    stemKinds: Object.freeze([...initialPlan.requested]),
    plannedMix: initialPlan.mix,
    durationSeconds: plannedDurationSeconds(initialPlan.requested, metadata),
    source: 'device',
    load: async (options) => {
      if (released || options.signal.aborted) {
        return { ok: false, code: 'aborted' }
      }
      if (hydratedLease !== null) return { ok: true, lease: hydratedLease }
      if (loadPromise !== null) return loadPromise
      loadPromise = hydrate(options)
      try {
        const result = await loadPromise
        if (!result.ok) loadPromise = null
        return result
      } catch (error) {
        loadPromise = null
        throw error
      }
    },
    release: () => {
      if (released) return
      released = true
      lifetimeAbort.abort()
      hydratedLease?.release()
      hydratedLease = null
    },
  }
  return source
}

/**
 * Open the device's durable UVR catalog for one play-along target.
 *
 * This module intentionally owns the persistence imports. Route shells must
 * dynamically import it only when a prepared-song surface is requested.
 * Session selection reads counts and metadata only; `source.load` is the sole
 * encoded-audio and object-URL boundary.
 */
export function createUvrPlayAlongSongPort<
  TTarget extends PlayAlongTargetStemKind,
>(policy: PlayAlongTargetPolicy<TTarget>): PlayAlongSongSourcePort<TTarget> {
  let sessions: readonly UvrSessionRecord[] = []
  let refreshGeneration = 0

  return {
    initialize: async () => {
      const generation = ++refreshGeneration
      const records = await readUvrSessionRecords()
      if (generation === refreshGeneration) {
        sessions = latestSessionRecords(records)
      }
    },

    completedSongs: () =>
      sessions
        .filter((session) => session.status === 'completed')
        .map((session) => ({
          sessionId: session.appSessionId,
          title: songTitle(session.originalFileName),
          createdAt: sessionCreatedAt(session),
        }))
        .sort((left, right) => right.createdAt - left.createdAt),

    openSession: async (sessionId, signal) => {
      if (signal.aborted) return { ok: false, code: 'aborted' }

      const session = sessions.find(
        (candidate) => candidate.appSessionId === sessionId,
      )
      if (session === undefined) return { ok: false, code: 'not-found' }
      if (session.status !== 'completed') {
        return { ok: false, code: 'not-completed' }
      }

      const available = (await readUvrStemManifest(sessionId)).filter(
        isPlayAlongStemKind,
      )
      if (signal.aborted) return { ok: false, code: 'aborted' }

      const source = createBackingSource(session, available, policy)
      return source === null
        ? { ok: false, code: 'missing-local-audio' }
        : { ok: true, lease: source }
    },
  }
}
