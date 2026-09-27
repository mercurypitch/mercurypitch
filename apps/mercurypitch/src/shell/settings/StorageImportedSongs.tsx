// ============================================================
// Storage, Imported songs: the singer's own Karaoke songs (plan S8 §9)
// ============================================================
//
// Mock 9c. Between the models and the cached rooms: how many, their size,
// and a Remove that asks first and says the originals are still in Files.
// Under the list, why the examples are not counted: they are part of the
// app, like its rooms' pictures.
//
// Reached only through StorageScreen's stand-ins, which a store build folds
// away with everything this imports.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { ImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import { removeAllImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import { importedSongsStorageLine, removeImportedQuestion, songsStuckLine, } from './imported-songs-copy'
import { askSettings } from './settings-alert'
import { SettingsRow } from './SettingsList'
import { formatBytes } from './storage-facts'
import { ClearButton, Dot } from './storage-parts'

export interface StorageImportedSongsProps {
  /** Absent where the facts have none to say. */
  songs: ImportedSongs | undefined
  /** The screen's one error line: '' clears it. */
  onError: (message: string) => void
  /** The songs changed: the screen reads the phone again. */
  onChanged: () => Promise<void>
}

export function StorageImportedSongsRow(
  props: StorageImportedSongsProps,
): JSX.Element {
  const remove = async (): Promise<void> => {
    props.onError('')
    const stuck = await removeAllImportedSongs()
    if (stuck > 0) props.onError(songsStuckLine(stuck))
    await props.onChanged()
  }

  const ask = (count: number): void => {
    askSettings({
      ...removeImportedQuestion(count),
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => void remove(),
    })
  }

  return (
    <Show when={props.songs}>
      {(songs) => (
        <SettingsRow
          id="storage-imported-songs"
          icon={<Dot category="songs" />}
          label="Imported songs"
          sub={importedSongsStorageLine(songs().count)}
          value={
            songs().bytes === null ? undefined : formatBytes(songs().bytes ?? 0)
          }
          accessory={
            <ClearButton
              label="Remove imported songs"
              text="Remove"
              disabled={songs().count === 0}
              onPress={() => {
                ask(songs().count)
              }}
            />
          }
        />
      )}
    </Show>
  )
}

export function StorageImportedSongsNote(props: {
  songs: ImportedSongs | undefined
}): JSX.Element {
  return (
    <Show when={props.songs !== undefined}>
      <p class="mp-set__caption">
        The example songs are not counted here: they are part of the app, like
        its rooms' pictures.
      </p>
    </Show>
  )
}
