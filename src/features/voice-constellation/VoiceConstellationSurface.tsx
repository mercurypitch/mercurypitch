// ============================================================
// Voice Constellation Surface — saved matches across the full legend map.
// ============================================================
//
// The web route's full-screen dialog: its own top bar (the MercuryPitch mark
// as the way back, the public gallery link and Close), a focus trap, and the
// map itself (VoiceConstellationMap.tsx), which the native app's page draws
// under the shell's own bar instead.

import type { Component } from 'solid-js'
import { Portal } from 'solid-js/web'
import { X } from '@/components/icons'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { useVoiceConstellation } from './useVoiceConstellation'
import { VOICE_LEGENDS_URL, VoiceConstellationBody, VoiceConstellationDetail, } from './VoiceConstellationMap'
import styles from './VoiceConstellationSurface.module.css'

export interface VoiceConstellationSurfaceProps {
  onClose: () => void
}

export const VoiceConstellationSurface: Component<
  VoiceConstellationSurfaceProps
> = (props) => {
  let dialog: HTMLElement | undefined
  let closeButton: HTMLButtonElement | undefined

  const state = useVoiceConstellation()

  useFocusTrap(() => dialog, {
    isOpen: () => true,
    onClose: () => props.onClose(),
    initialFocus: () => closeButton,
  })

  return (
    <Portal>
      <section
        ref={dialog}
        class={styles.surface}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-constellation-title"
        aria-describedby="voice-constellation-intro"
        aria-busy={state.prints.loading}
        tabindex="-1"
        data-voice-constellation
      >
        <div class={styles.sky} aria-hidden="true" />

        <div class={styles.topbar}>
          <button
            type="button"
            class={styles.brand}
            onClick={() => props.onClose()}
            aria-label="Back to MercuryPitch"
            title="Back to MercuryPitch"
          >
            <span class={styles.brandMark} aria-hidden="true">
              <img src="/favicon.svg" width="38" height="38" alt="" />
            </span>
            <span>
              <b>MercuryPitch</b>
              <small>Voice Mirror</small>
            </span>
          </button>
          <div class={styles.topbarActions}>
            <a
              class={styles.publicLink}
              href={VOICE_LEGENDS_URL}
              target="_blank"
              rel="noreferrer"
            >
              Explore every portrait
            </a>
            <button
              ref={closeButton}
              type="button"
              class={styles.closeButton}
              onClick={() => props.onClose()}
              aria-label="Close voice constellation"
              title="Close voice constellation"
            >
              <X />
            </button>
          </div>
        </div>

        <main class={styles.content}>
          <VoiceConstellationBody state={state} voiceprintHref="/mirror" />
        </main>

        <VoiceConstellationDetail state={state} voiceprintHref="/mirror" />
      </section>
    </Portal>
  )
}
