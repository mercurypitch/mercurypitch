// ============================================================
// VoiceTypePicker — "Find my key" needs a range to fit to
// ============================================================
//
// Shown when there is no measured voiceprint and no voice type picked in
// Settings, and again when Find my key is asked with the song already at
// the fit: then it says so, marks the voice picked before, and offers the
// song's own key as well as the other voices. The pick is the same voice
// type Settings keeps. Voice Mirror
// opens in a new tab so the song on stage is not lost; a range measured
// there is read back when this tab is shown again. The native app has no
// Voice Mirror, so there the picker offers the voice types alone.
//
// The chrome (portal, overlay, focus trap, Escape) is ConfirmDialog's, with
// two changes for the stage it opens over. The dialog is solid: the bridge
// hands it the panels' glass, which over a photo was too faint to read, so
// it takes the stage's own palette unfaded, as the key panel does. And it
// sits above the popover layer, because the key panel that opens it stays
// up behind it.

import type { Component } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import confirmStyles from '@/components/ConfirmDialog.module.css'
import { createPortalSkinBridge } from '@/components/portal-skin'
import { formatKeyShift } from '@/lib/key-shift/key-shift'
import { isolateKeys } from '@/lib/keyboard-isolation'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import styles from './VoiceTypePicker.module.css'

// Declaration order is highest voice first.
const VOICE_TYPES = Object.keys(VOCAL_RANGES) as VocalRangePreset[]

interface VoiceTypePickerProps {
  open: boolean
  onPick: (preset: VocalRangePreset) => void
  onCancel: () => void
  /**
   * The key the song already sits at, which fits the voice it was fitted
   * to; absent while there is no voice yet.
   */
  fits?: number | null
  /** The voice picked before, marked among the others. */
  current?: VocalRangePreset | null
  /** Offered while the song is in another key than its own. */
  onOriginalKey?: () => void
}

/** What the picker says when the song already sits at the fit. */
function fitsLine(fits: number): string {
  const key = fits === 0 ? "The song's own key" : `Key ${formatKeyShift(fits)}`
  return `${key} already fits your voice. Pick another voice to try a different key.`
}

export const VoiceTypePicker: Component<VoiceTypePickerProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const bodyId = createUniqueId()
  const portalSkin = createPortalSkinBridge(() => props.open)

  // Isolated: the mixer's shortcuts sit behind this dialog on the page, and
  // Escape must close the picker without leaving focus mode as well. The
  // dialog takes the focus itself (tabindex -1), so a press on its words
  // keeps the focus inside, where the trap hears the keys, instead of
  // dropping it to the page behind.
  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: () => props.onCancel(),
    isolateKeyboard: isolateKeys,
  })

  return (
    <>
      <span ref={portalSkin.anchorRef} hidden aria-hidden="true" />
      <Show when={props.open}>
        <Portal>
          <div
            class={`${confirmStyles.overlay} ${styles.overlay}`}
            style={portalSkin.style()}
            onClick={() => props.onCancel()}
          >
            <div
              ref={dialogRef}
              class={`${confirmStyles.dialog} ${styles.dialog} mp-dark-stage`}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-labelledby={titleId}
              aria-describedby={bodyId}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 id={titleId}>Which is your voice?</h4>
              <p id={bodyId}>
                {props.fits != null
                  ? fitsLine(props.fits)
                  : IS_NATIVE_BUILD
                    ? 'Find my key moves the song into your range. Pick the voice closest to yours.'
                    : 'Find my key moves the song into your range. Pick the voice closest to yours, or measure your range with Voice Mirror.'}
              </p>
              <div class={styles.voices}>
                <For each={VOICE_TYPES}>
                  {(preset) => (
                    <button
                      type="button"
                      class={styles.voice}
                      data-voice={preset}
                      aria-current={
                        props.current === preset ? 'true' : undefined
                      }
                      onClick={() => props.onPick(preset)}
                    >
                      <span class={styles.voiceName}>
                        {VOCAL_RANGES[preset].label}
                      </span>
                      <span class={styles.voiceRange}>
                        {midiToNoteNameOctave(VOCAL_RANGES[preset].lowMidi)}–
                        {midiToNoteNameOctave(VOCAL_RANGES[preset].highMidi)}
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <div class={`${confirmStyles.actions} ${styles.actions}`}>
                <Show when={!IS_NATIVE_BUILD}>
                  <a
                    class={`${confirmStyles.secondary} ${styles.measure}`}
                    href="/mirror"
                    target="_blank"
                    rel="noopener"
                  >
                    Measure my range
                  </a>
                </Show>
                <Show
                  when={
                    props.fits != null &&
                    props.fits !== 0 &&
                    props.onOriginalKey
                  }
                >
                  {(onOriginalKey) => (
                    <button
                      type="button"
                      class={confirmStyles.secondary}
                      onClick={() => onOriginalKey()()}
                    >
                      Back to original key
                    </button>
                  )}
                </Show>
                <button
                  type="button"
                  class={confirmStyles.cancel}
                  onClick={() => props.onCancel()}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}
