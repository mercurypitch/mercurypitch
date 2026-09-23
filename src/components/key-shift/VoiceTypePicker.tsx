// ============================================================
// VoiceTypePicker — "Find my key" needs a range to fit to
// ============================================================
//
// Shown when there is no measured voiceprint and no voice type picked in
// Settings. The pick is the same voice type Settings keeps. Voice Mirror
// opens in a new tab so the song on stage is not lost; a range measured
// there is read back when this tab is shown again.
//
// The chrome (portal, overlay, focus trap, Escape) is ConfirmDialog's.

import type { Component } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import confirmStyles from '@/components/ConfirmDialog.module.css'
import { createPortalSkinBridge } from '@/components/portal-skin'
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
}

export const VoiceTypePicker: Component<VoiceTypePickerProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const bodyId = createUniqueId()
  const portalSkin = createPortalSkinBridge(() => props.open)

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: () => props.onCancel(),
  })

  return (
    <>
      <span ref={portalSkin.anchorRef} hidden aria-hidden="true" />
      <Show when={props.open}>
        <Portal>
          <div
            class={confirmStyles.overlay}
            style={portalSkin.style()}
            onClick={() => props.onCancel()}
          >
            <div
              ref={dialogRef}
              class={`${confirmStyles.dialog} ${styles.dialog}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={bodyId}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 id={titleId}>Which is your voice?</h4>
              <p id={bodyId}>
                Find my key moves the song into your range. Pick the voice
                closest to yours, or measure your range with Voice Mirror.
              </p>
              <div class={styles.voices}>
                <For each={VOICE_TYPES}>
                  {(preset) => (
                    <button
                      type="button"
                      class={styles.voice}
                      data-voice={preset}
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
              <div class={confirmStyles.actions}>
                <a
                  class={`${confirmStyles.secondary} ${styles.measure}`}
                  href="/mirror"
                  target="_blank"
                  rel="noopener"
                >
                  Measure my range
                </a>
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
