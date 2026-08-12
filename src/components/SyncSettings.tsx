// ── SyncSettings ──────────────────────────────────────────────────────
// Settings → Sync: what this device holds, and what the account knows.
//
// Three jobs. The first is honest reporting — how much storage this
// browser has given us and how much of it the library is using. Every
// quota figure behind the device-sync plan came from a secondary source
// that refused to be fetched; this is where the real number arrives, from
// the phone in somebody's hand.
//
// The second is whether that storage is safe. Capacity turned out not to
// be the constraint on any device measured; eviction is. A browser that
// reclaims space takes the library with it, which is the exact failure
// sync exists to prevent, so persistence gets a state and a button here.
//
// The third is the library list: how many songs are here, how many the
// account knows about, and how many of those this device cannot play.
// Drive and peer transports land in later phases — until then this page
// says what is true rather than offering a switch that does nothing.
//
// See docs/plans/device-sync.md.

import type { Component } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { storageEstimate } from '@/db/durable-write'
import { isStoragePersisted, requestPersistentStorage, } from '@/db/persistent-storage'
import { readLibraryManifests, syncLibraryList, } from '@/db/services/song-manifest-service'
import { getAllUvrSessions } from '@/stores/uvr-store'
import panel from './SettingsPanel.module.css'
import styles from './SyncSettings.module.css'

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
  const [persisted, setPersisted] = createSignal<boolean | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [asking, setAsking] = createSignal(false)
  const [refused, setRefused] = createSignal(false)
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
      setPersisted(await isStoragePersisted())
    } finally {
      setBusy(false)
      setChecked(true)
    }
  }

  onMount(() => {
    void refresh()
  })

  /**
   * Ask the browser to keep the library.
   *
   * Not `ensurePersistentStorage()`: that is the automatic follow-up to a
   * separation and spends a single attempt quietly, so a button wired to
   * it would do nothing the second time it was pressed. This is somebody
   * asking, so it asks.
   */
  const askToKeep = async (): Promise<void> => {
    setAsking(true)
    try {
      const granted = await requestPersistentStorage()
      setPersisted(await isStoragePersisted())
      // A refusal leaves every word on this page unchanged, so without
      // this the button reads as broken rather than as answered.
      setRefused(!granted)
    } finally {
      setAsking(false)
    }
  }

  const percentUsed = (): number | null => {
    const s = storage()
    if (s === null || s.quota <= 0) return null
    return Math.min(100, (s.usage / s.quota) * 100)
  }

  return (
    <>
      <div class={panel.settingsSection}>
        <h3 class={panel.settingsSectionTitle}>Storage on this device</h3>
        <div class={panel.settingsDivider} />

        <Show
          when={storage()}
          fallback={
            <p class={styles.stat}>
              <Show when={checked()} fallback="Checking…">
                This browser will not say how much storage it has given us.
              </Show>
            </p>
          }
        >
          {(s) => (
            <p class={styles.stat}>
              Using <strong>{megabytes(s().usage)}</strong> of{' '}
              <strong>{megabytes(s().quota)}</strong>
              <Show when={percentUsed()}>
                {(pct) => <> — {pct().toFixed(1)}%</>}
              </Show>
            </p>
          )}
        </Show>

        <p class={styles.note}>
          Songs, stems, lyrics and analysis all live here. A browser can clear
          this if the device runs short, so a library that only exists on one
          device is a library that can be lost.
        </p>

        <p class={styles.stat}>
          <Show
            when={persisted() !== null}
            fallback="This browser will not say whether your library is protected."
          >
            <Show
              when={persisted() === true}
              fallback="Your library is not protected from being cleared."
            >
              Your library is protected from being cleared.
            </Show>
          </Show>
        </p>

        <Show when={persisted() !== true}>
          <button
            type="button"
            class={`${panel.settingsActionBtn} ${styles.action}`}
            disabled={asking()}
            onClick={() => void askToKeep()}
          >
            {asking() ? 'Asking…' : 'Keep my library on this device'}
          </button>
          <p class={styles.note}>
            <Show
              when={refused()}
              fallback="Asks the browser for persistent storage. Some grant it silently, some show a prompt, and some decide for themselves from how often you use the app."
            >
              The browser said no for now. Most grant this once the app has been
              used a few times, or once it is installed to the home screen — it
              is worth asking again later.
            </Show>
          </p>
        </Show>
      </div>

      <div class={panel.settingsSection}>
        <h3 class={panel.settingsSectionTitle}>Your library</h3>
        <div class={panel.settingsDivider} />

        <p class={styles.stat}>
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

        <p class={styles.note}>
          Signing in shares the <em>list</em> of your songs between devices —
          titles and sizes, never the audio. The audio itself stays where it was
          made; sending it across is the next piece of this, and until then you
          can export a song here and import it there, or share one straight into
          a jam room.
        </p>

        <button
          type="button"
          class={`${panel.settingsActionBtn} ${styles.action}`}
          disabled={busy()}
          onClick={() => void refresh()}
        >
          {busy() ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </>
  )
}
