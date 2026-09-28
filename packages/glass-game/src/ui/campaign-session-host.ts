// Campaign session host — retain failed progress writes only for the current museum visit.

import type { GlassGameHost } from '../host'

export function createCampaignSessionHost(host: GlassGameHost): GlassGameHost {
  const progressFallbacks = new Map<string, string>()
  const preferenceFallbacks = new Map<string, string>()

  const readProgress = (levelId: string): unknown => {
    try {
      return host.loadProgress(levelId)
    } catch {
      return null
    }
  }
  const readPreference = (key: string): string | null => {
    try {
      return host.readPreference(key)
    } catch {
      return null
    }
  }

  return {
    ...host,
    loadProgress: (levelId) => {
      const fallback = progressFallbacks.get(levelId)
      return fallback === undefined
        ? readProgress(levelId)
        : JSON.parse(fallback)
    },
    saveProgress: (progress) => {
      // Copy exactly the game's save, not an inferred completion. JSON also
      // keeps later caller mutations from changing a failed-write snapshot.
      const serialized = JSON.stringify(progress)
      try {
        host.saveProgress(progress)
      } catch {
        // Hosts may throw or swallow storage failures; readback decides below.
      }
      let persisted = false
      try {
        persisted =
          JSON.stringify(readProgress(progress.levelId)) === serialized
      } catch {
        // A malformed host readback is not proof that the write survived.
      }
      if (persisted) progressFallbacks.delete(progress.levelId)
      else progressFallbacks.set(progress.levelId, serialized)
    },
    // These function identities remain stable across replay host wrappers,
    // whose lease owner keys retired-visit protection by readPreference.
    readPreference: (key) =>
      preferenceFallbacks.get(key) ?? readPreference(key),
    writePreference: (key, value) => {
      try {
        host.writePreference(key, value)
      } catch {
        // Replay attempts and leases must remain usable for this campaign.
      }
      if (readPreference(key) === value) preferenceFallbacks.delete(key)
      else preferenceFallbacks.set(key, value)
    },
  }
}
