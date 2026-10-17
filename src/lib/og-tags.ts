// ============================================================
// OG Tags — Dynamic Open Graph meta tag management
// ============================================================

import { OG_IMAGE_VERSIONS } from '@/seo/og-image-versions'

// The app sets these on boot, over the tags index.html shipped, so the two
// must agree (src/tests/og-tags.test.ts reads index.html to check).
const OG_TITLE =
  'MercuryPitch: See Your Voice, Sing Karaoke, Improve Every Take'
const OG_DESC =
  'Train your vocal pitch with real-time audio feedback, piano roll visualization, and accuracy scoring.'
// Stamped like index.html's: social caches key a card by its URL, and the
// bare URL is the one they still hold the old, letterboxed card under.
const OG_IMAGE = `https://mercurypitch.com/og-image.png?v=${OG_IMAGE_VERSIONS['og-image.png']}`
const OG_URL = 'https://mercurypitch.com/'
const SITE_NAME = 'MercuryPitch'

function setMeta(property: string, content: string, isName = false): void {
  const attr = isName ? 'name' : 'property'
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${property}"]`,
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Set the static default OG tags. Call on app init. */
export function initDefaultOGTags(): void {
  setMeta('og:title', OG_TITLE)
  setMeta('og:description', OG_DESC)
  setMeta('og:type', 'website')
  setMeta('og:url', OG_URL)
  setMeta('og:image', OG_IMAGE)
  setMeta('og:site_name', SITE_NAME)
  setMeta('twitter:card', 'summary_large_image', true)
  setMeta('twitter:title', OG_TITLE, true)
  setMeta('twitter:description', OG_DESC, true)
  setMeta('twitter:image', OG_IMAGE, true)
}

export interface MelodyOGMeta {
  noteCount: number
  bpm?: number
  key?: string
}

/** "An 8-note", "A 16-note": the article goes by how the number is said.
 *  It starts on a vowel for eight, eighty and eight hundred (any number
 *  written with a leading 8), and for eleven and eighteen, also when they
 *  lead a larger number ("eleven thousand"). */
function articleFor(count: number): 'A' | 'An' {
  const digits = String(Math.trunc(Math.abs(count)))
  // The digits said before the first "thousand" or "million".
  const lead = digits.slice(0, ((digits.length - 1) % 3) + 1)
  return digits.startsWith('8') || lead === '11' || lead === '18' ? 'An' : 'A'
}

/** Update OG tags for a shared melody. */
export function setMelodyOGTags(meta: MelodyOGMeta): void {
  const title =
    meta.key !== null && meta.key !== undefined
      ? `Melody in ${meta.key} shared on MercuryPitch`
      : 'Melody shared on MercuryPitch'

  const parts: string[] = [
    `${articleFor(meta.noteCount)} ${meta.noteCount}-note melody`,
  ]
  if (meta.bpm !== null && meta.bpm !== undefined)
    parts.push(`at ${meta.bpm} BPM`)
  if (meta.key !== null && meta.key !== undefined) parts.push(`in ${meta.key}`)
  const description = `${parts.join(' ')}. Practice it on MercuryPitch.`

  const url = window.location.href

  setMeta('og:title', title)
  setMeta('og:description', description)
  setMeta('og:url', url)
  setMeta('twitter:title', title, true)
  setMeta('twitter:description', description, true)
}

/** Revert OG tags to defaults (when melody is cleared). */
export function resetToDefaultOGTags(): void {
  setMeta('og:title', OG_TITLE)
  setMeta('og:description', OG_DESC)
  setMeta('og:url', OG_URL)
  setMeta('twitter:title', OG_TITLE, true)
  setMeta('twitter:description', OG_DESC, true)
}
