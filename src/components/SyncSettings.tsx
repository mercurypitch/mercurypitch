// ── SyncSettings ──────────────────────────────────────────────────────
// Settings → Sync: what this device holds, and what the account knows.
//
// Four jobs. The first is honest reporting — how much storage this
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
//
// The fourth is Google Drive — the transport that answers the question
// the other three only describe. A device can be lost; a Drive folder
// survives it.
//
// See docs/plans/device-sync.md.

import type { Component } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { storageEstimate } from '@/db/durable-write'
import { isStoragePersisted, requestPersistentStorage, } from '@/db/persistent-storage'
import { hasUpgradedAccount, takeDriveConnectResult, } from '@/db/services/auth-service'
import { readLibraryManifests, syncLibraryList, } from '@/db/services/song-manifest-service'
import { isStandalone, needsIosInstallHint } from '@/lib/pwa-install'
import { backUpToDrive, connectDrive, disconnectDriveSync, driveBusy, driveEmail, driveError, driveJob, driveScan, driveState, refreshDriveStatus, restoreFromDrive, scanDrive, stopDriveJob, } from '@/stores/drive-sync-store'
import { getAllUvrSessions } from '@/stores/uvr-store'
import { InstallAppButton } from './InstallAppButton'
import panel from './SettingsPanel.module.css'
import styles from './SyncSettings.module.css'

/** Why a connect attempt came back without a grant. */
const CONNECT_REFUSALS: Record<string, string> = {
  declined: 'Google Drive access was not granted.',
  no_refresh_token:
    'Google did not return lasting access. Try again, and choose the account rather than a saved session.',
  store_failed: 'Drive access could not be saved. Please try again.',
}

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
  const [connectRefusal, setConnectRefusal] = createSignal<string | null>(null)

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
    if (!hasUpgradedAccount()) return
    // A connect attempt that came back refused left its reason in the
    // redirect; without this the page would simply still say
    // "not connected" and the button would look broken.
    const connectResult = takeDriveConnectResult()
    if (connectResult !== null && !connectResult.ok) {
      setConnectRefusal(
        CONNECT_REFUSALS[connectResult.error] ??
          'Google Drive could not be connected.',
      )
    }
    void refreshDriveStatus().then(() => {
      // Straight into the comparison on the way back from a successful
      // connect: the person pressed a button expecting to see their
      // songs, not another button.
      if (connectResult?.ok === true && driveState() === 'connected') {
        void scanDrive()
      }
    })
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

  /** Whether this device is an iPhone or iPad that can only self-install. */
  const iosHint = (): boolean => needsIosInstallHint()

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

        {/* The iPhone answer, and it is not a workaround: adding to the
            Home Screen is what makes Safari grant persistence, measured on a
            real device. Safari also purges script-writable storage after
            about a week without a visit, and a home-screen app is the
            documented exemption — so on iOS this is the difference between
            a library that survives and one that quietly does not. */}
        <Show when={!isStandalone() && (persisted() !== true || iosHint())}>
          <div class={styles.install}>
            <p class={styles.note}>
              <Show
                when={iosHint()}
                fallback="Installing the app makes browsers far more willing to keep your library, and it opens without browser chrome, so there is more room for the words."
              >
                On an iPhone or iPad, adding MercuryPitch to the Home Screen is
                what lets Safari keep your library — and it opens without the
                browser chrome, so there is more room for the words. Until there
                is a native app, this is the way to do it.
              </Show>
            </p>
            <InstallAppButton variant="panel" />
          </div>
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
          titles and sizes, never the audio. To move the audio itself, back it
          up to your Google Drive below, send it straight to another device from
          the Karaoke tab, or export a song here and import it there.
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

      <div class={panel.settingsSection}>
        <h3 class={panel.settingsSectionTitle}>Google Drive</h3>
        <div class={panel.settingsDivider} />

        <Show
          when={hasUpgradedAccount()}
          fallback={
            <p class={styles.note}>
              Sign in to back your library up to your own Google Drive. The
              songs go to your Drive, not to us — but the connection belongs to
              an account, so there has to be one.
            </p>
          }
        >
          <Show when={driveState() !== 'connected'}>
            <p class={styles.note}>
              Back your songs up to a folder in your own Google Drive, and get
              them back on any device you sign in on. The audio goes from this
              browser straight to Google — it never passes through our servers,
              and we only ever see the folder we created.
            </p>
            <div class={styles.actions}>
              <button
                type="button"
                class={panel.settingsActionBtn}
                onClick={() => connectDrive()}
              >
                Connect Google Drive
              </button>
            </div>
            <Show when={connectRefusal()}>
              {(reason) => <p class={styles.warn}>{reason()}</p>}
            </Show>
          </Show>

          <Show when={driveState() === 'connected'}>
            <p class={styles.stat}>
              Connected
              <Show when={driveEmail()}>{(email) => <> as {email()}</>}</Show>
            </p>

            <Show when={driveScan()}>
              {(scan) => (
                <p class={styles.stat}>
                  <strong>{scan().inDrive}</strong>{' '}
                  {scan().inDrive === 1 ? 'song' : 'songs'} in Drive
                  <Show when={scan().toBackUp.length > 0}>
                    {' · '}
                    <strong>{scan().toBackUp.length}</strong> here not backed up
                  </Show>
                  <Show when={scan().toRestore.length > 0}>
                    {' · '}
                    <strong>{scan().toRestore.length}</strong> in Drive not here
                  </Show>
                  <Show
                    when={
                      scan().toBackUp.length === 0 &&
                      scan().toRestore.length === 0
                    }
                  >
                    {' — everything matches'}
                  </Show>
                </p>
              )}
            </Show>

            <Show when={driveJob()}>
              {(job) => (
                <div class={styles.progress}>
                  <div class={styles.progressLabel}>
                    <span class={styles.progressTitle}>
                      {job().kind === 'backup' ? 'Backing up' : 'Restoring'}
                      {job().title === '' ? '' : ` ${job().title}`}
                    </span>
                    <span class={styles.progressCount}>
                      {job().done} / {job().total}
                    </span>
                  </div>
                  <div class={styles.progressTrack}>
                    <div
                      class={styles.progressFill}
                      style={{
                        // Whole songs plus the fraction through this one:
                        // a bar that only moved between songs would sit
                        // still for the minutes a song takes to pack.
                        width: `${Math.min(
                          100,
                          ((job().done + job().ratio) /
                            Math.max(1, job().total)) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <Show when={job().failed > 0}>
                    <p class={styles.warn}>
                      {job().failed} {job().failed === 1 ? 'song' : 'songs'}{' '}
                      could not be moved; the rest are still going.
                    </p>
                  </Show>
                </div>
              )}
            </Show>

            <div class={styles.actions}>
              <Show
                when={driveJob() === null}
                fallback={
                  <button
                    type="button"
                    class={panel.settingsActionBtn}
                    onClick={() => stopDriveJob()}
                  >
                    Stop
                  </button>
                }
              >
                <button
                  type="button"
                  class={panel.settingsActionBtn}
                  disabled={driveBusy()}
                  onClick={() => void scanDrive()}
                >
                  {driveBusy() ? 'Checking…' : 'Check Drive'}
                </button>
                <Show when={(driveScan()?.toBackUp.length ?? 0) > 0}>
                  <button
                    type="button"
                    class={panel.settingsActionBtn}
                    disabled={driveBusy()}
                    onClick={() => void backUpToDrive()}
                  >
                    Back up {driveScan()?.toBackUp.length}{' '}
                    {driveScan()?.toBackUp.length === 1 ? 'song' : 'songs'}
                  </button>
                </Show>
                <Show when={(driveScan()?.toRestore.length ?? 0) > 0}>
                  <button
                    type="button"
                    class={panel.settingsActionBtn}
                    disabled={driveBusy()}
                    onClick={() => void restoreFromDrive()}
                  >
                    Restore {driveScan()?.toRestore.length}{' '}
                    {driveScan()?.toRestore.length === 1 ? 'song' : 'songs'}
                  </button>
                </Show>
                <button
                  type="button"
                  class={panel.settingsActionBtn}
                  disabled={driveBusy()}
                  onClick={() => void disconnectDriveSync()}
                >
                  Disconnect
                </button>
              </Show>
            </div>

            <Show when={driveError()}>
              {(message) => <p class={styles.warn}>{message()}</p>}
            </Show>

            <p class={styles.note}>
              Songs are stored in a MercuryPitch folder you can open in Drive —
              one file each, at the portable quality, with the lyrics and
              analysis alongside. Backing up and restoring both work a piece at
              a time, so a lost connection costs the piece rather than the song.
            </p>
          </Show>
        </Show>
      </div>
    </>
  )
}
