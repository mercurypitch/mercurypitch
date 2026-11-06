// ============================================================
// EntryFaq — an entry document's questions, set into its room above the foot
// ============================================================
//
// Several documents open the Voice Mirror and Karaoke Night, and once the room
// is up their questions are what tells them apart (SEO audit, 6 Nov 2026). The
// questions are in the document's prelude (render-entry-page.ts marks it
// `data-keeps="faq"`), which is a sibling after #root, so kept there they
// drew after the room's legal row and footer: the page ended on an answer,
// with Privacy and Terms in the middle of it.
//
// So the room borrows them. Where this mounts, above its legal row or footer,
// the prelude's FAQ section moves in, the same node, so a crawler that runs
// the page reads it once, in its place. The prelude hides with the rest of
// itself once the room is up (entry-prelude.css). When this unmounts (a take
// or a song takes the page) the section goes back where it came from, and the
// next mount borrows it again. A document without kept questions draws
// nothing here.

import type { JSX } from 'solid-js'
import { onCleanup } from 'solid-js'

/** The questions a document keeps under its room. */
const KEPT_FAQ = '.entry-prelude[data-keeps="faq"] > .entry-prelude__faq'

export function EntryFaq(): JSX.Element {
  const faq = document.querySelector<HTMLElement>(KEPT_FAQ)
  if (faq === null) return null
  const home = faq.parentElement
  const next = faq.nextSibling
  onCleanup(() => {
    if (home === null) return
    if (next !== null && next.parentNode === home) home.insertBefore(faq, next)
    else home.append(faq)
  })
  return <div class="entry-faq" ref={(slot) => slot.append(faq)} />
}
