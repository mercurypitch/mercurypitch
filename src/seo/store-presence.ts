// ============================================================
// Store presence — what the website tells machines about the native apps
// ============================================================
//
// Worked out from the store listings (src/lib/store-listings.ts), so the day a
// listing goes live every machine-read surface follows it, and none of them can
// name a listing that is not live. Today none is, and every function here
// returns nothing.
//
//   - Safari's Smart App Banner, once the App Store listing is live. The
//     generated entry documents carry it on their own (render-entry-page.ts);
//     index.html is hand-written, and store-presence.test.ts fails until it
//     carries the same tag.
//   - A MobileApplication node per live store on the home page, linked to the
//     organization the way the web app is. Hand-written in index.html, held to
//     these nodes by the same test.
//   - `related_applications` in public/site.webmanifest, which is what lets
//     Chrome on Android answer getInstalledRelatedApps(). Hand-written too:
//     the service worker precaches the manifest by its hash, so a copy
//     rewritten after the build would be cached under the old one.
//     `prefer_related_applications` stays false, because the store app must
//     never take over the web app's own install prompt.
//
// No `app-argument` on the banner yet. It hands the page's URL to the app, and
// is worth adding once the app opens links (docs/plans/search-and-answer-engines.md).
// The native build never includes any of this: it has its own Vite config.

// Relative, not '@/': render-entry-page.ts imports this, and vite.config.ts
// loads that before the alias exists.
import type { StoreListings } from '../lib/store-listings'
import { STORE_LISTINGS, storeLinks } from '../lib/store-listings'
import { ORGANIZATION_ID, SITE_ORIGIN } from './entry-pages'

/** The `content` of Safari's Smart App Banner meta tag, or undefined while
 *  the App Store listing is not live. */
export function smartAppBannerContent(
  listings: StoreListings = STORE_LISTINGS,
): string | undefined {
  return storeLinks(listings).appStore === undefined
    ? undefined
    : `app-id=${listings.appStore.appleId}`
}

/** The whole tag, as index.html and the entry documents write it. */
export function smartAppBannerTag(
  listings: StoreListings = STORE_LISTINGS,
): string | undefined {
  const content = smartAppBannerContent(listings)
  return content === undefined
    ? undefined
    : `<meta name="apple-itunes-app" content="${content}" />`
}

/** One MobileApplication node per live store, for the home page. */
export function mobileApplicationNodes(
  listings: StoreListings = STORE_LISTINGS,
): Record<string, unknown>[] {
  const links = storeLinks(listings)
  const node = (id: string, os: string, url: string) => ({
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    '@id': `${SITE_ORIGIN}/#${id}`,
    name: 'MercuryPitch',
    alternateName: 'Mercury Pitch',
    operatingSystem: os,
    applicationCategory: 'MusicApplication',
    url,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORGANIZATION_ID },
  })
  return [
    ...(links.appStore === undefined
      ? []
      : [node('ios-app', 'iOS', links.appStore)]),
    ...(links.googlePlay === undefined
      ? []
      : [node('android-app', 'Android', links.googlePlay)]),
  ]
}

export interface RelatedApplication {
  platform: 'play' | 'itunes'
  url: string
  id?: string
}

/** The web manifest's `related_applications`, one entry per live store. */
export function relatedApplications(
  listings: StoreListings = STORE_LISTINGS,
): RelatedApplication[] {
  const links = storeLinks(listings)
  return [
    ...(links.googlePlay === undefined
      ? []
      : [
          {
            platform: 'play' as const,
            url: links.googlePlay,
            id: listings.googlePlay.packageName,
          },
        ]),
    ...(links.appStore === undefined
      ? []
      : [{ platform: 'itunes' as const, url: links.appStore }]),
  ]
}
