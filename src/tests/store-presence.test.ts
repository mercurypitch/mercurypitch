import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { StoreListings } from '@/lib/store-listings'
import { STORE_LISTINGS } from '@/lib/store-listings'
import { ENTRY_PAGES } from '@/seo/entry-pages'
import { renderEntryPage } from '@/seo/render-entry-page'
import { mobileApplicationNodes, relatedApplications, smartAppBannerContent, smartAppBannerTag, } from '@/seo/store-presence'

// What the website tells machines about the native apps follows the store
// listings and nothing else (src/seo/store-presence.ts). Today no listing is
// live, so most of this checks for silence; the fake listings below check what
// the first day of each store will produce.

const repoFile = (path: string) =>
  readFileSync(`${process.cwd()}/${path}`, 'utf8')

const APPLE_ID = '6740000000'
const PACKAGE = 'com.irchiinnuss.mercurypitch'
const APP_STORE_URL = `https://apps.apple.com/app/id${APPLE_ID}`
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}`

const listings = (appStore: boolean, googlePlay: boolean): StoreListings => ({
  appStore: { live: appStore, appleId: APPLE_ID },
  googlePlay: { live: googlePlay, packageName: PACKAGE },
})

function jsonLd(html: string): Record<string, unknown>[] {
  return Array.from(
    new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelectorAll('script[type="application/ld+json"]'),
  ).map((node) => JSON.parse(node.textContent ?? '{}'))
}

describe('store presence, from the listings', () => {
  it('says nothing while no listing is live', () => {
    const none = listings(false, false)
    expect(smartAppBannerContent(none)).toBeUndefined()
    expect(mobileApplicationNodes(none)).toEqual([])
    expect(relatedApplications(none)).toEqual([])
  })

  it('offers the Smart App Banner only for a live App Store listing', () => {
    expect(smartAppBannerContent(listings(true, false))).toBe(
      `app-id=${APPLE_ID}`,
    )
    expect(smartAppBannerContent(listings(false, true))).toBeUndefined()
    // The store chips' rule: a live flag with no Apple ID links nowhere.
    expect(
      smartAppBannerContent({
        ...listings(false, false),
        appStore: { live: true, appleId: '' },
      }),
    ).toBeUndefined()
  })

  it('describes each live store as a free mobile app from the same publisher', () => {
    const nodes = mobileApplicationNodes(listings(true, true))

    expect(nodes.map((node) => node.operatingSystem)).toEqual([
      'iOS',
      'Android',
    ])
    expect(nodes.map((node) => node.url)).toEqual([APP_STORE_URL, PLAY_URL])
    for (const node of nodes) {
      expect(node['@type']).toBe('MobileApplication')
      expect(node.publisher).toEqual({
        '@id': 'https://mercurypitch.com/#organization',
      })
      expect(node.offers).toEqual({
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      })
    }
    expect(mobileApplicationNodes(listings(false, true))).toHaveLength(1)
  })

  it('lists each live store for getInstalledRelatedApps, Play by package name', () => {
    expect(relatedApplications(listings(true, true))).toEqual([
      { platform: 'play', url: PLAY_URL, id: PACKAGE },
      { platform: 'itunes', url: APP_STORE_URL },
    ])
  })
})

describe('the generated entry documents', () => {
  it('carry the banner once the App Store listing is live, and not before', () => {
    for (const page of ENTRY_PAGES) {
      expect(
        renderEntryPage(page, { listings: listings(false, true) }),
      ).not.toContain('apple-itunes-app')
      expect(
        renderEntryPage(page, { listings: listings(true, false) }),
      ).toContain(
        `<meta name="apple-itunes-app" content="app-id=${APPLE_ID}" />`,
      )
    }
  })

  it('carry what the shipped listings say', () => {
    const tag = smartAppBannerTag(STORE_LISTINGS)
    for (const page of ENTRY_PAGES) {
      const html = repoFile(`${page.slug}.html`)
      if (tag === undefined) expect(html).not.toContain('apple-itunes-app')
      else expect(html).toContain(tag)
    }
  })
})

// index.html and the manifest are written by hand, so nothing updates them on
// the day a listing goes live. These fail that day, naming what to add, until
// the files match the listings.
describe('the hand-written files', () => {
  it('index.html carries the Smart App Banner exactly when the App Store is live', () => {
    const html = repoFile('index.html')
    const tag = smartAppBannerTag(STORE_LISTINGS)
    if (tag === undefined) expect(html).not.toContain('apple-itunes-app')
    else expect(html, `index.html needs ${tag}`).toContain(tag)
  })

  it('index.html describes each live store app, and no other', () => {
    const apps = jsonLd(repoFile('index.html')).filter(
      (node) => node['@type'] === 'MobileApplication',
    )
    expect(apps, 'index.html needs these MobileApplication nodes').toEqual(
      mobileApplicationNodes(STORE_LISTINGS),
    )
  })

  it('the web manifest lists each live store app, and never prefers it', () => {
    const manifest = JSON.parse(repoFile('public/site.webmanifest'))
    const expected = relatedApplications(STORE_LISTINGS)

    if (expected.length === 0) {
      expect(manifest.related_applications).toBeUndefined()
    } else {
      expect(
        manifest.related_applications,
        'site.webmanifest needs these related_applications',
      ).toEqual(expected)
    }
    // true makes Chrome offer the store app instead of the web app's install.
    expect(manifest.prefer_related_applications ?? false).toBe(false)
  })
})
