// ============================================================
// Studio songs store — the open Studio page's song list, switch and New song, lent to the sidebar while the page is mounted
// ============================================================
//
// The open song is Studio page state: its controller owns the editor lease,
// the save queue and the take recorder, and only the page knows when leaving
// a song is safe. So the sidebar does not open songs itself. The page lends
// it a read-only view of the list it already keeps (summaries only, never
// audio), one `open(id)` that goes through the page's own switch and one
// `create()` that goes through its own New song, and takes the loan back
// when it unmounts. With no Studio page there is no
// loan, and the sidebar's Studio panel renders nothing: page-lifetime state
// never outlives the page in this app-lifetime store.

import { createSignal } from 'solid-js'
import type { StudioProjectSummary } from '@/lib/studio/model/types'

export interface StudioSongsLoan {
  /** Every song on this device, newest edit first: the summaries row, never a song's audio. */
  songs: () => readonly StudioProjectSummary[]
  /** The song the page holds open, behind the library or in the workspace. */
  openId: () => string | null
  /** Why the page cannot switch songs right now, said beside the list; null when it can. */
  hold: () => string | null
  /** A song is opening: rows wait without a reason, as the page says "Opening project". */
  opening: () => boolean
  /** Switch through the page's own path, with every check it makes. */
  open: (id: string) => Promise<void>
  /**
   * Whether the page's own New song would take a press now. Beyond every
   * hold, a save in flight keeps it waiting, without a reason: a switch
   * waits for the save, a new song does not.
   */
  canCreate: () => boolean
  /** Make a new song and open it, through the page's own New song path. */
  create: () => Promise<void>
}

const [loan, setLoan] = createSignal<StudioSongsLoan | null>(null)
/** The current loan, read untracked by the call that takes it back. */
let lent: StudioSongsLoan | null = null

/** The mounted Studio page's song list and switch, or null when no Studio page is mounted. */
export const studioSongs = loan

/**
 * Lend the page's list and switch to the sidebar. Returns the call that
 * takes it back, for the page's onCleanup; a later loan is left alone.
 */
export function lendStudioSongs(next: StudioSongsLoan): () => void {
  lent = next
  setLoan(() => next)
  return () => {
    if (lent !== next) return
    lent = null
    setLoan(null)
  }
}
