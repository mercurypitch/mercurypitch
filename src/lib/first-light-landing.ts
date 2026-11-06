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
// welcome opens by itself on a later page load of the home document `/`.
// Not on a tap of Home inside the app, since the address is read once, at
// load (ui-store.ts), and no takeover opens on an in-app move. The night
// rooms (Guitar, Piano, Drum and Karaoke Night) are documents of their own
// that never load First Light at all.
//
// Decided by the address alone. Never by user agent: a crawler and a person
// get the same page, or it is cloaking.

import { entryPath } from './entry-path'

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
 * same path with `.html` or trailing slashes is the same document.
 */
export function firstLightOpensOn(pathname: string): boolean {
  return !ROOM_ENTRY_PATHS.includes(entryPath(pathname))
}
