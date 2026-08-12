// Guitar Night Learn activities share one stage-first room frame and setlist vocabulary.
// ============================================================

import type { JSX } from 'solid-js'
import { onMount, Show } from 'solid-js'
import { ChevronLeft } from '@/components/icons'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import styles from './GuitarNightApp.module.css'

export type GuitarNightLearnActivityId =
  | 'first-steps'
  | 'note-hunt'
  | 'hear-find'
  | 'echo-phrase'
  | 'shape-walk'

export const GUITAR_NIGHT_LEARN_ACTIVITIES: readonly {
  id: Exclude<GuitarNightLearnActivityId, 'first-steps'>
  label: string
  detail: string
}[] = [
  {
    id: 'note-hunt',
    label: 'Note Hunt',
    detail: 'Find one note in every place it lives near the nut.',
  },
  {
    id: 'hear-find',
    label: 'Hear & Find',
    detail: 'Hear one pitch, then place it on the neck.',
  },
  {
    id: 'echo-phrase',
    label: 'Echo a Phrase',
    detail: 'Listen to a short line, then answer it note by note.',
  },
  {
    id: 'shape-walk',
    label: 'Shape Walk',
    detail: 'See how one major chord connects through CAGED shapes.',
  },
]

interface GuitarNightLearnActivityShellProps {
  testId: string
  name: string
  title: string
  progress?: string | null
  children: JSX.Element
  roomRef?(element: HTMLElement): void
  headingRef?(element: HTMLHeadingElement): void
  onBack(): void
}

export function GuitarNightLearnActivityShell(
  props: GuitarNightLearnActivityShellProps,
) {
  let heading!: HTMLHeadingElement

  onMount(() => {
    props.headingRef?.(heading)
    heading.focus({ preventScroll: true })
  })

  return (
    <section
      ref={(element) => props.roomRef?.(element)}
      class={styles.noteHuntRoom}
      data-testid={props.testId}
      data-stage-scope="true"
    >
      <div class={styles.roomHeadingRow}>
        <div class={styles.roomIdentity}>
          <button
            class={styles.roomBack}
            type="button"
            aria-label={`Back from ${props.name}`}
            onClick={() => props.onBack()}
          >
            <ChevronLeft />
          </button>
          <div>
            <p class={styles.eyebrow}>Learn · {props.name}</p>
            <h1 ref={heading} tabindex="-1">
              {props.title}
            </h1>
          </div>
        </div>
        <Show when={props.progress}>
          {(progress) => (
            <span class={styles.noteHuntHeadingProgress}>{progress()}</span>
          )}
        </Show>
      </div>
      {props.children}
    </section>
  )
}

export function guitarNightLearnTuningLabel(tuning: InstrumentTuning): string {
  const instrument = tuning.instrument === 'bass' ? 'bass' : 'guitar'
  const sourceName = tuning.name?.trim()
  const name =
    sourceName === undefined || sourceName === ''
      ? `${tuning.stringCount}-string ${instrument}`
      : sourceName
  return tuning.capo === undefined || tuning.capo === 0
    ? name
    : `${name} · capo ${tuning.capo}`
}
