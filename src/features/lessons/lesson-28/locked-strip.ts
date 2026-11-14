// ============================================================
// Lesson 28's locked strip — the hero's ten empty bars in a figure that waits
// ============================================================
//
// Until the cold open's choice the steps' figure, free play's and Sing
// it's staffs draw only the hero's ten empty bars (WEB-SPEC, Toys 2 and 6;
// FACTS 46): a still copy of the hero's strip, with no name of its own,
// the figure's carrying it, and no step part for the step parts to hide.
// The sheet shows it while the figure is locked, and the staffs after.

/** Puts a still copy of the hero's strip, `strip`, in `figure`; nothing where the page has none. */
export function addLockedStrip(figure: Element, strip: Element | null): void {
  if (strip === null) return
  const copy = strip.cloneNode(true) as Element
  copy.removeAttribute('role')
  copy.removeAttribute('aria-label')
  copy.removeAttribute('data-hero-strip')
  for (const el of copy.querySelectorAll('[data-part]'))
    el.removeAttribute('data-part')
  const still = document.createElement('div')
  still.className = 'song-strip score-locked'
  still.setAttribute('aria-hidden', 'true')
  still.append(copy)
  figure.append(still)
}
