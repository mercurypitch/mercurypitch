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
import { QrCode } from '@/components/QrCode'
import { formatBytes } from '@/lib/fetch-progress'
import { jamSignalingIsMocked } from '@/lib/jam/signaling'
import { isCompleteRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH, } from '@/lib/room-code'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { getGroupsReactive } from '@/stores/app-store'
import type { SyncTransfer } from '@/stores/sync-store'
import { enqueueSongs, estimatePackedBytes, sendSongToPeer, startSyncReceive, startSyncSend, stopQueue, stopSync, syncBusy, syncError, syncOwnRoom, syncPeerLabel, syncPeerRoom, syncQueue, syncRoomId, syncState, syncTransfers, takeSyncCodeToJoin, } from '@/stores/sync-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import { DeviceSync } from '../icons'
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

/**
 * The URL a phone lands on when it scans the receiving device's screen.
 *
 * Built from the running origin rather than a constant, so a code shown
 * on dev pairs with dev and one shown on a preview pairs with that
 * preview -- scanning a TV and being sent to production would look like
 * the feature simply not working.
 */
function syncLinkFor(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/sync:${code}`
}

function transferStateLabel(t: SyncTransfer): string {
  switch (t.status) {
    case 'packing':
      return `Packing ${Math.round(t.ratio * 100)}%`
    case 'preparing':
      // No percentage: this side is told a song is being packed, not how
      // far along it is. "This can take a minute" is the part somebody
      // watching a still screen actually needs.
      return 'Being prepared — this can take a minute'
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
  // A code that arrived by QR skips the chooser entirely: somebody who
  // has just pointed a camera at a screen has already said what they want
  // to do, and asking them to pick "Send songs" and retype the code is
  // undoing the thing the QR was for.
  const scanned = takeSyncCodeToJoin()
  const [mode, setMode] = createSignal<SyncMode>(
    scanned !== null
      ? 'send'
      : props.initialSessionId === undefined
        ? 'choose'
        : 'send',
  )
  const [joinCode, setJoinCode] = createSignal(scanned ?? '')
  const [joining, setJoining] = createSignal(false)
  /** Songs ticked for sending. Empty means "nothing chosen yet". */
  const [picked, setPicked] = createSignal<Set<string>>(new Set())
  /**
   * Which group the list is showing, or null for everything.
   *
   * This is what "send a playlist" is. Groups already exist and every
   * song already carries one, so filtering the list to a group and
   * pressing Select all sends that group — no new concept, no new
   * storage, and it reads the same as picking songs by hand.
   */
  const [groupFilter, setGroupFilter] = createSignal<string | null>(null)
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
    // A scanned code is a complete one, so there is nothing left to ask.
    if (scanned !== null && !jamSignalingIsMocked()) join()
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

  const sendable = createMemo<UvrSession[]>(() => {
    const group = groupFilter()
    return getAllUvrSessionsReactive()
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.fileHash !== undefined &&
          s.fileHash !== '',
      )
      .filter((s) => group === null || s.groupId === group)
      .sort((a, b) => {
        // Songs that cannot land over there sink to the bottom, so the
        // list reads as "these will fit" rather than as a minefield.
        const aFits = tooBigForPeer(estimatePackedBytes(a)) ? 1 : 0
        const bFits = tooBigForPeer(estimatePackedBytes(b)) ? 1 : 0
        if (aFits !== bFits) return aFits - bFits
        return b.createdAt - a.createdAt
      })
  })

  /** Only the groups that actually contain something sendable. */
  const groupsWithSongs = createMemo(() => {
    const all = getAllUvrSessionsReactive().filter(
      (s) =>
        s.status === 'completed' &&
        s.fileHash !== undefined &&
        s.fileHash !== '',
    )
    return getGroupsReactive().filter((g) =>
      all.some((s) => s.groupId === g.id),
    )
  })

  const fits = (session: UvrSession): boolean =>
    !tooBigForPeer(estimatePackedBytes(session))

  const pickable = createMemo(() => sendable().filter(fits))

  const togglePick = (sessionId: string): void => {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const pickedSessions = createMemo(() =>
    pickable().filter((s) => picked().has(s.sessionId)),
  )

  const pickedBytes = createMemo(() =>
    pickedSessions().reduce((n, s) => n + estimatePackedBytes(s), 0),
  )

  const allPicked = (): boolean =>
    pickable().length > 0 && pickedSessions().length === pickable().length

  const toggleAll = (): void => {
    setPicked(
      allPicked()
        ? new Set<string>()
        : new Set(pickable().map((s) => s.sessionId)),
    )
  }

  /**
   * Whether the whole selection would fit over there, checked once.
   *
   * Per song is not enough: a device with room for two of six accepts two
   * and then refuses four, one at a time, each with its own error.
   */
  const selectionTooBig = (): boolean => tooBigForPeer(pickedBytes())

  const sendPicked = (): void => {
    const ids = pickedSessions().map((s) => s.sessionId)
    if (ids.length === 0) return
    enqueueSongs(ids)
    setPicked(new Set<string>())
  }

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
                    <DeviceSync />
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
                    <div class={styles.pairing}>
                      <code class={styles.code}>{code()}</code>
                      {/* The device showing this is the one that cannot
                          type; the phone pointing at it can. Scanning
                          carries the code across without anyone reading
                          eight characters off a screen from the sofa. */}
                      <div class={styles.qr}>
                        <QrCode
                          value={syncLinkFor(code())}
                          size={168}
                          label="Scan to send songs to this device"
                        />
                        <span class={styles.qrHint}>
                          or scan this with your phone
                        </span>
                      </div>
                    </div>
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
                {/* A group IS the playlist. Filtering to one and pressing
                    Select all is "send this playlist", with no new
                    concept and nothing new to store. */}
                <Show when={groupsWithSongs().length > 0}>
                  <div class={styles.groupFilter}>
                    <button
                      type="button"
                      class={styles.groupChip}
                      classList={{
                        [styles.groupChipOn!]: groupFilter() === null,
                      }}
                      onClick={() => setGroupFilter(null)}
                    >
                      All songs
                    </button>
                    <For each={groupsWithSongs()}>
                      {(group) => (
                        <button
                          type="button"
                          class={styles.groupChip}
                          classList={{
                            [styles.groupChipOn!]: groupFilter() === group.id,
                          }}
                          onClick={() =>
                            setGroupFilter(
                              groupFilter() === group.id ? null : group.id,
                            )
                          }
                        >
                          {group.name}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={pickable().length > 1}>
                  <label class={styles.selectAll}>
                    <input
                      type="checkbox"
                      checked={allPicked()}
                      onChange={toggleAll}
                    />
                    Select all
                    {groupFilter() === null ? '' : ' in this group'}
                  </label>
                </Show>

                <div class={styles.songList}>
                  <For each={sendable()}>
                    {(session) => (
                      <div
                        class={styles.songRow}
                        classList={{ [styles.songRowOut!]: !fits(session) }}
                      >
                        <Show
                          when={fits(session)}
                          fallback={<span class={styles.songCheckSpacer} />}
                        >
                          <input
                            type="checkbox"
                            class={styles.songCheck}
                            checked={picked().has(session.sessionId)}
                            aria-label={`Send ${session.originalFile?.name ?? 'this song'}`}
                            onChange={() => togglePick(session.sessionId)}
                          />
                        </Show>
                        <span
                          class={styles.songTitle}
                          title={session.originalFile?.name}
                        >
                          {session.originalFile?.name ?? 'Untitled song'}
                          <Show when={!fits(session)}>
                            <span class={styles.songNote}>
                              {' '}
                              — about{' '}
                              {formatBytes(estimatePackedBytes(session))}, too
                              big for that device
                            </span>
                          </Show>
                        </span>
                        {/* The one-song fast path stays. Ticking a box and
                            pressing a footer button to send a single song
                            would be slower than what this replaced. */}
                        <button
                          type="button"
                          class={styles.songBtn}
                          disabled={syncBusy() || !fits(session)}
                          onClick={() => void sendSongToPeer(session.sessionId)}
                        >
                          <DeviceSync /> Send
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                <Show when={pickedSessions().length > 0}>
                  <div class={styles.selectionBar}>
                    <button
                      type="button"
                      class={styles.btn}
                      disabled={selectionTooBig()}
                      onClick={sendPicked}
                    >
                      <DeviceSync /> Send {pickedSessions().length} song
                      {pickedSessions().length === 1 ? '' : 's'} —{' '}
                      {formatBytes(pickedBytes())}
                    </button>
                    <Show when={selectionTooBig()}>
                      <p class={styles.warn}>
                        That is more than {syncPeerLabel() ?? 'that device'} has
                        room for. Untick a few and try again.
                      </p>
                    </Show>
                  </div>
                </Show>

                <Show when={syncQueue().length > 0}>
                  <div class={styles.queueBar}>
                    <span>{syncQueue().length} more waiting to be sent</span>
                    <button
                      type="button"
                      class={styles.queueStop}
                      onClick={stopQueue}
                    >
                      Stop after this one
                    </button>
                  </div>
                </Show>
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
                          t.status === 'packing' ||
                          t.status === 'preparing' ||
                          t.status === 'transferring'
                        }
                      >
                        <div class={styles.bar}>
                          <div
                            class={styles.barFill}
                            classList={{
                              [styles.barIndeterminate!]:
                                t.status === 'preparing',
                            }}
                            style={
                              t.status === 'preparing'
                                ? undefined
                                : { width: `${Math.round(t.ratio * 100)}%` }
                            }
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
