// ============================================================
// Walkthrough Control — Learn button for read-along chapters
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { WalkthroughModal, WalkthroughSelection } from '@/components/index'
import { closeWalkthroughChapter, openWalkthroughChapter, selectedWalkthrough, setShowSelection, showSelection, walkthroughModalOpen, } from '@/stores'
import type { WalkthroughTab } from '@/stores/walkthrough-store'

interface WalkthroughControlProps {
  showOnStart?: boolean
  showButtons?: boolean
  onStartWalkthrough?: (walkthroughId: string, tab: WalkthroughTab) => void
  onOpenGuide?: () => void
}

export const WalkthroughControl: Component<WalkthroughControlProps> = (
  _props,
) => {
  const handleStartWalkthrough = (
    walkthroughId: string,
    _walkthroughTab: WalkthroughTab,
  ) => {
    openWalkthroughChapter(walkthroughId)
  }

  const handleBackToSelection = () => {
    closeWalkthroughChapter()
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
        isOpen={walkthroughModalOpen()}
        onClose={closeWalkthroughChapter}
        onBackToList={handleBackToSelection}
        initialWalkthroughId={selectedWalkthrough()}
      />
    </>
  )
}
