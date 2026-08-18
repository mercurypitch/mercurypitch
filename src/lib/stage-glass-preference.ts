// ============================================================
// Stage glass — one clamped, storage-tolerant slider preference
// ============================================================
//
// Karaoke Night has had a "how much of the room shows through" slider since
// the stage got its backdrop, and Guitar Night now wants the same control.
// The two rooms disagree about what the number *means* — Karaoke's is a
// surface alpha, Guitar Night's is a clarity where zero is the old look — so
// they cannot share a constant. What they do share is the fiddly half: read a
// string out of storage that may be absent, unparseable, out of range or
// throw outright, and write one back clamped to the slider's own bounds.
//
// That half lives here once. Two copies of a clamp is how two rooms drift.

export interface StageGlassSpec {
  /** Where the chosen value survives a reload. */
  storageKey: string
  /** What a first visit — or any unusable stored value — gets. */
  defaultValue: number
  min: number
  max: number
  step: number
}

export interface StageGlassStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface StageGlassPreference {
  /** The slider's own bounds, for the `<input type="range">` that drives it. */
  readonly spec: StageGlassSpec
  /**
   * The stored value, or the default.
   *
   * An out-of-range number is treated as unusable rather than clamped: it can
   * only come from a build whose bounds were different, and silently dragging
   * it to the nearest edge would hand somebody a room they never chose.
   */
  load: (storage?: StageGlassStorage | null) => number
  /** Writes the value clamped into range, and returns what was written. */
  persist: (value: number, storage?: StageGlassStorage | null) => number
}

function browserStorage(): StageGlassStorage | null {
  try {
    return localStorage
  } catch {
    // Safari in private mode, and any browser with site data blocked. The
    // slider still works for the session; it just does not come back.
    return null
  }
}

export function createStageGlassPreference(
  spec: StageGlassSpec,
): StageGlassPreference {
  const load = (
    storage: StageGlassStorage | null = browserStorage(),
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
    storage: StageGlassStorage | null = browserStorage(),
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
