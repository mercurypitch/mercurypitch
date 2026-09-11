// Recorded melodies and imported tabs share one score chooser with clear local provenance.
import { For, Show } from 'solid-js'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightReferenceSummary } from './reference-port'

export function GuitarNightScoreLibrary(props: {
  references: readonly GuitarNightReferenceSummary[]
  formatDate(timestamp: number): string
  onAttach(id: string): void
}) {
  const hasRecordings = () =>
    props.references.some((item) => item.songId.startsWith('recorded:'))
  return (
    <For each={['Recorded melodies', 'Imported scores']}>
      {(group, index) => {
        const entries = () =>
          props.references.filter(
            (item) => item.songId.startsWith('recorded:') === (index() === 0),
          )
        return (
          <Show when={entries().length > 0}>
            <Show when={hasRecordings()}>
              <h3>{group}</h3>
            </Show>
            <ul class={styles.songList} aria-label={group}>
              <For each={entries()}>
                {(summary) => (
                  <li>
                    <button
                      type="button"
                      onClick={() => props.onAttach(summary.songId)}
                    >
                      <span>
                        <strong>{summary.title}</strong>
                        <small>
                          {summary.trackCount}{' '}
                          {summary.trackCount === 1 ? 'part' : 'parts'} ·{' '}
                          {props.formatDate(summary.importedAt)}
                        </small>
                      </span>
                      <i aria-hidden="true">Attach</i>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )
      }}
    </For>
  )
}
