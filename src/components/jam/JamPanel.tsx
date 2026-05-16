// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — create/join rooms, view peers, controls.

import { For, type Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js'
import {
  createJamRoom,
  jamChatMessages,
  jamConnectedPeers,
  jamError,
  jamIsMuted,
  jamLocalStream,
  jamPeerId,
  jamPeers,
  jamPitchTab,
  jamRemoteStreams,
  jamRoomId,
  jamRoomToJoin,
  jamState,
  jamVideoEnabled,
  joinJamRoom,
  leaveJamRoom,
  selectJamExercise,
  sendJamChatMessage,
  setJamPitchTab,
  setJamRoomToJoin,
  startJamPitchDetection,
  toggleJamMute,
  toggleJamVideo,
} from '@/stores/jam-store'
import { getMelodyLibrarySignal } from '@/stores/melody-store'
import { JamInviteModal } from './JamInviteModal'
import { JamPeerList } from './JamPeerList'
import { JamPitchDisplay } from './JamPitchDisplay'
import { JamSharedPitchCanvas } from './JamSharedPitchCanvas'
import { JamExerciseCanvas } from './JamExerciseCanvas'
import { JamExerciseControls } from './JamExerciseControls'

export const JamPanel: Component = () => {
  const [displayName, setDisplayName] = createSignal('')
  const [joinRoomId, setJoinRoomId] = createSignal('')
  const [showInvite, setShowInvite] = createSignal(false)
  const [joining, setJoining] = createSignal(false)
  const [chatText, setChatText] = createSignal('')
  const [showExercisePicker, setShowExercisePicker] = createSignal(false)
  let chatScrollEl: HTMLDivElement | undefined

  const melodyOptions = createMemo(() => {
    const lib = getMelodyLibrarySignal()()
    return Object.values(lib.melodies)
  })

  const handleSendChat = () => {
    const text = chatText().trim()
    if (!text) return
    sendJamChatMessage(text)
    setChatText('')
    // Scroll to bottom after render
    setTimeout(() => {
      chatScrollEl?.scrollTo({ top: chatScrollEl.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  const handleChatKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendChat()
    }
  }

  const handleCreate = () => {
    const name = displayName().trim() || 'Anonymous'
    createJamRoom(name).catch(() => {})
  }

  const autoJoin = (roomId: string) => {
    setJoinRoomId(roomId)
    setJoining(true)
    const name = displayName().trim() || 'Anonymous'
    joinJamRoom(roomId, name).finally(() => {
      setJoining(false)
      setJamRoomToJoin(null)
    })
  }

  onMount(() => {
    const roomId = jamRoomToJoin()
    if (roomId) autoJoin(roomId)
  })

  createEffect(() => {
    if (jamState() === 'active') {
      startJamPitchDetection()
    }
  })

  const handleJoin = () => {
    const roomId = joinRoomId().trim()
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
              Your name
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
              <span class="jam-room-id-badge">{jamRoomId()}</span>
            </div>
            <div class="jam-room-actions">
              <button
                class="jam-btn jam-btn-sm"
                onClick={() => setShowInvite(true)}
              >
                Invite
              </button>
              <button
                class={`jam-btn jam-btn-sm ${jamIsMuted() ? 'jam-btn-muted' : ''}`}
                onClick={toggleJamMute}
              >
                {jamIsMuted() ? 'Unmute' : 'Mute'}
              </button>
              <button
                class={`jam-btn jam-btn-sm ${!jamVideoEnabled() ? 'jam-btn-muted' : ''}`}
                onClick={toggleJamVideo}
              >
                {jamVideoEnabled() ? 'Cam Off' : 'Cam On'}
              </button>
              <button
                class="jam-btn jam-btn-sm jam-btn-danger"
                onClick={leaveJamRoom}
              >
                Leave
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

<div class="jam-video-grid">
            {/* Video grid unchanged */}
            <div class="jam-video-tile jam-video-local">
              <video
                ref={(el) => {
                  el.srcObject = jamLocalStream()
                }}
                autoplay
                muted
                playsinline
                class="jam-video-feed"
              />
              <span class="jam-video-label">You</span>
              <Show when={!jamVideoEnabled()}>
                <div class="jam-video-off">Camera off</div>
              </Show>
            </div>
            <For each={Object.entries(jamRemoteStreams())}>
              {([peerId, stream]) => (
                <div class="jam-video-tile jam-video-remote">
                  <video
                    ref={(el) => {
                      el.srcObject = stream
                    }}
                    autoplay
                    playsinline
                    class="jam-video-feed"
                  />
                  <span class="jam-video-label">
                    {jamPeers().find((p) => p.id === peerId)?.displayName ?? peerId}
                  </span>
                </div>
              )}
            </For>
          </div>

          {/* Pitch display — always visible */}
          <JamPitchDisplay />

          {/* Tab bar */}
          <div class="jam-tabs">
            <button
              class={`jam-tab ${jamPitchTab() === 'pitch' ? 'jam-tab-active' : ''}`}
              onClick={() => setJamPitchTab('pitch')}
            >
              Shared Pitch
            </button>
            <button
              class={`jam-tab ${jamPitchTab() === 'exercise' ? 'jam-tab-active' : ''}`}
              onClick={() => setJamPitchTab('exercise')}
            >
              Exercise
            </button>
            <button
              class={`jam-tab ${jamPitchTab() === 'chat' ? 'jam-tab-active' : ''}`}
              onClick={() => setJamPitchTab('chat')}
            >
              Chat
            </button>
          </div>

          {/* Tab content */}
          <Show when={jamPitchTab() === 'pitch'}>
            <div class="jam-tab-content">
              <JamPeerList peers={jamPeers()} />
              <div class="jam-shared-pitch-canvas">
                <JamSharedPitchCanvas myPeerId={jamPeerId} />
              </div>
            </div>
          </Show>

          <Show when={jamPitchTab() === 'exercise'}>
            <div class="jam-tab-content">
              <JamExerciseControls
                onSelectExercise={() =>
                  setShowExercisePicker(!showExercisePicker())
                }
              />
              <Show when={showExercisePicker()}>
                <div class="jam-exercise-picker">
                  <For each={melodyOptions()}>
                    {(melody) => (
                      <button
                        class="jam-ex-pick-item"
                        onClick={() => {
                          selectJamExercise(melody)
                          setShowExercisePicker(false)
                        }}
                      >
                        <span class="jam-ex-pick-name">{melody.name}</span>
                        <span class="jam-ex-pick-meta">
                          {melody.bpm} bpm · {melody.key} {melody.scaleType}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <div class="jam-exercise-canvas">
                <JamExerciseCanvas myPeerId={jamPeerId} />
              </div>
            </div>
          </Show>

          <Show when={jamPitchTab() === 'chat'}>
            <div class="jam-tab-content">
              <div class="jam-chat">
                <div
                  class="jam-chat-messages"
                  ref={(el) => (chatScrollEl = el)}
                >
                  <For each={jamChatMessages()}>
                    {(msg) => (
                      <div
                        class={`jam-chat-msg ${msg.peerId === jamPeerId() ? 'jam-chat-msg-own' : ''}`}
                      >
                        <span class="jam-chat-author">{msg.displayName}</span>
                        <span class="jam-chat-text">{msg.text}</span>
                        <span class="jam-chat-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
                <div class="jam-chat-input">
                  <input
                    type="text"
                    class="jam-input"
                    value={chatText()}
                    onInput={(e) => setChatText(e.currentTarget.value)}
                    onKeyDown={handleChatKey}
                    placeholder="Type a message..."
                    maxLength={500}
                  />
                  <button class="jam-btn jam-btn-sm" onClick={handleSendChat}>
                    Send
                  </button>
                </div>
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
    </div>
  )
}
