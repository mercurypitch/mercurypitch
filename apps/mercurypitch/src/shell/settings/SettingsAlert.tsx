// ============================================================
// SettingsAlert — the question Settings is asking, if any
// ============================================================
//
// The Keep alert's shape (`KeepAlert.tsx`, `.mp-alert` in shell.css): a title,
// one sentence, Cancel on the left and the answer on the right, red when the
// answer loses something. Escape is Cancel, as Back is. Rendered once, inside
// the shell root, over whatever screen asked.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { confirmSettingsAlert, dismissSettingsAlert, settingsAlert, settingsAlertOpen, } from './settings-alert'

export function SettingsAlert(): JSX.Element {
  let alertRef: HTMLDivElement | undefined
  useFocusTrap(() => alertRef, { isOpen: settingsAlertOpen })

  return (
    <Show when={settingsAlert()} keyed>
      {(asked) => (
        <div class="mp-alert-scrim">
          <div
            class="mp-alert"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="settings-alert-title"
            aria-describedby="settings-alert-text"
            ref={alertRef}
            data-testid="settings-alert"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              dismissSettingsAlert()
            }}
          >
            <div class="mp-alert__body">
              <div class="mp-alert__title" id="settings-alert-title">
                {asked.title}
              </div>
              <div class="mp-alert__text" id="settings-alert-text">
                {asked.text}
              </div>
            </div>
            <div class="mp-alert__actions">
              <button
                type="button"
                onClick={dismissSettingsAlert}
                data-testid="settings-alert-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                classList={{ 'mp-alert__danger': asked.destructive === true }}
                onClick={confirmSettingsAlert}
                data-testid="settings-alert-confirm"
              >
                {asked.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  )
}
