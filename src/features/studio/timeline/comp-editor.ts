// ============================================================
// Studio comp editor — which clip has rows open under its lane: a loop take's passes for comping, or a clip's takes (Show takes), for the clip bar, Clip details, the clip menu and the lanes to share
// ============================================================
//
// Comping opens one clip at a time: its passes stand as rows under its
// lane (StudioCompLanes.tsx) until Done or Escape. Show takes opens a
// clip's takes the same way (StudioTakeLanes.tsx) until Hide takes or
// Escape. They are separate modes, so a click on a take never comps and a
// drag along a pass never chooses a take: opening one closes the other.
// The clip bar, Clip details and the clip menu open them and the lane shows
// them, places that share no component, so they read it here, as the
// take-running flag is read (take-running.ts). One Studio is open at a time,
// and the rows belong to its song: they close as the song is left
// (StudioTimeline.tsx), even for a song with no lane to close them.
//
// While a take counts in, records or is being kept, the rows step aside
// and every Comp button waits, as Repeat, Punch and the range do: the take
// decides what the lane holds. Once it is kept the rows come back.
import { createSignal } from 'solid-js'
import { studioTakeRunning } from '../record/take-running'

/** The rows open under a lane: a clip's passes for comping, or its takes. */
interface StudioOpenRows {
  readonly mode: 'comp' | 'takes'
  readonly clipId: string
}

const [open, setOpen] = createSignal<StudioOpenRows | null>(null)

/** The clip whose rows of `mode` stand open, or null: none do, or a take holds them. */
function openIn(mode: StudioOpenRows['mode']): string | null {
  const rows = open()
  return studioTakeRunning() || rows?.mode !== mode ? null : rows.clipId
}

/** Opens a clip's rows of `mode`, or closes them when they are open already. */
function toggle(mode: StudioOpenRows['mode'], clipId: string): void {
  setOpen((now) =>
    now?.mode === mode && now.clipId === clipId ? null : { mode, clipId },
  )
}

/** Closes the rows of `mode`, wherever they stand, and leaves the other mode's be. */
function close(mode: StudioOpenRows['mode']): void {
  setOpen((now) => (now?.mode === mode ? null : now))
}

/** The clip whose passes stand open, or null: none is, or a take holds comping. */
export function studioCompClipId(): string | null {
  return openIn('comp')
}

/** True while a take holds comping: every Comp control says so. */
export const studioCompHeld = studioTakeRunning

/** What a Comp control says while a take holds it. */
export const STUDIO_COMP_HELD_TITLE = 'Stop the take to comp'

/** Opens a loop take's passes under its lane, closing any other rows. */
export function openStudioComp(clipId: string): void {
  setOpen({ mode: 'comp', clipId })
}

/** Closes the passes, wherever they stand. */
export function closeStudioComp(): void {
  close('comp')
}

/** Opens a loop take's passes, or closes them when they are open already. */
export function toggleStudioComp(clipId: string): void {
  toggle('comp', clipId)
}

/** The clip whose takes stand open as rows under its lane, or null. */
export function studioTakesClipId(): string | null {
  return openIn('takes')
}

/** Opens a clip's takes under its lane, closing any other rows. */
export function openStudioTakes(clipId: string): void {
  setOpen({ mode: 'takes', clipId })
}

/** Closes the takes, wherever they stand. */
export function closeStudioTakes(): void {
  close('takes')
}

/** Opens a clip's takes, or closes them when they are open already. */
export function toggleStudioTakes(clipId: string): void {
  toggle('takes', clipId)
}

/** Closes whatever rows stand open, takes or passes: their song is left. */
export function closeStudioRows(): void {
  setOpen(null)
}
