// ============================================================
// One clamped, storage-tolerant slider preference
// ============================================================
//
// Three sliders wanted the same fiddly half: read a number out of storage
// that may be absent, unparseable, out of range or throw outright, and write
// one back clamped to the slider's own bounds. Karaoke Night's stage alpha,
// Guitar Night's room clarity and the mixer's music level all disagree about
// what the number *means*, so they cannot share a constant — only this.
//
// Two copies of a clamp is how two sliders drift.

export interface ClampedPreferenceSpec {
  /** Where the chosen value survives a reload. */
  storageKey: string
  /** What a first visit — or any unusable stored value — gets. */
  defaultValue: number
  min: number
  max: number
  step: number
}

export interface ClampedPreferenceStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface ClampedPreference {
  /** The slider's own bounds, for the `<input type="range">` that drives it. */
  readonly spec: ClampedPreferenceSpec
  /**
   * The stored value, or the default.
   *
   * An out-of-range number is treated as unusable rather than clamped: it can
   * only come from a build whose bounds were different, and silently dragging
   * it to the nearest edge would hand somebody a room they never chose.
   */
  load: (storage?: ClampedPreferenceStorage | null) => number
  /** Writes the value clamped into range, and returns what was written. */
  persist: (value: number, storage?: ClampedPreferenceStorage | null) => number
}

function browserStorage(): ClampedPreferenceStorage | null {
  try {
    return localStorage
  } catch {
    // Safari in private mode, and any browser with site data blocked. The
    // slider still works for the session; it just does not come back.
    return null
  }
}

export function createClampedPreference(
  spec: ClampedPreferenceSpec,
): ClampedPreference {
  const load = (
    storage: ClampedPreferenceStorage | null = browserStorage(),
  ): number => {
    try {
      // Read the raw string first. `Number(null)` and `Number('')` are both
      // 0, so a room whose minimum is 0 — Guitar Night's is — would read an
      // absent preference as a deliberate zero and never see its default.
      const stored = storage?.getItem(spec.storageKey)
      if (stored === null || stored === undefined || stored.trim() === '') {
        return spec.defaultValue
      }
      const value = Number(stored)
      if (Number.isFinite(value) && value >= spec.min && value <= spec.max) {
        return value
      }
    } catch {
      /* storage unavailable */
    }
    return spec.defaultValue
  }

  const persist = (
    value: number,
    storage: ClampedPreferenceStorage | null = browserStorage(),
  ): number => {
    const normalized = Number.isFinite(value)
      ? Math.min(spec.max, Math.max(spec.min, value))
      : spec.defaultValue
    try {
      storage?.setItem(spec.storageKey, String(normalized))
    } catch {
      /* storage unavailable */
    }
    return normalized
  }

  return { spec, load, persist }
}
