// ============================================================
// sw.ts — the MercuryPitch service worker
// ============================================================
// Built by vite-plugin-pwa's `injectManifest` strategy and emitted as
// dist/sw.js, at the site root, so its scope is the whole origin. It exists
// first to make the app installable (Chrome will not offer "Install app"
// without a service worker that handles `fetch`) and second to make the
// installed app open offline and stay on one build across a deploy.
//
// This file is only the wiring: the worker globals, and which runtime call each
// event maps to. Every caching rule — and the reasoning behind it — lives in
// src/lib/sw-runtime.ts, where it can be tested against a fake CacheStorage
// instead of only in a browser.

/// <reference lib="webworker" />

// Forces module scope, which is what lets `self` below be re-declared as the
// worker global instead of colliding with lib.dom's `Window`. Rollup drops it
// from the IIFE bundle.
export {}

import type { SwPrecacheEntry, SwStaleBuildNotice } from './lib/sw-runtime'
import { BUILD_ID_MESSAGE, createServiceWorkerRuntime, UNKNOWN_BUILD_ID, } from './lib/sw-runtime'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: SwPrecacheEntry[]
}

/**
 * Tell every open page that what it just asked for is gone. `src/lib/
 * pwa-service-worker.ts` turns that into an update check, which turns into the
 * reload prompt — the only thing that can actually fix a page whose build is no
 * longer on the origin.
 */
async function broadcast(message: SwStaleBuildNotice): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) client.postMessage(message)
}

const runtime = createServiceWorkerRuntime({
  manifest: self.__WB_MANIFEST,
  // Guarded rather than read directly: if this build ever reaches the worker
  // without Vite's define applied, an unknown build id costs one redundant
  // update prompt, while a ReferenceError costs the whole worker.
  buildId:
    typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : UNKNOWN_BUILD_ID,
  baseUrl: self.location.href,
  env: {
    caches: self.caches,
    fetch: (input, init) => fetch(input, init),
    notifyClients: (message) => {
      void broadcast(message)
    },
  },
})

self.addEventListener('install', (event) => {
  // No skipWaiting(): a worker that took over mid-session would pair its own
  // chunk map with the page's already-loaded HTML. The waiting worker is
  // adopted only when the user accepts the update prompt.
  //
  // install() rejects if it cannot assemble one complete build. That is the
  // point: a worker that fails to install never activates, so the visitor keeps
  // the build they already have and the browser retries on the next check.
  event.waitUntil(runtime.install())
})

self.addEventListener('activate', (event) => {
  // No clients.claim() either, for the same reason. An open page keeps the
  // worker it started with and picks up the new one on its next navigation.
  event.waitUntil(runtime.activate())
})

self.addEventListener('message', (event) => {
  const action = runtime.handleMessage(event.data)
  if (action === undefined) return
  if (action.kind === 'skip-waiting') {
    void self.skipWaiting()
    return
  }
  // The page asks over a MessageChannel so the answer cannot be confused with
  // any other message it receives.
  const port = event.ports[0]
  if (port !== undefined) {
    port.postMessage({ type: BUILD_ID_MESSAGE, buildId: action.buildId })
  }
})

self.addEventListener('fetch', (event) => {
  const response = runtime.handleFetch(event.request)
  // `undefined` is "not this worker's business": the browser performs the
  // request itself, exactly as it would with no worker installed.
  if (response !== undefined) event.respondWith(response)
})
