// ============================================================
// Beside Cue repository port — atomic local snapshots behind an async seam
// ============================================================

import type { BesideCueStateV1 } from './types'

export interface BesideCueRepository {
  /**
   * Returns null before the first persisted state has been created. Adapters
   * must validate decoded snapshots with assertStateIdentityInvariants before
   * exposing them to application code.
   */
  loadState(): Promise<BesideCueStateV1 | null>

  /** Implementations must commit the complete snapshot atomically. */
  saveState(state: BesideCueStateV1): Promise<void>
}
