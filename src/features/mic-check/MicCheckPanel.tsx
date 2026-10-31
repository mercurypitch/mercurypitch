// ============================================================
// MicCheckPanel — hear yourself, and see who has your microphone
// ============================================================
//
// The Settings mic check. Press Start and say something or sing: the ribbon
// answers your level, a held note throws note glyphs that land on its key,
// and the panel says which input it is hearing. Underneath, the answer to
// the question a level bar cannot: when the microphone goes wrong, what
// took it. Every connected input with its role (the system default, the one
// for calls, the one being heard), the other surfaces in this tab that hold
// the mic, the track's format, and a timeline of every change while the
// check is open.
//
// All the watching lives in useMicCheckController; this file is layout.

import { createEffect, createMemo, For, on, Show } from 'solid-js'
import { Mic, Volume2 } from '@/components/icons'
import { MicLevelMeter } from '@/components/MicLevelMeter'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { noteColor } from '@/lib/note-utils'
import { describeFormat, formatWarnings, holderName, INPUT_KIND_HINT, INPUT_KIND_LABEL, permissionWords, } from './check-copy'
import type { VerdictAction } from './check-verdict'
import { INPUT_KIND_ICON } from './input-kind-icon'
import type { RosterInput } from './mic-roster'
import { listeningInput } from './mic-roster'
import styles from './MicCheckPanel.module.css'
import { MicCheckStage } from './MicCheckStage'
import type { MicCheckEvent } from './useMicCheckController'
import { useMicCheckController } from './useMicCheckController'

/** Within this many cents a held note reads as in tune. */
const IN_TUNE_CENTS = 8

const clockTime = (at: number): string =>
  new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

function centsWords(cents: number): string {
  const rounded = Math.round(cents)
  if (Math.abs(rounded) < IN_TUNE_CENTS) return 'in tune'
  return rounded > 0 ? `${rounded} cents sharp` : `${-rounded} cents flat`
}

export function MicCheckPanel() {
  const check = useMicCheckController()

  const listening = (): boolean => check.phase() === 'listening'
  const heard = createMemo(() => listeningInput(check.roster()))

  // Start and Stop swap places as the check starts and stops. When the one
  // that had focus goes, its counterpart takes the focus, so a keyboard user
  // is not dropped at the top of the page; a check that will not open hands
  // it back to Start.
  let startButton: HTMLButtonElement | undefined
  let stopButton: HTMLButtonElement | undefined
  let focusNext = false
  const handOff = (button: HTMLButtonElement): void => {
    focusNext = document.activeElement === button
  }
  createEffect(
    on(
      check.phase,
      (phase) => {
        if (!focusNext || phase === 'opening') return
        focusNext = false
        queueMicrotask(() => {
          ;(phase === 'listening' ? stopButton : startButton)?.focus()
        })
      },
      { defer: true },
    ),
  )
  const pinnedInput = createMemo(() => {
    const id = check.pinnedDeviceId()
    return id === null
      ? null
      : (check.roster().inputs.find((input) => input.deviceId === id) ?? null)
  })
  const blockingHolders = createMemo(() =>
    check.canSwitch() ? [] : check.otherHolders().map(holderName),
  )

  const actionLabel = (action: VerdictAction): string => {
    switch (action) {
      case 'start':
        return 'Start mic check'
      case 'restart':
        return 'Reopen the microphone'
      case 'take-over':
        return 'Use it here'
      case 'listen-to-default':
        // The verdict's title already names it, and a device's name can be
        // as long as the sentence.
        return 'Listen to the new default'
    }
  }

  const runAction = (action: VerdictAction): void => {
    switch (action) {
      case 'start':
        check.start()
        return
      case 'restart':
        check.restart()
        return
      case 'take-over':
        void check.takeOver()
        return
      case 'listen-to-default':
        // Reopen on the default as it is now, still following it. Picking
        // the device by id would pin it: the panel would then advise making
        // it the default, which it already is, and stop flagging later moves.
        check.restart()
        return
    }
  }

  /** The hint for an input that decides what MercuryPitch hears. */
  const hintFor = (input: RosterInput): string | null =>
    input.isListening || input.isDefault
      ? (INPUT_KIND_HINT[input.kind] ?? null)
      : null

  const warnings = createMemo(() => formatWarnings(check.track()?.settings))

  return (
    <div class={styles.panel} data-testid="mic-check">
      <div
        class={styles.stage}
        classList={{ [styles.stageLive]: listening() }}
        data-tour="settings.mic-check"
      >
        <MicCheckStage live={check.live} listening={listening()} />

        <Show when={check.note()}>
          {(note) => (
            <div class={styles.readout} aria-hidden="true">
              <span
                class={styles.readoutNote}
                style={{ '--note': noteColor(note().midi) }}
              >
                {midiToNoteName(note().midi)}
              </span>
              <span class={styles.readoutDetail}>
                {centsWords(note().cents)}
                <span class={styles.readoutHz}>{note().f0.toFixed(1)} Hz</span>
              </span>
            </div>
          )}
        </Show>

        <Show when={check.phase() !== 'listening'}>
          <div class={styles.stageCover}>
            <button
              ref={startButton}
              type="button"
              class={styles.primary}
              data-testid="mic-check-start"
              disabled={check.phase() === 'opening'}
              onClick={(event) => {
                handOff(event.currentTarget)
                check.start()
              }}
            >
              <Mic />
              {check.phase() === 'opening' ? 'Opening…' : 'Start mic check'}
            </button>
          </div>
        </Show>
      </div>

      <div
        class={styles.verdict}
        data-tone={check.verdict().tone}
        data-testid="mic-check-verdict"
        role="status"
        aria-live="polite"
      >
        <span class={styles.verdictDot} aria-hidden="true" />
        <div class={styles.verdictText}>
          <strong>{check.verdict().title}</strong>
          <span>{check.verdict().detail}</span>
        </div>
        <Show
          when={
            check.verdict().action !== 'start' ? check.verdict().action : null
          }
        >
          {(action) => (
            <button
              type="button"
              class={styles.secondary}
              disabled={check.switching()}
              onClick={() => {
                runAction(action())
              }}
            >
              {actionLabel(action())}
            </button>
          )}
        </Show>
      </div>

      <Show when={listening()}>
        <div class={styles.meterRow}>
          <div class={styles.meter}>
            <MicLevelMeter compact />
          </div>
          <button
            ref={stopButton}
            type="button"
            class={styles.secondary}
            data-testid="mic-check-stop"
            onClick={(event) => {
              handOff(event.currentTarget)
              check.stop()
            }}
          >
            Stop
          </button>
        </div>
      </Show>

      <section class={styles.block} aria-labelledby="mic-check-inputs">
        <h4 id="mic-check-inputs" class={styles.blockTitle}>
          Inputs
        </h4>
        <Show
          when={!check.roster().labelled && check.roster().inputs.length > 0}
        >
          <p class={styles.note}>Names appear once you allow the microphone.</p>
        </Show>
        <Show when={check.roster().inputs.length === 0}>
          <p class={styles.note}>No inputs are connected.</p>
        </Show>
        <Show when={listening() && blockingHolders().length > 0}>
          <p class={styles.note}>
            Switching inputs now would cut off {blockingHolders().join(', ')}.
            Stop it there first.
          </p>
        </Show>
        <ul class={styles.devices}>
          <For each={check.roster().inputs}>
            {(input, index) => {
              // A plain component variable, not <Dynamic>: a row is rebuilt
              // with the roster, so its kind never changes under it, and
              // Dynamic's first use in the app would grow the Solid chunk
              // every room loads on first paint.
              const KindIcon = INPUT_KIND_ICON[input.kind]
              return (
                <li
                  class={styles.device}
                  classList={{ [styles.deviceHeard]: input.isListening }}
                >
                  <span class={styles.deviceIcon} aria-hidden="true">
                    <KindIcon />
                  </span>
                  <span class={styles.deviceName}>
                    {input.name === '' ? `Input ${index() + 1}` : input.name}
                  </span>
                  <span class={styles.badges}>
                    <Show when={input.isListening}>
                      <span class={`${styles.badge} ${styles.badgeHeard}`}>
                        Listening
                      </span>
                    </Show>
                    <Show when={input.isDefault}>
                      <span class={`${styles.badge} ${styles.badgeDefault}`}>
                        System default
                      </span>
                    </Show>
                    <Show when={input.isCommunications && !input.isDefault}>
                      <span class={styles.badge}>Default for calls</span>
                    </Show>
                    <Show when={INPUT_KIND_LABEL[input.kind] !== ''}>
                      <span class={styles.badge}>
                        {INPUT_KIND_LABEL[input.kind]}
                      </span>
                    </Show>
                  </span>
                  <Show
                    when={
                      listening() &&
                      check.roster().labelled &&
                      !input.isListening
                    }
                  >
                    <button
                      type="button"
                      class={styles.deviceAction}
                      disabled={check.switching() || !check.canSwitch()}
                      onClick={() => {
                        void check.listenTo(input.deviceId)
                      }}
                    >
                      Listen
                    </button>
                  </Show>
                  <Show when={hintFor(input)}>
                    {(hint) => <p class={styles.deviceHint}>{hint()}</p>}
                  </Show>
                </li>
              )
            }}
          </For>
        </ul>
        <Show when={listening() && pinnedInput() !== null}>
          <div class={styles.pinned}>
            <p class={styles.note}>
              MercuryPitch is using {pinnedInput()?.name} until you reload. To
              keep it, make it the default input in your system's sound
              settings.
            </p>
            <button
              type="button"
              class={styles.deviceAction}
              disabled={check.switching() || !check.canSwitch()}
              onClick={() => {
                void check.listenTo(null)
              }}
            >
              Use the system default
            </button>
          </div>
        </Show>
      </section>

      <Show when={check.roster().outputs.length > 0}>
        <section class={styles.block} aria-labelledby="mic-check-outputs">
          <h4 id="mic-check-outputs" class={styles.blockTitle}>
            Outputs
          </h4>
          <ul class={styles.devices}>
            <For each={check.roster().outputs}>
              {(output, index) => (
                <li class={styles.device}>
                  <span class={styles.deviceIcon} aria-hidden="true">
                    <Volume2 />
                  </span>
                  <span class={styles.deviceName}>
                    {output.name === '' ? `Output ${index() + 1}` : output.name}
                  </span>
                  <span class={styles.badges}>
                    <Show when={output.isDefault}>
                      <span class={`${styles.badge} ${styles.badgeDefault}`}>
                        System default
                      </span>
                    </Show>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <section class={styles.block} aria-labelledby="mic-check-facts">
        <h4 id="mic-check-facts" class={styles.blockTitle}>
          What we know
        </h4>
        <dl class={styles.facts}>
          <dt>Permission</dt>
          <dd>{permissionWords(check.permission())}</dd>
          <Show when={check.track()}>
            {(track) => (
              <>
                <dt>Hearing</dt>
                <dd>{heard()?.name ?? track().label}</dd>
                <dt>Format</dt>
                <dd>{describeFormat(track().settings)}</dd>
              </>
            )}
          </Show>
          <dt>Also using it here</dt>
          <dd>
            {check.otherHolders().length === 0
              ? 'Nothing else in this tab'
              : check.otherHolders().map(holderName).join(', ')}
          </dd>
        </dl>
        <For each={warnings()}>
          {(warning) => <p class={styles.warning}>{warning}</p>}
        </For>
        <p class={styles.note}>
          A browser cannot see other apps. When one takes the microphone, it
          shows up here as a paused input, pure silence or a device that went
          away.
        </p>
      </section>

      <section class={styles.block} aria-labelledby="mic-check-timeline">
        <h4 id="mic-check-timeline" class={styles.blockTitle}>
          What changed
        </h4>
        <Show
          when={check.events().length > 0}
          fallback={
            <p class={styles.note}>
              Nothing yet. Plug something in, switch your system's input, or
              start a call elsewhere, and it will show up here.
            </p>
          }
        >
          <ol class={styles.timeline}>
            <For each={check.events()}>
              {(event: MicCheckEvent) => (
                <li class={styles.event} data-tone={event.tone}>
                  <time
                    class={styles.eventTime}
                    datetime={new Date(event.at).toISOString()}
                  >
                    {clockTime(event.at)}
                  </time>
                  <span>{event.text}</span>
                </li>
              )}
            </For>
          </ol>
        </Show>
      </section>
    </div>
  )
}
