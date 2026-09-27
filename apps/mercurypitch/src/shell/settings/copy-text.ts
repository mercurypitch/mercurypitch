// ============================================================
// Copy a line of text to the clipboard
// ============================================================
//
// The WebView's own clipboard: both shells serve the app from a secure
// origin, and every caller is a tap, so the write is allowed. It can still
// be refused (an old WebView, a policy), and the caller then says so rather
// than claiming a copy that did not happen.

/** True when the text reached the clipboard. Never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
