// ============================================================
// Studio note editor host — where the note editor mounts, loaded with import() the first time a clip's notes open
// ============================================================
//
// The editor, its roll and its drawing load on the first open, never with
// the Studio or any page before it. One editor a clip: opening another
// clip's notes mounts it again, so its view starts on that clip and its
// focus goes back to the clip it was opened for.
import { lazy, Show, Suspense } from 'solid-js'
import common from '../StudioPage.module.css'
import type { StudioNoteEditorProps } from './StudioNoteEditor'

const StudioNoteEditor = lazy(() =>
  import('./StudioNoteEditor').then((module) => ({
    default: module.StudioNoteEditor,
  })),
)

export type StudioNoteEditorHostProps = Omit<StudioNoteEditorProps, 'clip'>

export function StudioNoteEditorHost(props: StudioNoteEditorHostProps) {
  return (
    <Show when={props.state.clipId()} keyed>
      {(clipId) => (
        <Suspense
          fallback={
            <p class={common.notesLoading} role="status">
              Opening the notes
            </p>
          }
        >
          <Show when={props.state.clip()?.id === clipId && props.state.clip()}>
            {(clip) => (
              <StudioNoteEditor
                state={props.state}
                clip={clip()}
                project={props.project}
                assets={props.assets}
                phone={props.phone}
                tablet={props.tablet}
                transport={props.transport}
              />
            )}
          </Show>
        </Suspense>
      )}
    </Show>
  )
}
