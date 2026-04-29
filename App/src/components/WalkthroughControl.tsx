// ============================================================
// Walkthrough Control — Button to access walkthroughs anytime
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { WalkthroughModal, WalkthroughSelection } from '@/components'
import type { WalkthroughTab } from '@/stores/walkthrough-store'

interface WalkthroughControlProps {
  showOnStart?: boolean
  onStartWalkthrough?: (walkthroughId: string, tab: WalkthroughTab) => void
}

export const WalkthroughControl: Component<WalkthroughControlProps> = (
  props,
) => {
  const [showModal, setShowModal] = createSignal(false)
  const [showSelection, setShowSelection] = createSignal(false)
  const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<
    string | null
  >(null)
  const [walkthroughTab, setWalkthroughTab] =
    createSignal<WalkthroughTab>('practice')

  const handleOpenWalkthroughs = () => {
    setShowSelection(true)
    setSelectedWalkthrough(null)
  }

  const _handleWalkthroughSelect = (tab: WalkthroughTab) => {
    setSelectedWalkthrough(null)
    setWalkthroughTab(tab)
    setShowSelection(false)
    setShowModal(true)
  }

  const handleStartWalkthrough = (
    walkthroughId: string,
    walkthroughTab: WalkthroughTab,
  ) => {
    setSelectedWalkthrough(walkthroughId)
    setWalkthroughTab(walkthroughTab)
    setShowSelection(false)
    setShowModal(true)
  }

  const handleCloseWalkthroughModal = () => {
    setShowModal(false)
    setSelectedWalkthrough(null)
  }

  const handleCloseSelection = () => {
    setShowSelection(false)
  }

  return (
    <>
      {/* Main Walkthrough Selection (shown on app start or via button) */}
      <Show when={showSelection()}>
        <WalkthroughSelection
          isOpen={showSelection()}
          onClose={handleCloseSelection}
          onStartWalkthrough={handleStartWalkthrough}
        />
      </Show>

      {/* Walkthrough Modal */}
      <WalkthroughModal
        isOpen={showModal()}
        onClose={handleCloseWalkthroughModal}
        initialTab={walkthroughTab()}
        initialWalkthroughId={selectedWalkthrough()}
      />

      {/* Trigger Button (shown in settings or header) */}
      <Show
        when={props.showOnStart === false || props.showOnStart === undefined}
      >
        <button
          class="walkthrough-control-btn"
          onClick={handleOpenWalkthroughs}
          title="View PitchPerfect walkthroughs"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            />
          </svg>
          <span class="walkthrough-control-text">Learn</span>
        </button>
      </Show>
    </>
  )
}
