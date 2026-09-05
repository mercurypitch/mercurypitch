import { For, onMount } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import { useCopy } from '@/i18n/ui-copy'

interface BSideChoicePresentation {
  readonly key: string
  readonly label: string
}

interface ChooseBSideScreenProps {
  headerLabel: string
  pullText: string
  suggestions: readonly BSideChoicePresentation[]
  selectedKey?: string
  customText: string
  customSelected: boolean
  error?: string
  pending: boolean
  onSelect: (choiceKey: string) => void
  onSelectCustom: () => void
  onCustomInput: (value: string) => void
  onBack: () => void
  onContinue: () => void
}

export function ChooseBSideScreen(props: ChooseBSideScreenProps) {
  const copy = useCopy()
  let headingElement: HTMLHeadingElement | undefined

  onMount(() => {
    queueMicrotask(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      headingElement?.focus({ preventScroll: true })
    })
  })

  return (
    <main class="setup-screen app-screen">
      <AppHeader label={props.headerLabel} onBack={props.onBack} />
      <section class="setup-screen__intro" aria-labelledby="bside-title">
        <p class="step-label step-label--bside">
          {copy.t('Side B · your chosen turn')}
        </p>
        <h1
          ref={(element) => {
            headingElement = element
          }}
          id="bside-title"
          tabIndex={-1}
        >
          {copy.t('What small action would you rather begin?')}
        </h1>
        <p data-selection="text" dir="auto">
          {copy.t(
            'When {pull} shows up, choose something concrete enough to begin without planning.',
            { pull: props.pullText },
          )}
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
                  !props.customSelected && props.selectedKey === suggestion.key,
              }}
              role="radio"
              aria-checked={
                !props.customSelected && props.selectedKey === suggestion.key
              }
              onClick={() => props.onSelect(suggestion.key)}
            >
              <span class="choice-row__disc" aria-hidden="true" />
              <span class="choice-row__copy">
                <strong>{suggestion.label}</strong>
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
            <strong>{copy.t('Write my own')}</strong>
            <small>
              {copy.t('Begin with a verb: open, walk, play, fill, call.')}
            </small>
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
          <span>{copy.t('Your Side B')}</span>
          <input
            value={props.customText}
            onInput={(event) => props.onCustomInput(event.currentTarget.value)}
            maxLength={120}
            autocomplete="off"
            placeholder={copy.t('For example, play one guitar riff')}
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
          disabled={props.pending}
          onClick={() => props.onContinue()}
        >
          {props.pending ? copy.t('Saving…') : copy.t('Save my plan')}
        </button>
      </div>
    </main>
  )
}
