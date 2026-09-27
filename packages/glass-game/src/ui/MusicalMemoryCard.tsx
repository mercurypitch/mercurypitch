// Musical Memory card — local take facts, explicit playback, export, save and deletion controls.

import { createMemo, Show } from 'solid-js'
import type { MercEncoreVariant } from '../content/encore-examples'
import type { MusicalMemory } from '../core/musical-memory'
import { describeMusicalMemory } from './musical-memory-scorecard'
import styles from './MusicalMemoryCard.module.css'

export function MusicalMemoryCard(props: {
  take: MusicalMemory
  candidate: boolean
  saving: boolean
  saved: boolean
  replacing?: boolean
  canPlay: boolean
  onListen(): void
  onHearMerc?(variant: MercEncoreVariant): void
  onDownload(): void
  onSave?(): void
  onDelete(): void
}) {
  const scorecard = createMemo(() => describeMusicalMemory(props.take))
  const recordedDate = createMemo(() =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(scorecard().recordedAt)),
  )

  return (
    <section
      class={styles.card}
      aria-label={
        props.candidate ? 'New musical memory' : 'Saved musical memory'
      }
    >
      <header class={styles.header}>
        <div>
          <span>
            {props.candidate ? 'New musical memory' : 'On this device'}
          </span>
          <h3>{scorecard().melodyTitle}</h3>
        </div>
        <strong>{scorecard().duration}</strong>
      </header>
      <dl class={styles.facts}>
        <div>
          <dt>Shape</dt>
          <dd>
            {scorecard().noteCount === null
              ? 'Saved melody'
              : `${scorecard().noteCount} notes`}
          </dd>
        </div>
        <div>
          <dt>Starts</dt>
          <dd>{scorecard().startingNote}</dd>
        </div>
        <div>
          <dt>Pace</dt>
          <dd>{scorecard().pace}</dd>
        </div>
        <div>
          <dt>Captured</dt>
          <dd>{recordedDate()}</dd>
        </div>
      </dl>
      <p class={styles.privacy}>
        Stored locally. Nothing is uploaded or shared.
      </p>
      <div class={styles.actions}>
        <Show when={props.canPlay}>
          <button type="button" onClick={() => props.onListen()}>
            Hear your take
          </button>
        </Show>
        <Show when={props.onHearMerc ? scorecard().merc?.variant : undefined}>
          {(variant) => (
            <button
              type="button"
              disabled={!props.canPlay}
              onClick={() => props.onHearMerc?.(variant())}
            >
              Hear Merc’s take
            </button>
          )}
        </Show>
        <button type="button" onClick={() => props.onDownload()}>
          Export audio
        </button>
        <Show when={props.candidate && props.onSave !== undefined}>
          <button
            type="button"
            disabled={props.saving || props.saved}
            onClick={() => props.onSave?.()}
          >
            {props.saved
              ? 'Saved'
              : props.replacing === true
                ? 'Replace saved take'
                : 'Save on this device'}
          </button>
        </Show>
        <button
          type="button"
          class={styles.delete}
          disabled={props.saving}
          onClick={() => props.onDelete()}
        >
          {props.candidate ? 'Discard new take' : 'Delete saved take'}
        </button>
      </div>
    </section>
  )
}
