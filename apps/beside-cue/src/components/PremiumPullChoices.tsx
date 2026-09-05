// ============================================================
// Premium Pull choices — expandable still previews with store-owned access
// ============================================================
// THESIS: More cast, without crowding the six familiar choices.
// OWN-WORLD: Existing paper, ink, character cutouts and turquoise selection.
// STORY: Free choices first; a deliberate reveal opens the additional cast.
// FIRST VIEWPORT: One quiet disclosure, no purchase interruption.
// FORM: Readable locked previews; native disabled radios; no autoplay gallery.

import { createSignal, createUniqueId, For, Show } from 'solid-js'
import type { AssetSlot, PullOption } from '@/content'
import { canSelectPull } from '@/content/pulls'
import { useCopy } from '@/i18n/ui-copy'
import { NoSelect } from '@/interaction/selection'
import { AssetStage } from './AssetStage'
import styles from './PremiumPullChoices.module.css'

interface PremiumPullChoicesProps {
  readonly options: readonly PullOption[]
  readonly selectedId?: string
  readonly isPro?: boolean
  readonly radioName: string
  readonly artFor: (id: string) => AssetSlot
  readonly onSelect: (id: string) => void
}

export function PremiumPullChoices(props: PremiumPullChoicesProps) {
  const copy = useCopy()
  const [expanded, setExpanded] = createSignal(false)
  const id = createUniqueId()
  return (
    <Show when={props.options.length > 0}>
      <details
        class={styles.shelf}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
        {...NoSelect}
      >
        <summary class={styles.toggle}>
          <span>{copy.t(expanded() ? 'Hide premium' : 'Show premium')}</span>
          <span class={styles.edition}>
            PRO · {copy.t('{count} Pulls', { count: props.options.length })}
          </span>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path
              d="m6 9 6 6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
        </summary>
        <Show when={expanded()}>
          <p class={styles.note} id={`${id}-note`}>
            {copy.t(
              props.isPro === true
                ? 'Your Pro cast. Choose the Pull you want to notice.'
                : 'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.',
            )}
          </p>
          <div
            class={styles.grid}
            role="radiogroup"
            aria-label={copy.t('Premium Pull choices')}
            aria-describedby={`${id}-note`}
          >
            <For each={props.options}>
              {(option) => {
                const allowed = () =>
                  canSelectPull(option.id, props.isPro === true, props.options)
                return (
                  <label
                    class={styles.card}
                    classList={{
                      [styles.selected]:
                        allowed() && props.selectedId === option.id,
                    }}
                  >
                    <input
                      type="radio"
                      name={props.radioName}
                      value={option.id}
                      aria-label={option.label}
                      aria-describedby={`${id}-${option.id}`}
                      checked={allowed() && props.selectedId === option.id}
                      disabled={!allowed()}
                      onChange={() => {
                        if (allowed()) props.onSelect(option.id)
                      }}
                    />
                    <span class={styles.badge}>
                      {allowed() ? 'PRO' : copy.t('PRO · Locked')}
                    </span>
                    <AssetStage
                      slot={props.artFor(option.id)}
                      ceiling="still"
                      size={256}
                      class={styles.art}
                    />
                    <span>{props.artFor(option.id).alt}</span>
                    <strong>{option.label}</strong>
                    <small id={`${id}-${option.id}`}>{option.moment}</small>
                  </label>
                )
              }}
            </For>
          </div>
        </Show>
      </details>
    </Show>
  )
}
