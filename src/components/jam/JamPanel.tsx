// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — create/join rooms, view peers, controls.

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js'
import { createJamRoom, jamConnectedPeers, jamError, jamIsMuted, jamPeerId, jamPeers, jamPitchTab, jamRoomId, jamRoomToJoin, jamState, jamVideoEnabled, joinJamRoom, leaveJamRoom, selectJamExercise, setJamPitchTab, setJamRoomToJoin, startJamPitchDetection, toggleJamMute, toggleJamVideo, } from '@/stores/jam-store'
import { getMelodyLibrarySignal } from '@/stores/melody-store'
import { JamCameraWidget } from './JamCameraWidget'
import { JamChatWidget } from './JamChatWidget'
import { JamExerciseCanvas } from './JamExerciseCanvas'
import exerciseCanvasStyles from './JamExerciseCanvas.module.css'
import { JamExerciseControls } from './JamExerciseControls'
import { JamInviteModal } from './JamInviteModal'
import panelStyles from './JamPanel.module.css'
import { JamPeerList } from './JamPeerList'
import { JamPitchDisplay } from './JamPitchDisplay'
import { JamSharedPitchCanvas } from './JamSharedPitchCanvas'
import pitchCanvasStyles from './JamSharedPitchCanvas.module.css'

export const JamPanel: Component = () => {
  const [displayName, setDisplayName] = createSignal('')
  const [joinRoomId, setJoinRoomId] = createSignal('')
  const [showInvite, setShowInvite] = createSignal(false)
  const [joining, setJoining] = createSignal(false)
  const [showExercisePicker, setShowExercisePicker] = createSignal(false)
  const [roomCopied, setRoomCopied] = createSignal(false)
  const [linkCopied, setLinkCopied] = createSignal(false)

  const roomLink = createMemo(
    () => `${window.location.origin}/#/jam:${jamRoomId() ?? ''}`,
  )

  createEffect(() => {
    // Sync URL if active
    if (jamState() === 'active') {
      window.history.replaceState(null, '', `/#/jam:${jamRoomId()}`)
    } else if (jamState() === 'idle') {
      window.history.replaceState(null, '', '/#/jam')
    }
  })

  // Default to pitch subtab on mount
  onMount(() => {
    setJamPitchTab('pitch')
  })

  const melodyOptions = createMemo(() => {
    const lib = getMelodyLibrarySignal()()
    return Object.values(lib.melodies)
  })

  const handleCreate = () => {
    const name = displayName().trim() || 'Anonymous'
    createJamRoom(name).catch(() => {})
  }

  onMount(() => {
    const roomId = jamRoomToJoin()
    if (roomId !== null) {
      setJoinRoomId(roomId.toUpperCase())
      setJamRoomToJoin(null)
    }
  })

  createEffect(() => {
    if (jamState() === 'active') {
      startJamPitchDetection()
    }
  })

  const handleJoin = () => {
    const roomId = joinRoomId().trim().toUpperCase()
    if (!roomId) return
    setJoining(true)
    const name = displayName().trim() || 'Anonymous'
    joinJamRoom(roomId, name).finally(() => setJoining(false))
  }

  return (
    <div class="jam-panel">
      <Show when={jamState() === 'idle'}>
        <div class="jam-connect">
          <h2 class="jam-title">Jam Session</h2>
          <p class="jam-desc">
            Play music together in real-time with other PitchPerfect users.
          </p>

          <div class="jam-field">
            <label class="jam-label" for="jam-display-name">
              Display Name (used for creating & joining)
            </label>
            <input
              id="jam-display-name"
              class="jam-input"
              type="text"
              value={displayName()}
              onInput={(e) => setDisplayName(e.currentTarget.value)}
              placeholder="Anonymous"
              maxLength={24}
            />
          </div>

          <div class="jam-actions">
            <button class="jam-btn jam-btn-primary" onClick={handleCreate}>
              Create Room
            </button>
          </div>

          <div class="jam-divider">
            <span>or join existing</span>
          </div>

          <div class="jam-field">
            <label class="jam-label" for="jam-room-id">
              Room code
            </label>
            <input
              id="jam-room-id"
              class="jam-input jam-input-mono"
              type="text"
              value={joinRoomId()}
              onInput={(e) => setJoinRoomId(e.currentTarget.value)}
              placeholder="e.g. abc123"
              maxLength={32}
            />
          </div>

          <button
            class="jam-btn jam-btn-secondary"
            onClick={handleJoin}
            disabled={joining() || joinRoomId().trim() === ''}
          >
            {joining() ? 'Joining...' : 'Join Room'}
          </button>

          <Show when={jamError()}>
            <p class="jam-error">{jamError()}</p>
          </Show>
        </div>
      </Show>

      <Show when={jamState() === 'connecting'}>
        <div class="jam-connecting">
          <p>Connecting to jam room...</p>
        </div>
      </Show>

      <Show when={jamState() === 'active'}>
        <div class="jam-active">
          <div class="jam-room-header">
            <div class="jam-room-info">
              <h2 class="jam-title">Jam Room</h2>
              <div class={panelStyles.roomIdRow}>
                <span class="jam-room-id-badge">{jamRoomId()}</span>
                <button
                  class="jam-btn jam-btn-sm"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(jamRoomId() ?? '')
                      .catch(() => {})
                    setRoomCopied(true)
                    setTimeout(() => setRoomCopied(false), 2000)
                  }}
                >
                  {roomCopied() ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div class={panelStyles.roomLinkRow}>
                <code class={panelStyles.roomLink}>{roomLink()}</code>
                <button
                  class="jam-btn jam-btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(roomLink()).catch(() => {})
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 2000)
                  }}
                >
                  {linkCopied() ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
            <div class="jam-room-actions">
              {/* Microphone toggle */}
              <button
                class={`jam-icon-btn ${jamIsMuted() ? 'jam-icon-btn-off' : 'jam-icon-btn-on'}`}
                onClick={toggleJamMute}
                title={jamIsMuted() ? 'Unmute microphone' : 'Mute microphone'}
              >
                <Show
                  when={!jamIsMuted()}
                  fallback={
                    /* Mic off — crossed */
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  }
                >
                  {/* Mic on */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </Show>
              </button>

              {/* Camera toggle */}
              <button
                class={`jam-icon-btn ${jamVideoEnabled() ? 'jam-icon-btn-on' : 'jam-icon-btn-off'}`}
                onClick={() => void toggleJamVideo()}
                title={jamVideoEnabled() ? 'Turn camera off' : 'Turn camera on'}
              >
                <Show
                  when={jamVideoEnabled()}
                  fallback={
                    /* Camera off — crossed */
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A4 4 0 1 1 7.72 7.72" />
                    </svg>
                  }
                >
                  {/* Camera on */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </Show>
              </button>

              {/* Invite */}
              <button
                class="jam-icon-btn jam-icon-btn-neutral"
                onClick={() => setShowInvite(true)}
                title="Invite people"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </button>

              {/* Leave */}
              <button
                class="jam-icon-btn jam-icon-btn-danger"
                onClick={leaveJamRoom}
                title="Leave room"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          <div class="jam-status">
            <span class="jam-status-dot jam-status-dot-active" />
            <span>
              {jamConnectedPeers().length} peer
              {jamConnectedPeers().length !== 1 ? 's' : ''} connected
            </span>
            <Show when={jamIsMuted()}>
              <span class="jam-muted-indicator">(muted)</span>
            </Show>
          </div>

          {/* Pitch display — always visible */}
          <JamPitchDisplay />

          {/* Tab bar */}
          <div class={panelStyles.tabs}>
            <button
              class={`${panelStyles.tab} ${jamPitchTab() === 'pitch' ? panelStyles.tabActive : ''}`}
              onClick={() => setJamPitchTab('pitch')}
            >
              Shared Pitch
            </button>
            <button
              class={`${panelStyles.tab} ${jamPitchTab() === 'exercise' ? panelStyles.tabActive : ''}`}
              onClick={() => setJamPitchTab('exercise')}
            >
              Exercise
            </button>
          </div>

          {/* Tab content */}
          <Show when={jamPitchTab() === 'pitch'}>
            <div class={panelStyles.tabContent}>
              <JamPeerList peers={jamPeers()} />
              <div class={pitchCanvasStyles.container}>
                <JamSharedPitchCanvas myPeerId={jamPeerId} />
              </div>
            </div>
          </Show>

          <Show when={jamPitchTab() === 'exercise'}>
            <div class={panelStyles.tabContent}>
              <JamExerciseControls
                onSelectExercise={() =>
                  setShowExercisePicker(!showExercisePicker())
                }
              />
              <Show when={showExercisePicker()}>
                <div class={panelStyles.exercisePicker}>
                  <For each={melodyOptions()}>
                    {(melody) => (
                      <button
                        class={panelStyles.pickItem}
                        onClick={() => {
                          selectJamExercise(melody)
                          setShowExercisePicker(false)
                        }}
                      >
                        <span class={panelStyles.pickName}>{melody.name}</span>
                        <span class={panelStyles.pickMeta}>
                          {melody.bpm} bpm · {melody.key} {melody.scaleType}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <div class={exerciseCanvasStyles.container}>
                <JamExerciseCanvas myPeerId={jamPeerId} />
              </div>
            </div>
          </Show>

          <Show when={jamError()}>
            <p class="jam-error">{jamError()}</p>
          </Show>
        </div>
      </Show>

      <Show when={showInvite()}>
        <JamInviteModal
          roomId={jamRoomId() ?? ''}
          onClose={() => setShowInvite(false)}
        />
      </Show>

      <Show when={jamState() === 'active'}>
        <JamCameraWidget />
        <JamChatWidget />
      </Show>
    </div>
  )
}
