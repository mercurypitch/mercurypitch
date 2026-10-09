// The store config is the one place the native listings are named, so these
// tests hold it to the two facts it borrows: the Android package name the
// native build ships under, and the link shapes the stores answer to.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { StoreListings } from './store-listings'
import { appStoreUrl, googlePlayUrl, STORE_LISTINGS, STORE_PREVIEW_VIDEO_URL, storeLinks, storeListingProblems, } from './store-listings'

const ROOT = resolve(__dirname, '../..')
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8')

const live = (over: Partial<StoreListings> = {}): StoreListings => ({
  appStore: { live: true, appleId: '6740000000' },
  googlePlay: { live: true, packageName: 'com.example.app' },
  ...over,
})

describe('store listings config', () => {
  it('ships valid, so a bad edit fails here instead of linking to a 404', () => {
    expect(storeListingProblems(STORE_LISTINGS)).toEqual([])
  })

  it('names the package the Android build ships under', () => {
    const { packageName } = STORE_LISTINGS.googlePlay
    expect(read('apps/mercurypitch/android/app/build.gradle')).toContain(
      `applicationId "${packageName}"`,
    )
    expect(read('apps/mercurypitch/capacitor.config.ts')).toContain(
      `appId: '${packageName}'`,
    )
  })

  it('keeps the placeholder video in one value', () => {
    expect(STORE_PREVIEW_VIDEO_URL).toBe(
      'https://www.youtube.com/watch?v=NSK9kc_0-dw',
    )
  })
})

describe('store links', () => {
  it('builds the ID-only App Store link and the package Play link', () => {
    expect(appStoreUrl('6740000000')).toBe(
      'https://apps.apple.com/app/id6740000000',
    )
    expect(googlePlayUrl('com.example.app')).toBe(
      'https://play.google.com/store/apps/details?id=com.example.app',
    )
  })

  it('gives no link for a listing that is not live', () => {
    expect(
      storeLinks({
        appStore: { live: false, appleId: '' },
        googlePlay: { live: false, packageName: 'com.example.app' },
      }),
    ).toEqual({})
  })

  it('links each live listing to its store page', () => {
    expect(storeLinks(live())).toEqual({
      appStore: 'https://apps.apple.com/app/id6740000000',
      googlePlay:
        'https://play.google.com/store/apps/details?id=com.example.app',
    })
  })

  it('reports a live listing with a malformed ID and leaves it unlinked', () => {
    const bad = live({
      appStore: { live: true, appleId: 'id6740000000' },
      googlePlay: { live: true, packageName: 'Com.Example' },
    })
    expect(storeListingProblems(bad)).toHaveLength(2)
    expect(storeLinks(bad)).toEqual({})
  })

  it('does not ask for an Apple ID before the App Store listing is live', () => {
    expect(
      storeListingProblems({
        appStore: { live: false, appleId: '' },
        googlePlay: { live: false, packageName: 'com.example.app' },
      }),
    ).toEqual([])
  })
})
