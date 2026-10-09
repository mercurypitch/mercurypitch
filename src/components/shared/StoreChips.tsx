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
//
// SURFACE-AGNOSTIC. Mounted on the Mirror's two results and on First Light's
// Map, which is why it lives here and not in either feature. It names no
// surface and counts nothing itself: the mount site passes `onChipClick` and
// counts the click under its own event name, because the funnel stores an
// event name and a client id and nothing else. Its look is set through custom
// properties on the `class` a surface passes in (StoreChips.module.css).

import type { Component } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import type { StoreListings } from '@/lib/store-listings'
import { STORE_LISTINGS, STORE_PREVIEW_VIDEO_URL, storeLinks, } from '@/lib/store-listings'
import styles from './StoreChips.module.css'

/** Which store a chip or badge names. */
export type StoreId = 'app-store' | 'google-play'

interface Store {
  id: StoreId
  name: string
  /** The listing, once live and well formed. */
  href?: string
  /** The official badge: its words are its accessible name. */
  badge: { label: string; src: string; width: number; height: number }
}

export interface StoreChipsProps {
  /** Overrides the shipped config, for tests. */
  listings?: StoreListings
  /**
   * A chip or badge was clicked, coming soon or live. The mount site counts
   * it under its own event name; the link opens either way.
   */
  onChipClick?: (store: StoreId) => void
  /** The surface's class on the root, where it sets the custom properties
   *  StoreChips.module.css reads (colours, margin, caption size). */
  class?: string
}

/** What people hold, for the caption: an iPhone, not an App Store. */
const DEVICE: Record<StoreId, string> = {
  'app-store': 'iPhone',
  'google-play': 'Android',
}

/**
 * The caption over the coming-soon chips: the devices still waiting, the way
 * launches say it ("coming soon to iPhone and Android"), then what the chips
 * open meanwhile, which is the Android tablet video.
 */
function comingSoonCaption(waiting: readonly Store[]): string {
  const devices = waiting.map((s) => DEVICE[s.id]).join(' and ')
  const buttons =
    waiting.length > 1
      ? 'both buttons play'
      : `the ${waiting[0].name} button plays`
  return (
    `Coming soon to ${devices}. For now, ${buttons} a first look, filmed ` +
    'on an Android tablet: leave the app mid-song and the karaoke keeps ' +
    'playing, with the lyrics floating on top.'
  )
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
  const comingSoon = (): Store[] => stores().filter((s) => s.href === undefined)
  const captionId = createUniqueId()

  return (
    <div class={`${styles.root} ${props.class ?? ''}`}>
      <Show when={comingSoon().length > 0}>
        <p class={styles.caption} id={captionId}>
          {comingSoonCaption(comingSoon())}
        </p>
      </Show>
      <div class={styles.row}>
        <For each={stores()}>
          {(store) => (
            <Show
              when={store.href}
              fallback={
                <a
                  class={styles.chip}
                  data-store={store.id}
                  href={STORE_PREVIEW_VIDEO_URL}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Coming soon: ${store.name}. Opens a video of the app on YouTube, in a new tab.`}
                  aria-describedby={captionId}
                  onClick={() => props.onChipClick?.(store.id)}
                >
                  <span class={styles.chipSoon}>Coming soon</span>
                  <span class={styles.chipName}>{store.name}</span>
                </a>
              }
            >
              {(href) => (
                <a
                  class={styles.badge}
                  data-store={store.id}
                  href={href()}
                  target="_blank"
                  rel="noopener"
                  onClick={() => props.onChipClick?.(store.id)}
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
  IS_NATIVE_BUILD ? null : (
    <WebStoreChips
      listings={props.listings}
      onChipClick={props.onChipClick}
      class={props.class}
    />
  )
