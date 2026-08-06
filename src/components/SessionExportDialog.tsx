// ============================================================
// Session Export Dialog — selects restorable audio stems for a UVR archive.
// ============================================================

import type { Component } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { SessionExportStemType } from '@/db/services/session-export-service'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { Download, X } from './icons'
import styles from './SessionExportDialog.module.css'

export type SessionExportPreset = 'core' | 'all' | 'custom'

interface SessionExportDialogProps {
  open: boolean
  available: readonly SessionExportStemType[]
  selected: readonly SessionExportStemType[]
  preset: SessionExportPreset
  progress: number
  busy: boolean
  error: string
  onPresetChange: (preset: SessionExportPreset) => void
  onStemToggle: (stem: SessionExportStemType) => void
  onSubmit: () => void
  onClose: () => void
}

const CORE_STEMS: readonly SessionExportStemType[] = ['vocal', 'instrumental']

const STEM_LABELS: Record<SessionExportStemType, string> = {
  vocal: 'Vocal',
  instrumental: 'Instrumental',
  drums: 'Drums',
  bass: 'Bass',
  guitar: 'Guitar',
  piano: 'Piano',
  other: 'Other',
}

export const SessionExportDialog: Component<SessionExportDialogProps> = (
  props,
) => {
  let dialogRef: HTMLDivElement | undefined
  const radioName = `uvr-export-preset-${createUniqueId()}`
  const titleId = `uvr-export-title-${createUniqueId()}`
  const descriptionId = `uvr-export-description-${createUniqueId()}`

  const hasCoreStem = (): boolean =>
    props.selected.some((stem) => CORE_STEMS.includes(stem))

  const close = (): void => {
    if (!props.busy) props.onClose()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: close,
    initialFocus: () => dialogRef,
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class={styles.overlay}
          data-testid="session-export-overlay"
          onClick={close}
        >
          <div
            ref={dialogRef}
            class={styles.dialog}
            data-testid="session-export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={props.busy ? true : undefined}
            tabindex="-1"
            onClick={(event) => event.stopPropagation()}
          >
            <div class={styles.header}>
              <div>
                <p>Session archive</p>
                <h4 id={titleId}>Choose stems to include</h4>
              </div>
              <button
                type="button"
                class={styles.close}
                aria-label="Close export options"
                disabled={props.busy}
                onClick={close}
              >
                <X />
              </button>
            </div>

            <p id={descriptionId} class={styles.description}>
              The archive keeps the original upload when stored, plus lyrics,
              timing, pitch analysis and session details. Account credentials
              and temporary server handles are never included.
            </p>

            <div
              class={styles.presets}
              role="radiogroup"
              aria-label="Stem selection preset"
            >
              <label
                classList={{ [styles.presetActive]: props.preset === 'core' }}
              >
                <input
                  type="radio"
                  name={radioName}
                  value="core"
                  checked={props.preset === 'core'}
                  disabled={props.busy}
                  onChange={() => props.onPresetChange('core')}
                />
                <span>
                  <strong>Vocal + instrumental</strong>
                  <small>The classic two-stem session</small>
                </span>
              </label>
              <label
                classList={{ [styles.presetActive]: props.preset === 'all' }}
              >
                <input
                  type="radio"
                  name={radioName}
                  value="all"
                  checked={props.preset === 'all'}
                  disabled={props.busy}
                  onChange={() => props.onPresetChange('all')}
                />
                <span>
                  <strong>All available stems</strong>
                  <small>{props.available.length} audio stems</small>
                </span>
              </label>
              <label
                classList={{ [styles.presetActive]: props.preset === 'custom' }}
              >
                <input
                  type="radio"
                  name={radioName}
                  value="custom"
                  checked={props.preset === 'custom'}
                  disabled={props.busy}
                  onChange={() => props.onPresetChange('custom')}
                />
                <span>
                  <strong>Custom</strong>
                  <small>Choose individual stems</small>
                </span>
              </label>
            </div>

            <Show when={props.preset === 'custom'}>
              <fieldset class={styles.custom}>
                <legend>Audio stems</legend>
                <For each={props.available}>
                  {(stem) => (
                    <label>
                      <input
                        type="checkbox"
                        checked={props.selected.includes(stem)}
                        disabled={props.busy}
                        onChange={() => props.onStemToggle(stem)}
                      />
                      <span>{STEM_LABELS[stem]}</span>
                    </label>
                  )}
                </For>
              </fieldset>
              <Show when={!hasCoreStem()}>
                <p class={styles.selectionHint} role="alert">
                  Keep Vocal or Instrumental so MercuryPitch can reopen this
                  session.
                </p>
              </Show>
            </Show>

            <Show when={props.error !== ''}>
              <p class={styles.error} role="alert">
                {props.error}
              </p>
            </Show>

            <Show when={props.busy}>
              <div
                class={styles.progress}
                role="progressbar"
                aria-label="Packing session archive"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={props.progress}
              >
                <span style={{ width: `${props.progress}%` }} />
              </div>
            </Show>

            <div class={styles.actions}>
              <span aria-live="polite">
                {props.selected.length}{' '}
                {props.selected.length === 1 ? 'stem' : 'stems'} selected
              </span>
              <button
                type="button"
                class={styles.cancel}
                disabled={props.busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="button"
                class={styles.submit}
                data-testid="session-export-submit"
                disabled={
                  props.busy || props.selected.length === 0 || !hasCoreStem()
                }
                onClick={() => props.onSubmit()}
              >
                <Download />
                {props.busy ? `Packing ${props.progress}%` : 'Export session'}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
