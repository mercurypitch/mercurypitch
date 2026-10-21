// ============================================================
// Walkthrough icons — the spotlight tour tooltip's action-row glyphs
// ============================================================
//
// Compact (15-16px) glyphs for the tooltip's icon-only buttons: skip the
// tour, skip a section, finish. Icon-only buttons keep the spotlight tight on
// small screens; the label lives in each button's title/aria-label, so every
// glyph is aria-hidden. Moved out of Walkthrough.tsx, which keeps the tour's
// logic and markup.

export const IconClose = () => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconSkipForward = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5 5l9 7-9 7z" />
    <rect x="15" y="5" width="3" height="14" rx="1" />
  </svg>
)

export const IconCheck = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
)
