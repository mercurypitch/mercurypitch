// ============================================================
// Walkthrough Selection — Show walkthrough options on app start
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'
import {
  completeWalkthrough,
  getCompletionPercentage,
  getCompletedWalkthroughs,
  getRemainingWalkthroughs,
  getTotalWalkthroughCount,
  isWalkthroughCompleted,
  viewWalkthrough,
  WalkthroughTab,
} from '@/stores/walkthrough-store'

interface WalkthroughSelectionProps {
  isOpen: boolean
  onClose: () => void
}

export const WalkthroughSelection: Component<WalkthroughSelectionProps> = (props) => {
  const [selectedTab, setSelectedTab] = createSignal<WalkthroughTab>('practice')

  const remaining = createMemo(() => getRemainingWalkthroughs())
  const completed = createMemo(() => getCompletedWalkthroughs())
  const total = createMemo(() => getTotalWalkthroughCount())
  const percentage = createMemo(() => getCompletionPercentage())

  const handleWalkthroughSelect = (id: string) => {
    viewWalkthrough(id)
    props.onClose()
  }

  const handleComplete = (id: string) => {
    completeWalkthrough(id)
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose()
    }
  }

  return (
    <Show when={props.isOpen}>
      <div class="walkthrough-selection-overlay" onClick={handleClickOutside}>
        <div class="walkthrough-selection-card">
          {/* Header */}
          <div class="ws-header">
            <div class="ws-header-left">
              <span class="ws-percentage">{percentage()}%</span>
              <h2 class="ws-title">PitchPerfect Walkthroughs</h2>
            </div>
            <button class="ws-close-btn" onClick={props.onClose} title="Skip walkthrough">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div class="ws-progress-container">
            <div class="ws-progress-bar">
              <div
                class="ws-progress-fill"
                style={{
                  width: `${percentage()}%`,
                }}
              />
            </div>
            <span class="ws-progress-text">
              {completed().length} of {total()} walkthroughs
            </span>
          </div>

          {/* Info */}
          {!percentage() && (
            <p class="ws-info">
              Welcome to PitchPerfect! Learn how to use the app with our interactive walkthroughs.
            </p>
          )}

          {/* Tabs */}
          <div class="ws-tabs">
            {(['practice', 'editor', 'settings'] as WalkthroughTab[]).map((tab) => {
              const tabRemaining = remaining().filter(w => w.tab === tab)
              return (
                <button
                  class={`ws-tab ${tab === selectedTab() ? 'active' : ''}`}
                  onClick={() => setSelectedTab(tab)}
                  title={`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab walkthroughs`}
                >
                  <span class="ws-tab-label">
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </span>
                  {tabRemaining.length > 0 && (
                    <span class="ws-tab-badge">{tabRemaining.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* List */}
          <div class="ws-list">
            {remaining().filter(w => w.tab === selectedTab()).map((walkthrough) => (
              <div
                class={`ws-item ${isWalkthroughCompleted(walkthrough.id) ? 'completed' : ''}`}
              >
                <button
                  class="ws-item-button"
                  onClick={() => handleWalkthroughSelect(walkthrough.id)}
                >
                  <span class="ws-item-icon">📖</span>
                  <div class="ws-item-content">
                    <span class="ws-item-title">{walkthrough.title}</span>
                    <span class="ws-item-desc">
                      Learn about {selectedTab()} tab features
                    </span>
                  </div>
                  <Show when={isWalkthroughCompleted(walkthrough.id)}>
                    <span class="ws-item-status">✓</span>
                  </Show>
                </button>
              </div>
            ))}
          </div>

          {/* Completed Section */}
          <Show when={completed().length > 0}>
            <div class="ws-completed-section">
              <h3 class="ws-completed-title">Completed</h3>
              <div class="ws-completed-list">
                {completed().map((walkthrough) => (
                  <button
                    class="ws-completed-item"
                    onClick={() => handleWalkthroughSelect(walkthrough.id)}
                  >
                    <span class="ws-item-icon">✓</span>
                    <span class="ws-item-title">{walkthrough.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </Show>

          {/* Footer */}
          <div class="ws-footer">
            <button class="ws-skip-btn" onClick={props.onClose}>
              Skip for now
            </button>
            <button class="ws-done-btn" onClick={props.onClose}>
              {percentage() === 100 ? 'All Done!' : 'Start Now'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}