// UVR song port adapts durable separation sessions for the standalone Guitar Night route.
// ============================================================

import type { UvrSessionRecord, UvrStemType } from '@/db/entities'
import { readUvrSessionRecords, readUvrStemSnapshot, } from '@/db/services/uvr-read-service'
import { openUvrStemLease } from '@/lib/uvr-stem-lease'
import type { GuitarNightOpenBackingResult, GuitarNightSongPort, GuitarNightStemAsset, GuitarNightStemKind, } from './song-port'
import { planGuitarNightBacking, resolveGuitarNightDefaultMix, } from './song-port'

const GUITAR_NIGHT_STEM_KINDS = new Set<GuitarNightStemKind>([
  'vocal',
  'instrumental',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
])

function isGuitarNightStemKind(kind: UvrStemType): kind is GuitarNightStemKind {
  return GUITAR_NIGHT_STEM_KINDS.has(kind as GuitarNightStemKind)
}

function aborted(): GuitarNightOpenBackingResult {
  return { ok: false, code: 'aborted' }
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

function leaseResult(
  sessionId: string,
  title: string,
  stemLease: Awaited<ReturnType<typeof openUvrStemLease>>,
): GuitarNightOpenBackingResult {
  if (stemLease === null || stemLease.assets.length === 0) {
    return { ok: false, code: 'missing-local-audio' }
  }

  const stems = stemLease.assets.filter((asset) =>
    isGuitarNightStemKind(asset.kind),
  ) as readonly GuitarNightStemAsset[]
  if (stems.length === 0) {
    stemLease.release()
    return { ok: false, code: 'missing-local-audio' }
  }

  const defaultMix = resolveGuitarNightDefaultMix(
    stems.map((stem) => stem.kind),
  )
  if (defaultMix === null) {
    stemLease.release()
    return { ok: false, code: 'missing-local-audio' }
  }

  return {
    ok: true,
    lease: {
      sessionId,
      title,
      stems,
      defaultMix,
      release: () => stemLease.release(),
    },
  }
}

export function createUvrGuitarNightSongPort(): GuitarNightSongPort {
  let sessions: readonly UvrSessionRecord[] = []

  return {
    initialize: async () => {
      sessions = latestSessionRecords(await readUvrSessionRecords())
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

    openSession: async (
      sessionId: string,
      signal: AbortSignal,
    ): Promise<GuitarNightOpenBackingResult> => {
      if (signal.aborted) return aborted()

      // Read the immutable catalog synchronously before the first await. The
      // durable record can disappear later; this request owns this snapshot.
      const session = sessions.find(
        (candidate) => candidate.appSessionId === sessionId,
      )
      if (session === undefined) return { ok: false, code: 'not-found' }
      if (session.status !== 'completed') {
        return { ok: false, code: 'not-completed' }
      }
      const title = songTitle(session.originalFileName)

      const snapshot = await readUvrStemSnapshot(sessionId)
      const available = snapshot
        .map((stem) => stem.kind)
        .filter(isGuitarNightStemKind)
      if (signal.aborted) return aborted()

      const plan = planGuitarNightBacking(available)
      if (plan.requested.length === 0) {
        return { ok: false, code: 'missing-local-audio' }
      }

      const stemLease = await openUvrStemLease(sessionId, plan.requested, {
        signal,
        snapshot,
      })
      if (signal.aborted) {
        stemLease?.release()
        return aborted()
      }

      return leaseResult(sessionId, title, stemLease)
    },
  }
}
