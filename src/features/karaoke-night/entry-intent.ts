// ============================================================
// Karaoke Night entry intent — which search landing opened the stage
// ============================================================
//
// Three documents boot this room (src/seo/entry-pages.ts): Karaoke Night's
// own (/karaoke-night, and its alias /karaoke), the vocal remover's and the
// karaoke app's. Each answers a search of its own, and once the room was up
// all three drew the same hero, so a crawler that runs the page read three
// copies of one (SEO audit, 6 Nov 2026). The hero leads with each document's
// own heading and promise now, in the words its document already uses
// (KaraokeHero.tsx); the room behind it is the same. Read off the path, as
// the Voice Mirror's doors are (src/features/mirror/entry-intent.ts).

export type KaraokeEntryIntent =
  | 'karaoke-night'
  | 'vocal-remover'
  | 'karaoke-app'

/** The landing at `pathname`, in its clean form or as the document Vite serves. */
export function karaokeEntryIntent(pathname: string): KaraokeEntryIntent {
  const path = pathname.replace(/\/+$/, '').replace(/\.html$/, '')
  if (path === '/vocal-remover') return 'vocal-remover'
  if (path === '/karaoke-app') return 'karaoke-app'
  return 'karaoke-night'
}
