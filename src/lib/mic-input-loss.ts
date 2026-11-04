// ============================================================
// Mic input loss — when an input of its own counts as gone: its track ended, or stayed muted while the page showed
// ============================================================
//
// An input of its own (MicManager.acquireFrom) is gone when its track ends,
// as on an unplug, or stays muted for MUTED_INPUT_LOST_MS. A browser that
// keeps one capture at a time (WebKit) mutes the earlier track, rather than
// ending it, as another opens, and a take would go on recording silence with
// nothing said. WebKit also mutes a hidden page's capture, and a take keeps
// going however long the singer is on another tab (the run guard), so the
// count waits while the page is hidden and starts over when it shows.

/** How long a track may stay muted, while the page shows, before its input counts as gone. */
export const MUTED_INPUT_LOST_MS = 500

const pageHidden = (): boolean =>
  typeof document !== 'undefined' && document.hidden

/**
 * Call `lost` when `stream`'s input goes: a track ends, or one stays muted
 * for MUTED_INPUT_LOST_MS while the page shows. Nothing once `signal` aborts.
 */
export function watchInputLoss(
  stream: MediaStream,
  signal: AbortSignal,
  lost: () => void,
): void {
  const tracks = stream.getTracks()
  // A track muted already, as a shared stream an earlier capture muted is,
  // sends no 'mute' of its own.
  const muted = new Set(tracks.filter((track) => track.muted))
  let count: ReturnType<typeof setTimeout> | null = null
  const stopCount = () => {
    if (count !== null) clearTimeout(count)
    count = null
  }
  const expire = () => {
    count = null
    lost()
  }
  const recount = () => {
    if (signal.aborted || muted.size === 0 || pageHidden()) stopCount()
    else if (count === null) count = setTimeout(expire, MUTED_INPUT_LOST_MS)
  }
  const options = { signal }
  for (const track of tracks) {
    track.addEventListener?.('ended', lost, options)
    track.addEventListener?.(
      'mute',
      () => {
        muted.add(track)
        recount()
      },
      options,
    )
    track.addEventListener?.(
      'unmute',
      () => {
        muted.delete(track)
        recount()
      },
      options,
    )
  }
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', recount, options)
  signal.addEventListener('abort', stopCount, { once: true })
  recount()
}
