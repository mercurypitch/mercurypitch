// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — tabless layout with collapsible sidebar.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onMount, Show, } from 'solid-js'
import { createJamRoom, jamConnectedPeers, jamError, jamExerciseBpm, jamExerciseLoop, jamExerciseMelody, jamIsMuted, jamPeerId, jamPeers, jamRoomId, jamRoomToJoin, jamState, jamVideoEnabled, joinJamRoom, leaveJamRoom, selectJamExercise, setJamExerciseBpm, setJamExerciseLoop, setJamRoomToJoin, startJamPitchDetection, toggleJamMute, toggleJamVideo, } from '@/stores/jam-store'
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
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const [showLivePitch, setShowLivePitch] = createSignal(true)

  const roomLink = createMemo(
    () => `${window.location.origin}/#/jam:${jamRoomId() ?? ''}`,
  )

  createEffect(() => {
    if (jamState() === 'active') {
      window.history.replaceState(null, '', `/#/jam:${jamRoomId()}`)
    } else if (jamState() === 'idle') {
      window.history.replaceState(null, '', '/#/jam')
    }
  })

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
      // Auto-select the first available melody if none is loaded yet
      if (jamExerciseMelody() === null) {
        const first = melodyOptions()[0]
        if (first !== undefined) selectJamExercise(first)
      }
    }
  })

  const melodyOptions = createMemo(() => {
    const lib = getMelodyLibrarySignal()()
    return Object.values(lib.melodies)
  })

  const handleCreate = () => {
    const name = displayName().trim() || 'Anonymous'
    createJamRoom(name).catch(() => {})
  }

  const handleJoin = () => {
    const roomId = joinRoomId().trim().toUpperCase()
    if (!roomId) return
    setJoining(true)
    const name = displayName().trim() || 'Anonymous'
    joinJamRoom(roomId, name).finally(() => setJoining(false))
  }

  return (
    <div class="jam-panel">
      {/* ── Idle: connect screen ─────────────────────────────────── */}
      <Show when={jamState() === 'idle'}>
        <div class="jam-connect">
          <h2 class="jam-title">Jam Session</h2>
          <p class="jam-desc">
            Play music together in real-time with other PitchPerfect users.
          </p>

          <div class="jam-field">
            <label class="jam-label" for="jam-display-name">
              Display Name (used for creating &amp; joining)
            </label>
            <input
              id="jam-display-name"
              class="jam-input"
              type="text"
              value={displayName()}
              onInput={(e) => setDisplayName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  document.getElementById('jam-room-id')?.focus()
                }
              }}
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
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  joinRoomId().trim() !== '' &&
                  !joining()
                ) {
                  handleJoin()
                }
              }}
              placeholder="e.g. ABCD"
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

      {/* ── Connecting ───────────────────────────────────────────── */}
      <Show when={jamState() === 'connecting'}>
        <div class="jam-connecting">
          <p>Connecting to jam room...</p>
        </div>
      </Show>

      {/* ── Active session ───────────────────────────────────────── */}
      <Show when={jamState() === 'active'}>
        <div class={panelStyles.sessionLayout}>
          {/* ── Collapsible sidebar ────────────────────────────── */}
          <div
            class={`${panelStyles.sidebar} ${sidebarOpen() ? panelStyles.sidebarOpen : ''}`}
          >
            <div class={panelStyles.sidebarInner}>
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

              <JamPeerList peers={jamPeers()} />
              <JamPitchDisplay />
            </div>
          </div>

          {/* ── Main content ───────────────────────────────────── */}
          <div class={panelStyles.mainArea}>
            {/* Top bar: room info + controls */}
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
                {/* Sidebar toggle */}
                <button
                  class={`jam-icon-btn ${sidebarOpen() ? 'jam-icon-btn-on' : 'jam-icon-btn-neutral'}`}
                  onClick={() => setSidebarOpen((v) => !v)}
                  title={
                    sidebarOpen() ? 'Hide peers panel' : 'Show peers panel'
                  }
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
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>

                {/* Microphone toggle */}
                <button
                  class={`jam-icon-btn ${jamIsMuted() ? 'jam-icon-btn-off' : 'jam-icon-btn-on'}`}
                  onClick={toggleJamMute}
                  title={jamIsMuted() ? 'Unmute microphone' : 'Mute microphone'}
                >
                  <Show
                    when={!jamIsMuted()}
                    fallback={
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
                  title={
                    jamVideoEnabled() ? 'Turn camera off' : 'Turn camera on'
                  }
                >
                  <Show
                    when={jamVideoEnabled()}
                    fallback={
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

            {/* ── Exercise controls + live pitch toggle ─────────── */}
            <div class={panelStyles.exerciseBar}>
              {/* Live pitch toggle — always reachable on the left */}
              <button
                class={panelStyles.pitchToggleBtn}
                classList={{
                  [panelStyles.pitchToggleBtnActive]: showLivePitch(),
                }}
                onClick={() => setShowLivePitch((v) => !v)}
                title={
                  showLivePitch()
                    ? 'Hide live pitch monitor'
                    : 'Show live pitch monitor'
                }
              >
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path
                    d="M2 8h2l2-4 2 8 2-5 2 3h2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <JamExerciseControls
                onSelectExercise={() =>
                  setShowExercisePicker(!showExercisePicker())
                }
                loopEnabled={jamExerciseLoop()}
                onToggleLoop={() => setJamExerciseLoop((v) => !v)}
              />
              {/* BPM control — host only, shown when melody loaded */}
              <Show when={jamExerciseMelody()}>
                <div class={panelStyles.bpmControl}>
                  <button
                    class={panelStyles.bpmStep}
                    onClick={() =>
                      setJamExerciseBpm((v) => Math.max(40, v - 5))
                    }
                    title="Decrease BPM by 5"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      width="10"
                      height="10"
                      fill="currentColor"
                    >
                      <rect x="2" y="5.5" width="8" height="1.5" rx="0.75" />
                    </svg>
                  </button>
                  <input
                    class={panelStyles.bpmInput}
                    type="number"
                    min="20"
                    max="300"
                    value={jamExerciseBpm()}
                    onInput={(e) => {
                      const v = parseInt(e.currentTarget.value, 10)
                      if (!isNaN(v) && v >= 20 && v <= 300) setJamExerciseBpm(v)
                    }}
                    title="Playback BPM"
                  />
                  <button
                    class={panelStyles.bpmStep}
                    onClick={() =>
                      setJamExerciseBpm((v) => Math.min(300, v + 5))
                    }
                    title="Increase BPM by 5"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      width="10"
                      height="10"
                      fill="currentColor"
                    >
                      <rect x="2" y="5.5" width="8" height="1.5" rx="0.75" />
                      <rect x="5.25" y="2" width="1.5" height="8" rx="0.75" />
                    </svg>
                  </button>
                  <span class={panelStyles.bpmLabel}>bpm</span>
                </div>
              </Show>
            </div>

            {/* Exercise picker dropdown */}
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

            {/* ── Canvases: exercise (main) + shared pitch (strip) ─ */}
            <div class={panelStyles.canvasArea}>
              {/* Exercise — takes most space */}
              <div
                class={`${exerciseCanvasStyles.container} ${panelStyles.exerciseCanvas}`}
              >
                <JamExerciseCanvas myPeerId={jamPeerId} />
              </div>

              {/* Shared pitch — compact strip below, toggleable */}
              <div
                class={panelStyles.pitchStrip}
                classList={{
                  [panelStyles.pitchStripCollapsed]: !showLivePitch(),
                }}
              >
                <Show when={showLivePitch()}>
                  <div class={panelStyles.pitchStripLabel}>
                    Live Pitch Monitor
                  </div>
                  <div class={pitchCanvasStyles.container}>
                    <JamSharedPitchCanvas myPeerId={jamPeerId} />
                  </div>
                </Show>
              </div>
            </div>

            <Show when={jamError()}>
              <p class="jam-error">{jamError()}</p>
            </Show>
          </div>
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
