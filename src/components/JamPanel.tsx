// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — create/join rooms, view peers, controls.

import type { Component } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { createJamRoom, jamConnectedPeers, jamError, jamIsMuted, jamPeers, jamRoomId, jamRoomToJoin, jamState, joinJamRoom, leaveJamRoom, setJamRoomToJoin, toggleJamMute, } from '@/stores/jam-store'
import { JamInviteModal } from './JamInviteModal'
import { JamPeerList } from './JamPeerList'

export const JamPanel: Component = () => {
  const [displayName, setDisplayName] = createSignal('')
  const [joinRoomId, setJoinRoomId] = createSignal('')
  const [showInvite, setShowInvite] = createSignal(false)
  const [joining, setJoining] = createSignal(false)

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

          <JamPeerList peers={jamPeers()} />

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
