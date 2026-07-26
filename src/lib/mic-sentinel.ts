// ── MicSentinel ──────────────────────────────────────────────────────
// Self-monitor for microphone state. The mic postmortem found both prod
// symptoms came from UI signals and device reality drifting apart with
// nothing watching: icons "on" over dead tracks, pipelines detecting
// while icons said "off", and phantom holds keeping the device hot with
// every icon off.
//
// Surfaces register the accessor that drives their mic icon (and an
// optional forceOff). A low-frequency watchdog compares three sources of
// truth — the manager's holds, the actual MediaStreamTrack liveness, and
// each registered icon — and:
//   - reports any mismatch that persists for two consecutive ticks to the
//     console (one structured warn per mismatch transition, never spam),
//   - self-heals the one unambiguous case: an icon claiming "on" while no
//     live track exists is forced off (the surface's own reset path runs,
//     so signals, nodes, and holds all settle together).
// `window.__micSentinel.dump()` prints the full state for bug reports.
//
// The comparison is a pure function so the invariants are unit-testable.
// Tests: src/tests/mic-sentinel.test.ts

import { micManager } from '@/lib/mic-manager'

export interface MicIndicatorSnapshot {
  id: string
  on: boolean
}

export interface MicRealitySnapshot {
  /** Consumer ids currently holding the manager's device. */
  holds: readonly string[]
  /** True when the shared stream exists and has at least one live track. */
  streamLive: boolean
  indicators: readonly MicIndicatorSnapshot[]
}

export type MicMismatchKind =
  /** An icon says on, but no live track exists — the "mic on but not
   *  really" prod symptom. Self-healed via the indicator's forceOff. */
  | 'ui-on-stream-dead'
  /** The device is live and held, but every registered icon says off —
   *  the "icon off while the pitch visual detects" prod symptom. */
  | 'live-without-ui'
  /** A hold exists with a dead stream — a phantom hold keeping the
   *  manager's consumer count up (blocks linger teardown forever). */
  | 'hold-on-dead-stream'

export interface MicMismatch {
  kind: MicMismatchKind
  /** Indicator or consumer ids implicated. */
  ids: string[]
}

/** Pure comparison of the three sources of truth. */
export function compareMicStates(reality: MicRealitySnapshot): MicMismatch[] {
  const mismatches: MicMismatch[] = []

  const onIndicators = reality.indicators.filter((i) => i.on)
  if (!reality.streamLive && onIndicators.length > 0) {
    mismatches.push({
      kind: 'ui-on-stream-dead',
      ids: onIndicators.map((i) => i.id),
    })
  }

  if (
    reality.streamLive &&
    reality.holds.length > 0 &&
    reality.indicators.length > 0 &&
    onIndicators.length === 0
  ) {
    mismatches.push({ kind: 'live-without-ui', ids: [...reality.holds] })
  }

  if (!reality.streamLive && reality.holds.length > 0) {
    mismatches.push({ kind: 'hold-on-dead-stream', ids: [...reality.holds] })
  }

  return mismatches
}

interface RegisteredIndicator {
  id: string
  uiOn: () => boolean
  forceOff?: () => void
}

const indicators = new Map<string, RegisteredIndicator>()

/**
 * Register the accessor driving a surface's mic icon. `forceOff` (the
 * surface's own turn-the-mic-off path) enables self-healing for the
 * icon-on-over-dead-device case. Returns an unregister function; call it
 * in the surface's cleanup.
 */
export function registerMicIndicator(
  id: string,
  uiOn: () => boolean,
  forceOff?: () => void,
): () => void {
  indicators.set(id, { id, uiOn, forceOff })
  ensureWatchdog()
  return () => {
    indicators.delete(id)
  }
}

function snapshotReality(): MicRealitySnapshot {
  const stream = micManager.getStream()
  const streamLive =
    stream !== null && stream.getTracks().some((t) => t.readyState === 'live')
  return {
    holds: micManager.getConsumers(),
    streamLive,
    indicators: [...indicators.values()].map((i) => ({
      id: i.id,
      on: safeRead(i.uiOn),
    })),
  }
}

function safeRead(accessor: () => boolean): boolean {
  try {
    return accessor()
  } catch {
    return false
  }
}

const TICK_MS = 3000
/** A mismatch must survive this many consecutive ticks before it is
 *  reported/healed — transient toggling states are not desyncs. */
const CONFIRM_TICKS = 2

let watchdog: ReturnType<typeof setInterval> | null = null
/** kind:ids signature → consecutive ticks seen. */
let pending = new Map<string, { mismatch: MicMismatch; ticks: number }>()
/** Signatures already reported, cleared once the mismatch disappears. */
const reported = new Set<string>()

function ensureWatchdog(): void {
  if (watchdog !== null || typeof setInterval === 'undefined') return
  watchdog = setInterval(tick, TICK_MS)
}

function tick(): void {
  const reality = snapshotReality()
  // Idle app: nothing held, nothing on, nothing to compare.
  if (
    reality.holds.length === 0 &&
    !reality.streamLive &&
    reality.indicators.every((i) => !i.on)
  ) {
    pending = new Map()
    reported.clear()
    return
  }

  const current = compareMicStates(reality)
  const next = new Map<string, { mismatch: MicMismatch; ticks: number }>()
  for (const mismatch of current) {
    const signature = `${mismatch.kind}:${mismatch.ids.join(',')}`
    const ticks = (pending.get(signature)?.ticks ?? 0) + 1
    next.set(signature, { mismatch, ticks })
    if (ticks === CONFIRM_TICKS && !reported.has(signature)) {
      reported.add(signature)
      report(mismatch, reality)
      heal(mismatch)
    }
  }
  // Mismatches that vanished may be re-reported if they come back.
  for (const signature of reported) {
    if (!next.has(signature)) reported.delete(signature)
  }
  pending = next
}

function report(mismatch: MicMismatch, reality: MicRealitySnapshot): void {
  console.warn(`[MicSentinel] ${mismatch.kind}: ${mismatch.ids.join(', ')}`, {
    holds: reality.holds,
    streamLive: reality.streamLive,
    indicators: reality.indicators,
  })
}

function heal(mismatch: MicMismatch): void {
  if (mismatch.kind !== 'ui-on-stream-dead') return
  for (const id of mismatch.ids) {
    const indicator = indicators.get(id)
    if (indicator?.forceOff === undefined) continue
    try {
      console.warn(`[MicSentinel] forcing '${id}' off (no live mic track)`)
      indicator.forceOff()
    } catch (err) {
      console.warn(`[MicSentinel] forceOff for '${id}' failed:`, err)
    }
  }
}

/** Console-friendly state dump for bug reports (window.__micSentinel). */
export function micSentinelDump(): MicRealitySnapshot {
  const reality = snapshotReality()
  console.info('[MicSentinel] state', reality)
  return reality
}

declare global {
  interface Window {
    __micSentinel?: { dump: () => MicRealitySnapshot }
  }
}

if (typeof window !== 'undefined') {
  window.__micSentinel = { dump: micSentinelDump }
}
