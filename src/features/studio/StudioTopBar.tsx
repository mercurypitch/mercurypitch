// Studio top bar — the song's name and whether it is saved, the transport on a computer, undo and redo, and the buttons that open Add takes, Mix, Sound and Export.
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { CheckSmall, ChevronDown, Download, Plus, RotateCcw, SlidersHorizontal, } from '@/components/icons'
import { STUDIO_MIX_SHORTCUT } from './mix/mix-shortcut'
import type { StudioPanelName } from './panels/studio-panels'
import { MixingDesk, RotateCw } from './studio-icons'
import styles from './StudioPage.module.css'
import type { StudioController } from './useStudioController'

interface StudioTopBarProps {
  studio: StudioController
  /** The song takes edits now: no save, render or export holds it. */
  writable: boolean
  panel: StudioPanelName | null
  onPanel(name: StudioPanelName): void
  onHistory(direction: 'undo' | 'redo'): void
  /** The transport, where the bar carries it (a computer); a phone's sits at its foot. */
  transport?: JSX.Element
}

/** Whether the song is saved, in words. */
function saveWords(studio: StudioController): string {
  if (!studio.writable()) return 'Read only'
  return {
    saved: 'Saved in this browser',
    unsaved: 'Changes not saved',
    saving: 'Saving…',
    error: 'Changes not saved',
  }[studio.saveState()]
}

export function StudioTopBar(props: StudioTopBarProps) {
  return (
    <div class={styles.topBar} data-studio-top-bar>
      <div class={styles.topBarRow}>
        <div class={styles.songIdentity}>
          <button
            type="button"
            class={styles.songTitle}
            title="Song options"
            aria-label="Song options"
            data-tour="studio.song-options"
            aria-expanded={props.panel === 'song'}
            onClick={() => props.onPanel('song')}
          >
            <span>{props.studio.project()!.title}</span>
            <ChevronDown size={14} />
          </button>
          <span
            class={styles.saveStatus}
            data-state={
              props.studio.writable() ? props.studio.saveState() : 'read-only'
            }
            role="status"
          >
            <Show
              when={
                props.studio.writable() && props.studio.saveState() === 'saved'
              }
            >
              <CheckSmall size={12} />
            </Show>
            {saveWords(props.studio)}
          </span>
        </div>
        {props.transport}
        <div class={styles.topActions}>
          <div class={styles.historyButtons} data-tour="studio.history">
            <button
              type="button"
              class={styles.iconButton}
              aria-label={props.studio.undoLabel() ?? 'Undo'}
              title={`${props.studio.undoLabel() ?? 'Undo'} (Ctrl+Z)`}
              disabled={!props.writable || !props.studio.canUndo()}
              onClick={() => props.onHistory('undo')}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              class={styles.iconButton}
              aria-label={props.studio.redoLabel() ?? 'Redo'}
              title={`${props.studio.redoLabel() ?? 'Redo'} (Ctrl+Shift+Z)`}
              disabled={!props.writable || !props.studio.canRedo()}
              onClick={() => props.onHistory('redo')}
            >
              <RotateCw size={17} />
            </button>
          </div>
          <span class={styles.divider} aria-hidden="true" />
          <button
            type="button"
            class={styles.button}
            disabled={!props.writable}
            aria-expanded={props.panel === 'sources'}
            data-tour="studio.add-takes"
            title="Add takes"
            onClick={() => props.onPanel('sources')}
          >
            <Plus size={16} />
            <span class={styles.label}>Add takes</span>
          </button>
          <button
            type="button"
            class={styles.button}
            aria-expanded={props.panel === 'mix'}
            data-tour="studio.mix"
            title={`Mix (${STUDIO_MIX_SHORTCUT})`}
            aria-keyshortcuts={STUDIO_MIX_SHORTCUT}
            onClick={() => props.onPanel('mix')}
          >
            <MixingDesk size={16} />
            <span class={styles.label}>Mix</span>
          </button>
          <button
            type="button"
            class={styles.button}
            data-tour="studio.sound"
            aria-expanded={props.panel === 'sound'}
            title="Sound"
            onClick={() => props.onPanel('sound')}
          >
            <SlidersHorizontal />
            <span class={styles.label}>Sound</span>
          </button>
          <button
            type="button"
            class={styles.primaryButton}
            data-tour="studio.export"
            title="Export"
            aria-expanded={props.panel === 'export'}
            onClick={() => props.onPanel('export')}
          >
            <Download />
            <span class={styles.exportLabel}>Export</span>
          </button>
        </div>
      </div>
    </div>
  )
}
