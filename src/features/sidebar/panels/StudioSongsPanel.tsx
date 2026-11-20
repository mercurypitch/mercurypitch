// Studio songs in the rail — every song on this device, one tap from opening, with its length, lanes and last edit.
// The list and the switch are the Studio page's, lent through
// studio-songs-store: a row asks the page to open its song, and the page
// decides through the same checks its own song list makes. The rail never
// reads a song or its audio itself. Nothing renders while no Studio page is
// mounted, or while there are no songs: the page's own empty state, with
// its Create project button, is right beside the rail and says it better.
//
// Default export: loaded lazily by the registry so Studio's rail stays out
// of the shell chunk.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import { isPhoneStage } from '@/lib/use-viewport'
import type { StudioSongsLoan } from '@/stores/studio-songs-store'
import { studioSongs } from '@/stores/studio-songs-store'
import { setSidebarOpen, sidebarOpen } from '@/stores/ui-store'
import { songDuration, songEdited, songLanes } from './studio-song-meta'
import styles from './StudioRail.module.css'

/** Five level bars that jump to a new reading when the row is pointed at. */
const SongGlyph: Component = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect x="2.8" y="9" width="2.4" height="6" rx="1.2" />
    <rect x="7.3" y="6" width="2.4" height="12" rx="1.2" />
    <rect x="11.8" y="10.5" width="2.4" height="3" rx="1.2" />
    <rect x="16.3" y="8.5" width="2.4" height="7" rx="1.2" />
    <rect x="20.8" y="7" width="2.4" height="10" rx="1.2" />
  </svg>
)

const SongRow: Component<{
  song: StudioProjectSummary
  loan: StudioSongsLoan
  disabled: boolean
  onOpen: (id: string) => void
}> = (props) => {
  const isOpen = () => props.song.id === props.loan.openId()
  const edited = () => songEdited(props.song.updatedAt)
  const length = () =>
    props.song.clipCount > 0 ? songDuration(props.song.durationFrames) : 'Empty'
  const label = () =>
    [
      props.song.title,
      props.song.clipCount > 0 ? length() : 'empty',
      songLanes(props.song.trackCount),
      edited()?.long.toLowerCase(),
    ]
      .filter(Boolean)
      .join(', ')
  return (
    <li>
      <button
        type="button"
        class={styles.row}
        aria-label={label()}
        aria-current={isOpen() ? 'true' : undefined}
        disabled={props.disabled}
        title={props.song.title}
        onClick={() => props.onOpen(props.song.id)}
      >
        <span class={styles.glyph}>
          <SongGlyph />
        </span>
        <span class={styles.body}>
          <span class={styles.titleLine}>
            <span class={styles.title}>{props.song.title}</span>
            <Show when={edited()}>
              {(when) => <span class={styles.edited}>{when().short}</span>}
            </Show>
          </span>
          <span class={styles.pills}>
            <span class={`${styles.pill} ${styles.pillTime}`}>{length()}</span>
            <span class={styles.pill}>{songLanes(props.song.trackCount)}</span>
            <Show when={isOpen()}>
              <span class={`${styles.pill} ${styles.pillOpen}`}>Open</span>
            </Show>
          </span>
        </span>
      </button>
    </li>
  )
}

const StudioSongsPanel: Component = () => {
  /**
   * On a phone the rail is a drawer that slides off-screen, and a closed
   * one would keep every row mounted: a second set of song buttons nobody
   * can see, in the tab order. Same rule as the Jam rail's song list.
   */
  const listOnScreen = (): boolean => !isPhoneStage() || sidebarOpen()

  function open(loan: StudioSongsLoan, id: string): void {
    // On a phone the drawer covers the song: a pick folds it away.
    if (isPhoneStage()) setSidebarOpen(false)
    void loan.open(id)
  }

  return (
    <Show when={studioSongs()}>
      {(loan) => (
        <Show when={loan().songs().length > 0}>
          <CollapsibleSection
            title="Your songs"
            storageKey="sidebar-studio-songs-open"
          >
            <div class={styles.panel} data-tour="studio.rail-songs">
              <Show when={loan().hold()}>
                {(reason) => (
                  <p class={styles.hold} role="status">
                    {reason()}
                  </p>
                )}
              </Show>
              <Show when={listOnScreen()}>
                <nav aria-label="Studio songs">
                  <ul class={styles.list}>
                    <For each={loan().songs()}>
                      {(song) => (
                        <SongRow
                          song={song}
                          loan={loan()}
                          disabled={loan().hold() !== null || loan().opening()}
                          onOpen={(id) => open(loan(), id)}
                        />
                      )}
                    </For>
                  </ul>
                </nav>
              </Show>
            </div>
          </CollapsibleSection>
        </Show>
      )}
    </Show>
  )
}

export default StudioSongsPanel
