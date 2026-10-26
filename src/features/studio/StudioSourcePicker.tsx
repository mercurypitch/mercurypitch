// Studio source picker — explicit, metadata-only browsing of the app's kept takes.
import { For, Show } from 'solid-js'
import styles from './StudioPage.module.css'
import type { StudioController } from './useStudioController'

interface StudioSourcePickerProps {
  studio: StudioController
}

export function StudioSourcePicker(props: StudioSourcePickerProps) {
  const duration = (ms: number) =>
    `${Math.floor(ms / 60_000)}:${Math.floor((ms / 1000) % 60)
      .toString()
      .padStart(2, '0')}`
  return (
    <section class={styles.sources} aria-label="Kept takes">
      <div class={styles.projectHeading}>
        <h2>Kept takes</h2>
        <button
          type="button"
          disabled={props.studio.busy()}
          onClick={() => void props.studio.refreshSources()}
        >
          Refresh
        </button>
      </div>
      <Show when={props.studio.sourceError()}>
        {(error) => <p role="alert">{error()}</p>}
      </Show>
      <Show
        when={props.studio.sources().length}
        fallback={
          <p>
            Your kept recordings appear here. You can also upload an audio file.
          </p>
        }
      >
        <ul class={styles.sourceList}>
          <For each={props.studio.sources()}>
            {(source) => (
              <li>
                <div>
                  <strong>{source.title}</strong>
                  <small>
                    {source.sourceLabel} · {duration(source.durationMs)}
                  </small>
                  <p>{source.audioDescription}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Add ${source.title}`}
                  disabled={props.studio.busy() || !props.studio.writable()}
                  onClick={() => void props.studio.addTake(source)}
                >
                  Add
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
