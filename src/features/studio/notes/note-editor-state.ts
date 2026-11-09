// ============================================================
// Studio note editor state — which MIDI clip's notes are open, whether the editor fills the arrangement, and the drawer's height
// ============================================================
//
// One clip at a time. The editor closes by itself when its clip goes
// (deleted, undone away, or no longer a MIDI clip) and when another song
// opens, so it never shows notes the song no longer has. The drawer's
// height is chosen on its top edge and kept on this device, as the mix
// desk's is; whether it fills the arrangement is not kept, so the editor
// always opens as a drawer under the lanes.
import { batch, createEffect, createMemo, createSignal } from 'solid-js'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'

export const STUDIO_NOTE_EDITOR_HEIGHT_KEY =
  'mercurypitch.studio.note-editor-height.v1'

function storedHeight(): number | null {
  try {
    const value = Number(
      window.localStorage.getItem(STUDIO_NOTE_EDITOR_HEIGHT_KEY),
    )
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function storeHeight(value: number | null): void {
  try {
    if (value === null)
      window.localStorage.removeItem(STUDIO_NOTE_EDITOR_HEIGHT_KEY)
    else
      window.localStorage.setItem(
        STUDIO_NOTE_EDITOR_HEIGHT_KEY,
        String(Math.round(value)),
      )
  } catch {
    // Storage may be off (a private window): the height lasts for this visit.
  }
}

export interface StudioNoteEditorStateOptions {
  project(): StudioProject | null
}

export function createStudioNoteEditorState(
  options: StudioNoteEditorStateOptions,
) {
  const [opened, setOpened] = createSignal<{
    clipId: string
    projectId: string
  } | null>(null)
  const [expanded, setExpanded] = createSignal(false)
  const [height, setHeightSignal] = createSignal(storedHeight())

  /** The open clip as the song holds it now; null once it is gone or plays no MIDI. */
  const clip = createMemo<StudioClip | null>(() => {
    const open = opened()
    const project = options.project()
    if (open === null || project?.id !== open.projectId) return null
    const found = project.clips.find((each) => each.id === open.clipId)
    return found?.midi === undefined ? null : found
  })

  function close(): void {
    batch(() => {
      setOpened(null)
      setExpanded(false)
    })
  }

  createEffect(() => {
    if (opened() !== null && clip() === null) close()
  })

  /** Open clip `clipId`'s notes; false for a clip the song does not hold or that plays no MIDI. */
  function open(clipId: string): boolean {
    const project = options.project()
    const target = project?.clips.find((each) => each.id === clipId)
    if (project === null || target?.midi === undefined) return false
    setOpened({ clipId, projectId: project.id })
    return true
  }

  /** Keep a drawer height, or null for the automatic one. */
  function setHeight(value: number | null): void {
    setHeightSignal(value)
    storeHeight(value)
  }

  return {
    /** The open clip's id, or null with the editor closed. */
    clipId: () => clip()?.id ?? null,
    clip,
    open,
    close,
    expanded,
    setExpanded,
    /** The drawer's chosen height in CSS pixels; null for the automatic one. */
    height,
    setHeight,
  }
}

export type StudioNoteEditorState = ReturnType<
  typeof createStudioNoteEditorState
>
