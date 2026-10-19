// ============================================================
// The voiceprint ask, drawn: a small sheet after a sign-in
// ============================================================
//
// Keep's shape, smaller: Not now at the top right, the voiceprint card when
// one of the takes has a range (Keep's own card, keep-voiceprint.ts), the
// question, what is not on the account yet, and Keep on this account. Not
// now, Back, the backdrop and a swipe all decline (voiceprint-ask.ts), as
// they close Keep. When and whether it opens is voiceprint-ask.ts; every
// word is account-copy.ts.
//
// The Account screen's note (VoiceprintAskNote) is the way back for anyone
// who said Not now: it is there while this phone holds takes the account
// could add.

import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import './settings.css'
import { Sheet } from '@/components/mobile/Sheet'
import { accountHeld } from '@/db/services/auth-service'
import { WaveIcon } from '../icons'
import { VOICEPRINT_ASK, voiceprintAskBody, voiceprintAskTitle, } from './account-copy'
import { VoiceprintCard } from './AccountOffer'
import { keepableVoiceprint } from './keep-voiceprint'
import { addableVoiceprints, keepVoiceprints, voiceprintAskAsking, voiceprintAskNotNow, voiceprintAskOpen, voiceprintAskSaving, voiceprintAskUp, } from './voiceprint-ask'

/** The ask, over whatever the sign-in landed on. */
export function VoiceprintAskSheet(): JSX.Element {
  // Read as it opens: the takes on this phone right now.
  const count = createMemo(() =>
    voiceprintAskOpen() ? addableVoiceprints() : 0,
  )
  const print = createMemo(() =>
    voiceprintAskOpen() ? keepableVoiceprint() : null,
  )
  return (
    <Sheet
      isOpen={voiceprintAskUp()}
      close={voiceprintAskNotNow}
      ariaLabel={voiceprintAskTitle(count())}
      class="mp-offer-sheet"
    >
      <div
        class="mp-offer mp-offer--sheet mp-keep"
        data-testid="voiceprint-ask"
      >
        <div class="mp-keep__top">
          <button
            type="button"
            class="mp-keep__not-now"
            data-testid="voiceprint-ask-not-now"
            disabled={voiceprintAskSaving()}
            onClick={voiceprintAskNotNow}
          >
            {VOICEPRINT_ASK.notNow}
          </button>
        </div>
        <Show when={print()}>
          {(current) => <VoiceprintCard print={current()} />}
        </Show>
        <h2 class="mp-offer__title">{voiceprintAskTitle(count())}</h2>
        <p class="mp-keep__fact">{voiceprintAskBody(count())}</p>
        <button
          type="button"
          class="mp-set-button"
          data-testid="voiceprint-ask-keep"
          disabled={voiceprintAskSaving()}
          aria-busy={voiceprintAskSaving() ? 'true' : undefined}
          onClick={() => void keepVoiceprints()}
        >
          {voiceprintAskSaving() ? VOICEPRINT_ASK.saving : VOICEPRINT_ASK.keep}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * The Account screen's note: the same question, for anyone who said Not now
 * to the sheet. There while this phone holds takes the account could add.
 */
export function VoiceprintAskNote(): JSX.Element {
  // Not while the sheet asks the same thing, or is about to.
  const count = (): number => {
    if (voiceprintAskAsking() || !accountHeld()) return 0
    return addableVoiceprints()
  }
  return (
    <Show when={count() > 0}>
      <div class="mp-set-note" role="status" data-testid="voiceprint-note">
        <WaveIcon size={20} />
        <div class="mp-set-note__body">
          <p>{voiceprintAskBody(count())}</p>
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary mp-set-button--small"
            disabled={voiceprintAskSaving()}
            onClick={() => void keepVoiceprints()}
            data-testid="voiceprint-note-keep"
          >
            {voiceprintAskSaving()
              ? VOICEPRINT_ASK.saving
              : VOICEPRINT_ASK.keep}
          </button>
        </div>
      </div>
    </Show>
  )
}
