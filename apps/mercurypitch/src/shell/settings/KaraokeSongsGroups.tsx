// ============================================================
// Settings, Karaoke, Stage 2: the songs on this phone
// ============================================================
//
// Plan S8 §9, mock 9b. In a build that imports songs, a group above the
// lyrics and playback: the songs on this phone (how many, their size, Remove
// imported songs after asking). The examples are part of the app and stay.
//
// The subscription that pays for them is not here any more: it is Mercury
// Pitch Cloud's, and the premium exercises ride it too, so it stands in
// Settings itself (CloudGroup.tsx, S7b §5).
//
// On Android, Play's review access sits at the top: the code Google's
// reviewers are given (KaraokeReviewAccess.tsx), still at Settings, Karaoke,
// App review.
//
// Reached only through KaraokeSettingsScreen's stand-in, which a store build
// folds away with everything this imports.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { importedSongs, removeAllImportedSongs, } from '@/features/karaoke-room/karaoke-imported-songs'
import { thisDeviceLower } from '@/lib/device-noun'
import { NoteGlyphIcon, TrashIcon } from '../icons'
import { importedSongsValue, removeImportedQuestion, songsStuckLine, } from './imported-songs-copy'
import { IN_A_PLAY_BUILD, KaraokeReviewAccess, reviewAccessShown, } from './KaraokeReviewAccess'
import { askSettings } from './settings-alert'
import { SettingsGroup, SettingsRow } from './SettingsList'

/**
 * Play's review access, on Android. A build made for iOS folds this to
 * nothing, so none of it is in that bundle (a `<Show>` would keep its
 * children, as KaraokeSettingsScreen's stand-in says of Stage 2).
 */
function ReviewAccess(): JSX.Element {
  return IN_A_PLAY_BUILD && reviewAccessShown() ? <KaraokeReviewAccess /> : null
}

/** Stage 2: Play's review access on Android, and the songs on this phone. */
export function KaraokeSongsGroups(): JSX.Element {
  const [stuck, setStuck] = createSignal(0)
  let live = true
  onCleanup(() => {
    live = false
  })

  const removeAll = async (): Promise<void> => {
    setStuck(0)
    const left = await removeAllImportedSongs()
    if (live) setStuck(left)
  }

  const askRemoveAll = (count: number): void => {
    askSettings({
      ...removeImportedQuestion(count),
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => void removeAll(),
    })
  }

  return (
    <>
      <ReviewAccess />
      <SettingsGroup title={`Songs on ${thisDeviceLower()}`}>
        <SettingsRow
          id="karaoke-imported-songs"
          icon={<NoteGlyphIcon />}
          label="Imported songs"
          value={importedSongsValue(importedSongs())}
        />
        <Show when={importedSongs().count > 0}>
          <SettingsRow
            id="karaoke-remove-imported"
            icon={<TrashIcon />}
            label="Remove imported songs"
            tone="danger"
            onPress={() => {
              askRemoveAll(importedSongs().count)
            }}
          />
        </Show>
      </SettingsGroup>
      <Show when={stuck() > 0}>
        <p class="mp-set__error" role="alert">
          {songsStuckLine(stuck())}
        </p>
      </Show>
      <p class="mp-set__caption">
        The example songs are part of the app and stay.
      </p>
    </>
  )
}
