import { For } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import type { PullOption } from '@/content'

interface ChoosePullScreenProps {
  options: readonly PullOption[]
  selectedId?: string
  customText: string
  error?: string
  onSelect: (id: string) => void
  onCustomInput: (value: string) => void
  onBack: () => void
  onContinue: () => void
}

export function ChoosePullScreen(props: ChoosePullScreenProps) {
  const customSelected = () => props.selectedId === 'custom'

  return (
    <main class="setup-screen app-screen">
      <AppHeader label="Your first cue" onBack={props.onBack} />
      <section class="setup-screen__intro" aria-labelledby="pull-title">
        <p class="step-label">Side A · the familiar pull</p>
        <h1 id="pull-title">Which moment would you like less of?</h1>
        <p>
          Choose a starting point. You can use your own words, and they stay on
          this device.
        </p>
      </section>
      <div class="choice-list" role="radiogroup" aria-labelledby="pull-title">
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              class="choice-row"
              classList={{
                'choice-row--selected': props.selectedId === option.id,
              }}
              role="radio"
              aria-checked={props.selectedId === option.id}
              onClick={() => props.onSelect(option.id)}
            >
              <span class="choice-row__disc" aria-hidden="true" />
              <span class="choice-row__copy">
                <strong>{option.label}</strong>
                <small>{option.moment}</small>
              </span>
              <span class="choice-row__check" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m6 12 4 4 8-9" />
                </svg>
              </span>
            </button>
          )}
        </For>
        <button
          type="button"
          class="choice-row"
          classList={{ 'choice-row--selected': customSelected() }}
          role="radio"
          aria-checked={customSelected()}
          onClick={() => props.onSelect('custom')}
        >
          <span
            class="choice-row__disc choice-row__disc--custom"
            aria-hidden="true"
          />
          <span class="choice-row__copy">
            <strong>Something else</strong>
            <small>
              Name the moment in language that feels natural to you.
            </small>
          </span>
          <span class="choice-row__check" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m6 12 4 4 8-9" />
            </svg>
          </span>
        </button>
      </div>
      {customSelected() ? (
        <label class="text-field">
          <span>Your words</span>
          <input
            value={props.customText}
            onInput={(event) => props.onCustomInput(event.currentTarget.value)}
            maxLength={120}
            autocomplete="off"
            placeholder="For example, opening the feed again"
            aria-describedby={
              props.error === undefined ? 'pull-private-note' : 'pull-error'
            }
          />
          <small id="pull-private-note">Stored only on this device.</small>
        </label>
      ) : null}
      {props.error === undefined ? null : (
        <p class="field-error" id="pull-error" role="alert">
          {props.error}
        </p>
      )}
      <div class="setup-screen__footer">
        <button
          class="primary-button primary-button--wide"
          type="button"
          onClick={() => props.onContinue()}
        >
          Choose my B-side
        </button>
      </div>
    </main>
  )
}
