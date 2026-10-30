// ============================================================
// First Light's microphone: which input Merc hears, and the fixes
// ============================================================
//
// Under the waiting screen's stage, two chips. The first names the input Merc
// is hearing and opens every input the browser lists, each with its role
// (the one being heard, the system default, a Bluetooth headset) and a way
// to switch to it. The second, "Mic not behaving?", opens the fixes. Once
// help is due (the beat's nudge, or a screen that already failed), the list
// opens by itself, since the usual answer is a different microphone; with
// only one input listed there is nothing to switch to, and the fixes open
// instead.
//
// The roles come from the Settings mic check's roster (mic-check/
// mic-roster.ts), so both surfaces call the same input by the same name.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, Show, untrack } from 'solid-js'
import { ChevronDown, HelpCircle, Mic } from '@/components/icons'
import { formatWarnings, INPUT_KIND_HINT, INPUT_KIND_LABEL, } from '@/features/mic-check/check-copy'
import { INPUT_KIND_ICON } from '@/features/mic-check/input-kind-icon'
import type { MicRoster } from '@/features/mic-check/mic-roster'
import { listeningInput } from '@/features/mic-check/mic-roster'
import { FIRST_LIGHT_FIX_APPS, FIRST_LIGHT_FIX_LIMIT, FIRST_LIGHT_FIX_MUTED, FIRST_LIGHT_FIX_PICK, FIRST_LIGHT_SILENT_PICK, } from '../copy'
import styles from './FirstLightMic.module.css'

type Panel = 'inputs' | 'fix'

const PANEL_ID: Record<Panel, string> = {
  inputs: 'first-light-mic-inputs',
  fix: 'first-light-mic-fix',
}

export interface FirstLightMicProps {
  roster: MicRoster
  /** What the capture track reports about its format, for its warnings. */
  settings: MediaTrackSettings | null
  /** Open the help without a tap: nothing was heard, or the mic failed. */
  helpDue: boolean
  /** Offer the inputs. Off where the mic never opened, and the list could
   *  only count devices it cannot name. */
  showInputs: boolean
  /** The input being opened right now, or null. */
  switching: string | null
  /** The input picked last that sent no sound at all, or null. */
  silentPick: string | null
  /** The input being listened to carries nothing at all (the beat failed
   *  on it): its row says "No signal", as the beat's eyebrow does, instead
   *  of "Listening", and leaves the why to the beat's own words above. */
  listeningSilent?: boolean
  onPick: (deviceId: string) => void
}

export function FirstLightMic(props: FirstLightMicProps): JSX.Element {
  const [open, setOpen] = createSignal<Panel | null>(null)

  // Nothing to name or switch to until the browser lists an input.
  const listsInputs = (): boolean =>
    props.showInputs && props.roster.inputs.length > 0

  const heardName = (): string => {
    const name = listeningInput(props.roster)?.name ?? ''
    return name === '' ? 'Your microphone' : name
  }

  // Once a tap opens or closes a panel, the panels are the singer's: nothing
  // here opens one again.
  let touched = false

  // Opens when help falls due: the inputs when there is another to switch
  // to, else the fixes. The list can arrive after (a beat that failed before
  // it ever listed the inputs lists them as it fails), and then it moves the
  // fixes it opened by itself over to the inputs.
  createEffect(() => {
    if (!props.helpDue) return
    const choices = props.showInputs && props.roster.inputs.length > 1
    untrack(() => {
      if (touched) return
      const current = open()
      if (current === null || (current === 'fix' && choices)) {
        setOpen(choices ? 'inputs' : 'fix')
      }
    })
  })

  const toggle = (panel: Panel): void => {
    touched = true
    setOpen((current) => (current === panel ? null : panel))
  }

  const chip = (panel: Panel, icon: JSX.Element, label: JSX.Element) => (
    <button
      type="button"
      class={styles.chip}
      aria-expanded={open() === panel}
      aria-controls={PANEL_ID[panel]}
      onClick={() => toggle(panel)}
    >
      <span class={styles.chipIcon} aria-hidden="true">
        {icon}
      </span>
      {label}
      <span class={styles.chevron} aria-hidden="true">
        <ChevronDown />
      </span>
    </button>
  )

  return (
    <div class={styles.mic} data-testid="first-light-mic">
      <div class={styles.chips}>
        <Show when={listsInputs()}>
          {chip(
            'inputs',
            <Mic />,
            <span class={styles.chipName}>
              <span class={styles.srOnly}>Microphone in use: </span>
              {heardName()}
            </span>,
          )}
        </Show>
        {chip('fix', <HelpCircle />, <span>Mic not behaving?</span>)}
      </div>

      <Show when={open() === 'inputs' && listsInputs()}>
        <div id={PANEL_ID.inputs} class={styles.panel}>
          <ul class={styles.inputs}>
            <For each={props.roster.inputs}>
              {(input, index) => {
                // A plain component variable, not <Dynamic>: each row is
                // built anew with the roster, so its kind never changes
                // under it, and Dynamic's first use in the app would grow
                // the Solid chunk every room loads on first paint.
                const KindIcon = INPUT_KIND_ICON[input.kind]
                const kind = INPUT_KIND_LABEL[input.kind]
                const hint =
                  input.isListening || input.isDefault
                    ? INPUT_KIND_HINT[input.kind]
                    : undefined
                return (
                  <li
                    class={styles.input}
                    classList={{ [styles.inputHeard]: input.isListening }}
                  >
                    <span class={styles.inputIcon} aria-hidden="true">
                      <KindIcon />
                    </span>
                    <span class={styles.inputText}>
                      <span class={styles.inputName}>
                        {input.name === ''
                          ? `Microphone ${index() + 1}`
                          : input.name}
                      </span>
                      <span class={styles.badges}>
                        <Show when={input.isListening}>
                          <Show
                            when={props.listeningSilent === true}
                            fallback={
                              <span
                                class={`${styles.badge} ${styles.badgeHeard}`}
                              >
                                Listening
                              </span>
                            }
                          >
                            <span
                              class={`${styles.badge} ${styles.badgeSilent}`}
                            >
                              No signal
                            </span>
                          </Show>
                        </Show>
                        <Show when={input.isDefault}>
                          <span class={styles.badge}>System default</span>
                        </Show>
                        <Show when={kind !== ''}>
                          <span class={styles.badge}>{kind}</span>
                        </Show>
                      </span>
                    </span>
                    <Show when={!input.isListening}>
                      <button
                        type="button"
                        class={styles.use}
                        disabled={props.switching !== null}
                        onClick={() => props.onPick(input.deviceId)}
                      >
                        {props.switching === input.deviceId
                          ? 'Opening…'
                          : 'Use this'}
                      </button>
                    </Show>
                    {/* One cell for every note, so two never share a
                        grid cell on top of each other. */}
                    <span class={styles.inputNotes}>
                      <Show when={props.silentPick === input.deviceId}>
                        <p class={styles.inputNote}>
                          {FIRST_LIGHT_SILENT_PICK}
                        </p>
                      </Show>
                      <Show when={hint}>
                        {(text) => <p class={styles.inputNote}>{text()}</p>}
                      </Show>
                      <Show when={input.isListening}>
                        <For each={formatWarnings(props.settings)}>
                          {(warning) => (
                            <p class={styles.inputNote}>{warning}</p>
                          )}
                        </For>
                      </Show>
                    </span>
                  </li>
                )
              }}
            </For>
          </ul>
          <Show when={props.roster.inputs.length === 1}>
            <p class={styles.panelNote}>
              This is the only microphone your browser can see.
            </p>
          </Show>
        </div>
      </Show>

      <Show when={open() === 'fix'}>
        <div id={PANEL_ID.fix} class={styles.panel}>
          <ol class={styles.fixes}>
            <Show when={listsInputs()}>
              <li>{FIRST_LIGHT_FIX_PICK}</li>
            </Show>
            <li>{FIRST_LIGHT_FIX_MUTED}</li>
            <li>{FIRST_LIGHT_FIX_APPS}</li>
          </ol>
          <p class={styles.panelNote}>{FIRST_LIGHT_FIX_LIMIT}</p>
        </div>
      </Show>
    </div>
  )
}
