// ============================================================
// Walkthrough Control — Learn button for read-along chapters
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { WalkthroughModal, WalkthroughSelection } from '@/components'
import type { WalkthroughTab } from '@/stores/walkthrough-store'
import { getRemainingWalkthroughs } from '@/stores/walkthrough-store'

interface WalkthroughControlProps {
  showOnStart?: boolean
  onStartWalkthrough?: (walkthroughId: string, tab: WalkthroughTab) => void
}

export const WalkthroughControl: Component<WalkthroughControlProps> = (props) => {
  const [showModal, setShowModal] = createSignal(false)
  const [showSelection, setShowSelection] = createSignal(false)
  const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<string | null>(null)
  const [walkthroughTab, setWalkthroughTab] = createSignal<WalkthroughTab>('practice')

  const hasRemaining = getRemainingWalkthroughs().length > 0

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

  const handleStartWalkthrough = (walkthroughId: string, walkthroughTab: WalkthroughTab) => {
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
      {/* Walkthrough Selection */}
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

      {/* Learn button */}
      <Show when={props.showOnStart === false || props.showOnStart === undefined}>
        <button
          class="walkthrough-control-btn"
          onClick={handleOpenWalkthroughs}
          title="View PitchPerfect walkthroughs"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.43.3 4.5 1.5.15.15.35.05.5 0 .1-.1.1-.25 0-.35C21.25 20 21 19.75 21 19.5V5z" />
          </svg>
          <span class="walkthrough-control-text">Learn</span>
          {hasRemaining && <span class="ws-tab-badge">new</span>}
        </button>
      </Show>
    </>
  )
}
