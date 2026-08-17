// ============================================================
// signal-quality advisor — "your room is triggering false notes"
// ============================================================
//
// The one app-level consumer of the signal-quality seam. Polls the rolling
// snapshot a couple of times a second, and when the classifier says the
// environment is producing blips, says so once — as a toast with a jump to
// the mic-environment setting — instead of letting the user wonder why
// notes they never sang keep flickering through the tracker.
//
// It recommends and deep-links; it never changes the preset itself. The
// quiet-as-default rationale in settings-store.ts stands.

import { revealSidebarPanel } from '@/features/sidebar/reveal-panel'
import { classifySignalQuality, readSignalQuality, resetSignalQuality, } from '@/lib/signal-quality'
import { removeNotification, showActionNotification, } from '@/stores/notifications-store'
import type { SensitivityPreset } from '@/stores/settings-store'
import { sensitivityPreset } from '@/stores/settings-store'
import { openSettingsSection, setSidebarOpen } from '@/stores/ui-store'

export const ADVISOR_POLL_MS = 500
/** The window must have been filling this long before a verdict counts. */
export const MIN_OBSERVATION_MS = 5_000
/** Frames older than this mean the mic is off — never advise on a stale window. */
export const FRESH_FRAME_MS = 1_000
export const ADVISOR_COOLDOWN_MS = 10 * 60_000
export const ADVISOR_SESSION_CAP = 2
export const ADVISOR_STAMP_KEY = 'pitchperfect_signal_advisor_last'

/** Test seams — the defaults are the app's. */
export interface SignalAdvisorEnv {
  /** Wall clock for the cooldown stamp (Date.now). */
  now?: () => number
  /** Frame clock — must tick the same time base the detector stamps frames with (performance.now). */
  frameNow?: () => number
  notify?: typeof showActionNotification
  dismiss?: typeof removeNotification
  openSettings?: typeof openSettingsSection
  /**
   * Reveals a sidebar panel, returning false when it is not on the page.
   * Seam so the toast's action can be asserted without a live sidebar.
   */
  revealPanel?: (id: 'mic') => boolean
  preset?: () => SensitivityPreset
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

/**
 * Start the advisor loop. Returns a dispose function. One instance per app —
 * it lives next to the practice engine in EngineContext.
 */
export function createSignalQualityAdvisor(
  env: SignalAdvisorEnv = {},
): () => void {
  const now = env.now ?? (() => Date.now())
  const frameNow = env.frameNow ?? (() => performance.now())
  const notify = env.notify ?? showActionNotification
  const dismiss = env.dismiss ?? removeNotification
  const openSettings = env.openSettings ?? openSettingsSection
  const revealPanel =
    env.revealPanel ??
    ((id: 'mic') => revealSidebarPanel(id, { openSidebar: setSidebarOpen }))
  const preset = env.preset ?? sensitivityPreset
  const storage = env.storage ?? localStorage

  let firedThisSession = 0

  const cooledDown = (): boolean => {
    const raw = storage.getItem(ADVISOR_STAMP_KEY)
    const last = raw === null ? 0 : Number(raw)
    return !Number.isFinite(last) || now() - last >= ADVISOR_COOLDOWN_MS
  }

  const tick = (): void => {
    if (firedThisSession >= ADVISOR_SESSION_CAP) return
    const snapshot = readSignalQuality()
    // No fresh frames means no live mic — a window left over from the last
    // run must not produce advice about a room nobody is singing in.
    if (snapshot.lastFrameAtMs === 0) return
    if (frameNow() - snapshot.lastFrameAtMs > FRESH_FRAME_MS) return
    if (snapshot.observedMs < MIN_OBSERVATION_MS) return
    const active = preset()
    const verdict = classifySignalQuality(snapshot, {
      presetIsQuiet: active === 'quiet',
    })
    if (verdict !== 'noisy-environment') return
    if (!cooledDown()) return

    firedThisSession++
    storage.setItem(ADVISOR_STAMP_KEY, String(now()))
    // The same window must not immediately re-satisfy the classifier.
    resetSignalQuality()

    const message =
      active === 'noisy'
        ? 'Background noise is still triggering false notes. A quieter spot will score truer.'
        : 'Background noise is triggering false notes. Try the "High Noise" environment setting, or move somewhere quieter.'
    const id = notify(
      message,
      'warning',
      {
        label: 'Open mic settings',
        onClick: () => {
          dismiss(id)
          // The mic panel is a universal sidebar panel, so the control this
          // toast is about is usually already on screen. Point at it rather
          // than send the singer to the Settings tab and back — the whole
          // cost of taking the advice, on a phone especially.
          if (!revealPanel('mic')) {
            openSettings('singing', 'sensitivity-presets')
          }
        },
      },
      { channel: 'signal-quality', title: 'Microphone', durationMs: 15_000 },
    )
  }

  const timer = setInterval(tick, ADVISOR_POLL_MS)
  return () => {
    clearInterval(timer)
  }
}
