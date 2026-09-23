// Replay host — keep tier attempts separate while preserving each host's original save namespace.

import type { LevelDefinition } from '../contracts'
import { mergeSavedProgress } from '../core/progress'
import type { ResolvedReplay } from '../core/replay-profile'
import { sameReplayIdentity } from '../core/replay-profile'
import type { ReplayProgress } from '../core/replay-progress'
import { beginReplayAttempt, readReplayProgress, saveReplayAttempt, } from '../core/replay-progress'
import type { GlassGameHost } from '../host'

function preferenceKey(levelId: string): string {
  return `replays:v1:${levelId}`
}

export function loadReplayProgress(
  host: GlassGameHost,
  level: LevelDefinition,
  profiles: readonly ResolvedReplay[],
): ReplayProgress {
  let raw: unknown
  try {
    raw = JSON.parse(
      host.readPreference(preferenceKey(level.id)) ?? 'null',
    ) as unknown
  } catch {
    raw = null
  }
  return readReplayProgress(level, profiles, raw, host.loadProgress(level.id))
}

export interface ReplayVisit {
  host: GlassGameHost
  progress(): ReplayProgress
}

export function createReplayVisitHost(
  host: GlassGameHost,
  source: LevelDefinition,
  profile: ResolvedReplay,
  profiles: readonly ResolvedReplay[],
  options: { fresh: boolean; leaseId: string; now?: () => number },
): ReplayVisit {
  const key = preferenceKey(source.id)
  const leaseKey = `${key}:active-visit`
  const now = options.now ?? Date.now
  let state = beginReplayAttempt(
    loadReplayProgress(host, source, profiles),
    profile,
    options.fresh,
  )
  const initial = state.attempts.find((item) =>
    sameReplayIdentity(item.identity, profile.identity),
  )!.progress
  // Keep the pre-replay save byte-for-byte before any migration-facing write.
  const legacy = host.loadProgress(source.id)
  if (host.readPreference(`${key}:legacy-backup`) === null)
    host.writePreference(`${key}:legacy-backup`, JSON.stringify(legacy ?? null))
  host.writePreference(key, JSON.stringify(state))
  host.writePreference(leaseKey, options.leaseId)
  return {
    progress: () => state,
    host: {
      ...host,
      loadProgress: (levelId) =>
        levelId === source.id ? initial : host.loadProgress(levelId),
      saveProgress: (candidate) => {
        if (candidate.levelId !== source.id) {
          host.saveProgress(candidate)
          return
        }
        const lease = host.readPreference(leaseKey)
        // An old visit's cleanup must never overwrite the newly mounted replay.
        if (lease !== null && lease !== options.leaseId) return
        let latest = loadReplayProgress(host, source, profiles)
        if (
          !latest.attempts.some((item) =>
            sameReplayIdentity(item.identity, profile.identity),
          )
        )
          latest = state
        state = saveReplayAttempt(latest, profile, candidate, now())
        host.writePreference(key, JSON.stringify(state))
        // Compatibility projection is only for historical map/unlock consumers.
        // It is never read back as a difficulty attempt or used to certify a tier.
        host.saveProgress(
          mergeSavedProgress(source, host.loadProgress(source.id), {
            ...candidate,
            rewards: state.collection,
          }),
        )
      },
    },
  }
}

export function loadPreReplayProgress(
  host: GlassGameHost,
  levelId: string,
): unknown {
  const raw = host.readPreference(`${preferenceKey(levelId)}:legacy-backup`)
  if (raw === null) return host.loadProgress(levelId)
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
