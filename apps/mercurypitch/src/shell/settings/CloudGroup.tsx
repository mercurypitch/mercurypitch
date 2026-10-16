// ============================================================
// Settings: Mercury Pitch Cloud, the standing row (plan S7b §5)
// ============================================================
//
// Where Settings answers for the subscription, whatever uses it: the Karaoke
// room's own songs, and the premium exercises that ride the same one (owner,
// 9 Oct). How it stands, the songs left, "See the plan" for a singer without
// it, Manage where the store has a page for it, and Restore purchase.
//
// The status and the songs left are what /me last said. "See the plan"
// opens the same offer the Karaoke room's Import does (CloudOffer.tsx), and
// asks first, as every offer does (cloud-offer-store askBeforeOffering): a
// purchase the server has not heard of yet opens what follows a yes, never
// the offer again (S7 §3.9). Manage and Restore go to the store through the
// shell (karaoke-subscription.ts), and Restore says "not available yet"
// where the build sells nothing. A restore is said at once; the songs follow
// when the store's word reaches the server (awaitSubscription keeps asking
// for a while).
//
// Stage 2. SettingsScreen reaches it through a plain conditional on
// KARAOKE_IMPORT, which a store build folds away with all this imports.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { askBeforeOffering, openCloudOffer, } from '@/features/karaoke-room/cloud-offer-store'
import { CLOUD_OFFER_TITLE } from '@/features/karaoke-room/CloudOffer'
import { awaitSubscription, CLOUD_NAME, karaokeSongs, refreshKaraokeSongs, restoreNote, songsOnTheWay, songsOptionRow, subscriptionStatusLine, } from '@/features/karaoke-room/karaoke-songs'
import { nativeShellApi } from '@/stores/native-shell-store'
import { CardIcon, CloudIcon, ExternalIcon, NoteGlyphIcon, RefreshIcon, } from '../icons'
import { SettingsGroup, SettingsRow } from './SettingsList'

export function CloudGroup(): JSX.Element {
  const [note, setNote] = createSignal<string | null>(null)
  const [asking, setAsking] = createSignal(false)
  let live = true
  onCleanup(() => {
    live = false
  })

  onMount(() => {
    void refreshKaraokeSongs()
  })

  const subscription = () => nativeShellApi()?.karaokeSubscription

  /** The offer, once the server and the store have been asked. */
  const seePlan = async (): Promise<void> => {
    setNote(null)
    if (songsOnTheWay()) {
      openCloudOffer('settings', 'subscribed')
      return
    }
    setAsking(true)
    const { songs, storeHolds } = await askBeforeOffering()
    setAsking(false)
    if (!live) return
    if (storeHolds) openCloudOffer('settings', 'subscribed')
    else if (!songs.subscribed) openCloudOffer('settings')
  }

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
      <SettingsGroup title={CLOUD_NAME}>
        <SettingsRow
          id="cloud-status"
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
              id="cloud-songs-left"
              icon={<NoteGlyphIcon />}
              label={songs().label}
              value={songs().value}
            />
          )}
        </Show>
        <Show when={!karaokeSongs().subscribed}>
          <SettingsRow
            id="cloud-plan"
            icon={<CloudIcon />}
            label="See the plan"
            sub={CLOUD_OFFER_TITLE}
            onPress={() => {
              if (!asking()) void seePlan()
            }}
          />
        </Show>
        <Show when={manage()}>
          {(open) => (
            <SettingsRow
              id="cloud-manage"
              icon={<ExternalIcon />}
              label="Manage subscription"
              onPress={() => void openManage(open())}
            />
          )}
        </Show>
        <SettingsRow
          id="cloud-restore"
          icon={<RefreshIcon />}
          label="Restore purchase"
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
    </>
  )
}
