// ============================================================
// ModalState - Shared modal open/close signals
// ============================================================

import { createSignal } from 'solid-js'

// Library modal state
const [libraryModalOpen, setLibraryModalOpen] = createSignal(false)
const [sessionModalOpen, setSessionModalOpen] = createSignal(false)

export {
  libraryModalOpen,
  setLibraryModalOpen,
  sessionModalOpen,
  setSessionModalOpen,
}
