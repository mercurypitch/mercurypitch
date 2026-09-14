// ============================================================
// App foreground — native inactivity and page visibility share one gate
// ============================================================

import { cancelSharedAudioContextSuspension, suspendSharedAudioContext, } from '@irchiinnuss/audio-io/shared-audio-context'
import { onAppState } from '@irchiinnuss/mobile-runtime/platform'

/** A visible WebView cannot overrule an inactive native app or a hidden page. */
export function subscribeAppForeground(
  onForeground: (foreground: boolean) => void,
): () => void {
  let nativeActive = true
  let pageHidden = false
  let foreground = document.visibilityState === 'visible'
  let disposed = false

  const synchronize = (): void => {
    if (disposed) return
    const next =
      nativeActive && !pageHidden && document.visibilityState === 'visible'
    if (next && !foreground) cancelSharedAudioContextSuspension()
    foreground = next
    // Repeated visible events also refresh the local day after a long sleep.
    onForeground(next)
  }
  const hidePage = (): void => {
    pageHidden = true
    synchronize()
  }
  const showPage = (): void => {
    pageHidden = false
    synchronize()
  }

  document.addEventListener('visibilitychange', synchronize)
  window.addEventListener('pagehide', hidePage)
  window.addEventListener('pageshow', showPage)
  const stopNative = onAppState((state) => {
    if (disposed) return
    nativeActive = state === 'active'
    synchronize()
    // The native event can precede (or replace) document visibility. Cancel
    // app requests first, then let the shared owner finish their short tails.
    if (!nativeActive) suspendSharedAudioContext()
  })
  synchronize()

  return () => {
    if (disposed) return
    disposed = true
    stopNative()
    document.removeEventListener('visibilitychange', synchronize)
    window.removeEventListener('pagehide', hidePage)
    window.removeEventListener('pageshow', showPage)
  }
}
