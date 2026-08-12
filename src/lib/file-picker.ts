// ============================================================
// File picker — open a file input and notice when the device has no picker
// ============================================================
//
// `<input type="file">.click()` is the only way a web page can ask for a local
// file, and on a television it frequently does nothing at all. Android TV and
// Google TV ship no app that answers `ACTION_GET_CONTENT`, so the WebView fires
// the intent, nothing resolves it, and the page never hears back: no `change`
// event, no cancel, no error. The user sees a button that does not respond —
// or, if they hold the OK key, the browser's own long-press context menu, which
// is the "any upload button simply does nothing or opens some right-click menu"
// report this module answers.
//
// There is no capability flag for this, and none is coming. What CAN be
// observed is the side effect of a picker opening: every platform that has one
// takes focus away from the document (`blur`, or a `visibilitychange` to
// hidden) within a few hundred milliseconds. If that never happens and no file
// arrives, no picker opened.
//
// So: click the input, watch, and if nothing moved, tell the user the truth and
// point them at the route that does work — prepare the song on a phone or
// computer while signed in, then open it here from the library.
//
// Tests: src/lib/file-picker.test.ts
// ============================================================

/** How long to wait for evidence that a native picker took over. */
export const FILE_PICKER_PROBE_MS = 1500

export interface FilePickerSignals {
  /** The document lost focus, or the page was hidden. */
  documentLostFocus: boolean
  /** A `change` event delivered at least one file. */
  filesArrived: boolean
  /** The input reported that the user cancelled (Chromium's `cancel` event). */
  cancelled: boolean
}

/**
 * Did the click fail to reach a picker? Pure so the decision is testable
 * without a browser — the timing plumbing lives in `openFilePicker`.
 *
 * Deliberately biased towards silence: a browser that fires `cancel` (Chromium
 * 113+) or hands back files clearly HAS a picker, and a browser that only blurs
 * probably does too. Only complete silence is treated as failure.
 */
export function filePickerLooksUnavailable(
  signals: FilePickerSignals,
): boolean {
  if (signals.filesArrived || signals.cancelled) return false
  return !signals.documentLostFocus
}

export interface OpenFilePickerOptions {
  /** Called once when the click produced no picker at all. */
  onUnavailable?: () => void
  /** Probe window in ms. Exposed for tests. */
  probeMs?: number
}

/**
 * Click a file input and report back if the device swallowed it.
 *
 * Use everywhere a hidden `<input type="file">` is triggered from a button —
 * the input's own `onChange` is unchanged and still does the real work.
 */
export function openFilePicker(
  input: HTMLInputElement | undefined,
  options: OpenFilePickerOptions = {},
): void {
  if (!input) return

  const onUnavailable = options.onUnavailable
  if (!onUnavailable) {
    input.click()
    return
  }

  const signals: FilePickerSignals = {
    documentLostFocus: false,
    filesArrived: false,
    cancelled: false,
  }

  const noteBlur = (): void => {
    signals.documentLostFocus = true
  }
  const noteVisibility = (): void => {
    if (document.visibilityState === 'hidden') signals.documentLostFocus = true
  }
  const noteChange = (): void => {
    signals.filesArrived = true
  }
  const noteCancel = (): void => {
    signals.cancelled = true
  }

  window.addEventListener('blur', noteBlur, { once: true })
  document.addEventListener('visibilitychange', noteVisibility)
  input.addEventListener('change', noteChange, { once: true })
  input.addEventListener('cancel', noteCancel, { once: true })

  const settle = (): void => {
    window.removeEventListener('blur', noteBlur)
    document.removeEventListener('visibilitychange', noteVisibility)
    input.removeEventListener('change', noteChange)
    input.removeEventListener('cancel', noteCancel)
    if (filePickerLooksUnavailable(signals)) onUnavailable()
  }

  window.setTimeout(settle, options.probeMs ?? FILE_PICKER_PROBE_MS)
  input.click()
}

/**
 * What to tell the user when no picker appeared. Honest about the cause and
 * specific about the route that still works, because "try again" does not.
 */
export const FILE_PICKER_UNAVAILABLE_MESSAGE =
  'This TV browser has no file manager, so it cannot open a file picker. ' +
  'Add the song on your phone or computer while signed in, then open it here ' +
  'from your library.'
