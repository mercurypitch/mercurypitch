// ============================================================
// Cinematic onboarding preference — local revision/outcome marker
// ============================================================

export interface CinematicOnboardingPreference {
  readonly revision: string
  readonly outcome: 'finished' | 'dismissed'
  readonly recordedAt: string
}

const STORAGE_KEY = 'beside-cue:cinematic-onboarding'

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>
type RemoveStorage = Pick<Storage, 'removeItem'>

export interface CinematicOnboardingPreferenceStore {
  read(revision: string): CinematicOnboardingPreference | undefined
  write(
    revision: string,
    outcome: CinematicOnboardingPreference['outcome'],
    now?: () => Date,
  ): void
  clear(): void
}

function browserStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function readCinematicOnboardingPreference(
  revision: string,
  storage: ReadStorage | undefined = browserStorage(),
): CinematicOnboardingPreference | undefined {
  if (storage === undefined) return undefined

  let serialized: string | null
  try {
    serialized = storage.getItem(STORAGE_KEY)
  } catch {
    return undefined
  }
  if (serialized === null) return undefined

  try {
    const value = JSON.parse(
      serialized,
    ) as Partial<CinematicOnboardingPreference>
    if (
      value.revision !== revision ||
      (value.outcome !== 'finished' && value.outcome !== 'dismissed') ||
      typeof value.recordedAt !== 'string'
    ) {
      return undefined
    }
    return {
      revision,
      outcome: value.outcome,
      recordedAt: value.recordedAt,
    }
  } catch {
    return undefined
  }
}

export function writeCinematicOnboardingPreference(
  revision: string,
  outcome: CinematicOnboardingPreference['outcome'],
  storage: WriteStorage | undefined = browserStorage(),
  now: () => Date = () => new Date(),
): void {
  if (storage === undefined) return

  const preference: CinematicOnboardingPreference = {
    revision,
    outcome,
    recordedAt: now().toISOString(),
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // Onboarding remains optional when a browser or WebView denies storage.
  }
}

export function clearCinematicOnboardingPreference(
  storage: RemoveStorage | undefined = browserStorage(),
): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // The cue-domain reset still succeeds if WebView storage is unavailable.
  }
}

export function createCinematicOnboardingPreferenceStore(
  storage:
    | (ReadStorage & WriteStorage & RemoveStorage)
    | undefined = browserStorage(),
): CinematicOnboardingPreferenceStore {
  return {
    read: (revision) => readCinematicOnboardingPreference(revision, storage),
    write: (revision, outcome, now) =>
      writeCinematicOnboardingPreference(
        revision,
        outcome,
        storage,
        now ?? (() => new Date()),
      ),
    clear: () => clearCinematicOnboardingPreference(storage),
  }
}
