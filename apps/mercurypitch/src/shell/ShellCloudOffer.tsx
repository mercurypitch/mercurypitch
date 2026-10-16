// ============================================================
// The Cloud offer, as the shell mounts it
// ============================================================
//
// Paywall B v2 (plan S7b §4) asks for an account in two places, and each
// goes somewhere different. Its free account, under Subscribe, opens Keep,
// the account offer (S7b §3.5). Sign in after a purchase opens the sign-in
// sheet: the singer has paid, so it is no offer. NativeShell mounts this
// behind KARAOKE_IMPORT, so a store build folds it away with the offer.

import { Capacitor } from '@capacitor/core'
import type { JSX } from 'solid-js'
import { CloudOffer } from '@/features/karaoke-room/CloudOffer'
import { openKeep } from './settings/account-offer'
import { openSignIn } from './settings/sign-in-state'

export function ShellCloudOffer(): JSX.Element {
  return (
    <CloudOffer
      platform={Capacitor.getPlatform()}
      onAccount={openKeep}
      onSignIn={openSignIn}
    />
  )
}
