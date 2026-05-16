import type { Component } from 'solid-js'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { jamChatMessages, jamPeerId, jamUnreadChatCount, sendJamChatMessage, setJamUnreadChatCount, } from '@/stores/jam-store'
import styles from './JamChatWidget.module.css'

export const JamChatWidget: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [chatText, setChatText] = createSignal('')
  let scrollEl: HTMLDivElement | undefined

  createEffect(() => {
    // Auto-scroll to bottom on new message if open
    jamChatMessages()
    if (isOpen() && scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight
    }
  })

  createEffect(() => {
    // If user opens the chat widget or a new message arrives while open, clear unread count
    jamChatMessages() // Depend on messages to clear when new ones arrive
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

  const toggleOpen = () => {
    if (!isOpen()) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
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
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class={styles.messages} ref={scrollEl}>
            <For each={jamChatMessages()}>
              {(msg) => {
                const isOwn = msg.peerId === jamPeerId()
                return (
                  <div class={`${styles.msg} ${isOwn ? styles.msgOwn : ''}`}>
                    <Show when={!isOwn}>
                      <span class={styles.author}>{msg.displayName}</span>
                    </Show>
                    <span class={styles.text}>{msg.text}</span>
                    <span class={styles.time}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
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
        <button class={styles.bubbleBtn} onClick={toggleOpen}>
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
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
