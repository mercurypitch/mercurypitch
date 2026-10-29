// ============================================================
// Experimental features store — what this page shows, and the switches it reads at startup
// ============================================================
//
// The build gives every experimental feature one default
// (EXPERIMENTAL_FEATURES_BUILD_DEFAULT: on for the dev deploy, PR previews,
// `pnpm dev` and the e2e bundle, off for mercurypitch.com and the native
// app). The owner can switch a feature either way per environment from his
// console; the db-worker serves the switches at GET /api/features, and a
// switch wins over the default (src/lib/experimental-features.ts).
//
// The web entry asks once, at startup (src/index.tsx), and nothing waits for
// the answer: the default holds until it comes, and a failure, a timeout or
// an answer this page cannot read leaves the default standing. The native
// entry never asks, so the native app is its build's default alone.
//
// `experimentalFeaturesPending` is true only while that one read is in
// flight. The route guard (App.tsx) asks it, so a deep link to a feature the
// owner switched on is not sent Home on a default that is about to change.
//
// Kept free of `@/lib/defaults` on purpose: src/features/tabs/constants.ts
// imports this store, rooms built to stand alone import that file, and
// defaults.ts is pinned into the `pitch-core` chunk. The API base is read
// inline for that reason, as src/index.tsx reads its portable-console flag.

import { createSignal } from 'solid-js'
import type { ExperimentalFeature, FeatureOverrides, } from '@/lib/experimental-features'
import { FEATURES_PATH, parseFeatureOverrides, resolveExperimentalFeature, } from '@/lib/experimental-features'

/**
 * This build's default for every experimental feature. vite.config.ts pins
 * the variable to "1" or "0" with a `define` (tools/experimental-features.ts
 * decides which), so the comparison folds.
 */
export const EXPERIMENTAL_FEATURES_BUILD_DEFAULT: boolean =
  import.meta.env.VITE_EXPERIMENTAL_FEATURES === '1'

/** How long the startup read may take before the build's default stands for this page. */
export const FEATURES_READ_TIMEOUT_MS = 2500

/** The db-worker this build talks to; empty in a build with no API (the e2e and tour bundles). */
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? ''

/** Loopback only: a page served from anywhere else never opens the e2e door. */
const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

/**
 * What an e2e spec hands the page before it boots, as
 * `window.__MP_E2E_EXPERIMENTS__`. A build with no API has nowhere to read
 * switches from, so on a loopback host the door reads them from the page's
 * own origin, where the spec answers them. `buildDefault` boots the e2e
 * bundle as the production build's default, and `timeoutMs` lets a spec hold
 * the read open for as long as it needs to look at the page meanwhile.
 * Nothing else sets it.
 */
interface E2EExperimentsDoor {
  buildDefault?: boolean
  timeoutMs?: number
}

interface FeaturesRead {
  url: string
  timeoutMs?: number
}

export interface LoadExperimentalFeaturesOptions {
  /** The db-worker to ask. Defaults to the build's API base. */
  base?: string
  fetcher?: typeof fetch
  timeoutMs?: number
}

const [overrides, setOverrides] = createSignal<FeatureOverrides>({})
const [pending, setPending] = createSignal(false)
const [buildDefault, setBuildDefault] = createSignal(
  EXPERIMENTAL_FEATURES_BUILD_DEFAULT,
)
let request: Promise<void> | null = null

/** Whether this page shows `name`. Reactive: it follows the startup read when it lands. */
export function experimentalFeatureOn(name: ExperimentalFeature): boolean {
  return resolveExperimentalFeature(name, buildDefault(), overrides())
}

/** True while the startup read is in flight. Reactive. */
export function experimentalFeaturesPending(): boolean {
  return pending()
}

function e2eDoor(): E2EExperimentsDoor | null {
  if (typeof window === 'undefined') return null
  const door = (window as { __MP_E2E_EXPERIMENTS__?: unknown })
    .__MP_E2E_EXPERIMENTS__
  if (typeof door !== 'object' || door === null) return null
  if (!LOOPBACK_HOSTS.includes(window.location.hostname)) return null
  return door as E2EExperimentsDoor
}

/** Where to ask, or null when this build has nowhere to ask. */
function featuresRead(base: string): FeaturesRead | null {
  const trimmed = base.replace(/\/+$/, '')
  if (trimmed !== '') return { url: `${trimmed}${FEATURES_PATH}` }
  const door = e2eDoor()
  if (door === null) return null
  if (typeof door.buildDefault === 'boolean') setBuildDefault(door.buildDefault)
  return {
    url: FEATURES_PATH,
    timeoutMs:
      typeof door.timeoutMs === 'number' && door.timeoutMs > 0
        ? door.timeoutMs
        : undefined,
  }
}

/** The switches, or none at all on any failure. Never rejects. */
async function readOverrides(
  url: string,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<FeatureOverrides> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(url, { signal: controller.signal })
    if (!response.ok) return {}
    return parseFeatureOverrides(await response.json())
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask the db-worker for the owner's switches, once per page; later calls
 * share the first. Never rejects, and never blocks: call it without waiting.
 */
export function loadExperimentalFeatures(
  options: LoadExperimentalFeaturesOptions = {},
): Promise<void> {
  if (request !== null) return request
  const read = featuresRead(options.base ?? API_BASE)
  if (read === null) {
    request = Promise.resolve()
    return request
  }
  setPending(true)
  request = readOverrides(
    read.url,
    options.fetcher ?? ((input, init) => fetch(input, init)),
    options.timeoutMs ?? read.timeoutMs ?? FEATURES_READ_TIMEOUT_MS,
  ).then((answer) => {
    setOverrides(answer)
    setPending(false)
  })
  return request
}

/** Back to a page that has not asked yet, on this build's default. Tests only. */
export function resetExperimentalFeaturesStoreForTests(): void {
  request = null
  setOverrides({})
  setPending(false)
  setBuildDefault(EXPERIMENTAL_FEATURES_BUILD_DEFAULT)
}
