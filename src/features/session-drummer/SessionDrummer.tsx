// Walnut Studio puts a tactile four-wheel groove picker behind one quiet room utility.
// THESIS: the player's own rehearsal companion, not another mixing dashboard.
// OWN-WORLD: approved walnut cheeks, brass rim, charcoal cloth and warm labels.
// STORY: choose a pocket, hear the phrase, and keep the guitar stage in view.
// FIRST VIEWPORT: only a Drummer chip; the recorder and Listening keep their places.
// FORM: a compact faceplate, four real listbox wheels, phrase markers and one Start action.
import { createMemo, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Drum, Play, Square } from '@/components/icons'
import { DRUM_PATTERN_STYLE_LABELS, DRUM_PATTERN_STYLE_ORDER, DRUM_PATTERNS, } from '@/features/drum-night/patterns/drum-pattern-library'
import type { GuitarNightDrumKitId } from '@/features/guitar-night/guitar-night-drum-sound'
import { GUITAR_NIGHT_DRUM_KIT_OPTIONS } from '@/features/guitar-night/guitar-night-drum-sound'
import { GuitarNightMixerDialog } from '@/features/guitar-night/GuitarNightMixControls'
import { DrummerWheel } from './DrummerWheel'
import { DRUMMER_BARS, drummerPattern, isDrummerFillBar, } from './session-drummer-pattern'
import styles from './SessionDrummer.module.css'
import type { SessionDrummerController } from './useSessionDrummer'

export function SessionDrummer(props: {
  controller: SessionDrummerController
  disabled?: boolean
}) {
  const drummer = () => props.controller
  const pattern = createMemo(() =>
    drummerPattern(drummer().settings().patternId),
  )
  const beats = createMemo(() =>
    DRUM_PATTERNS.filter((beat) => beat.style === pattern().style).map(
      (beat) => ({ value: beat.id, label: beat.name }),
    ),
  )
  const fillOptions = createMemo(() => [
    { value: '0', label: 'No fills' },
    ...[2, 4, 8, 16]
      .filter((bars) => bars <= drummer().settings().bars)
      .map((bars) => ({
        value: String(bars),
        label:
          bars === drummer().settings().bars
            ? 'Phrase end'
            : `Every ${bars} bars`,
      })),
  ])
  const kitStatus = () => {
    drummer().bar()
    const snapshot = drummer().snapshot()
    if (
      !snapshot ||
      snapshot.selectedKitId === 'mercury-synth' ||
      snapshot.selectedKitId === 'circuit'
    )
      return null
    return snapshot.sampledReady
      ? null
      : snapshot.status === 'error'
        ? 'Samples unavailable — synth fallback is playing.'
        : 'Loading kit samples; synth fills any gaps.'
  }
  return (
    <>
      <div class={styles.chip}>
        <button
          type="button"
          class={styles.trigger}
          aria-label={`Session drummer${drummer().armed() ? (drummer().waiting() ? ' · ready' : ' · playing') : ''}`}
          aria-haspopup="dialog"
          aria-expanded={drummer().open()}
          data-armed={drummer().armed()}
          title="Session drummer"
          disabled={props.disabled}
          onClick={() => drummer().setOpen(true)}
          data-tour="session-drummer"
        >
          <Drum />
          <strong>Drummer</strong>
          <Show when={drummer().armed()}>
            <span
              class={styles.lamp}
              data-playing={drummer().bar() >= 0}
              aria-hidden="true"
            />
          </Show>
        </button>
        <Show when={drummer().armed() || drummer().busy()}>
          <button
            type="button"
            class={styles.quickStop}
            aria-label="Stop session drummer"
            title="Stop drummer"
            onClick={() => drummer().stop()}
          >
            <Square />
          </button>
        </Show>
      </div>
      <Show when={drummer().open()}>
        <Portal>
          <div class={styles.skin}>
            <GuitarNightMixerDialog
              isOpen
              label="Session drummer"
              kicker="Walnut Studio"
              title="Your session drummer"
              closeLabel="Close drummer"
              onClose={() => drummer().setOpen(false)}
              panelClass={styles.panel}
              scrimClass={styles.scrim}
            >
              <div class={styles.wheels}>
                <DrummerWheel
                  label="Genre"
                  options={DRUM_PATTERN_STYLE_ORDER.map((style) => ({
                    value: style,
                    label: DRUM_PATTERN_STYLE_LABELS[style],
                  }))}
                  value={pattern().style}
                  onChange={(value) => {
                    const beat = DRUM_PATTERNS.find(
                      (item) => item.style === value,
                    )!
                    drummer().change({
                      patternId: beat.id,
                      tempoBpm: beat.tempoBpm,
                    })
                  }}
                />
                <DrummerWheel
                  label="Beat"
                  options={beats()}
                  value={pattern().id}
                  onChange={(patternId) =>
                    drummer().change({
                      patternId,
                      tempoBpm: drummerPattern(patternId).tempoBpm,
                    })
                  }
                />
                <DrummerWheel
                  label="Bars"
                  options={DRUMMER_BARS.map((bars) => ({
                    value: String(bars),
                    label: `${bars} bars`,
                  }))}
                  value={String(drummer().settings().bars)}
                  onChange={(value) =>
                    drummer().change({ bars: Number(value) })
                  }
                />
                <DrummerWheel
                  label="Fills"
                  options={fillOptions()}
                  value={String(drummer().settings().fillEvery)}
                  onChange={(value) =>
                    drummer().change({ fillEvery: Number(value) })
                  }
                />
              </div>
              <p class={styles.description}>{pattern().description}</p>
              <div
                class={styles.phrase}
                aria-label={`${drummer().settings().bars}-bar phrase; highlighted bars contain fills`}
              >
                <For
                  each={Array.from(
                    { length: drummer().settings().bars },
                    (_, i) => i,
                  )}
                >
                  {(bar) => (
                    <span
                      data-fill={isDrummerFillBar(bar, drummer().settings())}
                      data-current={drummer().bar() === bar}
                      title={`Bar ${bar + 1}${isDrummerFillBar(bar, drummer().settings()) ? ' · fill' : ''}`}
                    >
                      {bar + 1}
                    </span>
                  )}
                </For>
              </div>
              <div class={styles.soundRow}>
                <label>
                  Tempo{' '}
                  <span class={styles.tempo}>
                    <input
                      aria-label="Drummer tempo"
                      type="number"
                      min="40"
                      max="300"
                      step="1"
                      value={Math.round(drummer().tempo() ?? 104)}
                      disabled={drummer().followsScore()}
                      onChange={(event) =>
                        drummer().change({
                          tempoBpm: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>BPM</small>
                  </span>
                </label>
                <label>
                  Kit{' '}
                  <select
                    value={drummer().settings().kitId}
                    onChange={(event) =>
                      drummer().change({
                        kitId: event.currentTarget
                          .value as GuitarNightDrumKitId,
                      })
                    }
                  >
                    <For each={GUITAR_NIGHT_DRUM_KIT_OPTIONS}>
                      {(kit) => <option value={kit.id}>{kit.label}</option>}
                    </For>
                  </select>
                </label>
                <label>
                  Fill{' '}
                  <select
                    disabled={drummer().settings().fillEvery === 0}
                    value={drummer().settings().fillStyle}
                    onChange={(event) =>
                      drummer().change({
                        fillStyle: event.currentTarget.value as
                          | 'snare'
                          | 'toms',
                      })
                    }
                  >
                    <option value="snare">Snare</option>
                    <option value="toms">Around the toms</option>
                  </select>
                </label>
              </div>
              <label class={styles.level}>
                Drummer level{' '}
                <input
                  aria-label="Drummer level"
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={drummer().settings().level}
                  onInput={(event) =>
                    drummer().setLevel(Number(event.currentTarget.value))
                  }
                />
                <output>{Math.round(drummer().settings().level * 100)}%</output>
              </label>
              <p class={styles.clockNote}>
                {drummer().followsScore()
                  ? '4/4 groove · follows score tempo, pause and A/B loop.'
                  : '4/4 groove · your tempo, independent of song or recording.'}
              </p>
              <Show when={drummer().error()}>
                <p class={styles.error} role="alert">
                  {drummer().error()}
                </p>
              </Show>
              <Show when={drummer().unavailableReason()}>
                <p class={styles.error} role="status">
                  {drummer().unavailableReason()}
                </p>
              </Show>
              <Show when={kitStatus()}>
                <p class={styles.clockNote} role="status">
                  {kitStatus()}
                </p>
              </Show>
              <Show
                when={
                  drummer().settings().kitId === 'muldjord' ||
                  drummer().settings().kitId === 'crocell'
                }
              >
                <a
                  class={styles.clockNote}
                  href={`/drum-night/kits/${drummer().settings().kitId}/LICENSE.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Kit credits · CC BY 4.0
                </a>
              </Show>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={styles.surprise}
                  disabled={
                    drummer().busy() ||
                    props.disabled === true ||
                    drummer().unavailableReason() !== null
                  }
                  onClick={() => drummer().surprise()}
                >
                  Surprise me
                </button>
                <button
                  type="button"
                  class={styles.primary}
                  disabled={
                    (props.disabled === true ||
                      drummer().unavailableReason() !== null) &&
                    !drummer().armed()
                  }
                  onClick={() =>
                    drummer().armed() || drummer().busy()
                      ? drummer().stop()
                      : void drummer().start()
                  }
                >
                  {drummer().armed() || drummer().busy() ? (
                    <Square />
                  ) : (
                    <Play />
                  )}
                  {drummer().busy()
                    ? 'Cancel start'
                    : drummer().armed()
                      ? 'Stop drummer'
                      : drummer().followsScore()
                        ? 'Start with score'
                        : 'Start drummer'}
                </button>
              </div>
              <span class={styles.state} role="status">
                {drummer().waiting()
                  ? 'Ready — joins when the score plays'
                  : drummer().changed()
                    ? `${pattern().name} · changing next bar`
                    : drummer().armed()
                      ? `${drummerPattern(drummer().active()?.patternId ?? pattern().id).name} · playing`
                      : '16 original grooves · choose your pocket'}
              </span>
            </GuitarNightMixerDialog>
          </div>
        </Portal>
      </Show>
    </>
  )
}
