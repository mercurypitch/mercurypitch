// ============================================================
// What a native sign-in does once a session lands
// ============================================================
//
// The sign-in sheet and Keep both end a ceremony here, so the two can never
// disagree on what signing in means for this phone's practice. Every way in
// reaches one of the two: the onboarding's and the Cloud offer's Sign in open
// the sheet.
//
// An account made here takes this phone's unclaimed takes with it: making
// it is the consent (REQ-NAM-036, 037). Signing in to one that already
// existed takes nothing by itself (REQ-NAM-039): a beat later it asks
// whether they go to the account, when there are any it has not said Not
// now to (voiceprint-ask.ts; owner, 16 Oct). Its history is announced on
// the Account screen's next visit (REQ-NAM-043). Retag-first means a failed
// upload is carried by the next sync, so nothing waits on it.
//
// Mercury Pitch Cloud bought on this phone while signed out goes to the
// account with no Restore tap; one another account owns never moves by
// itself (owner rule D2). Either way the songs are asked again, so Settings
// shows the account (cloud-offer-store.ts settleCloudAfterSignIn). A build
// without the subscription folds the call away, and all it imports.

import type { AuthResponse } from '@/db/services/auth-service'
import { adoptDeviceVoiceprints } from '@/db/services/voiceprint-service'
import { settleCloudAfterSignIn } from '@/features/karaoke-room/cloud-offer-store'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { showNotification } from '@/stores/notifications-store'
import { markAccountFillDue } from './account-fill'
import { refreshAccount } from './account-state'
import { askAfterSignIn } from './voiceprint-ask'

/** After the surface that asked has closed: say so, and settle the takes. */
export function afterSignIn(auth: AuthResponse): void {
  showNotification('Signed in', 'info')
  if (auth.isNew) void adoptDeviceVoiceprints().catch(() => 0)
  else {
    markAccountFillDue(auth.userId)
    askAfterSignIn(auth.userId)
  }
  void refreshAccount()
  if (KARAOKE_IMPORT) void settleCloudAfterSignIn()
}
