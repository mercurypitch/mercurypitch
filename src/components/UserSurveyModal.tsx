// ============================================================
// UserSurveyModal — Optional onboarding survey (2-3 questions)
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
  { id: 'beginner', label: 'Beginner — just starting out' },
  { id: 'intermediate', label: 'Intermediate — some experience' },
  { id: 'advanced', label: 'Advanced — trained vocalist' },
  { id: 'professional', label: 'Professional — I perform regularly' },
  { id: 'curious', label: 'Just curious — exploring my voice' },
]

const USAGES = [
  { id: 'pitch', label: 'Improve pitch accuracy' },
  { id: 'warmup', label: 'Vocal warmups & exercises' },
  { id: 'ear', label: 'Ear training' },
  { id: 'learn', label: 'Learn to sing' },
  { id: 'pro', label: 'Professional practice tool' },
  { id: 'fun', label: 'Just for fun' },
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
    await submitSurvey({
      background: background(),
      usage: usage(),
      featureRequest: featureRequest().trim() || undefined,
    })
    setSubmitting(false)
    showNotification('Thank you for sharing!', 'success')
    props.onClose()
  }

  const handleSkip = () => {
    props.onClose()
  }

  return (
    <div
      class={styles.overlay}
      classList={{ [styles.visible]: visible() }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick survey"
      onClick={handleSkip}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>Welcome to MercuryPitch</h2>
          <p class={styles.subtitle}>
            Help us make the app better for you — this is optional and takes 30
            seconds.
          </p>
        </div>

        <div class={styles.questions}>
          {/* Q1: Background */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>
              What is your singing background?
            </h3>
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
                          width="14"
                          height="14"
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
              How do you plan to use MercuryPitch?
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
                          width="14"
                          height="14"
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
              What feature would you most like to see? (optional)
            </h3>
            <textarea
              class={styles.textarea}
              value={featureRequest()}
              onInput={(e) => setFeatureRequest(e.currentTarget.value)}
              placeholder="e.g. Guitar practice mode, downloadable exercises, offline support..."
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <div class={styles.actions}>
          <button class={styles.skipBtn} onClick={handleSkip} type="button">
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
