// ============================================================
// Review access row — where a store reviewer turns the paid tier on
// ============================================================
//
// Visible on purpose. A hidden unlock reads as undisclosed functionality, and
// the reviewer has to be able to follow the written instructions without
// hunting. The copy says plainly that nothing is bought here.

import { createSignal, Show } from 'solid-js'
import { useCopy } from '@/i18n/ui-copy'
import type { ReviewAccessState } from '@/purchases/review-access'
import styles from './ReviewAccessRow.module.css'

interface ReviewAccessRowProps {
  /** What the paid tier is called, so the copy matches the section above. */
  name: string
  active: boolean
  state: ReviewAccessState
  onRedeem: ((code: string) => void) | ((code: string) => Promise<unknown>)
  onRevoke: () => void
}

export function ReviewAccessRow(props: ReviewAccessRowProps) {
  const copy = useCopy()
  const [code, setCode] = createSignal('')
  const busy = () => props.state === 'checking'

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (busy() || code().trim() === '') return
    await props.onRedeem(code())
    setCode('')
  }

  return (
    <div class={styles.review}>
      <Show
        when={props.active}
        fallback={
          <form class={styles.form} onSubmit={(event) => void submit(event)}>
            <label class={styles.field}>
              {copy.t('Review access code')}
              <input
                type="text"
                value={code()}
                onInput={(event) => setCode(event.currentTarget.value)}
                autocomplete="off"
                autocapitalize="characters"
                autocorrect="off"
                spellcheck={false}
                disabled={busy()}
              />
            </label>
            <div class={styles.actions}>
              <button
                class="secondary-button"
                type="submit"
                disabled={busy() || code().trim() === ''}
              >
                {busy() ? copy.t('Checking…') : copy.t('Turn on review access')}
              </button>
            </div>
            <p class="settings-group__intro">
              {copy.t(
                'For app review. The code opens {name} on this device. Nothing is bought and nothing is charged.',
                { name: props.name },
              )}
            </p>
            <Show when={props.state === 'rejected'}>
              <p class="schedule-status schedule-status--error" role="alert">
                {copy.t('That code does not match. Check it and try again.')}
              </p>
            </Show>
            <Show when={props.state === 'unavailable'}>
              <p class="schedule-status schedule-status--error" role="alert">
                {copy.t('This build cannot check review codes.')}
              </p>
            </Show>
          </form>
        }
      >
        <p class="schedule-status" role="status">
          {copy.t(
            'Review access is on. {name} is open on this device and nothing was bought.',
            { name: props.name },
          )}
        </p>
        <div class={styles.actions}>
          <button
            class="text-button"
            type="button"
            onClick={() => props.onRevoke()}
          >
            {copy.t('Turn off review access')}
          </button>
        </div>
      </Show>
    </div>
  )
}
