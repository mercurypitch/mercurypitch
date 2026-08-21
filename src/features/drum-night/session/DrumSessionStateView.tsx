// ============================================================
// Drum Session State View — honest import boundary copy
// ============================================================

import type { Accessor, JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import type { DrumSessionImportState } from './drum-session'
import styles from './DrumNightSessionViews.module.css'

export interface DrumSessionStateCopy {
  readonly title: string
  readonly detail: string
  readonly tone: 'neutral' | 'busy' | 'warning' | 'error'
}

export function drumSessionStateCopy(
  state: DrumSessionImportState,
): DrumSessionStateCopy | null {
  switch (state.status) {
    case 'idle':
      return {
        title: 'No drum part loaded',
        detail: 'Bring a MIDI or Guitar Pro file to open its percussion part.',
        tone: 'neutral',
      }
    case 'loading':
      return {
        title: `Reading ${state.fileName}`,
        detail: 'Keeping tempo, meter, articulation, and velocity together.',
        tone: 'busy',
      }
    case 'empty':
      return {
        title: 'This file is empty',
        detail:
          'Export the part again with at least one drum event, then retry.',
        tone: 'warning',
      }
    case 'too-large':
      return {
        title: 'This file is too large to open safely',
        detail: `Choose a file smaller than ${Math.round(state.maximumBytes / 1024 / 1024)} MB. This file is ${Math.ceil(state.actualBytes / 1024 / 1024)} MB.`,
        tone: 'warning',
      }
    case 'unsupported':
      return state.reason === 'file-type'
        ? {
            title: 'File type not supported',
            detail: 'Choose a MIDI, GP, GP3, GP4, GP5, or GPX file.',
            tone: 'warning',
          }
        : {
            title: 'No safely mapped drum hits',
            detail: `${state.droppedHitCount} source ${state.droppedHitCount === 1 ? 'event was' : 'events were'} reported as unsupported. Drum Night will not guess a substitute sound.`,
            tone: 'warning',
          }
    case 'no-drums':
      return {
        title: 'No drum track in this file',
        detail: `${state.pitchedTrackCount} pitched ${state.pitchedTrackCount === 1 ? 'part was' : 'parts were'} found, but Drum Night needs a percussion track.`,
        tone: 'warning',
      }
    case 'error':
      return {
        title: 'The drum part could not be opened',
        detail: state.message,
        tone: 'error',
      }
    case 'ready':
      return null
  }
}

interface DrumSessionStateViewProps {
  state: Accessor<DrumSessionImportState>
  context: 'score' | 'kit' | 'coach'
}

export function DrumSessionStateView(
  props: DrumSessionStateViewProps,
): JSX.Element {
  const copy = createMemo(() => drumSessionStateCopy(props.state()))

  return (
    <Show when={copy()} keyed>
      {(content) => (
        <section
          class={styles.stateView}
          data-tone={content.tone}
          role={content.tone === 'error' ? 'alert' : 'status'}
          aria-label={`${props.context} session state`}
        >
          <span class={styles.stateMark} aria-hidden="true" />
          <div>
            <h2>{content.title}</h2>
            <p>{content.detail}</p>
          </div>
        </section>
      )}
    </Show>
  )
}
