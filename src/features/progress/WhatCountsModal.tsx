// ============================================================
// "What counts here?" — the guide, as a dialog
// ============================================================
//
// Opened from the pill row on the Progress card, the profile and the
// community runs list. The full-page route at #/what-counts renders the same
// `WhatCountsGuide`; this is the version you get without leaving what you
// were looking at.

import type { Component } from 'solid-js'
import { createUniqueId } from 'solid-js'
import { X } from '@/components/icons'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { WhatCountsGuide } from './WhatCountsGuide'
import styles from './WhatCountsModal.module.css'

export const WhatCountsModal: Component<{ onClose: () => void }> = (props) => {
  let cardRef: HTMLDivElement | undefined
  const titleId = createUniqueId()

  // No `initialFocus` override: the close button is the first focusable
  // thing in the card, which is exactly where the trap puts focus by default.
  useFocusTrap(() => cardRef, {
    isOpen: () => true,
    onClose: () => props.onClose(),
  })

  return (
    <div
      class={styles.overlay}
      data-testid="what-counts-modal"
      onClick={(event) => {
        // Backdrop only. A click that started inside the card and drifted out
        // must not close it — this is a reading surface, and losing your place
        // to a stray drag is worse than an extra click to dismiss.
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <div
        ref={cardRef}
        class={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          class={styles.close}
          onClick={() => props.onClose()}
          aria-label="Close"
          title="Close"
          data-testid="what-counts-close"
        >
          <X />
        </button>
        <WhatCountsGuide headingId={titleId} />
      </div>
    </div>
  )
}
