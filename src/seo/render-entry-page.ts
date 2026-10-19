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
import { ABOUT_URL, canonicalPath, DEFAULT_THEME_COLOR, navLinksFor, OG_IMAGE, OG_IMAGE_SIZE, ORGANIZATION_ID, SITE_ORIGIN, STUDIO_APP_ID, } from './entry-pages'
import { smartAppBannerTag } from './store-presence'

/** Escape for an attribute value or text node. */
function esc(value: string): string {
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
  /** The released Find Your Pitch lessons, linked after Home in the nav.
   *  The build reads them off learn/ (tools/lesson-links.ts). */
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
  const robots = unlisted.includes(page.slug)
    ? 'noindex, follow'
    : 'index, follow'
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
         The mark below is a real <img> the preload scanner finds anyway. -->
    <link rel="preload" as="image" href="/brand-mark.svg" />
    <link rel="stylesheet" href="/src/styles/entry-prelude.css" />
  </head>
  <body>
    <div id="root"></div>
    <div class="entry-prelude">
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
      <p>${esc(page.lede)}</p>
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
