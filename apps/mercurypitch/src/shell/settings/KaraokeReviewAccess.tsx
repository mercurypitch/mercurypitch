// ============================================================
// Settings, Karaoke: Play review access, on Android only
// ============================================================
//
// Google Play's reviewers cannot buy. Play Console's "App access" field gives
// them a code and says where to type it: here. The server grants a few songs
// for it, once per account (karaoke-review-access.ts, and the db-worker's
// review-access.ts), and the songs left update as for any other grant.
//
// Drawn on Android alone. An iOS app unlocks what it sells through in-app
// purchase only (App Store guideline 3.1.1), so an iOS build leaves all of
// this out when it is built (IN_A_PLAY_BUILD, folded in KaraokeSongsGroups),
// and at run time the platform decides again; the server refuses every other
// origin too.
//
// Part of the Karaoke room's Stage 2 (vite.config.ts KARAOKE_STAGE_2): reached
// only through KaraokeSongsGroups, which a store build without Import folds
// away.

import { Capacitor } from '@capacitor/core'
import type { JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { redeemReviewAccess, reviewAccessLine, } from '@/features/karaoke-room/karaoke-review-access'
import { refreshKaraokeSongs } from '@/features/karaoke-room/karaoke-songs'
import { LockIcon } from '../icons'
import { SettingsGroup, SettingsRow } from './SettingsList'

/** False in a build made for iOS, so none of this is in its bundle. CI names
 *  every native build's platform (capacitor-app.yml); a local build names
 *  none, and the platform it runs on decides. */
export const IN_A_PLAY_BUILD: boolean =
  import.meta.env.VITE_MERCURYPITCH_NATIVE_PLATFORM !== 'ios'

/** Whether this phone shows review access: an Android build, on Android. */
export function reviewAccessShown(
  platform: string = Capacitor.getPlatform(),
): boolean {
  return IN_A_PLAY_BUILD && platform === 'android'
}

export function KaraokeReviewAccess(): JSX.Element {
  const [open, setOpen] = createSignal(false)
  const [code, setCode] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [said, setSaid] = createSignal<string | null>(null)
  let live = true
  onCleanup(() => {
    live = false
  })

  const typed = (): string => code().trim()

  async function redeem(): Promise<void> {
    if (busy() || typed() === '') return
    setBusy(true)
    setSaid(null)
    const outcome = await redeemReviewAccess(typed())
    if (outcome.kind !== 'refused') await refreshKaraokeSongs()
    if (!live) return
    setBusy(false)
    setSaid(reviewAccessLine(outcome))
    if (outcome.kind !== 'refused') setCode('')
  }

  return (
    <>
      <SettingsGroup title="App review">
        <SettingsRow
          id="karaoke-review-access"
          icon={<LockIcon />}
          label="Review access"
          sub="For Google Play's reviewers"
          onPress={() => setOpen(!open())}
        />
      </SettingsGroup>
      <Show when={open()}>
        <form
          class="mp-set"
          data-testid="karaoke-review-access-form"
          onSubmit={(event) => {
            event.preventDefault()
            void redeem()
          }}
        >
          <label class="mp-field">
            <span class="mp-field__label">Review code</span>
            <input
              class="mp-field__input"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              value={code()}
              onInput={(event) => setCode(event.currentTarget.value)}
              disabled={busy()}
              data-testid="karaoke-review-code"
            />
          </label>
          <Show when={said()}>
            {(line) => (
              <p class="mp-set__caption" role="status">
                {line()}
              </p>
            )}
          </Show>
          <button
            type="submit"
            class="mp-set-button"
            disabled={busy() || typed() === ''}
            data-testid="karaoke-review-redeem"
          >
            {busy() ? 'Checking…' : 'Redeem'}
          </button>
        </form>
      </Show>
    </>
  )
}
