// ============================================================
// UserSurveyModal — Optional onboarding survey
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import { submitSurvey } from '@/db/services/survey-service'
import { showNotification } from '@/stores/notifications-store'
import styles from './UserSurveyModal.module.css'

interface Props {
  onClose: () => void
}

const BACKGROUNDS = [
  { id: 'singer', label: 'Singer / Vocalist' },
  { id: 'guitarist', label: 'Guitarist' },
  { id: 'musician', label: 'Musician (multi-instrument)' },
  { id: 'producer', label: 'Producer / Songwriter' },
  { id: 'exploring', label: 'Just exploring' },
]

const USAGES = [
  { id: 'singing', label: 'Singing practice' },
  { id: 'guitar', label: 'Guitar practice' },
  { id: 'jam', label: 'Jam sessions' },
  { id: 'karaoke', label: 'Karaoke singing' },
  { id: 'ear', label: 'Ear training' },
]

const UserSurveyModal: Component<Props> = (props) => {
  const [background, setBackground] = createSignal<string[]>([])
  const [usage, setUsage] = createSignal<string[]>([])
  const [featureRequest, setFeatureRequest] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [visible, setVisible] = createSignal(false)

  onMount(() => {
    requestAnimationFrame(() => setVisible(true))
  })

  const toggleItem = (
    list: string[],
    setter: (v: string[]) => void,
    id: string,
  ) => {
    if (list.includes(id)) {
      setter(list.filter((x) => x !== id))
    } else {
      setter([...list, id])
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const saved = await submitSurvey({
      background: background(),
      usage: usage(),
      featureRequest: featureRequest().trim() || undefined,
    })
    setSubmitting(false)
    // Only thank the user if the response was actually persisted; otherwise
    // close quietly rather than claim a success that did not happen.
    if (saved) showNotification('Thank you for sharing!', 'success')
    props.onClose()
  }

  return (
    <div
      class={styles.overlay}
      classList={{ [styles.visible]: visible() }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick survey"
      onClick={() => props.onClose()}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>Welcome to MercuryPitch</h2>
          <p class={styles.subtitle}>
            Help us improve — 3 quick questions (optional)
          </p>
        </div>

        <div class={styles.questions}>
          {/* Q1: Background */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>I am a...</h3>
            <div class={styles.options}>
              <For each={BACKGROUNDS}>
                {(opt) => (
                  <button
                    class={styles.option}
                    classList={{
                      [styles.selected]: background().includes(opt.id),
                    }}
                    onClick={() =>
                      toggleItem(background(), setBackground, opt.id)
                    }
                    type="button"
                  >
                    <span class={styles.check}>
                      <Show when={background().includes(opt.id)}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Show>
                    </span>
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Q2: Usage */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>
              I plan to use MercuryPitch for...
            </h3>
            <div class={styles.options}>
              <For each={USAGES}>
                {(opt) => (
                  <button
                    class={styles.option}
                    classList={{
                      [styles.selected]: usage().includes(opt.id),
                    }}
                    onClick={() => toggleItem(usage(), setUsage, opt.id)}
                    type="button"
                  >
                    <span class={styles.check}>
                      <Show when={usage().includes(opt.id)}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Show>
                    </span>
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Q3: Feature request */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>
              What feature would you most like to see?
            </h3>
            <textarea
              class={styles.textarea}
              value={featureRequest()}
              onInput={(e) => setFeatureRequest(e.currentTarget.value)}
              placeholder="e.g. Offline mode, more exercises, tablature view..."
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <div class={styles.actions}>
          <button
            class={styles.skipBtn}
            onClick={() => props.onClose()}
            type="button"
          >
            Skip
          </button>
          <button
            class={styles.submitBtn}
            onClick={() => void handleSubmit()}
            disabled={submitting()}
            type="button"
          >
            {submitting() ? 'Sending...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserSurveyModal
