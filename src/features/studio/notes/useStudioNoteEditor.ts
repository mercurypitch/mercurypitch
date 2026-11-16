// ============================================================
// Studio note editor hook — the workspace's note editor: its state, a clip's notes opened from the lanes, Clip details and E, and Mix giving way to it
// ============================================================
//
// Mix and the note editor share the space under the lanes, one at a time:
// opening the notes closes the desk, and the desk opening closes the notes
// (the workspace's panels call `close` as Mix opens). A panel that covers
// the lanes (below 1100 px, and a phone's sheet) closes too, so the notes
// are in view; a panel beside the lanes stays. The panel closes before the
// editor opens, so the focus it hands back cannot land after the editor
// has taken it. Opening a clip's notes selects the clip.
import { onCleanup, onMount } from 'solid-js'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioPanelName } from '../panels/studio-panels'
import type { NoteEditTool } from './edit-types'
import { installStudioNotesKey } from './note-editor-keys'
import { createStudioNoteEditorState } from './note-editor-state'

export interface StudioNoteEditorOptions {
  project(): StudioProject | null
  phone(): boolean
  panel(): StudioPanelName | null
  /** An open panel covers the lanes. */
  panelCovers(): boolean
  closePanel(): void
  selectClip(id: string): void
  selectedClipId(): string | null
  /** The Studio's root, where E answers. */
  scope(): Element | null
}

export function useStudioNoteEditor(options: StudioNoteEditorOptions) {
  const state = createStudioNoteEditorState({ project: options.project })

  /** Open clip `clipId`'s notes, in `tool` (Draw for a clip just made); false for a clip that plays no MIDI. */
  function open(clipId: string, tool?: NoteEditTool): boolean {
    const clip = options.project()?.clips.find((each) => each.id === clipId)
    if (clip?.midi === undefined) return false
    const panel = options.panel()
    if (panel === 'mix' || (panel !== null && options.panelCovers()))
      options.closePanel()
    options.selectClip(clipId)
    return state.open(clipId, tool)
  }

  onMount(() =>
    onCleanup(
      installStudioNotesKey({
        scope: options.scope,
        selectedClipId: options.selectedClipId,
        open,
      }),
    ),
  )

  const isOpen = () => state.clipId() !== null
  return {
    state,
    open,
    close: state.close,
    /** The drawer under the lanes is open: zoom and the clip bar dock beside them. */
    drawer: () => isOpen() && !options.phone(),
    /** The editor covers the lanes, which then take no focus. */
    covering: () => isOpen() && (options.phone() || state.expanded()),
    /** A phone's editor, which fills the screen. */
    full: () => isOpen() && options.phone(),
  }
}

export type StudioNoteEditorHandle = ReturnType<typeof useStudioNoteEditor>
