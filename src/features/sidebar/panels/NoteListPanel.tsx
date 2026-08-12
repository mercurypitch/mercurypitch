// Note list — bottom-anchored live melody readout for the Singing tab.
// The user toggle (showSidebarNoteList) gates it here; WHICH tabs get it
// at all is the registry's decision.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import styles from '@/components/AppSidebar.module.css'
import { NoteList } from '@/components/NoteList'
import { useSidebarHost } from '@/features/sidebar/sidebar-host'
import { showSidebarNoteList } from '@/stores/settings-store'

export const NoteListPanel: Component = () => {
  const host = useSidebarHost()
  return (
    <Show when={showSidebarNoteList()}>
      <div class={[styles.sidebarSection, styles.sidebarNotesBottom].join(' ')}>
        <NoteList
          melody={host.noteList.melody}
          currentNoteIndex={host.noteList.currentNoteIndex}
          noteResults={host.noteList.noteResults}
          isPlaying={host.noteList.isPlaying}
        />
      </div>
    </Show>
  )
}
