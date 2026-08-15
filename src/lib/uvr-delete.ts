// The one way UI code deletes a UVR session. The store cannot show UI,
// so the warning REQ-DRV-021 requires lives here — in one place, not
// copy-pasted into every component with a delete button.

import { showNotification } from '@/stores/notifications-store'
import { deleteUvrSession } from '@/stores/uvr-store'

/**
 * Delete a session and warn when the durable cascade did not land — a
 * delete the person watched succeed must not silently un-happen on the
 * next reload. Resolves with the store's answer for callers that care.
 */
export function deleteUvrSessionWithWarning(
  sessionId: string,
): Promise<boolean> {
  return deleteUvrSession(sessionId).then((gone) => {
    if (!gone) {
      showNotification(
        'This song did not fully delete — it can come back after a reload. Delete it again.',
        'error',
      )
    }
    return gone
  })
}
