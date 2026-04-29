// ============================================================
// Walkthrough Control — Learn button for read-along chapters
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { WalkthroughModal, WalkthroughSelection } from '@/components'
import type { WalkthroughTab } from '@/stores/walkthrough-store'

interface WalkthroughControlProps {
  showOnStart?: boolean
  onStartWalkthrough?: (walkthroughId: string, tab: WalkthroughTab) => void
  onOpenGuide?: () => void
}

export const WalkthroughControl: Component<WalkthroughControlProps> = (props) => {
  const [showModal, setShowModal] = createSignal(false)
  const [showSelection, setShowSelection] = createSignal(false)
  const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<string | null>(null)

  const handleOpenWalkthroughs = () => {
    setShowSelection(true)
    setSelectedWalkthrough(null)
  }

  const handleStartWalkthrough = (walkthroughId: string, _walkthroughTab: WalkthroughTab) => {
    setSelectedWalkthrough(walkthroughId)
    setShowSelection(false)
    setShowModal(true)
  }

  const handleCloseWalkthroughModal = () => {
    setShowModal(false)
    setSelectedWalkthrough(null)
  }

  const handleBackToSelection = () => {
    setShowModal(false)
    setSelectedWalkthrough(null)
    setShowSelection(true)
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
        onBackToList={handleBackToSelection}
        initialWalkthroughId={selectedWalkthrough()}
      />

      {/* Learn + Guide buttons */}
      <Show when={props.showOnStart === false || props.showOnStart === undefined}>
        <div class="walkthrough-control-group">
          <button
            class="walkthrough-control-btn"
            onClick={handleOpenWalkthroughs}
            title="View PitchPerfect walkthroughs"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.43.3 4.5 1.5.15.15.35.05.5 0 .1-.1.1-.25 0-.35C21.25 20 21 19.75 21 19.5V5z" />
            </svg>
            <span class="walkthrough-control-text">Learn</span>
          </button>
          <button
            class="walkthrough-control-btn walkthrough-control-btn-guide"
            onClick={() => props.onOpenGuide?.()}
            title="Interactive guide tours"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span class="walkthrough-control-text">Guide</span>
          </button>
        </div>
      </Show>
    </>
  )
}
