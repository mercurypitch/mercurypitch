// ── JamInviteModal ──────────────────────────────────────────────────
// Shareable room link/code for inviting peers.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import jamStyles from './Jam.module.css'
import styles from './JamInviteModal.module.css'

interface JamInviteModalProps {
  roomId: string
  onClose: () => void
}

export const JamInviteModal: Component<JamInviteModalProps> = (props) => {
  const [roomCopied, setRoomCopied] = createSignal(false)
  const [linkCopied, setLinkCopied] = createSignal(false)
  const roomLink = () => `${window.location.origin}/#/jam:${props.roomId}`

  /**
   * Confirm only what actually happened. Both handlers used to set the copied
   * flag unconditionally next to a swallowed rejection, so a blocked clipboard
   * (iOS Safari, any non-secure origin) still flashed "Copied!" — and the
   * person then pasted whatever was in the buffer before into the chat where
   * they meant to send the room code.
   */
  const copyToClipboard = (text: string, markCopied: (v: boolean) => void) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        markCopied(true)
        setTimeout(() => markCopied(false), 2000)
      })
      .catch(() => {
        markCopied(false)
      })
  }

  const handleCopyRoomId = () => {
    copyToClipboard(props.roomId, setRoomCopied)
  }

  const handleCopyLink = () => {
    copyToClipboard(roomLink(), setLinkCopied)
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
            <label class={jamStyles.label}>Room Code</label>
            <div class={styles.codeRow}>
              <code class={styles.code}>{props.roomId}</code>
              <button
                class={`${jamStyles.btn} ${jamStyles.btnSm}`}
                onClick={handleCopyRoomId}
              >
                {roomCopied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div class={styles.section}>
            <label class={jamStyles.label}>Share Link</label>
            <div class={styles.codeRow}>
              <code class={`${styles.code} ${styles.link}`}>{roomLink()}</code>
              <button
                class={`${jamStyles.btn} ${jamStyles.btnSm}`}
                onClick={handleCopyLink}
              >
                {linkCopied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
