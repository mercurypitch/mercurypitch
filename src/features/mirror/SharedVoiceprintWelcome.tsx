// ============================================================
// "Someone sent you this" — the first screen of a shared link
// ============================================================
//
// Before this existed, a shared card sent its recipient to the generic
// Mirror: an empty instrument asking a stranger to sing. They had come to
// look at what a friend sent them, so they left — shared sessions averaged
// three seconds. This screen shows them the voiceprint first, and only
// then offers them their own.

import { createResource, Show } from 'solid-js'
import { formatSpan, sharedRangeNotes, sharedVoiceprintTitle, } from '@/lib/mirror/shared-voiceprint'
import type { VoiceprintShareData } from '@/lib/share-codec'
import { renderSharedVoiceprintCard } from './shared-voiceprint-card'

export interface SharedVoiceprintWelcomeProps {
  data: VoiceprintShareData
  /** Continue into the singer's own take. */
  onStart: () => void
}

export function SharedVoiceprintWelcome(
  props: SharedVoiceprintWelcomeProps,
): ReturnType<typeof Show> {
  const range = (): string | null => sharedRangeNotes(props.data)
  const span = (): string | null => formatSpan(props.data.st)

  // The real card, rebuilt from the numbers in the link — the same drawing
  // the sender exported, not a second rendering of the same data. Null
  // whenever there is no twin, no portrait, or the portrait will not load;
  // the written layout below is the fallback, never a broken frame.
  const [card] = createResource(
    () => props.data,
    (data) => renderSharedVoiceprintCard(data),
  )

  return (
    <section class="shared-vp" aria-labelledby="shared-vp-title">
      <p class="shared-vp-eyebrow">Someone sent you this</p>
      <h1 class="shared-vp-title" id="shared-vp-title">
        {sharedVoiceprintTitle(props.data)}
      </h1>

      <Show when={card()}>
        <figure class="shared-vp-figure">{card()}</figure>
      </Show>

      <div
        class="shared-vp-card"
        classList={{ 'shared-vp-card-aside': card() != null }}
      >
        <Show when={range()}>
          <p class="shared-vp-range">{range()}</p>
        </Show>
        <Show when={span()}>
          <p class="shared-vp-span">{span()}</p>
        </Show>

        <Show when={props.data.tw}>
          <p class="mirror-chip shared-vp-twin">Voice twin: {props.data.tw}</p>
        </Show>

        <Show when={props.data.ac != null || props.data.sd != null}>
          <dl class="shared-vp-stats">
            <Show when={props.data.ac != null}>
              <div class="shared-vp-stat">
                <dt>Accuracy</dt>
                <dd>±{props.data.ac}¢</dd>
              </div>
            </Show>
            <Show when={props.data.sd != null}>
              <div class="shared-vp-stat">
                <dt>Steadiness</dt>
                <dd>±{props.data.sd}¢ on holds</dd>
              </div>
            </Show>
          </dl>
        </Show>
      </div>

      <button class="mirror-cta" onClick={() => props.onStart()} type="button">
        Meet your voice
      </button>
      <p class="shared-vp-foot">
        Sing one note and we will tell you which note it was. About a minute, no
        account, and it all happens on your device.
      </p>
    </section>
  )
}
