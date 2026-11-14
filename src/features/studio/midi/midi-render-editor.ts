// Studio MIDI editor API — what the note editor calls to hear notes before it commits them, to keep their audio when it closes, and to show what a clip's render is doing.
//
// The workspace provides it (StudioMidiEditorContext), so the editor's
// drawer and a lane's note preview read it with useStudioMidiEditor().
// Undo and redo stay the Studio's own; a committed edit goes through
// dispatch as set-sequence-notes, whose notes, once they match a draft
// already previewed, play that render without another.
import type { Accessor } from 'solid-js'
import { createContext, useContext } from 'solid-js'
import type { StudioSequence } from '@/lib/studio/model/types'
import type { StudioMidiRenderService, StudioMidiRenderState, } from './midi-render-service'

export type { StudioMidiRenderState } from './midi-render-service'

export interface StudioMidiEditorApi {
  /**
   * Notes being edited, not committed yet: the clip's sequence with the
   * draft's notes. Rendered once no draft has come for a quarter second,
   * and played in the clip's place through its lane's chain. Call it as
   * often as a gesture moves; null ends the draft, as a cancelled gesture
   * does. A commit or an undo of the clip's notes ends it too.
   */
  preview(clipId: string, draft: StudioSequence | null): void
  /**
   * The editor closed: drafts end, and every MIDI clip whose audio is stale
   * gets its render kept as its audio, without an undo step. Resolves once
   * each is kept or has failed.
   */
  editorClosed(): Promise<void>
  /** What clip `clipId`'s render is doing, as a signal: idle, rendering or failed. */
  renderState(clipId: string): Accessor<StudioMidiRenderState>
}

export function studioMidiEditorApi(
  service: StudioMidiRenderService,
): StudioMidiEditorApi {
  return {
    preview: (clipId, draft) => service.preview(clipId, draft),
    editorClosed: () => service.editorClosed(),
    renderState: (clipId) => () => service.renderState(clipId),
  }
}

export const StudioMidiEditorContext = createContext<StudioMidiEditorApi>()

/** The editor API of the workspace this is mounted in; undefined outside one. */
export function useStudioMidiEditor(): StudioMidiEditorApi | undefined {
  return useContext(StudioMidiEditorContext)
}
