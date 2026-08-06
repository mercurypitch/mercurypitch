import { For } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'

interface ChooseBSideScreenProps {
  pullText: string
  suggestions: readonly string[]
  selectedText: string
  customText: string
  customSelected: boolean
  error?: string
  onSelect: (text: string) => void
  onSelectCustom: () => void
  onCustomInput: (value: string) => void
  onBack: () => void
  onContinue: () => void
}

export function ChooseBSideScreen(props: ChooseBSideScreenProps) {
  return (
    <main class="setup-screen app-screen">
      <AppHeader label="Your first cue" onBack={props.onBack} />
      <section class="setup-screen__intro" aria-labelledby="bside-title">
        <p class="step-label step-label--bside">Side B · your chosen turn</p>
        <h1 id="bside-title">What tiny action belongs beside it?</h1>
        <p>
          When <strong>{props.pullText}</strong> shows up, choose something
          concrete enough to begin without planning.
        </p>
      </section>
      <div
        class="choice-list choice-list--bside"
        role="radiogroup"
        aria-labelledby="bside-title"
      >
        <For each={props.suggestions}>
          {(suggestion) => (
            <button
              type="button"
              class="choice-row"
              classList={{
                'choice-row--selected':
                  !props.customSelected && props.selectedText === suggestion,
              }}
              role="radio"
              aria-checked={
                !props.customSelected && props.selectedText === suggestion
              }
              onClick={() => props.onSelect(suggestion)}
            >
              <span class="choice-row__disc" aria-hidden="true" />
              <span class="choice-row__copy">
                <strong>{suggestion}</strong>
                <small>One clear beginning, not a new task list.</small>
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
          classList={{ 'choice-row--selected': props.customSelected }}
          role="radio"
          aria-checked={props.customSelected}
          onClick={() => props.onSelectCustom()}
        >
          <span
            class="choice-row__disc choice-row__disc--custom"
            aria-hidden="true"
          />
          <span class="choice-row__copy">
            <strong>Write my own</strong>
            <small>Begin with a verb: open, walk, play, fill, call.</small>
          </span>
          <span class="choice-row__check" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m6 12 4 4 8-9" />
            </svg>
          </span>
        </button>
      </div>
      {props.customSelected ? (
        <label class="text-field">
          <span>Your B-side</span>
          <input
            value={props.customText}
            onInput={(event) => props.onCustomInput(event.currentTarget.value)}
            maxLength={120}
            autocomplete="off"
            placeholder="For example, play one guitar riff"
            aria-describedby={
              props.error === undefined ? undefined : 'bside-error'
            }
          />
        </label>
      ) : null}
      {props.error === undefined ? null : (
        <p class="field-error" id="bside-error" role="alert">
          {props.error}
        </p>
      )}
      <div class="setup-screen__footer">
        <button
          class="primary-button primary-button--wide primary-button--bside"
          type="button"
          onClick={() => props.onContinue()}
        >
          Keep this beside me
        </button>
      </div>
    </main>
  )
}
