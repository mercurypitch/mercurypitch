// ============================================================
// VoiceControlHud — the ambient hands-free control pill
// ============================================================
//
// Bottom-left, sharing the corner with the practice-timer pill: when that
// pill is visible this one raises itself a row so both stay readable.
// Deliberately quiet — an icon button when idle, live text only while the
// listener hears something or a command just landed. Not a live region:
// interim transcripts change many times a second while music plays.

import { createEffect, createSignal, For, Show } from 'solid-js'
import { Mic, Settings, X } from '@/components/icons'
import { practiceTimerVisible } from '@/stores/practice-timer-store'
import type { VoiceControlEngine } from '@/stores/settings-store'
import { setVoiceControlEngine, voiceControlEngine, } from '@/stores/settings-store'
import type { VoiceControlController } from './useVoiceControlController'
import styles from './VoiceControlHud.module.css'

interface VoiceControlHudProps {
  controller: VoiceControlController
  /** Opens the spoken-command list — the same panel "what can I say" opens. */
  onShowCommands?: () => void
  /**
   * Where the pill sits. 'floating' (default) is the fixed bottom-left
   * overlay, which assumes a tab bar beneath it. 'docked' lets a host place
   * the pill in its own chrome — Guitar Night puts it in the header rail,
   * because as a floating overlay it cleared `--tabbar-total` for a tab bar
   * that screen does not have and landed on the primary action button.
   *
   * A variant rather than a bare class: the engine menu opens UPWARD for the
   * floating pill, and from a header it has to open downward. That belongs
   * with the component's own CSS, not with each host's.
   */
  placement?: 'floating' | 'docked'
}

/**
 * Engine names as a person would compare them, not as the code spells
 * them. The latency chip beside the pill is the other half of this: it
 * reports end-of-speech to transcript, which is the number that actually
 * differs between these three.
 */
const ENGINES: Array<{
  id: VoiceControlEngine
  label: string
  hint: string
}> = [
  {
    id: 'webspeech',
    label: 'Browser',
    hint: 'Chrome/Edge/Safari built-in — fast, needs a connection, sends audio to the browser vendor',
  },
  {
    id: 'local',
    label: 'Whisper',
    hint: 'OpenAI whisper-tiny, on this device — private, slower to start',
  },
  {
    id: 'moonshine',
    label: 'Moonshine',
    hint: 'Moonshine tiny, on this device — built for short commands, English only',
  },
]

export function VoiceControlHud(props: VoiceControlHudProps) {
  const [menuOpen, setMenuOpen] = createSignal(false)
  let statusEl: HTMLSpanElement | undefined
  /**
   * Expanded only while there is something to read. Between phrases the pill
   * is a mic and a cog again — on a phone the expanded bar was permanent
   * furniture, and docked in the header it sat over the app's own title for
   * the whole session rather than for the second the words were on screen.
   *
   * The menu pins it open: a picker that closed itself three seconds after
   * you opened it would be unusable.
   */
  const expanded = () =>
    props.controller.enabled() &&
    (menuOpen() || props.controller.hasSomethingToSay())
  const listening = () =>
    props.controller.enabled() &&
    props.controller.listenerState() === 'listening'
  const hasError = () =>
    props.controller.enabled() && props.controller.listenerState() === 'error'

  const statusText = () => {
    if (hasError()) {
      // The mic and the model fail differently; say which one it was.
      return props.controller.errorDetail() === 'local-engine-failed'
        ? 'Voice engine failed'
        : 'Mic unavailable'
    }
    if (props.controller.listenerState() === 'starting') {
      return 'Loading voice engine'
    }
    // Enabled but idle is a listener that STOPPED under us — the mic
    // sentinel killing a dead stream, or a backgrounded tab losing its
    // hold. Saying "Listening" over it would be a lie with no tell.
    if (props.controller.listenerState() === 'idle') {
      // Names the control, not a key. This asked for "V twice" — two presses
      // because the first only turned the already-silent listener off, and a
      // key a phone does not have. `toggle` now restarts from this state, so
      // one tap or one V does it, and the sentence is true on both.
      return 'Voice stopped — tap the mic to restart'
    }
    const fb = props.controller.feedback()
    if (fb !== null && fb.kind === 'matched') return fb.action ?? 'Done'
    if (fb !== null && (fb.kind === 'failed' || fb.kind === 'unavailable')) {
      return fb.message ?? 'Could not do that'
    }
    const interim = props.controller.interim()
    if (interim !== '') return interim
    if (fb !== null) return `"${fb.heard}"?`
    return 'Listening'
  }

  const title = () => {
    if (!props.controller.isSupported) {
      return 'Voice control is not supported in this browser (try Chrome, Edge or Safari)'
    }
    return props.controller.enabled()
      ? 'Turn voice control off (V)'
      : 'Turn voice control on (V)'
  }

  // A long sentence runs off the end of a strip this narrow, so the strip
  // follows it: every new word scrolls the tail into view. The singer is
  // reading what was just heard, not the start of the phrase.
  createEffect(() => {
    const text = statusText()
    // `expanded()` as a dependency, not a guard: the strip is unmounted while
    // collapsed, and the ref is assigned as it mounts — reading it here is
    // what makes the first words of a phrase scroll into view too.
    if (!expanded() || statusEl === undefined || text === '') return
    statusEl.scrollLeft = statusEl.scrollWidth
  })

  return (
    <div
      class={styles.pill}
      classList={{
        [styles.raised]: practiceTimerVisible(),
        [styles.expanded]: expanded(),
        [styles.docked]: props.placement === 'docked',
      }}
      data-testid="voice-control-pill"
      data-placement={props.placement ?? 'floating'}
      data-talking={expanded() ? 'true' : 'false'}
    >
      <button
        type="button"
        class={styles.toggle}
        classList={{
          [styles.listening]: listening(),
          [styles.errorState]: hasError(),
          [styles.unsupported]: !props.controller.isSupported,
        }}
        aria-pressed={props.controller.enabled()}
        aria-label={title()}
        title={title()}
        onClick={() => props.controller.toggle()}
      >
        <Mic />
      </button>
      {/* The engine picker, one hover away rather than three clicks deep
          in Settings. Which model is listening changes the experience more
          than any other setting here, and comparing them means switching
          them often. */}
      <Show when={props.controller.enabled()}>
        <div class={styles.tools}>
          <button
            type="button"
            class={styles.toolButton}
            aria-haspopup="menu"
            aria-expanded={menuOpen()}
            aria-label="Voice engine and commands"
            title="Voice engine and commands"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Settings />
          </button>
          <Show when={menuOpen()}>
            <div
              class={styles.menu}
              role="menu"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <p class={styles.menuHeading}>Engine</p>
              <For each={ENGINES}>
                {(engine) => (
                  <button
                    type="button"
                    class={styles.menuItem}
                    classList={{
                      [styles.menuItemActive]:
                        voiceControlEngine() === engine.id,
                    }}
                    role="menuitemradio"
                    aria-checked={voiceControlEngine() === engine.id}
                    title={engine.hint}
                    onClick={() => setVoiceControlEngine(engine.id)}
                  >
                    <span class={styles.menuDot} aria-hidden="true" />
                    {engine.label}
                  </button>
                )}
              </For>
              <Show when={props.onShowCommands !== undefined}>
                <div class={styles.menuDivider} />
                <button
                  type="button"
                  class={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    props.onShowCommands?.()
                  }}
                >
                  What can I say?
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
      {/* The words, and the controls that only make sense beside them.
          Collapsed, this whole half is gone and the pill is the mic and the
          cog — which is all there is to act on while nothing is being said. */}
      <Show when={expanded()}>
        <span
          ref={statusEl}
          class={styles.status}
          classList={{
            [styles.statusMatched]:
              props.controller.feedback()?.kind === 'matched',
            [styles.statusMiss]:
              props.controller.feedback()?.kind === 'unrecognized',
            [styles.statusWarn]:
              props.controller.feedback()?.kind === 'failed' ||
              props.controller.feedback()?.kind === 'unavailable',
          }}
          title={props.controller.feedback()?.heard ?? ''}
          data-testid="voice-control-status"
        >
          {statusText()}
        </span>
        <Show when={props.controller.lastLatencyMs() !== null}>
          <span
            class={styles.latency}
            title="End-of-speech to text time (on-device engine)"
          >
            {props.controller.lastLatencyMs()} ms
          </span>
        </Show>
        {/* The way out. Expanded, this pill is a wide bar pinned over the
            bottom-left of every screen, and the only control that closed it
            was the mic — which reads as "start/stop listening", not "put
            this away", and which no longer turns it off from a stopped
            listener at all. On a phone that left a status line nobody could
            dismiss sitting on top of the page's own controls. */}
        <button
          type="button"
          class={styles.dismiss}
          aria-label="Turn voice control off"
          title="Turn voice control off"
          onClick={() => props.controller.turnOff()}
        >
          <X />
        </button>
      </Show>
    </div>
  )
}
