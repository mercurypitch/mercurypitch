// SharedRunResult displays a public or self-contained result without importing a run.
import { createResource, For, Show } from 'solid-js'
import { loadPublicSharedSession } from '@/db/services/share-service'
import type { SharedRunResultData } from '@/lib/shared-run-result'
import { decodeSharedRunResult } from '@/lib/shared-run-result'
import type { SharedRunRequest } from './shared-run-link'
import styles from './SharedRunResult.module.css'

type ResultState = { summary: SharedRunResultData | null; failed: boolean }

export function SharedRunResult(props: {
  request: SharedRunRequest
  onClose: () => void
}) {
  const [result, { refetch }] = createResource(
    () => props.request,
    async (request): Promise<ResultState> => {
      try {
        const summary =
          request.kind === 'payload'
            ? decodeSharedRunResult(request.payload)
            : await loadPublicSharedSession(request.id)
        return { summary, failed: false }
      } catch {
        return { summary: null, failed: true }
      }
    },
  )

  return (
    <section class={styles.result} aria-label="Shared practice result">
      <button
        type="button"
        class={styles.button}
        onClick={() => props.onClose()}
      >
        Back to Community
      </button>
      <Show
        when={!result.loading}
        fallback={<p role="status">Loading result...</p>}
      >
        <Show
          when={result()?.failed !== true}
          fallback={
            <div role="alert">
              <p>Could not load this result. Try again.</p>
              <button
                type="button"
                class={styles.button}
                onClick={() => void refetch()}
              >
                Try again
              </button>
            </div>
          }
        >
          <Show
            when={result()?.summary}
            fallback={
              <p role="status">
                This shared result is unavailable. It may have been unpublished,
                or the link may be incomplete.
              </p>
            }
          >
            {(summary) => (
              <>
                <p class={styles.label}>Shared practice result</p>
                <h1>{summary().name}</h1>
                <p>
                  by {summary().author || 'Unknown'}{' '}
                  <span aria-hidden="true">·</span>{' '}
                  {new Date(summary().date).toLocaleDateString()}
                </p>
                <ul class={styles.scores} aria-label="Shared scores">
                  <For each={summary().results}>
                    {(score) => <li>{score}%</li>}
                  </For>
                </ul>
                <p>
                  This is a shared result. Viewing it does not add a run to your
                  practice history.
                </p>
              </>
            )}
          </Show>
        </Show>
      </Show>
    </section>
  )
}
