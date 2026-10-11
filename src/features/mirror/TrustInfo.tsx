// ============================================================
// Voice Mirror privacy "i" — the privacy line, one gesture away.
// ============================================================
//
// Shared by the start screen (MirrorLanding) and the screens after it
// (MirrorApp's mic check and the twin's reveal), so it lives on its own
// rather than inside either.

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'

/** The privacy story as an "i" affordance rather than a paragraph.
 *
 *  It used to be two sentences of body copy on both the landing and the mic
 *  screen, competing with the thing the visitor came to do. The promise still
 *  has to be one gesture away (it is the reason someone grants a microphone),
 *  so this mirrors Glass's TrustInfo, with one addition: Glass opens on click
 *  only, which leaves desktop users clicking a thing that looks hoverable.
 *  Hover is handled in CSS for fine pointers; the click toggle stays for touch,
 *  where hover does not exist. */
export function TrustInfo(): JSX.Element {
  const [open, setOpen] = createSignal(false)
  return (
    <div class="mirror-info">
      <button
        type="button"
        class="mirror-info-btn"
        aria-expanded={open()}
        aria-label="Privacy: how your audio is handled"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 10.8v5.4" />
          <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
        </svg>
      </button>
      <div class="mirror-info-pop" role="note" data-open={open()}>
        Private by design: your audio never leaves this device. The analysis
        runs here in your browser, and the recording stays with you.
      </div>
    </div>
  )
}
