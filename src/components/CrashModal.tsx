// ============================================================
// CrashModal — Error handling modal for app crashes
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { APP_VERSION } from '@/lib/defaults'
import { appError } from '@/stores'

/**
 * App crashed modal shown when an unhandled error occurs.
 * Displays error info, version, and provides recovery options.
 */
export const CrashModal: Component = () => {
  const error = createMemo(() => appError())
  const [copied, setCopied] = createSignal(false)
  const [copyError, setCopyError] = createSignal<string | null>(null)

  const handleReload = (): void => {
    window.location.reload()
  }

  const handleCopy = async (): Promise<void> => {
    setCopyError(null)
    try {
      // Fallback for mobile/safari compatibility
      const clipboard = navigator.clipboard
      const hasWriteText =
        typeof clipboard === 'object' &&
        clipboard !== null &&
        typeof (clipboard as { writeText?: (text: string) => Promise<void> })
          .writeText === 'function'

      if (!hasWriteText) {
        // Fallback: select and copy to document
        const stacktraceElement = document.querySelector(
          '.crash-stacktrace-content',
        )
        if (stacktraceElement) {
          const text = stacktraceElement.textContent || ''
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          try {
            document.execCommand('copy')
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopyError('Unable to copy')
          }
          document.body.removeChild(textarea)
        }
      } else {
        await (
          navigator.clipboard as { writeText: (text: string) => Promise<void> }
        ).writeText(errorStack())
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setCopyError('Unable to copy')
    }
  }

  const handleClearStorage = (): void => {
    try {
      localStorage.clear()
      if (window.indexedDB !== undefined) {
        window.indexedDB.deleteDatabase('pitchperfect')
      }
      window.location.reload()
    } catch (e) {
      console.error('Failed to clear storage:', e)
      // Try at least a reload even if storage fails
      window.location.reload()
    }
  }

  const errorStack = createMemo(() => {
    const err = error()
    if (err === null) return ''
    return err.error?.stack ?? ''
  })

  return (
    <Show when={error() !== null}>
      <div class="crash-modal-overlay">
        <div class="crash-modal-glass">
          <div class="crash-modal-content">
            <div class="crash-header">
              <div class="crash-icon-container">
                <svg
                  viewBox="0 0 24 24"
                  class="crash-svg-icon"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div class="crash-header-text">
                <h2 class="crash-title">Application Error</h2>
                <p class="crash-subtitle">
                  We've encountered an unexpected issue and had to suspend the
                  current session.
                </p>
              </div>
            </div>

            <div class="crash-error-panel">
              <div class="crash-error-message-box">
                <svg
                  class="crash-error-bullet"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <code class="crash-error-message">
                  {error()!.error.message}
                </code>
              </div>
              <div class="crash-stacktrace-wrapper">
                <div class="crash-stacktrace-header">
                  <pre class="crash-stacktrace-content">{errorStack()}</pre>
                  <button
                    classList={{
                      'crash-copy-btn': true,
                      error: copyError() !== null,
                    }}
                    onClick={() => {
                      void handleCopy()
                    }}
                    title="Copy to clipboard"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span class="crash-copy-text">
                      {copyError() ?? (copied() ? 'Copied!' : 'Copy')}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div class="crash-metadata">
              <div class="crash-meta-badge">
                <span class="crash-meta-label">v</span>
                <span class="crash-meta-value">{APP_VERSION}</span>
              </div>
              <div class="crash-meta-badge">
                <span class="crash-meta-label">Time</span>
                <span class="crash-meta-value">
                  {new Date(error()!.time).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div class="crash-actions-container">
              <button
                onClick={handleReload}
                class="crash-btn crash-btn-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                Reload App
              </button>

              <div class="crash-secondary-actions">
                <a
                  href="https://github.com/yourusername/pitch-perfect/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="crash-action-link"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                  </svg>
                  Report Bug
                </a>
                <span class="crash-action-divider">•</span>
                <button
                  onClick={handleClearStorage}
                  class="crash-action-link crash-danger-link"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Reset App Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
