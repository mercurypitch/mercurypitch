// ============================================================
// Studio track removal — remove a lane from its menu or its details, and leave the focus where Ctrl+Z undoes it
// ============================================================
//
// The control a lane is removed from goes with the lane, and the focus with
// it, out to the page: Ctrl+Z, which the Studio answers only while the
// focus is inside it (StudioWorkspace.tsx), then did nothing. So the focus
// moves to the lane that takes the removed one's place: the next lane's
// name, else the one before, else the Studio itself.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioTrack } from '@/lib/studio/model/types'

/** The lane the focus goes to once `trackId` is removed: the next, else the one before; null when it was the only one. */
export function studioTrackAfterRemoval(
  tracks: readonly Pick<StudioTrack, 'id'>[],
  trackId: string,
): string | null {
  const at = tracks.findIndex((track) => track.id === trackId)
  if (at === -1) return null
  return (tracks[at + 1] ?? tracks[at - 1])?.id ?? null
}

/** Remove lane `trackId`, undoably, and put the focus on its neighbour's name, or on `workspace`. False when the Studio refused. */
export function removeStudioTrack(
  trackId: string,
  studio: {
    project(): { readonly tracks: readonly Pick<StudioTrack, 'id'>[] } | null
    dispatch(command: StudioCommand): boolean
  },
  workspace: HTMLElement,
): boolean {
  const next = studioTrackAfterRemoval(studio.project()?.tracks ?? [], trackId)
  if (!studio.dispatch({ type: 'remove-track', trackId })) return false
  // The lanes redraw first; the removed lane's controls are gone by then.
  queueMicrotask(() => {
    if (!workspace.isConnected) return
    const header =
      next === null
        ? null
        : workspace.querySelector<HTMLElement>(
            `[data-studio-track-header="${CSS.escape(next)}"]`,
          )
    ;(header ?? workspace).focus({ preventScroll: true })
  })
  return true
}
