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
// says "not available yet" where the build sells nothing. A restore is said
// at once; the songs follow when the store's word reaches the server
// (awaitSubscription keeps asking for a while). The examples are part of
// the app and stay.
//
// On Android, Play's review access sits under the subscription: the code
// Google's reviewers are given (KaraokeReviewAccess.tsx).
//
// Reached only through KaraokeSettingsScreen's stand-in, which a store build
// folds away with everything this imports.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { importedSongs, removeAllImportedSongs, } from '@/features/karaoke-room/karaoke-imported-songs'
import { awaitSubscription, karaokeSongs, refreshKaraokeSongs, restoreNote, songsOptionRow, subscriptionStatusLine, } from '@/features/karaoke-room/karaoke-songs'
import { nativeShellApi } from '@/stores/native-shell-store'
import { CardIcon, ExternalIcon, NoteGlyphIcon, RefreshIcon, TrashIcon, } from '../icons'
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
    if (live) setNote(restoreNote(outcome))
    if (outcome === 'restored') {
      await awaitSubscription(async () =>
        refreshKaraokeSongs({ identify: true }),
      )
    }
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

  const openManage = async (
    open: NonNullable<ReturnType<typeof manage>>,
  ): Promise<void> => {
    setNote(null)
    const outcome = await open().catch(() => 'failed' as const)
    if (live && outcome === 'failed') {
      setNote(
        'The subscription page could not be opened. Try again in a moment.',
      )
    }
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
              onPress={() => void openManage(open())}
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
      <ReviewAccess />
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
