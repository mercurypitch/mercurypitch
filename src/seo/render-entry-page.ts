// Renders one EntryPage to the HTML document that ships at <slug>.html.
//
// Everything a crawler reads before JavaScript runs is produced here, so this
// file is where the shape of an entry document is decided — head metadata, the
// structured data, the prelude block and the cross-links. Per-page words live
// in entry-pages.ts; nothing page-specific belongs below.

import type { EntryPage } from './entry-pages'
import { ABOUT_URL, canonicalPath, navLinksFor, OG_IMAGE, SITE_ORIGIN, } from './entry-pages'

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
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page.app.name,
      url: `${SITE_ORIGIN}${canonicalPath(page)}`,
      applicationCategory: page.app.category,
      operatingSystem: 'Any (browser)',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isPartOf: {
        '@type': 'WebApplication',
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

export function renderEntryPage(page: EntryPage): string {
  const canonical = `${SITE_ORIGIN}${canonicalPath(page)}`
  const image = page.og.image ?? OG_IMAGE
  const ld = structuredData(page)
  const nav = navLinksFor(page)
    .map((link) => `        <a href="${esc(link.href)}">${esc(link.label)}</a>`)
    .join('\n')

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
    <meta name="description" content="${esc(page.description)}" />${
      page.keywords !== undefined && page.keywords !== ''
        ? `
    <meta name="keywords" content="${esc(page.keywords)}" />`
        : ''
    }
    <meta name="author" content="MercuryPitch" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />

    <!-- Open Graph -->
    <meta property="og:title" content="${esc(page.og.title)}" />
    <meta property="og:description" content="${esc(page.og.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />${
      page.og.imageAlt !== undefined && page.og.imageAlt !== ''
        ? `
    <meta property="og:image:alt" content="${esc(page.og.imageAlt)}" />`
        : ''
    }
    <meta property="og:site_name" content="MercuryPitch" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(page.twitter.title)}" />
    <meta
      name="twitter:description"
      content="${esc(page.twitter.description)}"
    />
    <meta name="twitter:image" content="${image}" />

    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#0b1026" />
${ld
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
          alt=""
        />
        <span class="entry-prelude__wordmark">Mercury<span>Pitch</span></span>
      </div>
      <h1>${esc(page.h1)}</h1>
      <p>${esc(page.lede)}</p>
      <nav aria-label="More from MercuryPitch">
${nav}
      </nav>${faqSection}
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
