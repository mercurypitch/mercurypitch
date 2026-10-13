// ============================================================
// Published totals — owner-scoped counts with stale-response protection.
// ============================================================

import { createEffect, createSignal, onCleanup } from 'solid-js'
import type {PublishedShareCounts} from '@/db/services/share-service';
import { loadPublishedShareCounts  } from '@/db/services/share-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { showNotification } from '@/stores/notifications-store'

export function usePublishedShareCounts() {
  const [counts, setCounts] = createSignal<PublishedShareCounts>({
    melodies: 0,
    sessions: 0,
  })
  let owner: string | undefined
  let request = 0
  let disposed = false
  onCleanup(() => {
    disposed = true
  })

  const refresh = async (): Promise<void> => {
    const userId = getUserId()
    const version = authVersion()
    const currentRequest = ++request
    const isCurrent = () =>
      !disposed &&
      currentRequest === request &&
      getUserId() === userId &&
      authVersion() === version
    try {
      const next = await loadPublishedShareCounts(userId)
      if (isCurrent()) setCounts(next)
    } catch {
      // Preserve this account's last successful totals, never another account's.
      if (isCurrent())
        showNotification(
          'Could not update your published totals. Reopen Community to retry.',
          'error',
        )
    }
  }

  createEffect(() => {
    authVersion()
    const userId = getUserId()
    if (owner !== userId) {
      owner = userId
      setCounts({ melodies: 0, sessions: 0 })
    }
    void refresh()
  })

  return { counts, refresh }
}
