// Adventure transient messages — owns notice and narration-caption timers for one visit.

import { createSignal } from 'solid-js'

const MESSAGE_DURATION_MS = 5000

export function createAdventureTransientMessages(
  openingNotice: string,
  isAlive: () => boolean,
) {
  const [notice, setNotice] = createSignal(openingNotice)
  const [narrationCaption, setNarrationCaption] = createSignal('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let narrationCaptionTimer: ReturnType<typeof setTimeout> | undefined
  let openingNoticePending = openingNotice !== ''

  function announce(message: string): void {
    clearTimeout(noticeTimer)
    setNotice(message)
    noticeTimer = setTimeout(() => {
      if (isAlive()) setNotice('')
    }, MESSAGE_DURATION_MS)
  }

  function clearNotice(): void {
    clearTimeout(noticeTimer)
    noticeTimer = undefined
    setNotice('')
  }

  function clearNarrationCaption(): void {
    clearTimeout(narrationCaptionTimer)
    narrationCaptionTimer = undefined
    setNarrationCaption('')
  }

  function clear(): void {
    clearNotice()
    clearNarrationCaption()
  }

  function showNarrationCaption(caption: string): void {
    clearNarrationCaption()
    setNarrationCaption(caption)
    narrationCaptionTimer = setTimeout(() => {
      if (isAlive()) setNarrationCaption('')
    }, MESSAGE_DURATION_MS)
  }

  return {
    notice,
    narrationCaption,
    announce,
    clear,
    clearNarrationCaption,
    showNarrationCaption,
    startOpeningNotice() {
      if (!openingNoticePending) return
      openingNoticePending = false
      announce(openingNotice)
    },
  }
}
