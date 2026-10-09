// ============================================================
// Store chips — the native app, named on the voiceprint result
// ============================================================
//
// Two links under the result, one per store. While a store's listing is not
// live (src/lib/store-listings.ts) its link is the Mirror's own text chip,
// "Coming soon" over the store's name, and it opens the preview video, with a
// caption that says what the video shows. Once the listing is live, the chip
// is replaced by that store's official badge, unaltered, linked to the
// listing.
//
// TEXT ONLY UNTIL LIVE, on purpose. Apple: "Don't use the standalone Apple
// logo", "Use only the badge artwork provided", and its badge licence covers
// apps "available for download on the App Store". Google: the Play icon
// "should only be used within the context of the Google Play lockup", and
// "Don't use the icon in marketing materials". So no logo, no icon, and
// nothing that looks like the black official badges.
//
// WEB ONLY. Inside the native app the chips are pointless, and App Review
// Guideline 2.3.10 bars names of other mobile platforms in an iOS app. The
// check is IS_NATIVE_BUILD, which constant-folds: under the native build this
// component is `() => null` and its copy is not in the bundle at all. (The
// Mirror is a separate web entry that the native build does not include
// either; this is the second lock, for whoever reuses the component.)

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import type { StoreListings } from '@/lib/store-listings'
import { STORE_LISTINGS, STORE_PREVIEW_VIDEO_URL, storeLinks, } from '@/lib/store-listings'

interface Store {
  id: 'app-store' | 'google-play'
  name: string
  /** The listing, once live and well formed. */
  href?: string
  /** The official badge: its words are its accessible name. */
  badge: { label: string; src: string; width: number; height: number }
}

export interface StoreChipsProps {
  /** Overrides the shipped config, for tests. */
  listings?: StoreListings
}

const WebStoreChips: Component<StoreChipsProps> = (props) => {
  const stores = (): Store[] => {
    const links = storeLinks(props.listings ?? STORE_LISTINGS)
    return [
      {
        id: 'app-store',
        name: 'App Store',
        href: links.appStore,
        badge: {
          label: 'Download on the App Store',
          src: '/stores/app-store-badge.svg',
          width: 120,
          height: 40,
        },
      },
      {
        id: 'google-play',
        name: 'Google Play',
        href: links.googlePlay,
        badge: {
          label: 'Get it on Google Play',
          src: '/stores/google-play-badge.png',
          width: 646,
          height: 250,
        },
      },
    ]
  }
  const anyComingSoon = (): boolean =>
    stores().some((s) => s.href === undefined)

  return (
    <div class="mirror-stores">
      <Show when={anyComingSoon()}>
        <p class="mirror-stores-caption" id="mirror-stores-caption">
          The MercuryPitch app is on its way. The video shows it on an Android
          tablet: leave the app mid-song and the karaoke keeps playing, with the
          lyrics floating on top.
        </p>
      </Show>
      <div class="mirror-stores-row">
        <For each={stores()}>
          {(store) => (
            <Show
              when={store.href}
              fallback={
                <a
                  class="mirror-store-chip"
                  data-store={store.id}
                  href={STORE_PREVIEW_VIDEO_URL}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Coming soon: ${store.name}. Opens a video of the app on YouTube, in a new tab.`}
                  aria-describedby="mirror-stores-caption"
                >
                  <span class="mirror-store-chip-soon">Coming soon</span>
                  <span class="mirror-store-chip-name">{store.name}</span>
                </a>
              }
            >
              {(href) => (
                <a
                  class="mirror-store-badge"
                  data-store={store.id}
                  href={href()}
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    src={store.badge.src}
                    width={store.badge.width}
                    height={store.badge.height}
                    alt={store.badge.label}
                    decoding="async"
                  />
                </a>
              )}
            </Show>
          )}
        </For>
      </div>
    </div>
  )
}

/** The store chips, or nothing at all inside the native app. */
export const StoreChips: Component<StoreChipsProps> = (props) =>
  IS_NATIVE_BUILD ? null : <WebStoreChips listings={props.listings} />
