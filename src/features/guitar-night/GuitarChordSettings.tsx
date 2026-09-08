// Session chord switches distinguish experimental live ink from reversible post-stop proposals.
/*
THESIS: Choose when to look for chord pitches, without conflating preview with saved evidence.
OWN-WORLD: Inherit Velvet Rehearsal's warm faceplate, ivory labels and amber switches.
STORY: Opt into live ink or let Stop prepare a proposal; acceptance stays explicit.
FIRST VIEWPORT: Labels left, switches right, measured preview status below Live chords.
FORM: A compact Session fieldset extending the existing surface, not a new panel or identity.
*/
import { Show } from 'solid-js'
import styles from './GuitarChordSettings.module.css'
import type { GuitarChordSettings as Settings } from './useGuitarChordSettings'
import type { GuitarLiveChords } from './useGuitarLiveChords'

export function GuitarChordSettings(props: {
  settings: Settings
  live: GuitarLiveChords
  liveAvailable: boolean
}) {
  const detail = () => {
    if (!props.settings.live())
      return 'Single-note preview. The amp and recording are unchanged.'
    if (!props.liveAvailable)
      return 'Live chords appear in Free form. Refine after Stop also works with a song.'
    if (props.live.error() !== null) return props.live.error()
    switch (props.live.status()) {
      case 'loading':
        return 'Loading the chord model on this device…'
      case 'listening':
        return 'Listening for chords. Play a short phrase.'
      case 'active':
        return 'Live chord preview is running. Audio monitoring never waits for these notes.'
      default:
        return 'Turn on Listening with Direct input or Room mic, then select Live or Record. Keep Live notes on.'
    }
  }
  return (
    <fieldset class={styles.section}>
      <legend>
        Chord detection <span class={styles.badge}>Experimental</span>
      </legend>
      <label class={styles.row}>
        <span>
          <strong>Live chords</strong>
          <small>Preview several pitches while you play or record.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Live chords"
          checked={props.settings.live()}
          onChange={(event) =>
            props.settings.setLive(event.currentTarget.checked)
          }
        />
      </label>
      <p class={styles.detail} role="status">
        {detail()}
      </p>
      <Show when={props.settings.live() && props.live.active()}>
        <p class={styles.timing}>
          Preview behind input: {Math.round(props.live.previewLagMs() ?? 0)} ms{' '}
          <span>·</span> Analysis: {Math.round(props.live.processingMs() ?? 0)}{' '}
          ms
        </p>
      </Show>
      <label class={styles.row}>
        <span>
          <strong>Refine after Stop</strong>
          <small>
            Automatically prepare a full-take chord proposal. Compare it before
            choosing Use refined notes.
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Refine after Stop"
          checked={props.settings.afterStop()}
          onChange={(event) =>
            props.settings.setAfterStop(event.currentTarget.checked)
          }
        />
      </label>
      <p class={styles.footnote}>
        Live detection needs a short analysis window. For the lightest session,
        leave it off and refine after Stop.
      </p>
    </fieldset>
  )
}
