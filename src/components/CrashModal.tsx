// ============================================================
// CrashModal — Error handling modal for app crashes
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { appError } from '@/stores'
import { APP_VERSION } from '@/version'

/**
 * App crashed modal shown when an unhandled error occurs.
 * Displays error info, version, and provides recovery options.
 */
export const CrashModal: Component = () => {
  const error = createMemo(() => appError())

  const handleReload = (): void => {
    window.location.reload()
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
      <div class="crash-modal">
        <div class="crash-header">
          <div class="crash-icon">💥</div>
          <h2 class="crash-title">Something went wrong</h2>
          <p class="crash-subtitle">
            The app encountered an unexpected error and had to close.
          </p>
        </div>


          <div class="crash-error-details">
            <div class="crash-error-header">
              <span class="crash-error-label">Error:</span>
              <code class="crash-error-message">{error()!.error.message}</code>
            </div>
            <div class="crash-stacktrace">
              <pre>{errorStack()}</pre>
            </div>
          </div>
          <div class="crash-info">
            <div class="crash-info-item">
              <span class="crash-info-label">Version:</span>
              <span class="crash-info-value">{APP_VERSION}</span>
            </div>
            <div class="crash-info-item">
              <span class="crash-info-label">Time:</span>
              <span class="crash-info-value">
                {new Date(error()!.time).toLocaleString()}
              </span>
            </div>
          </div>


        <div class="crash-actions">
          <a
            href="https://github.com/yourusername/pitch-perfect/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary"
          >
            Report Bug on GitHub
          </a>
          <button onClick={handleReload} class="btn btn-primary">
            Reload App
          </button>
          <button onClick={handleClearStorage} class="btn btn-tertiary">
            Clear Storage & Reload
          </button>
        </div>

        <p class="crash-footer">
          If the problem persists, try clearing your local storage and
          reloading.
        </p>
      </div>
    </div>
    </Show>
  )
}
