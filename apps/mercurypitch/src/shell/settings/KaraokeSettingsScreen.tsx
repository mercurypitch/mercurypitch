// ============================================================
// KaraokeSettingsScreen — the Karaoke room's settings, from Settings
// ============================================================
//
// Settings, Rooms, Karaoke (plan S8 §9). The room keeps its options behind
// its own gear; these are the two of them a singer may look for here
// instead, the size of the lyrics and whether the next song follows. One
// store under both (karaoke-room-store.ts), so what is set in one place is
// what the other shows.
//
// A build that imports songs (Stage 2) adds two groups above them: the
// subscription, and the songs on this phone. The subscription's status and
// the songs left are what /me last said; Manage and Restore go to the store
// through the shell (karaoke-subscription.ts), and Restore says "not
// available yet" until the store is real. Remove imported songs asks first;
// the examples are part of the app and stay.

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { importedSongs, removeAllImportedSongs, } from '@/features/karaoke-room/karaoke-imported-songs'
import { KARAOKE_LYRICS_SIZE_LABELS, karaokeLyricsSize, karaokePlayNext, setKaraokeLyricsSize, setKaraokePlayNext, } from '@/features/karaoke-room/karaoke-room-store'
import { karaokeSongs, refreshKaraokeSongs, restoreNote, songsOptionRow, subscriptionStatusLine, } from '@/features/karaoke-room/karaoke-songs'
import { ZEN_LYRICS_SIZES } from '@/features/stem-mixer/zen-navigation'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { nativeShellApi } from '@/stores/native-shell-store'
import { CardIcon, ExternalIcon, NoteGlyphIcon, RefreshIcon, TrashIcon, } from '../icons'
import { importedSongsValue, removeImportedQuestion, songsStuckLine, } from './imported-songs-copy'
import { askSettings } from './settings-alert'
import { SettingsChoice, SettingsGroup, SettingsRow } from './SettingsList'
import { SettingsSwitch } from './SettingsSwitch'

/** Stage 2: the subscription, and the songs on this phone. */
function KaraokeSongsGroups(): JSX.Element {
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

export function KaraokeSettingsScreen(): JSX.Element {
  return (
    <div class="mp-set" data-testid="karaoke-settings-screen">
      <Show when={KARAOKE_IMPORT}>
        <KaraokeSongsGroups />
      </Show>
      <section class="mp-set-group" aria-label="Lyrics">
        <h2 class="mp-set-group__title">Lyrics</h2>
        <div class="mp-set-list" role="radiogroup" aria-label="Lyrics size">
          <For each={ZEN_LYRICS_SIZES}>
            {(size) => (
              <SettingsChoice
                id={size}
                label={KARAOKE_LYRICS_SIZE_LABELS[size]}
                checked={karaokeLyricsSize() === size}
                onChoose={() => {
                  setKaraokeLyricsSize(size)
                }}
              />
            )}
          </For>
        </div>
      </section>
      <SettingsGroup title="Playback">
        <SettingsRow
          id="karaoke-play-next"
          label="Play the next song automatically"
          sub="When a song ends, the next one in the list starts"
          accessory={
            <SettingsSwitch
              checked={karaokePlayNext()}
              label="Play the next song automatically"
              onChange={(next) => {
                setKaraokePlayNext(next)
              }}
            />
          }
        />
      </SettingsGroup>
    </div>
  )
}
