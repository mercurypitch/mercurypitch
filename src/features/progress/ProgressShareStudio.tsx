// ============================================================
// Progress Share Studio — review an honest Progress moment, preview the exact
// export canvas, then hand it to the native share/download pipeline.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, For, onCleanup, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Share, X } from '@/components/icons'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './ProgressShareStudio.module.css'
import type { ProgressShareAppearance, ProgressShareExportStatus, ProgressShareFormat, ProgressShareMoment, } from './share-card'
import { DEFAULT_PROGRESS_SHARE_APPEARANCE, exportProgressShareCard, PROGRESS_SHARE_SIZES, renderProgressShareCard, } from './share-card'

interface FormatOption {
  id: ProgressShareFormat
  label: string
  ratio: string
  use: string
}

export const PROGRESS_SHARE_STUDIO_FORMATS: readonly FormatOption[] = [
  { id: 'feed', label: 'Feed', ratio: '4:5', use: 'Recommended' },
  { id: 'story', label: 'Story', ratio: '9:16', use: 'Full screen' },
  { id: 'square', label: 'Square', ratio: '1:1', use: 'Universal' },
]

/**
 * Deliberately code-level, not user-facing controls. Plate exposure and the
 * live-data scrim remain independently tunable after testing on real screens.
 */
export const PROGRESS_SHARE_STUDIO_APPEARANCE: Readonly<ProgressShareAppearance> =
  {
    ...DEFAULT_PROGRESS_SHARE_APPEARANCE,
  }

export interface ProgressShareStudioProps {
  open: boolean
  moment: ProgressShareMoment
  /** Seeds the optional identity field; identity still starts switched off. */
  initialHandle?: string
  /** Overrides the Pressing plate without exposing technical sliders in UI. */
  appearance?: ProgressShareAppearance
  onClose: () => void
  onOutcome?: (status: ProgressShareExportStatus) => void
}

type PreviewStatus = 'loading' | 'ready' | 'failed'

const PREVIEW_FAILURE =
  'The card preview could not be prepared. Your practice data is unchanged.'

const EXPORT_FAILURE: ProgressShareExportStatus = {
  outcome: 'failed',
  delivered: false,
  isError: true,
  role: 'alert',
  live: 'assertive',
  message: 'The progress card could not be exported. Please try again.',
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function cardMoment(
  source: ProgressShareMoment,
  includeIdentity: boolean,
  handle: string,
): ProgressShareMoment {
  return {
    ...source,
    handle: includeIdentity && clean(handle) !== '' ? clean(handle) : null,
  }
}

export function ProgressShareStudio(
  props: ProgressShareStudioProps,
): JSX.Element {
  let dialogRef: HTMLDivElement | undefined
  let previewMountRef: HTMLDivElement | undefined
  let renderGeneration = 0
  let exportGeneration = 0
  let wasOpen = false
  let disposed = false

  onCleanup(() => {
    disposed = true
    renderGeneration += 1
    exportGeneration += 1
    previewMountRef?.replaceChildren()
  })

  const titleId = createUniqueId()
  const descriptionId = createUniqueId()
  const evidenceTitleId = createUniqueId()
  const handleId = createUniqueId()
  const formatName = `progress-share-format-${createUniqueId()}`

  const [format, setFormat] = createSignal<ProgressShareFormat>('feed')
  const [includeIdentity, setIncludeIdentity] = createSignal(false)
  const [handle, setHandle] = createSignal('')
  const [previewStatus, setPreviewStatus] =
    createSignal<PreviewStatus>('loading')
  const [previewCanvas, setPreviewCanvas] = createSignal<HTMLCanvasElement>()
  const [previewRevision, setPreviewRevision] = createSignal(0)
  const [exporting, setExporting] = createSignal(false)
  const [deliveryStatus, setDeliveryStatus] =
    createSignal<ProgressShareExportStatus | null>(null)

  const close = (): void => {
    if (!exporting()) props.onClose()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: close,
    initialFocus: () => dialogRef,
  })

  createEffect(() => {
    const isOpen = props.open
    if (isOpen && !wasOpen) {
      const seededHandle = props.initialHandle ?? props.moment.handle ?? ''
      setFormat('feed')
      setIncludeIdentity(false)
      setHandle(seededHandle)
      setDeliveryStatus(null)
      setPreviewCanvas(undefined)
      setPreviewStatus('loading')
      setExporting(false)
    }
    if (!isOpen) {
      renderGeneration += 1
      exportGeneration += 1
      setExporting(false)
    }
    wasOpen = isOpen
  })

  createEffect(() => {
    if (!props.open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    onCleanup(() => {
      document.body.style.overflow = previousOverflow
    })
  })

  createEffect(() => {
    const isOpen = props.open
    const selectedFormat = format()
    const identityEnabled = includeIdentity()
    const currentHandle = handle()
    const sourceMoment = props.moment
    const appearance: ProgressShareAppearance = {
      ...PROGRESS_SHARE_STUDIO_APPEARANCE,
      ...props.appearance,
    }
    previewRevision()

    if (!isOpen) return

    const momentSnapshot = cardMoment(
      sourceMoment,
      identityEnabled,
      currentHandle,
    )
    const generation = ++renderGeneration
    setPreviewStatus('loading')
    setPreviewCanvas(undefined)
    setDeliveryStatus(null)

    void (async () => {
      try {
        const canvas = await renderProgressShareCard(
          momentSnapshot,
          selectedFormat,
          appearance,
        )
        if (generation !== renderGeneration) return
        previewMountRef?.replaceChildren(canvas)
        setPreviewCanvas(canvas)
        setPreviewStatus('ready')
      } catch {
        if (generation !== renderGeneration) return
        previewMountRef?.replaceChildren()
        setPreviewCanvas(undefined)
        setPreviewStatus('failed')
      }
    })()
  })

  const beginExport = (): void => {
    const canvas = previewCanvas()
    if (canvas === undefined || exporting()) return

    // Solid accessors and props are captured before the asynchronous boundary.
    const claim = clean(props.moment.claim)
    const outcomeHandler = props.onOutcome
    const generation = ++exportGeneration
    setExporting(true)
    setDeliveryStatus(null)

    void (async () => {
      let status: ProgressShareExportStatus
      try {
        status = await exportProgressShareCard(canvas, {
          title: 'My MercuryPitch progress',
          text:
            claim === ''
              ? 'One moment from my practice — mercurypitch.com/progress'
              : `${claim} — mercurypitch.com/progress`,
          shouldDeliver: () => !disposed && generation === exportGeneration,
        })
      } catch {
        status = { ...EXPORT_FAILURE }
      }
      if (generation !== exportGeneration) return
      setExporting(false)
      setDeliveryStatus(status)
      outcomeHandler?.(status)
    })()
  }

  const retryPreview = (): void => {
    setPreviewRevision((value) => value + 1)
  }

  const exportLabel = (): string => {
    if (exporting()) return 'Generating card…'
    const outcome = deliveryStatus()?.outcome
    if (outcome === 'failed' || outcome === 'dismissed') return 'Try again'
    if (outcome === 'shared') return 'Share again'
    if (outcome === 'downloaded') return 'Download again'
    return 'Generate & share'
  }

  const visibleFacts = (): readonly { value: string; label: string }[] =>
    props.moment.facts
      .filter((fact) => clean(fact.value) !== '' && clean(fact.label) !== '')
      .slice(0, 3)

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class={styles.overlay}
          data-testid="progress-share-overlay"
          onClick={close}
        >
          <div
            ref={dialogRef}
            class={styles.dialog}
            data-testid="progress-share-studio"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={exporting() ? true : undefined}
            tabindex="-1"
            onClick={(event) => event.stopPropagation()}
          >
            <div class={styles.header}>
              <div class={styles.titleLockup}>
                <span class={styles.brandMark} aria-hidden="true">
                  MP
                </span>
                <div>
                  <p>Progress share studio</p>
                  <h2 id={titleId}>Give one moment a lasting shape.</h2>
                </div>
              </div>
              <button
                type="button"
                class={styles.close}
                aria-label="Close share studio"
                disabled={exporting()}
                onClick={close}
              >
                <X />
              </button>
            </div>

            <p id={descriptionId} class={styles.description}>
              Your real practice evidence is pressed into a MercuryPitch card.
              Review every included detail before anything leaves this device.
            </p>

            <div class={styles.workspace}>
              <section class={styles.previewSection} aria-label="Card preview">
                <div
                  classList={{
                    [styles.previewFrame]: true,
                    [styles.previewFeed]: format() === 'feed',
                    [styles.previewStory]: format() === 'story',
                    [styles.previewSquare]: format() === 'square',
                  }}
                >
                  <div
                    ref={previewMountRef}
                    class={styles.canvasMount}
                    data-testid="progress-share-preview"
                  />
                  <Show when={previewStatus() !== 'ready'}>
                    <div class={styles.previewState}>
                      <Show
                        when={previewStatus() === 'failed'}
                        fallback={
                          <>
                            <span class={styles.developingLine} />
                            <p role="status" aria-live="polite">
                              Developing your Pressing…
                            </p>
                          </>
                        }
                      >
                        <p role="alert">{PREVIEW_FAILURE}</p>
                        <button type="button" onClick={retryPreview}>
                          Try preview again
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
                <p class={styles.previewCaption}>
                  Exact PNG preview · {PROGRESS_SHARE_SIZES[format()].width} ×{' '}
                  {PROGRESS_SHARE_SIZES[format()].height}
                </p>
              </section>

              <div class={styles.controls}>
                <fieldset class={styles.formatFieldset} disabled={exporting()}>
                  <legend>Choose a frame</legend>
                  <div class={styles.formatOptions}>
                    <For each={PROGRESS_SHARE_STUDIO_FORMATS}>
                      {(option) => (
                        <label
                          classList={{
                            [styles.formatOption]: true,
                            [styles.formatSelected]: format() === option.id,
                          }}
                        >
                          <input
                            type="radio"
                            name={formatName}
                            value={option.id}
                            checked={format() === option.id}
                            onChange={() => setFormat(option.id)}
                          />
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.ratio}</small>
                          </span>
                          <em>{option.use}</em>
                        </label>
                      )}
                    </For>
                  </div>
                </fieldset>

                <section
                  class={styles.evidence}
                  aria-labelledby={evidenceTitleId}
                >
                  <div class={styles.sectionHeading}>
                    <div>
                      <p>Immutable evidence</p>
                      <h3 id={evidenceTitleId}>What the card includes</h3>
                    </div>
                    <span>Review</span>
                  </div>
                  <blockquote>{props.moment.claim}</blockquote>
                  <Show when={clean(props.moment.context) !== ''}>
                    <p class={styles.context}>{props.moment.context}</p>
                  </Show>
                  <dl class={styles.factList}>
                    <For each={visibleFacts()}>
                      {(fact) => (
                        <div>
                          <dt>{fact.label}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      )}
                    </For>
                    <Show when={clean(props.moment.period) !== ''}>
                      <div>
                        <dt>Period</dt>
                        <dd>{props.moment.period}</dd>
                      </div>
                    </Show>
                    <Show when={clean(props.moment.trace?.description) !== ''}>
                      <div class={styles.traceFact}>
                        <dt>Voice trace</dt>
                        <dd>{props.moment.trace?.description}</dd>
                      </div>
                    </Show>
                  </dl>
                </section>

                <section class={styles.identity} aria-labelledby={handleId}>
                  <label class={styles.identityToggle}>
                    <span>
                      <strong id={handleId}>Add my handle</strong>
                      <small>Off by default. Your name stays private.</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={includeIdentity()}
                      disabled={exporting()}
                      onChange={(event) =>
                        setIncludeIdentity(event.currentTarget.checked)
                      }
                    />
                    <i aria-hidden="true" />
                  </label>
                  <Show when={includeIdentity()}>
                    <label class={styles.handleField} for={`${handleId}-input`}>
                      Handle shown on card
                      <input
                        id={`${handleId}-input`}
                        type="text"
                        value={handle()}
                        maxLength={40}
                        autocomplete="off"
                        autocapitalize="none"
                        spellcheck={false}
                        placeholder="@yourhandle"
                        disabled={exporting()}
                        onInput={(event) =>
                          setHandle(event.currentTarget.value)
                        }
                      />
                    </label>
                  </Show>
                </section>
              </div>
            </div>

            <div class={styles.footer}>
              <div class={styles.delivery}>
                <Show
                  when={deliveryStatus()}
                  fallback={
                    <p>
                      Opens your share sheet when available; otherwise saves a
                      PNG.
                    </p>
                  }
                >
                  {(status) => (
                    <p
                      classList={{ [styles.deliveryError]: status().isError }}
                      role={status().role}
                      aria-live={status().live}
                      aria-atomic="true"
                    >
                      {status().message}
                    </p>
                  )}
                </Show>
                <Show when={exporting()}>
                  <p role="status" aria-live="polite" aria-atomic="true">
                    Generating the full-resolution card…
                  </p>
                </Show>
              </div>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={styles.cancel}
                  disabled={exporting()}
                  onClick={close}
                >
                  Not now
                </button>
                <button
                  type="button"
                  class={styles.export}
                  data-testid="progress-share-export"
                  disabled={previewStatus() !== 'ready' || exporting()}
                  onClick={beginExport}
                >
                  <Share />
                  {exportLabel()}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
