// ============================================================
// ExampleCredit — the licence line an example song must carry
// ============================================================
//
// The demo corpus is Creative Commons, which obliges us to credit it wherever
// the song appears — not only on the page it was first built for. This renders
// nothing at all for a session that is not an example, so it can be dropped
// into any surface that shows a song by name and left there.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 7).

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { exampleCreditFor } from '@/features/karaoke-night/seed-examples'

export interface ExampleCreditProps {
  sessionId: string | undefined
  /** Extra classes, for surfaces with their own type scale. */
  class?: string
}

export const ExampleCredit: Component<ExampleCreditProps> = (props) => {
  const credit = () =>
    props.sessionId === undefined ? null : exampleCreditFor(props.sessionId)

  return (
    <Show when={credit()}>
      {(value) => (
        <p
          class={`example-credit${props.class === undefined ? '' : ` ${props.class}`}`}
        >
          <Show fallback={value().text} when={value().url !== ''}>
            <a href={value().url} rel="noopener noreferrer" target="_blank">
              {value().text}
            </a>
          </Show>
          <Show when={value().license !== ''}>
            {' · '}
            <Show fallback={value().license} when={value().licenseUrl !== ''}>
              <a
                href={value().licenseUrl}
                rel="noopener noreferrer license"
                target="_blank"
              >
                {value().license}
              </a>
            </Show>
          </Show>
        </p>
      )}
    </Show>
  )
}
