// ============================================================
// Voice Mirror — the account dialog, loaded on demand
// ============================================================
//
// The shared AuthModal and the toasts it speaks through, in a chunk of their
// own so the Mirror's first paint never carries them (MirrorAccountAsk). It
// loads when the ask is tapped, or when a Google sign-in started here lands
// back on this page.
//
// Taking the voiceprint along is the dialog's work and the entry's. A
// password sign-up adopts this browser's unclaimed takes as it resolves
// (AuthModal). A Google sign-up leaves the page and comes back to it, and
// the entry adopts on `gauth_new=1` as it lands (main.tsx,
// adoptAfterGoogleSignup). `adoptsGoogleSignup` is what lets that redirect
// carry the voiceprint hint for the first mail (REQ-VPR-022).

import { createEffect, onMount } from 'solid-js'
import { AuthModal } from '@/components/account/AuthModal'
import { Notifications } from '@/components/Notifications'
import { rememberGiftOffered, syncPromoClaims, } from '@/stores/launch-gift-store'
import { showNotification } from '@/stores/notifications-store'
import { openAuthModal } from '@/stores/ui-store'
import { answerAccountAsk, signUpAsked, takeLanding } from './account-ask'

/** What a failed Google return says. Cancel at Google comes back as the
 *  bare code `access_denied`, which reads as a fault; it was a choice. */
function googleFailure(error: string): string {
  if (error === 'access_denied') return 'Google sign-in was canceled.'
  return `Google sign-in failed: ${error}`
}

export default function MirrorAccountHost() {
  onMount(() => {
    const landing = takeLanding()
    if (landing === null) return
    if (landing.kind === 'second-factor') {
      // The dialog takes the ceremony as it opens and starts on its code pane.
      // A microtask later, like the tap's open below.
      queueMicrotask(() => openAuthModal('login'))
      return
    }
    if (!landing.result.ok) {
      showNotification(googleFailure(landing.result.error), 'error')
      return
    }
    showNotification('Signed in with Google', 'info')
    // Google confirms the address as the account is made, so a launch gift
    // claimed then is news to say now, once (launch-gift-store).
    void syncPromoClaims({ upgraded: true, verified: true })
  })

  createEffect(() => {
    if (!signUpAsked()) return
    answerAccountAsk()
    // Every "Create my free account" shown beside the gift remembers it, so a
    // code that runs out before the email is confirmed is said rather than
    // swallowed. Nothing on offer, nothing remembered.
    rememberGiftOffered()
    // Not in this pass: the host mounts AuthModal in it, and the dialog's
    // focus trap installs only if its element is there as the dialog opens.
    // Opened in the same pass, focus stays on the page behind it, Tab walks
    // out and Escape does nothing.
    queueMicrotask(() => openAuthModal('register'))
  })

  return (
    <>
      <AuthModal adoptsGoogleSignup />
      <Notifications />
    </>
  )
}
