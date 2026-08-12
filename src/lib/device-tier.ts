// ============================================================
// Device tier — one answer to "how much frame budget does this machine have?"
// ============================================================
//
// TV browsers (Google TV / Android TV, Tizen, webOS, Fire TV) are the reason
// this exists. They render a 1080p–4K viewport on a phone-class SoC with no
// compositor headroom, so the same stem-mixer canvas stack that runs at 60 Hz
// on a laptop stutters there — and the audio stutters with it, because every
// draw happens on the thread that also feeds Web Audio.
//
// Two independent facts are reported:
//
//   • `deviceClass()`  — WHAT it is: 'tv' | 'mobile' | 'desktop'. Drives
//     interaction decisions (a TV has no file manager, no touch, D-pad focus).
//   • `deviceTier()`   — HOW FAST it is: 'high' | 'balanced' | 'low'. Drives
//     render decisions (frame caps, DPR caps, effect budget).
//
// A TV is always at most 'balanced' from static signals alone, and the live
// frame-time sampler can demote any device to 'low' once it actually misses
// deadlines. Demotion is sticky for the session: a surface that keeps flipping
// between quality levels looks worse than one that commits to the lower one.
//
// The detection half is PURE (`classifyDevice`, `scoreDeviceTier`) and unit
// tested against real user-agent strings; only the singleton at the bottom
// touches `navigator`, `document` or localStorage.
//
// Tests: src/lib/device-tier.test.ts
// ============================================================

import { createSignal } from 'solid-js'

export type DeviceClass = 'desktop' | 'mobile' | 'tv'
export type DeviceTier = 'high' | 'balanced' | 'low'

/** User-facing override. 'auto' means "trust the detection". */
export type PerformanceMode = 'auto' | DeviceTier

export const PERFORMANCE_MODES: PerformanceMode[] = [
  'auto',
  'high',
  'balanced',
  'low',
]

export const PERFORMANCE_MODE_LABELS: Record<PerformanceMode, string> = {
  auto: 'Automatic',
  high: 'Full quality',
  balanced: 'Balanced',
  low: 'Performance',
}

export const PERFORMANCE_MODE_DESCRIPTIONS: Record<PerformanceMode, string> = {
  auto: 'Match the device — TVs and low-power hardware step down on their own',
  high: 'Every effect on, uncapped frame rate',
  balanced: 'Lighter blur and glow, frames capped at 45 per second',
  low: 'Flat surfaces, no blur, 30 frames per second, 1x canvas resolution',
}

/** Everything the classifier is allowed to look at. Injected so it is testable. */
export interface DeviceProbe {
  userAgent: string
  /** `navigator.userAgentData.mobile`, when the browser exposes it. */
  uaDataMobile: boolean | null
  hardwareConcurrency: number
  /** `navigator.deviceMemory` in GB — Chromium only, null elsewhere. */
  deviceMemoryGb: number | null
  maxTouchPoints: number
  /** `(pointer: coarse)` — a remote or a finger, not a mouse. */
  coarsePointer: boolean
  /** `(hover: none)` — the primary input cannot hover. */
  noHover: boolean
  /** `@media tv`, still honoured by several TV browsers. */
  tvMediaType: boolean
  screenWidth: number
}

// Explicit "I am a television" tokens. Deliberately broad: a false positive
// costs some visual polish, a false negative costs a stuttering karaoke night.
// `AFT…` is Amazon Fire TV, `CrKey` is Chromecast, `Web0S`/`webOS` is LG,
// `Tizen` is Samsung, `NetCast`/`Viera`/`BRAVIA`/`VIDAA` are vendor shells.
const TV_UA_PATTERN =
  /\b(?:smart-?tv|googletv|android\s?tv|apple\s?tv|tv\s?safari|hbbtv|netcast|web0s|webos|tizen|viera|bravia|aquos|philips[\s.-]*tv|vidaa|roku|dlnadoc|inettvbrowser|opera\s?tv|large\s?screen|crkey|aft[a-z]{1,4}\b)/i

// Chromecast/Fire TV sometimes only identify through the device build token.
const TV_BUILD_PATTERN = /\b(?:sdk_google_atv|atv|chromecast|shield android)\b/i

/**
 * Android without the `Mobile` token is a tablet OR a TV. Android TV WebView
 * drops `Mobile` and reports zero touch points; a real tablet reports touch.
 * That pair is the only reliable signal on the Philips/Google TV stack, whose
 * user agent is otherwise indistinguishable from a phone's.
 */
function looksLikeAndroidTv(probe: DeviceProbe): boolean {
  const ua = probe.userAgent
  if (!/\bandroid\b/i.test(ua)) return false
  if (/\bmobile\b/i.test(ua)) return false
  return probe.maxTouchPoints === 0 && (probe.coarsePointer || probe.noHover)
}

/** What kind of machine is this? Pure — see `DeviceProbe`. */
export function classifyDevice(probe: DeviceProbe): DeviceClass {
  const ua = probe.userAgent
  if (TV_UA_PATTERN.test(ua) || TV_BUILD_PATTERN.test(ua)) return 'tv'
  if (probe.tvMediaType) return 'tv'
  if (looksLikeAndroidTv(probe)) return 'tv'
  if (probe.uaDataMobile === true) return 'mobile'
  if (/\b(?:iphone|ipod|android.*mobile|windows phone)\b/i.test(ua)) {
    return 'mobile'
  }
  // iPadOS masquerades as desktop Safari and is only betrayed by touch.
  if (/\bipad\b/i.test(ua)) return 'mobile'
  if (/\bmacintosh\b/i.test(ua) && probe.maxTouchPoints > 1) return 'mobile'
  return 'desktop'
}

/**
 * How much frame budget does it have? Static signals only — the live sampler
 * refines this afterwards.
 *
 * A TV never scores 'high': even the fast ones drive far more pixels than
 * their GPU is sized for, and the blur/glow layer is what kills them.
 */
export function scoreDeviceTier(
  probe: DeviceProbe,
  deviceClass: DeviceClass = classifyDevice(probe),
): DeviceTier {
  const cores = probe.hardwareConcurrency > 0 ? probe.hardwareConcurrency : 4
  const memory = probe.deviceMemoryGb

  // Hard "this is a weak machine" evidence.
  if (cores <= 2) return 'low'
  if (memory !== null && memory <= 2) return 'low'
  // A TV pushing a 4K surface on a phone SoC is the exact case this exists for.
  if (deviceClass === 'tv' && (cores <= 4 || probe.screenWidth >= 1920)) {
    return 'low'
  }
  if (deviceClass === 'tv') return 'balanced'

  if (cores <= 4) return 'balanced'
  if (memory !== null && memory <= 4) return 'balanced'
  return 'high'
}

// ── Render budgets ────────────────────────────────────────────

/**
 * Presentation cap in frames per second. `Infinity` means "follow the display",
 * which is what a capable machine should do — capping a fast device makes the
 * playhead visibly step (see stem-mixer/frame-scheduler.ts).
 */
export function presentationFpsFor(tier: DeviceTier): number {
  if (tier === 'low') return 30
  if (tier === 'balanced') return 45
  return Number.POSITIVE_INFINITY
}

/** Pitch detection / scoring cadence. Independent of presentation. */
export function analysisFpsFor(tier: DeviceTier): number {
  if (tier === 'low') return 15
  if (tier === 'balanced') return 24
  return 30
}

/**
 * Canvas backing-store multiplier. A 4K TV reporting dpr 2 would otherwise ask
 * a phone GPU to fill 8 megapixels of waveform per frame.
 */
export function renderScaleFor(
  tier: DeviceTier,
  devicePixelRatio: number,
): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  if (tier === 'low') return 1
  if (tier === 'balanced') return Math.min(dpr, 1.5)
  return Math.min(dpr, 2)
}

// ── Live frame-time sampler ───────────────────────────────────

export interface FrameHealthSampler {
  /** Feed every animation-frame timestamp (ms). */
  record: (timestampMs: number) => void
  /** True once the window shows sustained missed deadlines. */
  isStruggling: () => boolean
  reset: () => void
}

/** Frames per window before a verdict — ~1.5 s of animation at 60 Hz. */
const FRAME_SAMPLE_WINDOW = 90
/** A frame slower than this is a miss. 28 ms ≈ below 36 fps. */
const SLOW_FRAME_MS = 28
/** Share of the window that must miss before we demote. */
const STRUGGLING_RATIO = 0.4

/**
 * Watch real frame intervals and report sustained stutter.
 *
 * Deliberately one-way: once a window is judged struggling it stays that way
 * until `reset()`. Oscillating between quality levels reads as a bug.
 */
export function createFrameHealthSampler(
  windowSize: number = FRAME_SAMPLE_WINDOW,
  slowFrameMs: number = SLOW_FRAME_MS,
  strugglingRatio: number = STRUGGLING_RATIO,
): FrameHealthSampler {
  let previousMs: number | null = null
  let sampled = 0
  let slow = 0
  let struggling = false

  return {
    record(timestampMs: number): void {
      if (struggling || !Number.isFinite(timestampMs)) return
      if (previousMs !== null) {
        const intervalMs = timestampMs - previousMs
        // A tab-switch or a long decode produces a multi-second gap that says
        // nothing about steady-state rendering. Ignore it.
        if (intervalMs >= 0 && intervalMs < 1000) {
          sampled++
          if (intervalMs > slowFrameMs) slow++
          if (sampled >= windowSize) {
            struggling = slow / sampled >= strugglingRatio
            sampled = 0
            slow = 0
          }
        }
      }
      previousMs = timestampMs
    },
    isStruggling: () => struggling,
    reset(): void {
      previousMs = null
      sampled = 0
      slow = 0
      struggling = false
    },
  }
}

// ── Runtime singleton ─────────────────────────────────────────

const PERFORMANCE_MODE_KEY = 'pitchperfect_performance_mode'

const isPerformanceMode = (value: unknown): value is PerformanceMode =>
  typeof value === 'string' && (PERFORMANCE_MODES as string[]).includes(value)

// Plain localStorage, NOT createPersistedSignal, for two independent reasons:
// the graphics tier is a property of THIS device — a TV and a laptop on the
// same account must not sync it through the cloud write-through that
// @/lib/storage funnels every persisted signal into — and that import would
// chain the pitch-core chunk into the standalone entries' first paint, which
// the piano-night e2e smoke test correctly rejects.
const readStoredPerformanceMode = (): PerformanceMode => {
  try {
    const raw = localStorage.getItem(PERFORMANCE_MODE_KEY)
    return isPerformanceMode(raw) ? raw : 'auto'
  } catch {
    return 'auto'
  }
}

const [performanceModeSignal, setPerformanceModeSignal] =
  createSignal<PerformanceMode>(
    typeof localStorage === 'undefined' ? 'auto' : readStoredPerformanceMode(),
  )

/** User override for the detected tier. Persisted per device; 'auto' default. */
export const performanceMode = performanceModeSignal

export function setPerformanceMode(mode: PerformanceMode): void {
  setPerformanceModeSignal(mode)
  try {
    localStorage.setItem(PERFORMANCE_MODE_KEY, mode)
  } catch {
    // Storage may be unavailable (private mode); the session value still holds.
  }
}

const matches = (query: string): boolean => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

/** Read the live environment into a probe. Falls back to desktop-ish values. */
export function readDeviceProbe(): DeviceProbe {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: '',
      uaDataMobile: null,
      hardwareConcurrency: 8,
      deviceMemoryGb: null,
      maxTouchPoints: 0,
      coarsePointer: false,
      noHover: false,
      tvMediaType: false,
      screenWidth: 1920,
    }
  }
  const uaData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory
  return {
    userAgent: navigator.userAgent || '',
    uaDataMobile: typeof uaData?.mobile === 'boolean' ? uaData.mobile : null,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemoryGb: typeof memory === 'number' ? memory : null,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    coarsePointer: matches('(pointer: coarse)'),
    noHover: matches('(hover: none)'),
    tvMediaType: matches('tv'),
    screenWidth:
      typeof window === 'undefined' ? 1920 : window.screen?.width || 1920,
  }
}

/**
 * `?perf=low` / `?device=tv` force a verdict for testing on hardware you do
 * not have. Read once at boot and remembered for the session.
 */
function readUrlOverrides(): {
  tier: DeviceTier | null
  deviceClass: DeviceClass | null
} {
  if (typeof window === 'undefined') return { tier: null, deviceClass: null }
  let params: URLSearchParams
  try {
    params = new URLSearchParams(window.location.search)
  } catch {
    return { tier: null, deviceClass: null }
  }
  const perf = params.get('perf')
  const device = params.get('device')
  return {
    tier:
      perf === 'low' || perf === 'balanced' || perf === 'high' ? perf : null,
    deviceClass:
      device === 'tv' || device === 'mobile' || device === 'desktop'
        ? device
        : null,
  }
}

let detectedClass: DeviceClass = 'desktop'
let detectedTier: DeviceTier = 'high'
let demoted = false
let initialised = false
const sampler = createFrameHealthSampler()

const resolveTier = (): DeviceTier => {
  const override = performanceMode()
  if (override !== 'auto') return override
  if (demoted) return 'low'
  return detectedTier
}

/** What kind of machine this is. Stable for the session. */
export function deviceClass(): DeviceClass {
  return detectedClass
}

/** True on a television — no file manager, no touch, D-pad focus. */
export function isTvDevice(): boolean {
  return detectedClass === 'tv'
}

/** The effective tier: the user's override, else detection, else demotion. */
export function deviceTier(): DeviceTier {
  return resolveTier()
}

/** Presentation cap in fps for the current tier (`Infinity` when uncapped). */
export function presentationFps(): number {
  return presentationFpsFor(resolveTier())
}

/** Analysis cadence in fps for the current tier. */
export function analysisFps(): number {
  return analysisFpsFor(resolveTier())
}

/**
 * The DPR every canvas should size its backing store with. Use this instead of
 * `window.devicePixelRatio` on any surface that redraws per frame — and use
 * the SAME value for `ctx.setTransform`, or the drawing is scaled wrong.
 */
export function renderScale(): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return renderScaleFor(resolveTier(), dpr)
}

/**
 * Feed an animation-frame timestamp so a device that only *looks* capable can
 * still be demoted. Costs one subtraction per frame; safe in a hot loop.
 */
export function recordAnimationFrame(timestampMs: number): void {
  if (demoted || performanceMode() !== 'auto') return
  sampler.record(timestampMs)
  if (sampler.isStruggling()) {
    demoted = true
    applyDocumentAttributes()
    console.info(
      '[device-tier] sustained frame misses — dropping to the low tier',
    )
  }
}

function applyDocumentAttributes(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.deviceClass = detectedClass
  root.dataset.perfTier = resolveTier()
}

/**
 * Detect once and publish the verdict on `<html>` as `data-device-class` and
 * `data-perf-tier`, which is what `src/styles/performance-mode.css` keys on.
 * Idempotent — every entry point may call it.
 */
export function initDeviceTier(): void {
  if (initialised) return
  initialised = true

  const overrides = readUrlOverrides()
  const probe = readDeviceProbe()
  detectedClass = overrides.deviceClass ?? classifyDevice(probe)
  detectedTier = overrides.tier ?? scoreDeviceTier(probe, detectedClass)

  applyDocumentAttributes()
}

/** Re-publish after the user changes the override in Settings. */
export function refreshDeviceTierAttributes(): void {
  applyDocumentAttributes()
}

/** Test seam — resets the singleton so each spec starts from nothing. */
export function __resetDeviceTierForTests(): void {
  initialised = false
  demoted = false
  detectedClass = 'desktop'
  detectedTier = 'high'
  sampler.reset()
}
