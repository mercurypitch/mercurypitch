// ============================================================
// ComposeMobileToolbar — one header row on a phone, the rest in a drawer
// ============================================================
//
// The desktop toolbar is a three-column grid: melody identity above the four
// view tabs, the transport centred, the Melody/Drums toggle on the right. Below
// the container query it collapses to one column, so on a phone all three stack
// — identity, tabs, transport, kind toggle, plus the desktop-first hint above
// them. Five rows of chrome before a single note of the piano roll, on the
// screen with the least room for it.
//
// Here it is one row: the view tabs, and a three-dot button that opens the rest
// in a bottom sheet. Play/pause stays inline. It is one icon wide, it is the
// control people came to press, and putting it two taps away to save nothing
// would be a worse trade than the rows we are removing.
//
// The sheet is the same `Sheet` primitive the Jam and Karaoke pickers use, so
// it drags, dismisses and traps focus like every other drawer in the app.

import type { Accessor, Component, JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { Drum, MoreHorizontal, MusicNote, Pause, Play } from '../icons'
import styles from './ComposeMobileToolbar.module.css'

export type ComposeEditorView =
  | 'piano-roll'
  | 'sheet-music'
  | 'split'
  | 'session-editor'

export interface ComposeMobileToolbarProps {
  melodyName: Accessor<string | null>
  editorView: Accessor<ComposeEditorView>
  onSelectView: (view: ComposeEditorView) => void
  kind: Accessor<'melody' | 'drums'>
  onSelectKind: (kind: 'melody' | 'drums') => void
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  /** The full desktop control bar, rendered inside the drawer. */
  controls: JSX.Element
  /** Each view tab keeps the icon and test id it has on desktop. */
  views: readonly {
    id: ComposeEditorView
    label: string
    testId?: string
    icon: () => JSX.Element
  }[]
}

export const ComposeMobileToolbar: Component<ComposeMobileToolbarProps> = (
  props,
) => {
  const [sheetOpen, setSheetOpen] = createSignal(false)

  // Paused counts as started: the button has to offer Resume, not a restart.
  const showPause = (): boolean => props.isPlaying() && !props.isPaused()
  const onTransport = (): void => {
    if (showPause()) props.onPause()
    else if (props.isPaused()) props.onResume()
    else props.onPlay()
  }

  return (
    <>
      <div class={styles.row}>
        <div
          class={styles.views}
          role="tablist"
          aria-label="Editor view"
          data-tour="compose.editor"
        >
          <For each={props.views}>
            {(view) => (
              <button
                type="button"
                role="tab"
                class={styles.viewTab}
                classList={{
                  [styles.viewTabActive]: props.editorView() === view.id,
                }}
                aria-selected={props.editorView() === view.id}
                aria-label={view.label}
                data-testid={view.testId}
                onClick={() => props.onSelectView(view.id)}
                title={view.label}
              >
                {view.icon()}
              </button>
            )}
          </For>
        </div>

        <div class={styles.rowEnd}>
          <button
            type="button"
            class={styles.transport}
            onClick={onTransport}
            aria-label={
              showPause() ? 'Pause' : props.isPaused() ? 'Resume' : 'Play'
            }
            title={showPause() ? 'Pause' : props.isPaused() ? 'Resume' : 'Play'}
          >
            <Show when={showPause()} fallback={<Play />}>
              <Pause />
            </Show>
          </button>
          <button
            type="button"
            class={styles.more}
            data-testid="compose-mobile-more"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen()}
            onClick={() => setSheetOpen(true)}
            aria-label="More compose controls"
            title="More compose controls"
          >
            <MoreHorizontal />
          </button>
        </div>
      </div>

      <Sheet
        isOpen={sheetOpen()}
        close={() => setSheetOpen(false)}
        ariaLabel="Compose controls"
      >
        <div class={styles.sheetBody}>
          {/* Which melody you are editing. On desktop this sits above the view
              tabs; the sheet is the only place a phone has room for it. */}
          <div class={styles.identity} data-testid="compose-melody-name">
            <span class={styles.identityIcon}>
              <MusicNote />
            </span>
            <span class={styles.identityName}>
              {props.melodyName() ?? 'Untitled'}
            </span>
          </div>

          <div class={styles.sheetGroup}>
            <span class={styles.sheetLabel}>Mode</span>
            <div
              class={styles.kindToggle}
              role="tablist"
              aria-label="Compose mode"
              data-tour="compose.kind"
            >
              <button
                type="button"
                role="tab"
                class={styles.kindTab}
                classList={{
                  [styles.kindTabActive]: props.kind() === 'melody',
                }}
                aria-selected={props.kind() === 'melody'}
                data-testid="compose-kind-melody"
                onClick={() => props.onSelectKind('melody')}
              >
                <MusicNote /> Melody
              </button>
              <button
                type="button"
                role="tab"
                class={styles.kindTab}
                classList={{
                  [styles.kindTabActive]: props.kind() === 'drums',
                }}
                aria-selected={props.kind() === 'drums'}
                data-testid="compose-kind-drums"
                onClick={() => props.onSelectKind('drums')}
              >
                <Drum /> Drums
              </button>
            </div>
          </div>

          <div class={styles.sheetGroup}>
            <span class={styles.sheetLabel}>Transport</span>
            {props.controls}
          </div>
        </div>
      </Sheet>
    </>
  )
}
