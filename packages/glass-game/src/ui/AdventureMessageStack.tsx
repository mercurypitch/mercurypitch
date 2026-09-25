// Adventure message stack — presents at most two current HUD messages through one polite live region.

import { createMemo, Show } from 'solid-js'
import { scheduleAdventureMessageKinds } from './adventure-message-scheduler'
import type { AdventureProgressGuidance } from './AdventureGuidance'
import styles from './GlassAdventure.module.css'

interface AdventureMessageStackProps {
  narration: string
  notice: string
  guidance?: AdventureProgressGuidance
  withEncounterOffer: boolean
}

export function AdventureMessageStack(props: AdventureMessageStackProps) {
  const messageKinds = createMemo(() =>
    scheduleAdventureMessageKinds({
      narration: props.narration !== '',
      notice: props.notice !== '',
      guidance: props.guidance !== undefined,
    }),
  )

  return (
    <Show when={messageKinds().length > 0}>
      <div
        class={styles.messageStack}
        classList={{
          [styles.messageStackWithOffer]: props.withEncounterOffer,
        }}
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Museum guidance"
        data-testid="glass-message-stack"
        data-message-count={messageKinds().length}
      >
        <Show when={messageKinds().includes('narration')}>
          <p
            class={styles.narrationCaption}
            data-testid="merc-narration-caption"
          >
            <strong>Merc:</strong> {props.narration}
          </p>
        </Show>
        <Show when={messageKinds().includes('notice')}>
          <p class={styles.notice} data-testid="glass-notice">
            {props.notice}
          </p>
        </Show>
        <Show
          when={
            messageKinds().includes('guidance') ? props.guidance : undefined
          }
        >
          {(guidance) => (
            <p
              class={styles.progressGuidance}
              data-testid="glass-progress-guidance"
              data-guidance-kind={guidance().kind}
            >
              <strong>{guidance().heading}</strong> {guidance().detail}
            </p>
          )}
        </Show>
      </div>
    </Show>
  )
}
