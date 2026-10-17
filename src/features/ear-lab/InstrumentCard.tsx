// ============================================================
// InstrumentCard — the engraved plate at the stage's top left.
//
// The bench caption and the drill's paragraph used to sit under the
// play pads, where they read as part of the console. They are about
// the instrument, so they hang on it: icon, name, what it measures,
// and the text clamped to three lines (or the drill's own count, where
// that shows all of it) until More. On a phone the plate folds to one
// row — "About Bassline" — and unfolds over the instrument; which
// drills stay open is remembered per drill.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, createUniqueId, onMount, Show } from 'solid-js'
import { earInfoOpen, setEarInfoOpen } from '@/stores/ear-lab-store'
import { IconChevron } from './ear-icons'
import { iconForDrill } from './instrument-icons'
import styles from './InstrumentCard.module.css'
import { useCompactStage } from './use-compact-stage'

export interface InstrumentCardProps {
  drillId: string
  name: string
  /** The bench caption: "Resolution · cents". */
  measures?: string
  description: string
  /** Lines of text before More. Three, unless the drill's instrument
   *  starts low enough to leave room under the plate for more; and only
   *  where that many show the whole text, or it is three again. */
  lines?: number
}

export function InstrumentCard(props: InstrumentCardProps): JSX.Element {
  const compact = useCompactStage()
  const open = (): boolean => earInfoOpen(props.drillId)
  const toggle = (): void => setEarInfoOpen(props.drillId, !open())
  const textId = createUniqueId()
  const shown = (): boolean => !compact() || open()

  // More only where the clamp actually cuts: measured once the text is
  // laid out, and assumed to cut where nothing is laid out (tests).
  // A drill's own count holds only where it shows the whole text: where
  // it would still cut (a narrower desk), the plate keeps three lines and
  // More rather than hang lower over the instrument for nothing.
  let textEl: HTMLParagraphElement | undefined
  const [clamps, setClamps] = createSignal(true)
  const [ownCountCuts, setOwnCountCuts] = createSignal(false)
  const lines = (): number | undefined =>
    ownCountCuts() ? undefined : props.lines
  onMount(() => {
    if (textEl === undefined || textEl.clientHeight === 0) return
    const cuts = textEl.scrollHeight > textEl.clientHeight + 1
    setOwnCountCuts(cuts)
    setClamps(cuts)
  })

  return (
    <aside
      class={styles.card}
      classList={{
        [styles.cardOpen]: open(),
        [styles.cardCompact]: compact(),
      }}
      data-testid="ear-instrument-card"
      data-open={open() ? 'true' : 'false'}
      aria-label={`About ${props.name}`}
    >
      <button
        type="button"
        class={styles.head}
        aria-expanded={open()}
        aria-controls={shown() ? textId : undefined}
        onClick={toggle}
      >
        <span class={styles.glyph} aria-hidden="true">
          {iconForDrill(props.drillId)({ size: 20 })}
        </span>
        <span class={styles.title}>
          <b class={styles.name}>
            {compact() ? `About ${props.name}` : props.name}
          </b>
          <Show when={props.measures !== undefined && !compact()}>
            <small class={styles.measures}>{props.measures}</small>
          </Show>
        </span>
        <IconChevron size={14} class={styles.chevron} />
      </button>
      <Show when={shown()}>
        <Show when={compact() && props.measures !== undefined}>
          <small class={styles.kicker}>{props.measures}</small>
        </Show>
        <p
          id={textId}
          ref={textEl}
          class={styles.text}
          classList={{ [styles.textClamped]: !open() && !compact() }}
          style={
            lines() === undefined
              ? undefined
              : { '--card-lines': String(lines()) }
          }
        >
          {props.description}
        </p>
      </Show>
      <Show when={!compact() && (clamps() || open())}>
        <button
          type="button"
          class={styles.more}
          aria-expanded={open()}
          aria-controls={textId}
          onClick={toggle}
        >
          {open() ? 'Less' : 'More'}
        </button>
      </Show>
    </aside>
  )
}
