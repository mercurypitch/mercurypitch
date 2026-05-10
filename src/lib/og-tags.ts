// ============================================================
// OG Tags — Dynamic Open Graph meta tag management
// ============================================================

const OG_TITLE = 'PitchPerfect — Vocal Pitch Training with Real-Time Feedback'
const OG_DESC =
  'Train your vocal pitch with real-time audio feedback, piano roll visualization, and accuracy scoring.'
const OG_IMAGE = 'https://pitchperfect.clodhost.com/favicon.png'
const OG_URL = 'https://pitchperfect.clodhost.com/'
const SITE_NAME = 'PitchPerfect'

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

function removeMeta(property: string, isName = false): void {
  const attr = isName ? 'name' : 'property'
  const el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${property}"]`,
  )
  if (el) el.remove()
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

/** Update OG tags for a shared melody. */
export function setMelodyOGTags(meta: MelodyOGMeta): void {
  const title = meta.key
    ? `Melody in ${meta.key} shared on PitchPerfect`
    : 'Melody shared on PitchPerfect'

  const parts: string[] = [`A ${meta.noteCount}-note melody`]
  if (meta.bpm) parts.push(`at ${meta.bpm} BPM`)
  if (meta.key) parts.push(`in ${meta.key}`)
  parts.push('— practice it on PitchPerfect.')
  const description = parts.join(' ')

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
