// ── SyncDevicesModal ─────────────────────────────────────────────────
// Moving songs between two of one person's devices, over the local
// network — the user-facing half of docs/plans/device-sync.md Phase 5.
//
// The receiving device shows a code; the sending device types it. Same
// shape as inviting somebody to a jam room, because it uses the same
// rooms — but this modal never touches the microphone, playback or any
// other room furniture. Once connected, the sender pushes songs one at a
// time; every finished transfer reports its real size, time and speed,
// which are exactly the numbers the plan wants measured per device.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { formatBytes } from '@/lib/fetch-progress'
import { jamSignalingIsMocked } from '@/lib/jam/signaling'
import { isCompleteRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH, } from '@/lib/room-code'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { SyncTransfer } from '@/stores/sync-store'
import { estimatePackedBytes, sendSongToPeer, startSyncReceive, startSyncSend, stopSync, syncBusy, syncError, syncOwnRoom, syncPeerLabel, syncPeerRoom, syncRoomId, syncState, syncTransfers, } from '@/stores/sync-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import { DeviceSync, Share } from '../icons'
import styles from './SyncDevicesModal.module.css'

type SyncMode = 'choose' | 'receive' | 'send'

interface SyncDevicesModalProps {
  /** Jump straight to sending this song, from a song card's Send button. */
  initialSessionId?: string
  onClose: () => void
}

function mb(bytes: number): string {
  const value = bytes / (1024 * 1024)
  return value >= 10 ? `${Math.round(value)} MB` : `${value.toFixed(1)} MB`
}

function transferStateLabel(t: SyncTransfer): string {
  switch (t.status) {
    case 'packing':
      return `Packing ${Math.round(t.ratio * 100)}%`
    case 'transferring':
      return `${t.direction === 'out' ? 'Sending' : 'Receiving'} ${Math.round(t.ratio * 100)}%`
    case 'done':
      return t.direction === 'out' ? 'Sent' : 'In your library'
    case 'already':
      return t.direction === 'out'
        ? 'Already on that device'
        : 'Already in this library'
    case 'failed':
      return 'Did not finish'
  }
}

/** "11.2 MB in 4.8 s — 2.3 MB/s", once a transfer has numbers to show. */
function transferNumbers(t: SyncTransfer): string | null {
  if (t.status !== 'done' || t.elapsedMs === undefined) return null
  const seconds = (t.elapsedMs / 1000).toFixed(1)
  const speed = (t.mbps ?? 0).toFixed(1)
  return `${mb(t.bytes)} in ${seconds} s — ${speed} MB/s`
}

export const SyncDevicesModal: Component<SyncDevicesModalProps> = (props) => {
  const [mode, setMode] = createSignal<SyncMode>(
    props.initialSessionId === undefined ? 'choose' : 'send',
  )
  const [joinCode, setJoinCode] = createSignal('')
  const [joining, setJoining] = createSignal(false)
  let dialogRef: HTMLDivElement | undefined
  // The song this modal was opened for is sent exactly once, on the first
  // connect — not again after every reconnect wobble.
  let initialSent = false

  const close = (): void => {
    stopSync()
    props.onClose()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => true,
    onClose: close,
  })

  // Leaving the tab with the modal open must not leave a room behind.
  onCleanup(() => stopSync())

  onMount(() => {
    if (mode() === 'receive' && !jamSignalingIsMocked()) void startSyncReceive()
  })

  const enterReceive = (): void => {
    setMode('receive')
    void startSyncReceive()
  }

  const join = (): void => {
    const code = normalizeRoomCode(joinCode())
    if (code === '' || joining()) return
    setJoining(true)
    void startSyncSend(code).finally(() => setJoining(false))
  }

  createEffect(() => {
    if (
      syncState() === 'connected' &&
      !initialSent &&
      props.initialSessionId !== undefined
    ) {
      initialSent = true
      void sendSongToPeer(props.initialSessionId)
    }
  })

  const sendable = createMemo<UvrSession[]>(() =>
    getAllUvrSessionsReactive()
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.fileHash !== undefined &&
          s.fileHash !== '',
      )
      .sort((a, b) => b.createdAt - a.createdAt),
  )

  const connected = () => syncState() === 'connected'

  /**
   * Whether a song of this size would be refused over there.
   *
   * Only ever true on a KNOWN shortage: a device that will not report its
   * quota must not have every song greyed out. Passing 0 asks the same
   * question about the device rather than about a song.
   */
  const tooBigForPeer = (bytes: number): boolean => {
    const room = syncPeerRoom()
    return room !== null && bytes > 0 && room.freeBytes < bytes
  }

  /** True when the far device has less room than a typical song needs. */
  const lowOnRoom = (): boolean => {
    const room = syncPeerRoom()
    return room !== null && room.freeBytes < 20 * 1024 * 1024
  }

  const receiveStatus = (): string => {
    if (connected()) return `Connected: ${syncPeerLabel() ?? 'another device'}`
    if (syncState() === 'waiting')
      return 'Waiting for your other device to enter the code…'
    // Idle with no code means the session ended before it started; the
    // reason is already in syncError, so do not claim to be opening one.
    if (syncState() === 'idle') return 'The sync session is not open.'
    return 'Opening a sync session…'
  }

  return (
    <Portal>
      <div class={styles.overlay} onClick={close}>
        <div
          ref={dialogRef}
          class={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="Sync with another device"
          onClick={(e) => e.stopPropagation()}
        >
          <div class={styles.header}>
            <h3>Sync with another device</h3>
            <button
              type="button"
              class={styles.close}
              onClick={close}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div class={styles.body}>
            {/* A preview build has no room server, and the mock invents
                peers that no song can actually reach. Saying so is the
                only honest thing to show: a code that can never be
                answered looks exactly like a broken feature. */}
            <Show when={jamSignalingIsMocked()}>
              <p class={styles.hint}>
                This is a preview build without the room server, so devices
                cannot find each other here. Device sync works on the real app,
                where both devices are on the same Wi-Fi.
              </p>
            </Show>

            <Show when={mode() === 'choose' && !jamSignalingIsMocked()}>
              <div class={styles.choices}>
                <button
                  type="button"
                  class={styles.choice}
                  onClick={enterReceive}
                >
                  <span class={styles.choiceIcon}>
                    <DeviceSync size={28} />
                  </span>
                  <span>
                    <strong>Receive songs on this device</strong>
                    <span>
                      Shows a code to enter on the device that has the songs.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  class={styles.choice}
                  onClick={() => setMode('send')}
                >
                  <span class={styles.choiceIcon}>
                    <Share />
                  </span>
                  <span>
                    <strong>Send songs from this device</strong>
                    <span>
                      Enter the code shown on the device that should get them.
                    </span>
                  </span>
                </button>
              </div>
              <p class={styles.hint}>
                Both devices need to be on the same Wi-Fi. Songs travel directly
                between them — nothing is uploaded anywhere.
              </p>
            </Show>

            <Show when={mode() === 'receive' && !jamSignalingIsMocked()}>
              <Show
                when={syncRoomId()}
                fallback={
                  <>
                    <p class={styles.status}>{receiveStatus()}</p>
                    {/* A session that never opened leaves nothing on
                        screen to act on. Without this the only way out is
                        closing the modal, which is not obviously a retry. */}
                    <Show when={syncState() === 'idle'}>
                      <button
                        type="button"
                        class={styles.btn}
                        onClick={enterReceive}
                      >
                        Try again
                      </button>
                    </Show>
                  </>
                }
              >
                {(code) => (
                  <>
                    <code class={styles.code}>{code()}</code>
                    <p
                      class={`${styles.status} ${connected() ? styles.statusConnected : ''}`}
                    >
                      {receiveStatus()}
                    </p>
                    <Show when={!connected()}>
                      <p class={styles.hint}>
                        On the device with your songs, open Karaoke, press the
                        sync button, choose “Send songs”, and enter this code.
                      </p>
                    </Show>
                    {/* This device's own allowance, said plainly on the
                        screen that is about to receive songs. A TV in
                        testing allowed 16 MB in total, and the only sign
                        was a stem that would not save at the very end. */}
                    <Show when={syncOwnRoom()}>
                      {(room) => (
                        <p
                          class={
                            room().freeBytes < 20 * 1024 * 1024
                              ? styles.warn
                              : styles.hint
                          }
                        >
                          This device has {formatBytes(room().freeBytes)} free
                          for songs
                          <Show when={room().quota > 0}>
                            {' '}
                            (of {formatBytes(room().quota)} the browser allows)
                          </Show>
                          .
                          <Show when={room().freeBytes < 20 * 1024 * 1024}>
                            {' '}
                            That is not much — most songs need 5-15 MB, and a
                            long one more.
                          </Show>
                        </p>
                      )}
                    </Show>
                  </>
                )}
              </Show>
            </Show>

            <Show when={mode() === 'send' && !jamSignalingIsMocked()}>
              <Show
                when={connected()}
                fallback={
                  <>
                    <div class={styles.joinRow}>
                      <input
                        class={styles.joinInput}
                        type="text"
                        placeholder="Code from the other device"
                        value={joinCode()}
                        maxLength={ROOM_CODE_LENGTH}
                        autocapitalize="characters"
                        autocomplete="off"
                        spellcheck={false}
                        onInput={(e) => {
                          // Normalized as it is typed, not at submit: a
                          // room id is a case-sensitive Durable Object
                          // name, so a lowercase code opens a different,
                          // empty room instead of failing. Rewriting the
                          // field also shows the person what will be
                          // sent.
                          const code = normalizeRoomCode(e.currentTarget.value)
                          e.currentTarget.value = code
                          setJoinCode(code)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') join()
                        }}
                      />
                      <button
                        type="button"
                        class={styles.btn}
                        disabled={!isCompleteRoomCode(joinCode()) || joining()}
                        onClick={join}
                      >
                        {joining() || syncState() === 'starting'
                          ? 'Connecting…'
                          : 'Connect'}
                      </button>
                    </div>
                    <p class={styles.hint}>
                      On the device that should receive the songs, open Karaoke,
                      press the sync button and choose “Receive songs” — it
                      shows the code to enter here.
                    </p>
                    <Show when={syncState() === 'waiting'}>
                      <p class={styles.status}>
                        Connecting to the other device…
                      </p>
                    </Show>
                  </>
                }
              >
                <p class={`${styles.status} ${styles.statusConnected}`}>
                  Connected: {syncPeerLabel() ?? 'another device'}
                  <Show when={syncPeerRoom()}>
                    {(room) => <> — {formatBytes(room().freeBytes)} free</>}
                  </Show>
                </p>
                {/* Said before anything is chosen, because the failure this
                    answers is a song that packs for minutes and then cannot
                    land: a TV in testing allowed 16 MB in total. */}
                <Show when={tooBigForPeer(0) === false && lowOnRoom()}>
                  <p class={styles.warn}>
                    That device is nearly full. Songs it cannot hold are marked
                    below.
                  </p>
                </Show>
                <div class={styles.songList}>
                  <For each={sendable()}>
                    {(session) => (
                      <div class={styles.songRow}>
                        <span
                          class={styles.songTitle}
                          title={session.originalFile?.name}
                        >
                          {session.originalFile?.name ?? 'Untitled song'}
                          <Show
                            when={tooBigForPeer(estimatePackedBytes(session))}
                          >
                            <span class={styles.songNote}>
                              {' '}
                              — about{' '}
                              {formatBytes(estimatePackedBytes(session))}, too
                              big for that device
                            </span>
                          </Show>
                        </span>
                        <button
                          type="button"
                          class={styles.songBtn}
                          disabled={
                            syncBusy() ||
                            tooBigForPeer(estimatePackedBytes(session))
                          }
                          onClick={() => void sendSongToPeer(session.sessionId)}
                        >
                          <Share /> Send
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>

            <Show when={syncTransfers().length > 0}>
              <div class={styles.transfers}>
                <For each={syncTransfers()}>
                  {(t) => (
                    <div class={styles.transfer}>
                      <div class={styles.transferHead}>
                        <span class={styles.transferTitle} title={t.title}>
                          {t.title}
                        </span>
                        <span
                          class={`${styles.transferState} ${
                            t.status === 'done' || t.status === 'already'
                              ? styles.transferDone
                              : t.status === 'failed'
                                ? styles.transferFailed
                                : ''
                          }`}
                        >
                          {transferStateLabel(t)}
                        </span>
                      </div>
                      <Show
                        when={
                          t.status === 'packing' || t.status === 'transferring'
                        }
                      >
                        <div class={styles.bar}>
                          <div
                            class={styles.barFill}
                            style={{ width: `${Math.round(t.ratio * 100)}%` }}
                          />
                        </div>
                      </Show>
                      <Show when={transferNumbers(t)}>
                        {(numbers) => (
                          <p class={styles.transferNote}>{numbers()}</p>
                        )}
                      </Show>
                      <Show when={t.status === 'failed' && t.message}>
                        {(message) => (
                          <p class={styles.transferNote}>{message()}</p>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={syncError()}>
              {(message) => <p class={styles.error}>{message()}</p>}
            </Show>
          </div>
        </div>
      </div>
    </Portal>
  )
}

export default SyncDevicesModal
