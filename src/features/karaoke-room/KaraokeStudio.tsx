// ============================================================
// The Karaoke studio: the old Karaoke tab, pushed over the room
// ============================================================
//
// In the native app the Karaoke tab is the room. The panel that was the tab
// (UvrPanel) is the studio now, a library to work on: songs, their groups
// and playlists, and their lyrics. It opens from the room's Options, "Manage
// songs", as a screen the shell pushes, with its own Back (plan S8 §11,
// decision D8 A).
//
// The studio draws what the panel's header and group tabs were, which
// scrolled sideways on a phone (audit K5): one options button, with the
// view first and then Guide and Settings, and one Group row that opens the
// groups as a list. The panel keeps its list and its views and lends the
// studio the controls those need (`uvr-studio-hosting.ts`).
//
// A song chosen to sing is not sung here: the room hosts the one zen stage.
// The room gets the song and the studio closes, unless the room could not
// play it, in which case the studio stays and says why.
//
// Where songs can be imported (Stage 2, KARAOKE_IMPORT), the songs view
// starts with Import a song, the room's own, and the options say how many
// songs are left, a tap from Settings, Karaoke (plan §11, mock 10c).

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { ChevronDown, Settings } from '@/components/icons'
import { OptionSection, OptionsSheet } from '@/components/mobile/OptionsSheet'
import { Sheet } from '@/components/mobile/Sheet'
import { SessionGroupTabs } from '@/components/SessionGroupTabs'
import type { UvrStudioControls, UvrStudioHosting, UvrStudioView, } from '@/components/uvr-studio-hosting'
import { UvrPanel } from '@/components/UvrPanel'
import { TAB_SINGING } from '@/features/tabs/constants'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { getGroupsReactive, karaokeActiveGroupId, setKaraokeActiveGroupId, } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import { showNotification } from '@/stores/notifications-store'
import { openSettingsSection, setActiveTab } from '@/stores/ui-store'
import styles from './karaoke-room.module.css'
import { roomLibrary } from './karaoke-room-library'
import { requestKaraokeSong } from './karaoke-room-store'
import { karaokeSongs, songsOptionRow } from './karaoke-songs'
import { KaraokeImport } from './KaraokeImport'

/** Said when a song chosen to sing is not one the room can play. */
export const STUDIO_CANNOT_SING =
  'This song is missing its vocal or its music, so the room cannot play it.'

/** The views the options offer, in their order. */
const VIEWS: ReadonlyArray<{ view: UvrStudioView; label: string }> = [
  { view: 'shazam-listen', label: 'Sing' },
  { view: 'upload', label: 'Songs' },
]

/** Which of the offered views a panel view belongs to. */
function offeredView(view: string): UvrStudioView {
  return view === 'shazam-listen' || view === 'shazam-results'
    ? 'shazam-listen'
    : 'upload'
}

interface KaraokeStudioProps {
  /** Close the studio: the shell pops its screen. */
  onDone: () => void
}

export const KaraokeStudio: Component<KaraokeStudioProps> = (props) => {
  const [controls, setControls] = createSignal<UvrStudioControls | null>(null)
  const [optionsOpen, setOptionsOpen] = createSignal(false)
  const [groupsOpen, setGroupsOpen] = createSignal(false)

  const view = (): UvrStudioView => offeredView(controls()?.view() ?? 'upload')

  // A group that has been deleted names nothing: the list shows every song.
  const groupName = (): string => {
    const id = karaokeActiveGroupId()
    if (id === null) return 'All songs'
    return (
      getGroupsReactive().find((group) => group.id === id)?.name ?? 'All songs'
    )
  }

  const sing = (sessionId: string): void => {
    if (!roomLibrary().some((song) => song.sessionId === sessionId)) {
      showNotification(STUDIO_CANNOT_SING, 'info')
      return
    }
    requestKaraokeSong(sessionId)
    props.onDone()
  }

  // A melody found by singing is a Sing exercise: the studio closes and the
  // Sing tab takes it, as the web's Karaoke page does.
  const toSing = (melodyId: string): void => {
    melodyStore.loadMelody(melodyId)
    props.onDone()
    setActiveTab(TAB_SINGING)
  }

  const hosting: UvrStudioHosting = {
    onSing: sing,
    attach: setControls,
  }

  const chooseView = (next: UvrStudioView): void => {
    setOptionsOpen(false)
    controls()?.showView(next)
  }

  return (
    <div id="uvr-panel" class={styles.studio} data-testid="karaoke-studio">
      <div class={styles.studioBar} data-testid="karaoke-studio-bar">
        {/* The groups filter the songs, so the row is there while they are. */}
        <Show when={view() === 'upload'}>
          <button
            type="button"
            class={styles.groupRow}
            aria-label={`Group: ${groupName()}`}
            aria-haspopup="dialog"
            data-testid="karaoke-studio-group"
            onClick={() => setGroupsOpen(true)}
          >
            <span class={styles.groupLabel}>Group</span>
            <span class={styles.groupValue}>{groupName()}</span>
            <ChevronDown size={18} />
          </button>
        </Show>
        <button
          type="button"
          class={styles.studioOptionsButton}
          aria-label="Studio options"
          data-testid="karaoke-studio-options-button"
          onClick={() => setOptionsOpen(true)}
        >
          <Settings />
        </button>
      </div>

      <Show when={KARAOKE_IMPORT && view() === 'upload'}>
        <div class={styles.studioImport}>
          <KaraokeImport />
        </div>
      </Show>

      <UvrPanel initialView="upload" studio={hosting} onSelectMelody={toSing} />

      <Sheet
        isOpen={groupsOpen()}
        close={() => setGroupsOpen(false)}
        ariaLabel="Group"
      >
        <div class={styles.groupSheet}>
          <div class={styles.sheetHead}>
            <h2 class={styles.sheetTitle}>Group</h2>
          </div>
          <div class={styles.groupList}>
            <SessionGroupTabs
              activeGroupId={karaokeActiveGroupId()}
              onSelectGroup={(id) => {
                setKaraokeActiveGroupId(id)
                setGroupsOpen(false)
              }}
            />
          </div>
        </div>
      </Sheet>

      <OptionsSheet
        isOpen={optionsOpen()}
        close={() => setOptionsOpen(false)}
        ariaLabel="Studio options"
      >
        <div class={styles.options} data-testid="karaoke-studio-options">
          <div class={styles.sheetHead}>
            <h2 class={styles.sheetTitle}>Studio options</h2>
          </div>
          <OptionSection label="View">
            <span class={styles.segments} role="radiogroup" aria-label="Show">
              <For each={VIEWS}>
                {(choice) => (
                  <button
                    type="button"
                    role="radio"
                    classList={{
                      [styles.segment]: true,
                      [styles.segmentOn]: view() === choice.view,
                    }}
                    aria-checked={view() === choice.view}
                    onClick={() => chooseView(choice.view)}
                  >
                    {choice.label}
                  </button>
                )}
              </For>
            </span>
          </OptionSection>
          <OptionSection label="More">
            <Show when={KARAOKE_IMPORT ? songsOptionRow(karaokeSongs()) : null}>
              {(songs) => (
                <button
                  type="button"
                  class={styles.sheetRowButton}
                  aria-label={`${songs().label}: ${songs().value}`}
                  onClick={() => {
                    setOptionsOpen(false)
                    openSettingsSection('karaoke')
                  }}
                >
                  <span>{songs().label}</span>
                  <span class={styles.optionValue}>{songs().value}</span>
                </button>
              )}
            </Show>
            <button
              type="button"
              class={styles.sheetRowButton}
              onClick={() => {
                setOptionsOpen(false)
                controls()?.openGuide()
              }}
            >
              Guide
            </button>
            <button
              type="button"
              class={styles.sheetRowButton}
              onClick={() => {
                setOptionsOpen(false)
                openSettingsSection('karaoke')
              }}
            >
              Settings
            </button>
          </OptionSection>
        </div>
      </OptionsSheet>
    </div>
  )
}
