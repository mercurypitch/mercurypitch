// ============================================================
// ChooseCueContextScreen — Names an optional private cue without implying detection.
// ============================================================
import { For, onMount, Show } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import styles from './ChooseCueContextScreen.module.css'

export interface CueContextChoicePresentation {
  readonly id: string
  readonly label: string
}

export type CueContextSelection =
  | { readonly kind: 'suggested'; readonly id: string }
  | { readonly kind: 'custom' }
  | { readonly kind: 'not-sure' }

interface ChooseCueContextScreenProps {
  readonly headerLabel: string
  readonly pullLabel: string
  readonly suggestions: readonly CueContextChoicePresentation[]
  readonly selection?: CueContextSelection
  readonly customText: string
  readonly error?: string
  readonly onSelect: (selection: CueContextSelection) => void
  readonly onCustomInput: (value: string) => void
  readonly onBack: () => void
  readonly onContinue: () => void
}

interface CueContextChoiceProps {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly selected: boolean
  readonly tone?: 'custom' | 'not-sure'
  readonly onSelect: () => void
}

function CueContextChoice(props: CueContextChoiceProps) {
  return (
    <label class={styles.choiceLabel}>
      <input
        class={styles.choiceRadio}
        type="radio"
        name="cue-context-choice"
        value={props.id}
        checked={props.selected}
        onChange={() => props.onSelect()}
      />
      <span class={styles.choiceSurface}>
        <span
          class={styles.choiceDisc}
          classList={{
            [styles.choiceDiscCustom]: props.tone === 'custom',
            [styles.choiceDiscNotSure]: props.tone === 'not-sure',
          }}
          aria-hidden="true"
        />
        <span class={styles.choiceCopy}>
          <strong>{props.label}</strong>
          <Show when={props.description}>
            {(description) => <small>{description()}</small>}
          </Show>
        </span>
        <span class={styles.choiceCheck} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m6 12 4 4 8-9" />
          </svg>
        </span>
      </span>
    </label>
  )
}

export function ChooseCueContextScreen(props: ChooseCueContextScreenProps) {
  let headingElement: HTMLHeadingElement | undefined

  const suggestionSelected = (id: string): boolean => {
    const selection = props.selection
    return selection?.kind === 'suggested' && selection.id === id
  }
  const customSelected = (): boolean => props.selection?.kind === 'custom'
  const notSureSelected = (): boolean => props.selection?.kind === 'not-sure'

  onMount(() => {
    queueMicrotask(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      headingElement?.focus({ preventScroll: true })
    })
  })

  return (
    <main class="setup-screen app-screen">
      <AppHeader label={props.headerLabel} onBack={props.onBack} />
      <section class="setup-screen__intro" aria-labelledby="cue-context-title">
        <p class="step-label">Cue · what brings the Pull into view</p>
        <h1
          ref={(element) => {
            headingElement = element
          }}
          id="cue-context-title"
          tabIndex={-1}
        >
          When does this Pull usually show up?
        </h1>
        <p id="cue-context-description">
          For <strong>{props.pullLabel}</strong>, choose a familiar moment or
          use your own words. This is a private note; Beside Cue will not detect
          it automatically.
        </p>
      </section>

      <fieldset
        class={styles.choiceFieldset}
        aria-describedby="cue-context-description"
      >
        <legend class="visually-hidden">
          When does this Pull usually show up?
        </legend>
        <div class={styles.choiceList}>
          <For each={props.suggestions}>
            {(suggestion) => (
              <CueContextChoice
                id={suggestion.id}
                label={suggestion.label}
                selected={suggestionSelected(suggestion.id)}
                onSelect={() =>
                  props.onSelect({ kind: 'suggested', id: suggestion.id })
                }
              />
            )}
          </For>
          <CueContextChoice
            id="custom"
            label="Write my own"
            description="Name the moment in words that feel natural to you."
            selected={customSelected()}
            tone="custom"
            onSelect={() => props.onSelect({ kind: 'custom' })}
          />
          <CueContextChoice
            id="not-sure"
            label="Not sure yet"
            description="Your plan works without this."
            selected={notSureSelected()}
            tone="not-sure"
            onSelect={() => props.onSelect({ kind: 'not-sure' })}
          />
        </div>
      </fieldset>

      <Show when={customSelected()}>
        <label class="text-field">
          <span>Your cue</span>
          <input
            value={props.customText}
            onInput={(event) => props.onCustomInput(event.currentTarget.value)}
            maxLength={120}
            autocomplete="off"
            placeholder="For example, when I get into bed with my phone"
            aria-label="Your cue"
            aria-describedby={`cue-context-private-note${
              props.error === undefined ? '' : ' cue-context-error'
            }`}
            aria-invalid={props.error !== undefined}
          />
          <small id="cue-context-private-note">
            Stored only on this device.
          </small>
        </label>
      </Show>

      <Show when={props.error}>
        {(error) => (
          <p class="field-error" id="cue-context-error" role="alert">
            {error()}
          </p>
        )}
      </Show>

      <div class="setup-screen__footer">
        <button
          class="primary-button primary-button--wide"
          type="button"
          disabled={props.selection === undefined}
          onClick={() => props.onContinue()}
        >
          Choose Side B
        </button>
      </div>
    </main>
  )
}
