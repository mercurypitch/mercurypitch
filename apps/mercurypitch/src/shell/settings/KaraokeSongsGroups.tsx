// ============================================================
// Settings, Karaoke, Stage 2: the subscription and the songs on this phone
// ============================================================
//
// Plan S8 §9, mock 9b. In a build that imports songs, two groups above the
// lyrics and playback: the subscription (how it stands, the songs left,
// Manage where the store has a page for it, Restore purchases) and the songs
// on this phone (how many, their size, Remove imported songs after asking).
// The status and the songs left are what /me last said; Manage and Restore
// go to the store through the shell (karaoke-subscription.ts), and Restore
// says "not available yet" until the store is real. The examples are part
// of the app and stay.
//
// Reached only through KaraokeSettingsScreen's stand-in, which a store build
// folds away with everything this imports.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { importedSongs, removeAllImportedSongs, } from '@/features/karaoke-room/karaoke-imported-songs'
import { karaokeSongs, refreshKaraokeSongs, restoreNote, songsOptionRow, subscriptionStatusLine, } from '@/features/karaoke-room/karaoke-songs'
import { nativeShellApi } from '@/stores/native-shell-store'
import { CardIcon, ExternalIcon, NoteGlyphIcon, RefreshIcon, TrashIcon, } from '../icons'
import { importedSongsValue, removeImportedQuestion, songsStuckLine, } from './imported-songs-copy'
import { askSettings } from './settings-alert'
import { SettingsGroup, SettingsRow } from './SettingsList'

/** Stage 2: the subscription, and the songs on this phone. */
export function KaraokeSongsGroups(): JSX.Element {
  const [note, setNote] = createSignal<string | null>(null)
  const [stuck, setStuck] = createSignal(0)
  let live = true
  onCleanup(() => {
    live = false
  })

  onMount(() => {
    void refreshKaraokeSongs()
  })

  const subscription = () => nativeShellApi()?.karaokeSubscription

  const restore = async (): Promise<void> => {
    setNote(null)
    const api = subscription()
    const outcome =
      api === undefined
        ? 'unavailable'
        : await api.restore().catch(() => 'failed' as const)
    if (outcome === 'restored') await refreshKaraokeSongs({ identify: true })
    if (live) setNote(restoreNote(outcome))
  }

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

  const manage = () => {
    const api = subscription()
    return karaokeSongs().subscribed ? api?.manage : undefined
  }

  return (
    <>
      <SettingsGroup title="Subscription">
        <SettingsRow
          id="karaoke-subscription"
          icon={<CardIcon />}
          label={subscriptionStatusLine(karaokeSongs())}
          sub={
            karaokeSongs().subscribed
              ? `${karaokeSongs().perPeriod} songs a month`
              : undefined
          }
        />
        <Show when={songsOptionRow(karaokeSongs())}>
          {(songs) => (
            <SettingsRow
              id="karaoke-songs-left"
              label={songs().label}
              value={songs().value}
            />
          )}
        </Show>
        <Show when={manage()}>
          {(open) => (
            <SettingsRow
              id="karaoke-manage"
              icon={<ExternalIcon />}
              label="Manage subscription"
              onPress={() => void open()()}
            />
          )}
        </Show>
        <SettingsRow
          id="karaoke-restore"
          icon={<RefreshIcon />}
          label="Restore purchases"
          onPress={() => void restore()}
        />
      </SettingsGroup>
      <Show when={note()}>
        {(said) => (
          <p class="mp-set__caption" role="status">
            {said()}
          </p>
        )}
      </Show>
      <SettingsGroup title="Songs on this phone">
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
