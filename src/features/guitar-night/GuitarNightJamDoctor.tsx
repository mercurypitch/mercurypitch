// Guitar Night Jam Doctor presents one completed-take truth without displacing the stage.
// ============================================================
//
// Analysis stays outside this module. The room hands it a factual, already
// resolved view and one recovery action; this component owns only hierarchy,
// focus, dismissal and the Velvet Rehearsal presentation.

import type { Accessor, JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, For, onCleanup, Show, } from 'solid-js'
import { Ear, X } from '@/components/icons'
import styles from './GuitarNightApp.module.css'

export interface GuitarNightDoctorEvidenceRow {
  label: string
  value: string
  detail?: string
}

export interface GuitarNightDoctorView {
  anchorLabel: string
  headline: string
  detail: string
  evidence: readonly GuitarNightDoctorEvidenceRow[]
  unavailableReasons: readonly string[]
  comparison?: string
  recoveryLabel: string
  recoveryDetail?: string
  privacyCopy: string
}

interface GuitarNightJamDoctorProps {
  open: boolean
  view: GuitarNightDoctorView | null
  /** A still-running take is named, never presented as a finished review. */
  recording?: boolean
  liveEventCount?: number
  id?: string
  footer?: JSX.Element
  returnFocus?: Accessor<HTMLElement | null>
  fallbackFocus?: Accessor<HTMLElement | null>
  onClose(): void
  onClear?(): void
  onRecover(): void
}

interface GuitarNightDoctorCueProps {
  view: GuitarNightDoctorView
  expanded: boolean
  controlsId: string
  buttonRef?(element: HTMLButtonElement): void
  onOpen(): void
}

export function GuitarNightDoctorCue(props: GuitarNightDoctorCueProps) {
  return (
    <div class={styles.doctorCue}>
      <button
        ref={(element) => props.buttonRef?.(element)}
        type="button"
        aria-expanded={props.expanded}
        aria-controls={props.controlsId}
        aria-label={`Review ${props.view.anchorLabel}: ${props.view.headline}`}
        onClick={() => props.onOpen()}
      >
        <span class={styles.doctorCueIcon} aria-hidden="true">
          <Ear />
        </span>
        <span class={styles.doctorCueCopy}>
          <small>Take ready</small>
          <strong>{props.view.anchorLabel}</strong>
          <span>{props.view.headline}</span>
        </span>
        <b aria-hidden="true">Review</b>
      </button>
    </div>
  )
}

export function GuitarNightJamDoctor(props: GuitarNightJamDoctorProps) {
  let backdrop: HTMLDivElement | undefined
  let sheet: HTMLElement | undefined
  let closeButton: HTMLButtonElement | undefined
  let recoveryButton: HTMLButtonElement | undefined
  let wasOpen = false
  let announcedView: GuitarNightDoctorView | null = null
  const [announcement, setAnnouncement] = createSignal('')
  const generatedId = createUniqueId()
  const dialogId = () => props.id ?? `guitar-night-doctor-${generatedId}`
  const titleId = () => `${dialogId()}-title`
  const detailId = () => `${dialogId()}-detail`
  const recoveryLabelId = () => `${dialogId()}-recovery-label`
  const recoveryDetailId = () => `${dialogId()}-recovery-detail`

  createEffect(() => {
    const view = props.view
    if (view === null) {
      announcedView = null
      setAnnouncement('')
      return
    }
    if (view === announcedView) return
    announcedView = view
    setAnnouncement(`Take review ready. ${view.anchorLabel}. ${view.headline}`)
  })

  createEffect(() => {
    if (props.open) {
      wasOpen = true
      queueMicrotask(() => {
        ;(recoveryButton ?? closeButton)?.focus({ preventScroll: true })
      })
      return
    }
    if (!wasOpen) return
    wasOpen = false
    const returnFocus = props.returnFocus
    const fallbackFocus = props.fallbackFocus
    queueMicrotask(() => {
      // The stage cue is conditionally mounted. Resolve it only after Solid has
      // restored that branch, otherwise this captures the detached old button.
      const returnTarget = returnFocus?.() ?? null
      const fallbackTarget = fallbackFocus?.() ?? null
      const target =
        returnTarget !== null && returnTarget.isConnected
          ? returnTarget
          : fallbackTarget !== null && fallbackTarget.isConnected
            ? fallbackTarget
            : null
      target?.focus({ preventScroll: true })
    })
  })

  createEffect(() => {
    if (!props.open) return
    const handleDialogKeys = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
        return
      }
      if (event.key !== 'Tab' || sheet === undefined) return
      const focusable = [
        ...sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) {
        event.preventDefault()
        return
      }
      const active = document.activeElement
      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (
        !event.shiftKey &&
        (active === last || !sheet.contains(active))
      ) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    const blockBackgroundPointer = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Node) || sheet?.contains(target) === true) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.type === 'click' && target === backdrop) props.onClose()
    }
    document.addEventListener('keydown', handleDialogKeys, true)
    document.addEventListener('pointerdown', blockBackgroundPointer, true)
    document.addEventListener('pointerup', blockBackgroundPointer, true)
    document.addEventListener('click', blockBackgroundPointer, true)
    onCleanup(() => {
      document.removeEventListener('keydown', handleDialogKeys, true)
      document.removeEventListener('pointerdown', blockBackgroundPointer, true)
      document.removeEventListener('pointerup', blockBackgroundPointer, true)
      document.removeEventListener('click', blockBackgroundPointer, true)
    })
  })

  return (
    <>
      <span
        class={styles.visuallyHidden}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement()}
      </span>
      <Show when={props.open}>
        <div
          ref={backdrop}
          class={styles.doctorBackdrop}
          data-testid="guitar-night-doctor-backdrop"
        >
          <aside
            ref={sheet}
            class={styles.doctorSheet}
            id={dialogId()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId()}
            aria-describedby={detailId()}
            data-recording={props.recording === true ? 'true' : 'false'}
          >
            <div class={styles.doctorSheetHeader}>
              <div>
                <span>Jam Doctor</span>
                <strong>{props.view?.anchorLabel ?? 'Listening'}</strong>
              </div>
              <button
                ref={closeButton}
                class={styles.doctorClose}
                type="button"
                aria-label="Close Jam Doctor"
                onClick={() => props.onClose()}
              >
                <X />
              </button>
            </div>

            <div class={styles.doctorBody}>
              <Show
                when={props.view}
                fallback={
                  <div class={styles.doctorEmpty}>
                    <span>
                      {props.recording === true
                        ? 'Listening live'
                        : 'No take yet'}
                    </span>
                    <h2 id={titleId()}>
                      {props.recording === true
                        ? 'Finish the phrase when you are ready.'
                        : 'Play something worth returning to.'}
                    </h2>
                    <p id={detailId()}>
                      {props.recording === true
                        ? `${props.liveEventCount ?? 0} input ${props.liveEventCount === 1 ? 'event is' : 'events are'} held locally so far. The review appears after Listening stops.`
                        : 'Turn on Listening, play a short phrase, then stop to review what this device could measure.'}
                    </p>
                  </div>
                }
              >
                {(view) => (
                  <>
                    <div class={styles.doctorInsight}>
                      <span>{view().anchorLabel}</span>
                      <h2 id={titleId()}>{view().headline}</h2>
                      <p id={detailId()}>{view().detail}</p>
                    </div>

                    <Show when={view().comparison}>
                      {(comparison) => (
                        <p class={styles.doctorComparison}>
                          <span aria-hidden="true" />
                          <strong>Compared with the previous take</strong>
                          {comparison()}
                        </p>
                      )}
                    </Show>

                    <Show when={view().evidence.length > 0}>
                      <dl class={styles.doctorEvidence}>
                        <For each={view().evidence}>
                          {(row) => (
                            <div>
                              <dt>{row.label}</dt>
                              <dd>{row.value}</dd>
                              <Show when={row.detail}>
                                {(detail) => <small>{detail()}</small>}
                              </Show>
                            </div>
                          )}
                        </For>
                      </dl>
                    </Show>

                    <Show when={view().unavailableReasons.length > 0}>
                      <div class={styles.doctorUnavailable}>
                        <strong>Not measured this time</strong>
                        <ul>
                          <For each={view().unavailableReasons}>
                            {(reason) => <li>{reason}</li>}
                          </For>
                        </ul>
                      </div>
                    </Show>

                    <p class={styles.doctorPrivacy}>{view().privacyCopy}</p>
                  </>
                )}
              </Show>

              <Show when={props.footer}>
                <div class={styles.doctorFooter}>{props.footer}</div>
              </Show>
            </div>

            <Show when={props.view}>
              {(view) => (
                <div class={styles.doctorActions}>
                  <button
                    ref={recoveryButton}
                    class={styles.doctorRecovery}
                    type="button"
                    aria-labelledby={recoveryLabelId()}
                    aria-describedby={
                      view().recoveryDetail === undefined
                        ? undefined
                        : recoveryDetailId()
                    }
                    onClick={() => props.onRecover()}
                  >
                    <span>
                      <strong id={recoveryLabelId()}>
                        {view().recoveryLabel}
                      </strong>
                      <Show when={view().recoveryDetail}>
                        {(detail) => (
                          <small id={recoveryDetailId()}>{detail()}</small>
                        )}
                      </Show>
                    </span>
                  </button>
                  <Show when={props.onClear}>
                    <button
                      class={styles.doctorClear}
                      type="button"
                      onClick={() => props.onClear?.()}
                    >
                      Discard review
                    </button>
                  </Show>
                </div>
              )}
            </Show>
          </aside>
        </div>
      </Show>
    </>
  )
}
