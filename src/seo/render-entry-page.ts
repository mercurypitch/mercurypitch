// Renders one EntryPage to the HTML document that ships at <slug>.html.
//
// Everything a crawler reads before JavaScript runs is produced here, so this
// file is where the shape of an entry document is decided — head metadata, the
// structured data, the prelude block and the cross-links. Per-page words live
// in entry-pages.ts; nothing page-specific belongs below.

// Relative, not '@/': vite.config.ts loads this file through
// tools/generate-entry-pages.ts, before the alias exists.
import { LEGAL_DOCUMENT_LINKS } from '../lib/legal-links'
import type { StoreListings } from '../lib/store-listings'
import type { EntryPage } from './entry-pages'
import { ABOUT_URL, canonicalPath, DEFAULT_THEME_COLOR, navLinksFor, OG_IMAGE, OG_IMAGE_SIZE, ORGANIZATION_ID, SITE_ORIGIN, STUDIO_APP_ID, X_SITE_HANDLE, } from './entry-pages'
import { smartAppBannerTag } from './store-presence'

/**
 * The robots directive of an entry document this build lists. The share cards
 * are 1200 px wide, and Search and Discover show one large only where the page
 * allows it, as the lessons' heads already do.
 */
export const LISTED_ROBOTS = 'index, follow, max-image-preview:large'
/** An entry this build serves but keeps out of discovery (`unlisted`). */
export const UNLISTED_ROBOTS = 'noindex, follow'

/** Escape for an attribute value or text node. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function structuredData(page: EntryPage): unknown[] {
  const nodes: unknown[] = []
  if (page.app) {
    const url = `${SITE_ORIGIN}${canonicalPath(page)}`
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name: page.app.name,
      url,
      applicationCategory: page.app.category,
      operatingSystem: 'Any (browser)',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      // Both nodes are defined in full in index.html. Linking them by @id is
      // what makes every room part of one studio from one publisher, rather
      // than unrelated apps that happen to share a name.
      isPartOf: {
        '@type': 'WebApplication',
        '@id': STUDIO_APP_ID,
        name: 'MercuryPitch',
        url: `${SITE_ORIGIN}/`,
      },
      publisher: {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'MercuryPitch',
        url: `${SITE_ORIGIN}/`,
      },
      description: page.app.description,
    })
  }
  if (page.faq !== undefined && page.faq.length > 0) {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }
  return nodes
}

/**
 * The rooms whose documents keep their questions on screen once the room is
 * up, under it. Two rooms are pages that scroll, and several documents open
 * each: the Voice Mirror's four and Karaoke Night's three. Once the room
 * mounted, the prelude that tells those documents apart was display:none,
 * and they read as copies of each other (SEO audit, 6 Nov 2026). Their
 * prelude is marked `data-keeps="faq"`, and the room borrows its FAQ, and
 * nothing else of it, into its own page above its legal row or footer
 * (src/components/EntryFaq.tsx). The studio's rooms are not pages that
 * scroll, so their documents keep the prelude's old rule.
 */
const ROOMS_KEEPING_THEIR_QUESTIONS: ReadonlySet<string> = new Set([
  '/src/features/mirror/main.tsx',
  '/src/features/karaoke-night/main.tsx',
])

/** Whether `page`'s FAQ stays on screen in its room, above its foot (`data-keeps="faq"`). */
export function keepsQuestionsUnderRoom(page: EntryPage): boolean {
  return (
    ROOMS_KEEPING_THEIR_QUESTIONS.has(page.boot) && (page.faq?.length ?? 0) > 0
  )
}

/** A lesson's clean path, as tools/draft-lessons.ts `lessonPath` writes it: `/learn/01`. */
const lessonHref = (n: number): string => `/learn/${String(n).padStart(2, '0')}`

/**
 * The paragraph under the lede that links the lessons this room practises
 * (`lessonsPractised`, SEARCH.md § 8), in the words the nav gives them. Only
 * a lesson in `released` is linked, and the build lists a lesson there only
 * once it is released (tools/lesson-links.ts), so a draft never is; nothing
 * when none is.
 */
export function practisedLessonsMarkup(
  page: EntryPage,
  released: readonly { href: string; label: string }[],
): string {
  const hrefs = (page.lessonsPractised ?? []).map(lessonHref)
  const links = released
    .filter((lesson) => hrefs.includes(lesson.href))
    .map((lesson) => `<a href="${esc(lesson.href)}">${esc(lesson.label)}</a>`)
  if (links.length === 0) return ''
  const last = links[links.length - 1]
  const list =
    links.length === 1 ? last : `${links.slice(0, -1).join(', ')} and ${last}`
  const lead =
    links.length === 1 ? 'Find Your Pitch lesson' : 'Find Your Pitch lessons'
  return `
      <p class="entry-prelude__lessons">${lead}: ${list}</p>`
}

export interface RenderEntryPageOptions {
  /**
   * Slugs this build serves but keeps out of discovery: no other entry links
   * to them, and their own document asks not to be indexed. See
   * tools/glassworks-listing.ts.
   */
  unlisted?: readonly string[]
  /** The store listings the banner is worked out from. Tests only; the build
   *  uses the shipped ones (src/lib/store-listings.ts). */
  listings?: StoreListings
  /** The released Find Your Pitch lessons, linked after Home in the nav,
   *  and those this room practises under its lede. The build reads them off
   *  learn/ (tools/lesson-links.ts). */
  lessons?: readonly { href: string; label: string }[]
}

export function renderEntryPage(
  page: EntryPage,
  options: RenderEntryPageOptions = {},
): string {
  const unlisted = options.unlisted ?? []
  const canonical = `${SITE_ORIGIN}${canonicalPath(page)}`
  const image = page.og.image ?? OG_IMAGE
  const imageSize = page.og.imageSize ?? OG_IMAGE_SIZE
  const ld = structuredData(page)
  // Safari's Smart App Banner, only once the App Store listing is live
  // (src/seo/store-presence.ts).
  const banner = smartAppBannerTag(options.listings)
  const robots = unlisted.includes(page.slug) ? UNLISTED_ROBOTS : LISTED_ROBOTS
  const nav = navLinksFor(page, unlisted, options.lessons)
    .map((link) => `        <a href="${esc(link.href)}">${esc(link.label)}</a>`)
    .join('\n')
  const legalNav = LEGAL_DOCUMENT_LINKS.map(
    (link) => `        <a href="${esc(link.href)}">${esc(link.label)}</a>`,
  ).join('\n')

  const faqSection =
    page.faq !== undefined && page.faq.length > 0
      ? `
      <section class="entry-prelude__faq">
${page.faq
  .map(
    (item) => `        <h2>${esc(item.q)}</h2>
        <p>${esc(item.a)}</p>`,
  )
  .join('\n')}
      </section>`
      : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}" />
    <meta name="author" content="MercuryPitch" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${canonical}" />

    <!-- Open Graph -->
    <meta property="og:title" content="${esc(page.og.title)}" />
    <meta property="og:description" content="${esc(page.og.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="${imageSize.width}" />
    <meta property="og:image:height" content="${imageSize.height}" />
    <meta property="og:image:alt" content="${esc(page.og.imageAlt)}" />
    <meta property="og:site_name" content="MercuryPitch" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="${X_SITE_HANDLE}" />
    <meta name="twitter:title" content="${esc(page.twitter.title)}" />
    <meta
      name="twitter:description"
      content="${esc(page.twitter.description)}"
    />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${esc(page.og.imageAlt)}" />

    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="${esc(page.themeColor ?? DEFAULT_THEME_COLOR)}" />
${banner === undefined ? '' : `    ${banner}\n`}${ld
    .map(
      (node) => `    <script type="application/ld+json">
${JSON.stringify(node, null, 2)
  .split('\n')
  .map((line) => `      ${line}`)
  .join('\n')}
    </script>`,
    )
    .join('\n')}

    <!-- The opening plates are NOT preloaded here, deliberately.
         They were, at high fetch priority, which queued 173 KB of decoration
         ahead of all 36 module scripts — and the bundle arriving is the very
         thing that ends the prelude, so the art competed with its own
         dismissal. Measured on 2026-09-09: the plate downloaded in full, and
         nothing ever painted it. On an entry document the plate is only a CSS
         background of .entry-prelude, and that is hidden the moment #root
         fills; the app's own opening curtain, which does paint it, never
         renders on these pages at all. A browser skips the background of a
         hidden element, so a fast boot now pays nothing while a slow boot —
         the one the prelude exists for — still gets the art while it is up.
         index.html keeps its preload: there the curtain really does paint it.
         The mark below is a real image element, which the preload scanner
         finds anyway. (Named without its tag: an SEO scanner that reads raw
         markup counts a tag here as an image with no alt text.) -->
    <link rel="preload" as="image" href="/brand-mark.svg" />
    <link rel="stylesheet" href="/src/styles/entry-prelude.css" />
  </head>
  <body>
    <div id="root"></div>
    <div class="entry-prelude"${keepsQuestionsUnderRoom(page) ? ' data-keeps="faq"' : ''}>
      <div class="entry-prelude__lockup">
        <img
          class="entry-prelude__mark"
          src="/brand-mark.svg"
          width="68"
          height="68"
          alt="MercuryPitch"
        />
        <span class="entry-prelude__wordmark">Mercury<span>Pitch</span></span>
      </div>
      <h1>${esc(page.h1)}</h1>
      <p>${esc(page.lede)}</p>${practisedLessonsMarkup(page, options.lessons ?? [])}
      <nav aria-label="More from MercuryPitch">
${nav}
      </nav>${faqSection}
      <nav class="entry-prelude__legal" aria-label="Legal">
${legalNav}
      </nav>
    </div>
    <noscript>${esc(page.noscript)}</noscript>${
      page.bootHash !== undefined && page.bootHash !== ''
        ? `
    <!-- The tab is a fragment, so the server never sees it and the document
         still has to be a real, separately indexable page. This opens the
         studio on the right tab without a redirect, and only when the visitor
         did not arrive with a hash of their own. -->
    <script>
      if (!window.location.hash) window.location.hash = '${page.bootHash}'
    </script>`
        : ''
    }
    <script type="module" src="${page.boot}"></script>
  </body>
</html>
`
}

export { ABOUT_URL }
