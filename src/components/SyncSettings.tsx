// ── SyncSettings ──────────────────────────────────────────────────────
// Settings → Sync: what this device holds, and what the account knows.
//
// Two jobs. The first is honest reporting — how much storage this browser
// has given us and how much of it the library is using. Every quota figure
// behind the device-sync plan came from a secondary source that refused to
// be fetched; this is where the real number arrives, from the phone in
// somebody's hand.
//
// The second is the library list itself: how many songs are here, how many
// the account knows about, and how many of those this device cannot play.
// Drive and peer transports land in later phases — until then this page
// says what is true rather than offering a switch that does nothing.
//
// See docs/plans/device-sync.md.

import type { Component } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { storageEstimate } from '@/db/durable-write'
import { readLibraryManifests, syncLibraryList, } from '@/db/services/song-manifest-service'
import { getAllUvrSessions } from '@/stores/uvr-store'
import styles from './SettingsPanel.module.css'

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

export const SyncSettings: Component = () => {
  const [storage, setStorage] = createSignal<{
    usage: number
    quota: number
  } | null>(null)
  const [here, setHere] = createSignal(0)
  const [known, setKnown] = createSignal(0)
  const [elsewhere, setElsewhere] = createSignal(0)
  const [busy, setBusy] = createSignal(false)
  const [checked, setChecked] = createSignal(false)

  const refresh = async (): Promise<void> => {
    setBusy(true)
    try {
      const sessions = getAllUvrSessions()
      setHere(sessions.filter((s) => s.status === 'completed').length)
      const missing = await syncLibraryList(sessions)
      setElsewhere(missing.length)
      setKnown((await readLibraryManifests()).length)
      setStorage(await storageEstimate())
    } finally {
      setBusy(false)
      setChecked(true)
    }
  }

  onMount(() => {
    void refresh()
  })

  const percentUsed = (): number | null => {
    const s = storage()
    if (s === null || s.quota <= 0) return null
    return Math.min(100, (s.usage / s.quota) * 100)
  }

  return (
    <>
      <div class={styles.settingsSection}>
        <h3 class={styles.settingsSectionTitle}>Storage on this device</h3>
        <div class={styles.settingsDivider} />
        <Show
          when={storage()}
          fallback={
            <p>
              <Show when={checked()} fallback="Checking…">
                This browser will not say how much storage it has given us.
              </Show>
            </p>
          }
        >
          {(s) => (
            <>
              <p>
                Using <strong>{megabytes(s().usage)}</strong> of{' '}
                <strong>{megabytes(s().quota)}</strong>
                <Show when={percentUsed()}>
                  {(pct) => <> — {pct().toFixed(1)}%</>}
                </Show>
              </p>
              <p class={styles.settingsDesc}>
                Songs, stems, lyrics and analysis all live here. A browser can
                clear this if the device runs short, so a library that only
                exists on one device is a library that can be lost.
              </p>
            </>
          )}
        </Show>
      </div>

      <div class={styles.settingsSection}>
        <h3 class={styles.settingsSectionTitle}>Your library</h3>
        <div class={styles.settingsDivider} />
        <p>
          <strong>{here()}</strong> {here() === 1 ? 'song' : 'songs'} on this
          device
          <Show when={known() > 0}>
            {' · '}
            <strong>{known()}</strong> in your account
          </Show>
          <Show when={elsewhere() > 0}>
            {' · '}
            <strong>{elsewhere()}</strong> not here yet
          </Show>
        </p>
        <p class={styles.settingsDesc}>
          Signing in shares the <em>list</em> of your songs between devices —
          titles and sizes, never the audio. The audio itself stays where it was
          made; sending it across is the next piece of this, and until then you
          can export a song here and import it there, or share one straight into
          a jam room.
        </p>
        <button
          type="button"
          class={styles.settingsActionBtn}
          disabled={busy()}
          onClick={() => void refresh()}
        >
          {busy() ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </>
  )
}
