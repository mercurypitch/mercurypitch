// ── JamInviteModal ──────────────────────────────────────────────────
// Shareable room link/code for inviting peers.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import styles from './JamInviteModal.module.css'

interface JamInviteModalProps {
  roomId: string
  onClose: () => void
}

export const JamInviteModal: Component<JamInviteModalProps> = (props) => {
  const [roomCopied, setRoomCopied] = createSignal(false)
  const [linkCopied, setLinkCopied] = createSignal(false)
  const roomLink = () => `${window.location.origin}/#/jam:${props.roomId}`

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(props.roomId).catch(() => {})
    setRoomCopied(true)
    setTimeout(() => setRoomCopied(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomLink()).catch(() => {})
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div class={styles.overlay} onClick={() => props.onClose()}>
      <div class={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h3>Invite Peers</h3>
          <button class={styles.close} onClick={() => props.onClose()}>
            &times;
          </button>
        </div>

        <div class={styles.body}>
          <div class={styles.section}>
            <label class="jam-label">Room Code</label>
            <div class={styles.codeRow}>
              <code class={styles.code}>{props.roomId}</code>
              <button class="jam-btn jam-btn-sm" onClick={handleCopyRoomId}>
                {roomCopied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div class={styles.section}>
            <label class="jam-label">Share Link</label>
            <div class={styles.codeRow}>
              <code class={`${styles.code} ${styles.link}`}>{roomLink()}</code>
              <button class="jam-btn jam-btn-sm" onClick={handleCopyLink}>
                {linkCopied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
