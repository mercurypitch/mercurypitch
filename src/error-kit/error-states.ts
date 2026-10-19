// ============================================================
// Error states — the words every "that did not work" page says
// ============================================================
//
// One scene, several states (docs/plans/error-pages.md). This file is where
// each state's words live, so the static pages, and later the in-app scene,
// cannot say different things about the same failure. The scene itself is
// staves.ts (the picture) and src/styles/error-scene.css (the room it hangs
// in).
//
// Only the states that ship are listed. A state is added here, with its
// stave, in the same change that gives it a page.

/** The failures that have a page of their own. */
export type ErrorState = 'not-found'

export interface ErrorStateCopy {
  /** The document title, brand last as on every other page. */
  title: string
  /** For a link preview or a search snippet that slips through noindex. */
  description: string
  /** The small readout above the heading. Text, never part of an image. */
  tag: string
  heading: string
  /** One line: what happened, without blaming the visitor, and the way on. */
  line: string
  /** The one action the page leads with. */
  primary: { href: string; label: string }
}

export const ERROR_STATES: Record<ErrorState, ErrorStateCopy> = {
  'not-found': {
    title: 'Page not found | MercuryPitch',
    description:
      'That address is not a page on MercuryPitch. The rooms below all are: vocal range, karaoke from songs you own, ear training, and instrument practice, free in your browser.',
    // 404 cents is a major third and four cents: a wrong note. The page
    // reads fine to anyone who does not get it.
    tag: '404 cents off',
    heading: 'Nothing plays at this address',
    line: 'The link may be old, or a letter slipped. Every room below is real, free, and runs in this browser with nothing to install.',
    primary: { href: '/', label: 'Back to the home page' },
  },
}
