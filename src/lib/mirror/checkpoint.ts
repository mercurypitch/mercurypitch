// ============================================================
// Voice Mirror — the mid-run checkpoint.
//
// One save point, taken when the twin is revealed. By then someone has sung
// three tasks and earned an answer, and losing that to a reload or a dropped
// connection costs them the whole minute over again. Everything before the
// reveal is cheap to redo and pointless to restore (you would only re-record
// it), so this is deliberately not a per-step resume.
//
// Reached only via the `#twin` fragment. A bare /mirror ignores any stored
// checkpoint and starts fresh, which is what makes "just reload to start
// over" keep working.
//
// Same privacy stance as attempts.ts: derived numbers and pitch frames only,
// never audio. Frames are rounded for the same reason — the trace is drawn at
// card scale, where sub-cent precision is invisible.
// ============================================================

import type { F0Frame, RangeResult } from './metrics'

const STORAGE_KEY = 'mirror.checkpoint.v1'

/** Past this a resume is more confusing than helpful: the delta line would
 *  compare against a baseline from another sitting, and the person has long
 *  since stopped waiting for five notes. */
export const CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000

/** The URL fragment that opts a load into the resume. */
export const CHECKPOINT_HASH = 'twin'

export interface MirrorCheckpoint {
  savedAt: number
  /** Completed glide takes (up, down). */
  glides: F0Frame[][]
  /** Hold-task frames — needed for steadiness in the final result. */
  hold: F0Frame[]
  /** Match targets already chosen from the range, so a resumed run asks for
   *  the same five notes the interrupted one would have. */
  targets: number[]
  range: RangeResult
}

const round = (value: number, places: number): number => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

const compact = (frames: readonly F0Frame[]): F0Frame[] =>
  frames.map((frame) => ({
    t: round(frame.t, 3),
    f0: round(frame.f0, 2),
    conf: round(frame.conf, 3),
  }))

/** True for the `#twin` fragment (leading `#` optional). */
export const isCheckpointHash = (hash: string): boolean =>
  hash.replace(/^#/, '') === CHECKPOINT_HASH

export function saveCheckpoint(
  storage: Storage,
  input: {
    glides: readonly F0Frame[][]
    hold: readonly F0Frame[]
    targets: readonly number[]
    range: RangeResult
  },
  savedAt: number = Date.now(),
): MirrorCheckpoint | null {
  const checkpoint: MirrorCheckpoint = {
    savedAt,
    glides: input.glides.map(compact),
    hold: compact(input.hold),
    targets: [...input.targets],
    range: input.range,
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(checkpoint))
    return checkpoint
  } catch {
    // Storage full or blocked. The live run is unaffected — it only means a
    // reload cannot be recovered, which is exactly where we started.
    return null
  }
}

/** The stored checkpoint, or null when absent, malformed or expired. Expired
 *  entries are cleared on read so a stale one cannot linger for a later run. */
export function loadCheckpoint(
  storage: Storage,
  now: number = Date.now(),
): MirrorCheckpoint | null {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as MirrorCheckpoint).savedAt !== 'number' ||
      !Array.isArray((parsed as MirrorCheckpoint).glides) ||
      !Array.isArray((parsed as MirrorCheckpoint).targets) ||
      typeof (parsed as MirrorCheckpoint).range !== 'object' ||
      (parsed as MirrorCheckpoint).range === null
    ) {
      return null
    }
    const checkpoint = parsed as MirrorCheckpoint
    if (now - checkpoint.savedAt > CHECKPOINT_TTL_MS) {
      clearCheckpoint(storage)
      return null
    }
    // Written before `hold` was carried; treat as empty rather than throwing
    // away an otherwise usable resume.
    return { ...checkpoint, hold: checkpoint.hold ?? [] }
  } catch {
    return null
  }
}

export function clearCheckpoint(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — a checkpoint that cannot be cleared is still TTL-bound.
  }
}
