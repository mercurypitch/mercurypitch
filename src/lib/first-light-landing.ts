// ============================================================
// First Light's landing rule — the documents the welcome may open on by itself
// ============================================================
//
// First Light, the web's first-run welcome, takes the whole screen. It opened
// by itself for everyone the device had never offered it to, whichever
// document they arrived on, so a search that landed on /ear-lab, /jam or
// /pitch-training met the welcome instead of the room it asked for, and a
// crawler, which is always a first visit, rendered those pages as copies of
// the home page (SEO audit, 6 Nov 2026). The owner's rule: show it on
// reasonable pages, not on the rooms.
//
// So it opens by itself on the home document, and not on an entry document
// that boots the studio straight into a room or a tab: every page with a
// `bootHash` in src/seo/entry-pages.ts, listed below and held to that model
// by first-light-landing.test.ts. Nothing is spent on those pages: the
// visitor still meets the welcome on their first visit to `/`. The night
// rooms (Guitar, Piano, Drum and Karaoke Night) are documents of their own
// that never load First Light at all.
//
// Decided by the address alone. Never by user agent: a crawler and a person
// get the same page, or it is cloaking.

/** The studio's entry documents that open on a room or a tab, by path. */
export const ROOM_ENTRY_PATHS: readonly string[] = [
  '/studio-night',
  '/ear-lab',
  '/jam',
  '/jam-rooms',
  '/pitch-training',
]

/**
 * Whether First Light may open by itself on the document at `pathname`. The
 * same path with `.html` or a trailing slash is the same document.
 */
export function firstLightOpensOn(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '').replace(/\.html$/, '')
  return !ROOM_ENTRY_PATHS.includes(path)
}
