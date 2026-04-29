// ============================================================
// Walkthrough Control — Learn button for read-along chapters
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { WalkthroughModal, WalkthroughSelection } from '@/components'
import type { WalkthroughTab } from '@/stores/walkthrough-store'

interface WalkthroughControlProps {
  showOnStart?: boolean
  showButtons?: boolean
  onStartWalkthrough?: (walkthroughId: string, tab: WalkthroughTab) => void
  onOpenGuide?: () => void
}

export const WalkthroughControl: Component<WalkthroughControlProps> = (
  props,
) => {
  const [showModal, setShowModal] = createSignal(false)
  const [showSelection, setShowSelection] = createSignal(false)
  const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<
    string | null
  >(null)

  const handleOpenWalkthroughs = () => {
    setShowSelection(true)
    setSelectedWalkthrough(null)
  }

  // Expose for external callers (sidebar)
  createEffect(() => {
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __openWalkthroughs?: () => void }
      ).__openWalkthroughs = handleOpenWalkthroughs
    }
  })

  const handleStartWalkthrough = (
    walkthroughId: string,
    _walkthroughTab: WalkthroughTab,
  ) => {
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
    </>
  )
}
