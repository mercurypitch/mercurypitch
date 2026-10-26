// Studio Compare controls — render first, then explicitly audition the level-matched Before or After.
import { Show } from 'solid-js'
import { runStudioPanelAction } from '../export/action-focus'
import common from '../StudioPage.module.css'
import styles from './StudioSound.module.css'
import type { StudioComparisonController } from './useStudioComparison'

export function StudioComparisonControls(props: {
  comparison: StudioComparisonController
  enabled: boolean
}) {
  return (
    <section
      class={styles.section}
      aria-label="Compare sound"
      data-studio-finishing-actions
    >
      <h3>Compare</h3>
      <p class={common.help}>
        Hear the original mix and your finished sound at matched loudness.
      </p>
      <Show
        when={props.comparison.busy()}
        fallback={
          <Show
            when={props.comparison.ready()}
            fallback={
              <button
                type="button"
                class={common.button}
                data-studio-finishing-action
                disabled={!props.enabled}
                onClick={(event) => {
                  const action = props.comparison.prepare
                  void runStudioPanelAction(event.currentTarget, action)
                }}
              >
                Prepare Compare
              </button>
            }
          >
            <div class={common.actions}>
              <button
                type="button"
                class={styles.choice}
                data-studio-finishing-action
                disabled={!props.enabled}
                aria-pressed={
                  (props.comparison.playing() || props.comparison.pending()) &&
                  props.comparison.side() === 'before'
                }
                onClick={() => void props.comparison.play('before')}
              >
                Before
              </button>
              <button
                type="button"
                class={styles.choice}
                disabled={!props.enabled}
                aria-pressed={
                  (props.comparison.playing() || props.comparison.pending()) &&
                  props.comparison.side() === 'after'
                }
                onClick={() => void props.comparison.play('after')}
              >
                After
              </button>
              <button
                type="button"
                class={common.button}
                disabled={
                  !props.comparison.playing() && !props.comparison.pending()
                }
                onClick={() => props.comparison.stop()}
              >
                Stop Compare
              </button>
            </div>
            <Show when={props.comparison.pending()}>
              <p role="status" class={common.help}>
                Starting audio…
              </p>
            </Show>
          </Show>
        }
      >
        <p role="status">
          {props.comparison.cancelling()
            ? 'Stopping after the current pass…'
            : 'Preparing both versions…'}
        </p>
        <button
          type="button"
          class={common.button}
          data-studio-finishing-action
          disabled={props.comparison.cancelling()}
          onClick={() => props.comparison.cancel()}
        >
          Cancel Compare
        </button>
      </Show>
      <Show when={props.comparison.error()}>
        {(error) => (
          <p role="alert" class={styles.error}>
            {error()}
          </p>
        )}
      </Show>
      <Show when={props.comparison.notice()}>
        {(notice) => (
          <p role="status" class={common.help}>
            {notice()}
          </p>
        )}
      </Show>
    </section>
  )
}
