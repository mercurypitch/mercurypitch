// ============================================================
// KaraokeSettingsScreen — the Karaoke room's settings, from Settings
// ============================================================
//
// Settings, Rooms, Karaoke (plan S8 §9). The room keeps its options behind
// its own gear; these are the two of them a singer may look for here
// instead, the size of the lyrics and whether the next song follows. One
// store under both (karaoke-room-store.ts), so what is set in one place is
// what the other shows. Whether a song keeps playing behind another app is
// here only: it is set once, not per song. So is whether leaving the app
// mid-song keeps the lyrics in a small window, which is Android's alone: iOS
// has picture-in-picture for video only, so an iPhone is not offered it.
//
// A build that imports songs (Stage 2) adds two groups above them, the
// subscription and the songs on this phone (KaraokeSongsGroups.tsx).

import { Capacitor } from '@capacitor/core'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { KARAOKE_LYRICS_SIZE_LABELS, karaokeBackgroundPlay, karaokeLyricsSize, karaokePictureInPicture, karaokePlayNext, setKaraokeBackgroundPlay, setKaraokeLyricsSize, setKaraokePictureInPicture, setKaraokePlayNext, } from '@/features/karaoke-room/karaoke-room-store'
import { ZEN_LYRICS_SIZES } from '@/features/stem-mixer/zen-navigation'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { KaraokeSongsGroups } from './KaraokeSongsGroups'
import { SettingsChoice, SettingsGroup, SettingsRow } from './SettingsList'
import { SettingsSwitch } from './SettingsSwitch'

/**
 * Stage 2's two groups. A plain conditional on the constant, which a store
 * build folds to nothing, so KaraokeSongsGroups and all it reaches drop out
 * of that bundle (a `<Show when={KARAOKE_IMPORT}>` would keep its children).
 */
const SongsGroups = (): JSX.Element =>
  KARAOKE_IMPORT ? <KaraokeSongsGroups /> : null

/** Whether this phone is offered the lyrics window: Android only. */
export function lyricsWindowShown(
  platform: string = Capacitor.getPlatform(),
): boolean {
  return platform === 'android'
}

export interface KaraokeSettingsScreenProps {
  /** Test seam. The phone's own platform otherwise. */
  readonly platform?: string
}

export function KaraokeSettingsScreen(
  props: KaraokeSettingsScreenProps = {},
): JSX.Element {
  return (
    <div class="mp-set" data-testid="karaoke-settings-screen">
      <SongsGroups />
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
        <SettingsRow
          id="karaoke-background-play"
          label="Keep playing in the background"
          sub="The song carries on when you switch apps or lock the screen"
          accessory={
            <SettingsSwitch
              checked={karaokeBackgroundPlay()}
              label="Keep playing in the background"
              onChange={(next) => {
                setKaraokeBackgroundPlay(next)
              }}
            />
          }
        />
        <Show when={lyricsWindowShown(props.platform)}>
          <SettingsRow
            id="karaoke-picture-in-picture"
            label="Show lyrics in a small window"
            sub="When you leave the app during a song, the lyrics stay in a corner of the screen"
            accessory={
              <SettingsSwitch
                checked={karaokePictureInPicture()}
                label="Show lyrics in a small window"
                onChange={(next) => {
                  setKaraokePictureInPicture(next)
                }}
              />
            }
          />
        </Show>
      </SettingsGroup>
    </div>
  )
}
