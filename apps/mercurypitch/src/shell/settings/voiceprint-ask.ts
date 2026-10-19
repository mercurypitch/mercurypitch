// ============================================================
// The voiceprint ask: this phone's takes, after a sign-in
// ============================================================
//
// Signing in to an account that already existed takes none of this phone's
// voiceprints by itself (REQ-NAM-039): a phone can be shared, so a take is
// never added to an account without a yes (owner rule D2). The owner chose
// to ask (16 Oct): a beat after the sign-in lands, a small sheet asks
// whether the takes made here before signing in go to the account, when the
// web's own rule says the ask is due (adoptionNoticeDue). Keep on this
// account adopts them; Not now declines, so the ask comes back only for a
// newer take. The web asks the same in Settings' Voice section, and both
// use the one voiceprint-service API.
//
// Which takes: every one the account could adopt (listAdoptableVoiceprints),
// the same set an account made here takes without asking. The sheet's card
// is Keep's, the newest of them with a range (keep-voiceprint.ts).
//
// The Account screen's note asks again for anyone who said Not now: it is
// there while this phone holds takes the account could add, declined or not.

import { batch, createSignal } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { adoptDeviceVoiceprints, adoptionNoticeDue, declineAdoption, listAdoptableVoiceprints, } from '@/db/services/voiceprint-service'
import { showNotification } from '@/stores/notifications-store'
import { voiceprintsKept } from './account-copy'

/** How long after the sign-in the ask rises: the sheet that signed in has
 *  gone by then, as Keep waits after a Keep (OFFER_BEAT_MS). */
export const ASK_BEAT_MS = 400

const [open, setOpen] = createSignal(false)
/** A sign-in landed and the beat has not run out yet. */
const [pending, setPending] = createSignal(false)
const [saving, setSaving] = createSignal(false)
/** Bumped when takes are adopted, so what reads the list reads it again. */
const [kept, setKept] = createSignal(0)

let beat: ReturnType<typeof setTimeout> | undefined

/** Whether the ask is up. Reactive. */
export const voiceprintAskOpen = open

/** Whether the ask is up or about to rise. Reactive. */
export function voiceprintAskAsking(): boolean {
  return open() || pending()
}

/** Whether Keep on this account is saving. Reactive. */
export const voiceprintAskSaving = saving

/** Takes this phone holds that the signed-in account could add. Reactive
 *  to a keep made here; read again by whatever opens. */
export function addableVoiceprints(): number {
  kept()
  return listAdoptableVoiceprints().length
}

/**
 * Whether the ask is on screen: open, over the account it asked for (a
 * sign-out closes it unanswered), with takes left to add or being added
 * (a keep retags them before it uploads, and the sheet stays up, saving,
 * until it ends). The sheet is drawn by this and Back answers by it
 * (shell-navigation.ts), so a press never goes to an ask nobody can see,
 * nor past one somebody can. Reactive.
 */
export function voiceprintAskUp(): boolean {
  return open() && accountHeld() && (saving() || addableVoiceprints() > 0)
}

/**
 * After a sign-in to an account that already existed: ask a beat later, if
 * the ask is due then and the same account is still signed in.
 */
export function askAfterSignIn(userId: string): void {
  clearTimeout(beat)
  setPending(true)
  beat = setTimeout(() => {
    beat = undefined
    const due = getUserId() === userId && adoptionNoticeDue()
    batch(() => {
      setPending(false)
      if (due) setOpen(true)
    })
  }, ASK_BEAT_MS)
}

/** Keep on this account: adopt the takes, say so, and close. */
export async function keepVoiceprints(): Promise<void> {
  if (saving()) return
  setSaving(true)
  try {
    const count = await adoptDeviceVoiceprints()
    if (count > 0) showNotification(voiceprintsKept(count), 'success')
  } catch {
    // adoptDeviceVoiceprints retags first: a failed upload is carried by
    // the next sync, so there is nothing to say here.
  } finally {
    setKept((n) => n + 1)
    setSaving(false)
    setOpen(false)
  }
}

/** Not now; and Back, the backdrop or a swipe on the sheet. */
export function voiceprintAskNotNow(): void {
  if (saving()) return
  declineAdoption()
  setOpen(false)
}

/** Tests: closed, nothing pending, nothing saving. */
export function resetVoiceprintAsk(): void {
  clearTimeout(beat)
  beat = undefined
  setPending(false)
  setOpen(false)
  setSaving(false)
  setKept(0)
}
