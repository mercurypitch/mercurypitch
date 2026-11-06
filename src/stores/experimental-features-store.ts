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
// the answer: the page renders at once and follows the answer if it lands
// within FEATURES_READ_TIMEOUT_MS. The native entry never asks, so the
// native app is its build's default alone.
//
// This browser keeps the last answer it heard (REMEMBERED_FEATURES_KEY), and
// every later page starts from it, read before the first render. A read that
// fails, times out or answers something this page cannot read leaves it
// standing; only an answer from the server changes it, an "off" included.
// Without it, a feature the owner switched on in production vanished for
// any visit whose read was slow or offline, and Studio took the songs it
// keeps in this browser with it. A read still out when the page stops
// waiting is let run a while longer: its answer is not applied to a page
// that has settled, but it is kept for the next one, so a browser whose
// reads are always slow still learns a switch, one load late.
//
// `experimentalFeaturesPending` is true only while the page waits on that
// one read. The route guard (App.tsx) asks it, so a deep link to a feature
// the owner switched on is not sent Home on a default that is about to
// change.
//
// It reads the build's env as it loads, which plain Node cannot do, and
// Playwright loads specs in plain Node. So the tab constants, which specs
// import, do not import this store: the web entry connects it to them before
// the first render (src/index.tsx, connectTabExperiments). The API base is
// read inline, as src/index.tsx reads its portable-console flag.

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

/** How long the page waits on the startup read before it settles on what it has. */
export const FEATURES_READ_TIMEOUT_MS = 2500

/** How long a read the page stopped waiting on may still land, to be kept for the next page. */
export const FEATURES_LATE_READ_MS = 30_000

/**
 * Where this browser keeps the last switches it heard, beside the address
 * it heard them from: an answer from one API is never another's.
 */
export const REMEMBERED_FEATURES_KEY = 'mp_experimental_features'

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
/** The startup read, while its answer may still land. */
let reading: AbortController | null = null
/** Bumped by every load and reset, so a read from before one lands nowhere after it. */
let generation = 0

/** Whether this page shows `name`. Reactive: it follows the startup read when it lands. */
export function experimentalFeatureOn(name: ExperimentalFeature): boolean {
  return resolveExperimentalFeature(name, buildDefault(), overrides())
}

/** True while the page waits on the startup read. Reactive. */
export function experimentalFeaturesPending(): boolean {
  return pending()
}

/**
 * The default every experimental feature falls back to on this page where
 * no switch is set: this build's, or the one an e2e spec boots it with.
 * Reactive. The owner's console says it beside each switch.
 */
export function experimentalFeaturesBuildDefault(): boolean {
  return buildDefault()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

// ── What this browser heard last ─────────────────────────────────────

/**
 * The switches this browser last heard from `url`, or null when it heard
 * none from there. Storage that is blocked, or holds anything else, reads
 * as none. Never throws.
 */
function recall(url: string): FeatureOverrides | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_FEATURES_KEY)
    if (raw === null) return null
    const kept: unknown = JSON.parse(raw)
    if (!isRecord(kept) || kept.from !== url) return null
    return parseFeatureOverrides(kept.switches)
  } catch {
    return null
  }
}

function remember(url: string, switches: FeatureOverrides): void {
  try {
    localStorage.setItem(
      REMEMBERED_FEATURES_KEY,
      JSON.stringify({ from: url, switches }),
    )
  } catch {
    // Blocked storage: the next page starts from the build's default, as
    // every page did before anything was kept.
  }
}

function forget(): void {
  try {
    localStorage.removeItem(REMEMBERED_FEATURES_KEY)
  } catch {
    // Blocked storage kept nothing to forget.
  }
}

// ── The read ─────────────────────────────────────────────────────────

/**
 * The switches the server answered, or null when it gave no answer this
 * page can read: a failure, an error status, a body that is not a JSON
 * object. An object naming no switch IS an answer: none is set, and the
 * build's default stands. Never rejects.
 */
async function askServer(
  url: string,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<FeatureOverrides | null> {
  try {
    const response = await fetcher(url, { signal })
    if (!response.ok) return null
    const body: unknown = await response.json()
    return isRecord(body) ? parseFeatureOverrides(body) : null
  } catch {
    return null
  }
}

/** `answer` if it lands within `ms`, null otherwise. Never rejects, as `answer` never does. */
function within<T>(answer: Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    void answer.then((value) => {
      clearTimeout(timer)
      resolve(value)
    })
  })
}

/**
 * Ask the db-worker for the owner's switches, once per page; later calls
 * share the first. Starts the page from what this browser heard last,
 * before it returns. Never rejects, and never blocks: call it without
 * waiting.
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
  const { url } = read
  const heard = recall(url)
  if (heard !== null) setOverrides(heard)
  setPending(true)
  const run = ++generation
  const waitMs = options.timeoutMs ?? read.timeoutMs ?? FEATURES_READ_TIMEOUT_MS
  const controller = new AbortController()
  reading = controller
  const giveUp = setTimeout(
    () => controller.abort(),
    Math.max(waitMs, FEATURES_LATE_READ_MS),
  )
  const answer = askServer(
    url,
    options.fetcher ?? ((input, init) => fetch(input, init)),
    controller.signal,
  ).then((switches) => {
    clearTimeout(giveUp)
    if (reading === controller) reading = null
    // A read given up on, by its own clock or by a reset, keeps nothing.
    if (switches === null || controller.signal.aborted) return null
    remember(url, switches)
    return switches
  })
  request = within(answer, waitMs).then((switches) => {
    if (run !== generation) return
    if (switches !== null) setOverrides(switches)
    setPending(false)
  })
  return request
}

/**
 * Back to a page that has not asked yet, on this build's default, in a
 * browser that has heard nothing. Tests only.
 */
export function resetExperimentalFeaturesStoreForTests(): void {
  generation += 1
  reading?.abort()
  reading = null
  request = null
  forget()
  setOverrides({})
  setPending(false)
  setBuildDefault(EXPERIMENTAL_FEATURES_BUILD_DEFAULT)
}
