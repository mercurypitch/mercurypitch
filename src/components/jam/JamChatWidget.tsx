import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamChatMessages, jamPeerId, jamPeers, jamPitchHistory, jamUnreadChatCount, sendJamChatMessage, setJamUnreadChatCount, } from '@/stores/jam-store'
import { selectedCharacter } from '@/stores/settings-store'
import styles from './JamChatWidget.module.css'

export const JamChatWidget: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [chatText, setChatText] = createSignal('')
  let scrollEl: HTMLDivElement | undefined

  // Peer color map keyed by peerId (same palette as canvases/camera)
  const colorMap = createMemo(() => {
    const ids = Object.keys(jamPitchHistory())
    // Also include all known peers even without pitch data yet
    const peerIds = [...new Set([...ids, ...jamPeers().map((p) => p.id)])]
    return buildPeerColorMap(peerIds)
  })

  createEffect(() => {
    jamChatMessages()
    if (isOpen() && scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight
    }
  })

  createEffect(() => {
    jamChatMessages()
    if (isOpen()) {
      setJamUnreadChatCount(0)
    }
  })

  const handleSend = () => {
    const txt = chatText().trim()
    if (!txt) return
    sendJamChatMessage(txt)
    setChatText('')
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div class={styles.widgetContainer}>
      <Show when={isOpen()}>
        <div class={styles.chatWindow}>
          <div class={styles.header}>
            <h3 class={styles.title}>Room Chat</h3>
            <button class={styles.closeBtn} onClick={() => setIsOpen(false)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class={styles.messages} ref={scrollEl}>
            <For each={jamChatMessages()}>
              {(msg) => {
                const isOwn = msg.peerId === jamPeerId()
                const peerColor = () => colorMap()[msg.peerId] ?? '#58a6ff'
                const initial = () => msg.displayName.charAt(0).toUpperCase()

                return (
                  <div
                    class={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : ''}`}
                  >
                    {/* Avatar — character SVG for self, colored initial for peers */}
                    <div
                      class={styles.avatar}
                      style={
                        isOwn
                          ? { background: 'transparent', border: 'none' }
                          : {
                              background: `${peerColor()}22`,
                              border: `1px solid ${peerColor()}66`,
                              color: peerColor(),
                            }
                      }
                    >
                      <Show
                        when={isOwn}
                        fallback={
                          <span class={styles.avatarInitial}>{initial()}</span>
                        }
                      >
                        <img
                          src={`characters/${selectedCharacter()}_idle.svg`}
                          alt={selectedCharacter()}
                          class={styles.avatarChar}
                        />
                      </Show>
                    </div>

                    {/* Bubble */}
                    <div
                      class={`${styles.msg} ${isOwn ? styles.msgOwn : ''}`}
                      style={
                        !isOwn
                          ? { 'border-color': `${peerColor()}44` }
                          : undefined
                      }
                    >
                      <Show when={!isOwn}>
                        <span
                          class={styles.author}
                          style={{ color: peerColor() }}
                        >
                          {msg.displayName}
                        </span>
                      </Show>
                      <span class={styles.text}>{msg.text}</span>
                      <span class={styles.time}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )
              }}
            </For>
          </div>

          <div class={styles.inputArea}>
            <input
              type="text"
              class="jam-input"
              style={{ flex: 1 }}
              value={chatText()}
              onInput={(e) => setChatText(e.currentTarget.value)}
              onKeyDown={handleKey}
              placeholder="Type a message..."
              maxLength={500}
            />
            <button
              class="jam-btn jam-btn-primary jam-btn-sm"
              onClick={handleSend}
            >
              Send
            </button>
          </div>
        </div>
      </Show>

      <Show when={!isOpen()}>
        <button class={styles.bubbleBtn} onClick={() => setIsOpen(true)}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <Show when={jamUnreadChatCount() > 0}>
            <span class={styles.badge}>
              {jamUnreadChatCount() > 99 ? '99+' : jamUnreadChatCount()}
            </span>
          </Show>
        </button>
      </Show>
    </div>
  )
}
