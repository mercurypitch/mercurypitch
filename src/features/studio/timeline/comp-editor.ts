// ============================================================
// Studio comp editor — which loop take has its passes open under its lane, for the clip bar, Clip details and the lanes to share
// ============================================================
//
// Comping opens one clip at a time: its passes stand as rows under its
// lane (StudioCompLanes.tsx) until Done or Escape. The clip bar and Clip
// details open it and the lane shows it, three places that share no
// component, so they read it here, as the take-running flag is read
// (take-running.ts). One Studio is open at a time.
//
// While a take counts in, records or is being kept, the rows step aside
// and every Comp button waits, as Repeat, Punch and the range do: the take
// decides what the lane holds. Once it is kept the rows come back.
import { createSignal } from 'solid-js'
import { studioTakeRunning } from '../record/take-running'

const [open, setOpen] = createSignal<string | null>(null)

/** The clip whose passes stand open, or null: none is, or a take holds comping. */
export function studioCompClipId(): string | null {
  return studioTakeRunning() ? null : open()
}

/** True while a take holds comping: every Comp control says so. */
export const studioCompHeld = studioTakeRunning

/** What a Comp control says while a take holds it. */
export const STUDIO_COMP_HELD_TITLE = 'Stop the take to comp'

/** Opens a loop take's passes under its lane, closing any other. */
export function openStudioComp(clipId: string): void {
  setOpen(clipId)
}

/** Closes the passes, wherever they stand. */
export function closeStudioComp(): void {
  setOpen(null)
}

/** Opens a loop take's passes, or closes them when they are open already. */
export function toggleStudioComp(clipId: string): void {
  setOpen((current) => (current === clipId ? null : clipId))
}
