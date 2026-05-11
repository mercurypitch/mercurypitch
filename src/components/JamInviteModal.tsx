// ── JamInviteModal ──────────────────────────────────────────────────
// Shareable room link/code for inviting peers.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'

interface JamInviteModalProps {
  roomId: string
  onClose: () => void
}

export const JamInviteModal: Component<JamInviteModalProps> = (props) => {
  const [copied, setCopied] = createSignal(false)
  const roomLink = `${window.location.origin}/#jam:${props.roomId}`

  const handleCopyRoomId = async () => {
    await navigator.clipboard.writeText(props.roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(roomLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="jam-modal-overlay" onClick={props.onClose}>
      <div class="jam-modal" onClick={(e) => e.stopPropagation()}>
        <div class="jam-modal-header">
          <h3>Invite Peers</h3>
          <button class="jam-modal-close" onClick={props.onClose}>
            &times;
          </button>
        </div>

        <div class="jam-modal-body">
          <div class="jam-invite-section">
            <label class="jam-label">Room Code</label>
            <div class="jam-invite-code-row">
              <code class="jam-invite-code">{props.roomId}</code>
              <button class="jam-btn jam-btn-sm" onClick={handleCopyRoomId}>
                {copied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div class="jam-invite-section">
            <label class="jam-label">Share Link</label>
            <div class="jam-invite-code-row">
              <code class="jam-invite-code jam-invite-link">{roomLink}</code>
              <button class="jam-btn jam-btn-sm" onClick={handleCopyLink}>
                {copied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
