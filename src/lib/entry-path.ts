// ============================================================
// Entry path — the document an address names, however it is spelled
// ============================================================
//
// One entry document answers at its clean path, with trailing slashes, and
// as the .html file Vite serves: /voice-type-test, /voice-type-test/ and
// /voice-type-test.html are one page. First Light's landing rule
// (first-light-landing.ts), the Voice Mirror's doors and Karaoke Night's
// landings (each room's entry-intent.ts) read the page off the address, and
// each wrote this cleanup by hand: one stripped a single slash where the
// others stripped them all.

/** `pathname` without its trailing slashes or `.html`: `/voice-type-test//` is `/voice-type-test`, and `/` stays `/`. */
export function entryPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '').replace(/\.html$/, '')
  return path === '' ? '/' : path
}
