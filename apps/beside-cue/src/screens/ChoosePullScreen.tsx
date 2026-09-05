// Image-first Pull selection keeps choice, preview and confirmation separate.
import { createEffect, For, onMount, Show } from 'solid-js'
import { AppHeader } from '@/components/AppHeader'
import { AssetStage } from '@/components/AssetStage'
import { PremiumPullChoices } from '@/components/PremiumPullChoices'
import type { AssetSlot, PullOption } from '@/content'
import { getLocalizedGenericPullCharacter } from '@/content/localized-pack'
import { canSelectPull, isPremiumPull } from '@/content/pulls'
import { useCopy } from '@/i18n/ui-copy'
import styles from './ChoosePullScreen.module.css'

export interface PullChoicePresentation {
  readonly pullId: string
  readonly art: AssetSlot
  /** Always visible when this Pull is selected, whether or not audio exists. */
  readonly previewCaption: string
  /** True only when the active manifest has a validated packaged recording. */
  readonly recordingAvailable: boolean
}

export type PullPreviewVoiceState =
  | 'unavailable'
  | 'muted'
  | 'idle'
  | 'starting'
  | 'playing'
  | 'played'
  | 'failed'

interface ChoosePullScreenProps {
  headerLabel: string
  options: readonly PullOption[]
  isPro?: boolean
  presentations: readonly PullChoicePresentation[]
  selectedId?: string
  customText: string
  error?: string
  previewVoiceState: PullPreviewVoiceState
  onSelect: (id: string) => void
  onCustomInput: (value: string) => void
  onHearPreview?: (pullId: string) => void
  onBack: () => void
  onContinue: () => void
}

interface PullCardProps {
  id: string
  label: string
  description: string
  selected: boolean
  presentation?: PullChoicePresentation
  onSelect: (id: string) => void
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function PullCard(props: PullCardProps) {
  return (
    <label
      class={styles.pullCard}
      classList={{ [styles.pullCardSelected]: props.selected }}
    >
      <input
        class={styles.pullRadio}
        type="radio"
        name="pull-choice"
        value={props.id}
        checked={props.selected}
        aria-label={props.label}
        aria-describedby={`pull-choice-${props.id}-description`}
        onChange={() => props.onSelect(props.id)}
      />
      <span class={styles.pullCardSurface}>
        <span class={styles.pullArtwork}>
          <Show
            when={props.presentation}
            fallback={<span class={styles.artFallback} aria-hidden="true" />}
          >
            {(presentation) => (
              <AssetStage
                slot={presentation().art}
                ceiling="still"
                class={styles.pullAsset}
                size={256}
              />
            )}
          </Show>
        </span>
        <span class={styles.pullCopy}>
          <strong>{props.label}</strong>
          <small id={`pull-choice-${props.id}-description`}>
            {props.description}
          </small>
        </span>
        <span class={styles.selectionMark} aria-hidden="true" />
      </span>
    </label>
  )
}

export function ChoosePullScreen(props: ChoosePullScreenProps) {
  const copy = useCopy()
  let headingElement: HTMLHeadingElement | undefined
  let previewElement: HTMLElement | undefined
  let observedInitialSelection = false
  let previousSelectedId: string | undefined
  let selectionScrollRequest = 0

  const customSelected = () => props.selectedId === 'custom'
  const presentationFor = (
    pullId: string,
  ): PullChoicePresentation | undefined =>
    props.presentations.find((presentation) => presentation.pullId === pullId)
  const selectedOption = (): PullOption | undefined =>
    props.options.find((option) => option.id === props.selectedId)
  const selectedPresentation = (): PullChoicePresentation | undefined => {
    const selectedId = props.selectedId
    return selectedId === undefined ? undefined : presentationFor(selectedId)
  }
  const selectedLabel = (): string =>
    customSelected()
      ? copy.t('Something else')
      : (selectedOption()?.label ?? copy.t('Your Pull'))
  const selectedCaption = (): string =>
    selectedPresentation()?.previewCaption ??
    selectedOption()?.moment ??
    copy.t('Use your own words for the moment you want to notice sooner.')
  const canHearSelected = (): boolean =>
    selectedPresentation()?.recordingAvailable === true &&
    props.previewVoiceState !== 'unavailable' &&
    props.previewVoiceState !== 'muted' &&
    props.onHearPreview !== undefined
  const voiceBusy = (): boolean =>
    props.previewVoiceState === 'starting' ||
    props.previewVoiceState === 'playing'
  const voiceButtonLabel = (): string => {
    if (props.previewVoiceState === 'starting') return copy.t('Starting voice…')
    if (props.previewVoiceState === 'playing') return copy.t('Voice playing')
    if (props.previewVoiceState === 'played') return copy.t('Replay voice')
    return copy.t('Hear voice')
  }
  const voiceStatus = (): string | undefined => {
    if (props.previewVoiceState === 'muted') {
      return copy.t('Voice is muted in Settings. The full caption is shown.')
    }
    if (props.previewVoiceState === 'starting') return copy.t('Voice loading.')
    if (props.previewVoiceState === 'playing') return copy.t('Voice playing.')
    if (props.previewVoiceState === 'played') return copy.t('Voice stopped.')
    if (props.previewVoiceState === 'failed') {
      return copy.t('Voice could not play. The full caption is shown.')
    }
    return undefined
  }

  const hearSelected = (): void => {
    const selectedId = props.selectedId
    if (selectedId !== undefined) {
      props.onHearPreview?.(selectedId)
    }
  }

  onMount(() => {
    queueMicrotask(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      headingElement?.focus({ preventScroll: true })
    })
  })

  createEffect(() => {
    const selectedId = props.selectedId
    const request = ++selectionScrollRequest
    if (!observedInitialSelection) {
      observedInitialSelection = true
      previousSelectedId = selectedId
      return
    }

    const selectionChanged = selectedId !== previousSelectedId
    previousSelectedId = selectedId
    if (!selectionChanged || selectedId === undefined) return

    // Show mounts reactively from the same selection. Waiting one microtask
    // makes sure its element exists without delaying the reveal to a new frame.
    queueMicrotask(() => {
      if (request !== selectionScrollRequest) return
      previewElement?.scrollIntoView?.({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    })
  })

  return (
    <main class="setup-screen app-screen">
      <AppHeader label={props.headerLabel} onBack={props.onBack} />
      <section class="setup-screen__intro" aria-labelledby="pull-title">
        <p class="step-label">{copy.t('Your Pull · the familiar pattern')}</p>
        <h1
          ref={(element) => {
            headingElement = element
          }}
          id="pull-title"
          tabIndex={-1}
        >
          {copy.t('Choose your Pull')}
        </h1>
        <p>
          {copy.t(
            'Choose a starting point. You can use your own words, and they stay on this device.',
          )}
        </p>
      </section>

      <div
        class={styles.pullGrid}
        role="radiogroup"
        aria-labelledby="pull-title"
      >
        <For each={props.options.filter((option) => !isPremiumPull(option))}>
          {(option) => (
            <PullCard
              id={option.id}
              label={option.label}
              description={option.moment}
              selected={props.selectedId === option.id}
              presentation={presentationFor(option.id)}
              onSelect={props.onSelect}
            />
          )}
        </For>
        <PullCard
          id="custom"
          label={copy.t('Something else')}
          description={copy.t(
            'Name the moment in language that feels natural to you.',
          )}
          selected={customSelected()}
          presentation={presentationFor('custom')}
          onSelect={props.onSelect}
        />
      </div>

      <PremiumPullChoices
        options={props.options.filter(isPremiumPull)}
        selectedId={props.selectedId}
        isPro={props.isPro}
        radioName="pull-choice"
        artFor={(id) =>
          presentationFor(id)?.art ??
          getLocalizedGenericPullCharacter(copy.locale()).token
        }
        onSelect={props.onSelect}
      />

      <Show when={props.selectedId !== undefined}>
        <section
          ref={(element) => {
            previewElement = element
          }}
          class={styles.selectionPreview}
          aria-label={copy.t('Selected Pull preview')}
          tabIndex={-1}
        >
          <div class={styles.previewCopy} aria-live="polite" aria-atomic="true">
            <p>{copy.t('Selected Pull')}</p>
            <h2>{selectedLabel()}</h2>
            <p>{selectedCaption()}</p>
          </div>
          <Show
            when={
              selectedPresentation()?.recordingAvailable === true &&
              (canHearSelected() || voiceStatus() !== undefined)
            }
          >
            <div class={styles.voiceControls}>
              <Show when={voiceStatus()}>
                {(status) => (
                  <p class={styles.voiceStatus} role="status">
                    {status()}
                  </p>
                )}
              </Show>
              <Show when={canHearSelected()}>
                <button
                  class={styles.hearButton}
                  type="button"
                  disabled={voiceBusy()}
                  onClick={hearSelected}
                >
                  {voiceButtonLabel()}
                </button>
              </Show>
            </div>
          </Show>
        </section>
      </Show>

      <Show when={customSelected()}>
        <label class="text-field">
          <span>{copy.t('Your words')}</span>
          <input
            value={props.customText}
            onInput={(event) => props.onCustomInput(event.currentTarget.value)}
            maxLength={120}
            autocomplete="off"
            placeholder={copy.t('For example, opening the feed again')}
            aria-label={copy.t('Your words')}
            aria-describedby={
              props.error === undefined ? 'pull-private-note' : 'pull-error'
            }
          />
          <small id="pull-private-note">
            {copy.t('Stored only on this device.')}
          </small>
        </label>
      </Show>

      <Show when={props.error}>
        {(error) => (
          <p class="field-error" id="pull-error" role="alert">
            {error()}
          </p>
        )}
      </Show>

      <div class="setup-screen__footer">
        <button
          class="primary-button primary-button--wide"
          type="button"
          disabled={
            !canSelectPull(
              props.selectedId,
              props.isPro === true,
              props.options,
            )
          }
          onClick={() => {
            if (
              canSelectPull(
                props.selectedId,
                props.isPro === true,
                props.options,
              )
            )
              props.onContinue()
          }}
        >
          {copy.t('Confirm {pull}', { pull: selectedLabel() })}
        </button>
      </div>
    </main>
  )
}
