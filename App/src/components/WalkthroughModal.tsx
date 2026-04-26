// ============================================================
// Walkthrough Modal — Display walkthrough content
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import type {
  WalkthroughTab
} from '@/stores/walkthrough-store'
import {
  completeWalkthrough,
  getWalkthrough,
  getWalkthroughsForTab,
  isWalkthroughCompleted,
  viewWalkthrough
} from '@/stores/walkthrough-store'
import type { WalkthroughContent } from '@/types/walkthrough'

interface WalkthroughModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: WalkthroughTab
  initialWalkthroughId?: string | null
}

export const WalkthroughModal: Component<WalkthroughModalProps> = (props) => {
  const [currentTab, setCurrentTab] = createSignal<WalkthroughTab>(
    props.initialTab ?? 'practice',
  )
  const [currentWalkthrough, setCurrentWalkthrough] = createSignal<WalkthroughContent | undefined>(
    undefined,
  )
  const [currentStepIndex, setCurrentStepIndex] = createSignal(0)

  // Load walkthrough when initially provided and modal opens
  createEffect(() => {
    if (props.initialWalkthroughId !== null && props.initialWalkthroughId !== undefined && props.isOpen) {
      startWalkthrough(props.initialWalkthroughId)
    }
  })

  // Sync isCompleted with store progress
  const isCompleted = createMemo(() => {
    const walkthrough = currentWalkthrough()
    if (!walkthrough) return false
    return isWalkthroughCompleted(walkthrough.id)
  })

  // Sync tab with initialTab prop changes
  createEffect(() => {
    if (props.initialTab !== null && props.initialTab !== undefined) {
      setCurrentTab(props.initialTab)
    }
  })

// Ensure tab is reset when modal opens
  createEffect(() => {
    if (props.isOpen && props.initialTab !== null && props.initialTab !== undefined) {
      setCurrentTab(props.initialTab)
    }
  })

  // Reset on tab change
  const handleTabChange = (tab: WalkthroughTab) => {
    setCurrentTab(tab)
    setCurrentWalkthrough(undefined)
    setCurrentStepIndex(0)
  }

  // Navigate steps
  const nextStep = () => {
    const steps = currentWalkthrough()?.steps ?? []
    if (currentStepIndex() < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex() + 1)
    }
  }

  const prevStep = () => {
    if (currentStepIndex() > 0) {
      setCurrentStepIndex(currentStepIndex() - 1)
    }
  }

  const startWalkthrough = (walkthroughId: string) => {
    const walkthrough = getWalkthrough(walkthroughId)
    if (walkthrough) {
      setCurrentWalkthrough(walkthrough)
      setCurrentStepIndex(0)
      viewWalkthrough(walkthroughId)
    }
  }

  const completeCurrentWalkthrough = () => {
    if (currentWalkthrough()) {
      completeWalkthrough(currentWalkthrough()!.id)
    }
  }

  const handleContinue = () => {
    // Find next unfinished walkthrough
    const allWalkthroughs = getWalkthroughsForTab(currentTab())
    const nextWalkthrough = allWalkthroughs.find(w => !isWalkthroughCompleted(w.id))
    if (nextWalkthrough) {
      startWalkthrough(nextWalkthrough.id)
    } else {
      props.onClose()
    }
  }

  const closeOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose()
    }
  }

  // Close on ESC
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose()
    }
  }

  const handleBackToList = () => {
    // Reset to initial tab and show walkthrough list
    setCurrentWalkthrough(undefined)
    setCurrentStepIndex(0)
  }

  // Lifecycle - setup escape key listener
  createEffect(() => {
    if (props.isOpen) {
      const doc = typeof document !== 'undefined' ? document : undefined
      if (doc) {
        doc.addEventListener('keydown', handleKeyDown)
        return () => doc.removeEventListener('keydown', handleKeyDown)
      }
    }
  })

  const walkthroughs = getWalkthroughsForTab(currentTab())

  return (
    <Show when={props.isOpen}>
      <div
        class="walkthrough-backdrop"
        onClick={closeOnBackdrop}
      >
        <div class="walkthrough-modal">
          <Show when={!currentWalkthrough()}>
            <div class="walkthrough-content">
              {/* Header */}
              <div class="walkthrough-header">
                <h2 class="walkthrough-title">
                  Welcome to PitchPerfect Walkthroughs
                </h2>
                <p class="walkthrough-subtitle">
                  Learn how to use each feature effectively
                </p>
              </div>

              {/* Tab Selector */}
              <div class="walkthrough-tabs">
                {(['practice', 'editor', 'settings', 'study'] as WalkthroughTab[]).map((tab) => (
                  <button
                    class={`walkthrough-tab ${tab === currentTab() ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Walkthrough List */}
              <div class="walkthrough-list">
                {walkthroughs.map((walkthrough) => {
                  const completed = isWalkthroughCompleted(walkthrough.id)
                  return (
                    <button
                      class={`walkthrough-item ${completed ? 'completed' : ''}`}
                      onClick={() => startWalkthrough(walkthrough.id)}
                      title={completed ? 'Completed' : 'Start walkthrough'}
                    >
                      <span class="walkthrough-thumbnail">{walkthrough.thumbnail}</span>
                      <div class="walkthrough-item-content">
                        <h3 class="walkthrough-item-title">
                          {completed && '✓ '}
                          {walkthrough.title}
                        </h3>
                        <p class="walkthrough-item-desc">
                          {walkthrough.description}
                        </p>
                        <Show when={completed}>
                          <span class="walkthrough-status">Completed</span>
                        </Show>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div class="walkthrough-footer">
                <button class="walkthrough-close-btn" onClick={props.onClose}>
                  Got it!
                </button>
              </div>
            </div>
          </Show>

          <Show when={currentWalkthrough()}>
            <Show when={isCompleted()}>
              <div class="walkthrough-complete">
                <div class="walkthrough-complete-icon">🎉</div>
                <h2 class="walkthrough-complete-title">Great Job!</h2>
                <p class="walkthrough-complete-desc">
                  You've completed this walkthrough.
                </p>
                <button class="walkthrough-complete-btn" onClick={handleContinue}>
                  Continue
                </button>
              </div>
            </Show>

            <Show when={!isCompleted()}>
              <div class="walkthrough-content">
                {/* Back to list */}
                <button
                  class="walkthrough-back-btn"
                  onClick={handleBackToList}
                >
                  ← Back to list
                </button>

                {/* Content */}
                <div class="walkthrough-body">
                  <h2 class="walkthrough-main-title">
                    {currentWalkthrough()!.title}
                  </h2>
                  <p class="walkthrough-main-desc">
                    {currentWalkthrough()!.description}
                  </p>

                  <div class="walkthrough-text">
                    {currentWalkthrough()!.content.split('\n').map((para, _i) =>
                      para.trim() ? (
                        <p class="walkthrough-paragraph">
                          {para}
                        </p>
                      ) : (
                        <br />
                      ),
                    )}
                  </div>

                  {/* Steps */}
                  <div class="walkthrough-steps">
                    <h3 class="walkthrough-steps-title">How to Use:</h3>
                    <div class="walkthrough-steps-list">
                      {currentStepIndex() === 0 && (
                        <div class="walkthrough-step-item active">
                          <span class="walkthrough-step-number">1</span>
                          <div class="walkthrough-step-details">
                            <h4 class="walkthrough-step-title">
                              {currentWalkthrough()!.steps[0].title}
                            </h4>
                            <p class="walkthrough-step-desc">
                              {currentWalkthrough()!.steps[0].description}
                            </p>
                            <span class="walkthrough-step-action">
                              Action: {currentWalkthrough()!.steps[0].action}
                            </span>
                          </div>
                        </div>
                      )}

                      {currentStepIndex() === 1 && (
                        <div class="walkthrough-step-item active">
                          <span class="walkthrough-step-number">2</span>
                          <div class="walkthrough-step-details">
                            <h4 class="walkthrough-step-title">
                              {currentWalkthrough()!.steps[1].title}
                            </h4>
                            <p class="walkthrough-step-desc">
                              {currentWalkthrough()!.steps[1].description}
                            </p>
                            <span class="walkthrough-step-action">
                              Action: {currentWalkthrough()!.steps[1].action}
                            </span>
                          </div>
                        </div>
                      )}

                      {currentStepIndex() === 2 && (
                        <div class="walkthrough-step-item active">
                          <span class="walkthrough-step-number">3</span>
                          <div class="walkthrough-step-details">
                            <h4 class="walkthrough-step-title">
                              {currentWalkthrough()!.steps[2].title}
                            </h4>
                            <p class="walkthrough-step-desc">
                              {currentWalkthrough()!.steps[2].description}
                            </p>
                            <span class="walkthrough-step-action">
                              Action: {currentWalkthrough()!.steps[2].action}
                            </span>
                          </div>
                        </div>
                      )}

                      {currentWalkthrough()!.steps.length === 4 && currentStepIndex() === 3 && (
                        <div class="walkthrough-step-item active">
                          <span class="walkthrough-step-number">4</span>
                          <div class="walkthrough-step-details">
                            <h4 class="walkthrough-step-title">
                              {currentWalkthrough()!.steps[3].title}
                            </h4>
                            <p class="walkthrough-step-desc">
                              {currentWalkthrough()!.steps[3].description}
                            </p>
                            <span class="walkthrough-step-action">
                              Action: {currentWalkthrough()!.steps[3].action}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div class="walkthrough-controls">
                  <button
                    class="walkthrough-nav-btn"
                    onClick={prevStep}
                    disabled={currentStepIndex() === 0}
                  >
                    ← Previous
                  </button>

                  {currentStepIndex() < (currentWalkthrough()!.steps.length - 1) ? (
                    <button
                      class="walkthrough-nav-btn walkthrough-nav-btn-next"
                      onClick={nextStep}
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      class="walkthrough-complete-btn"
                      onClick={completeCurrentWalkthrough}
                    >
                      ✓ Mark as Complete
                    </button>
                  )}
                </div>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  )
}