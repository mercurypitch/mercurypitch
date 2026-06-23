import type { Component } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { VocalRangePreset } from '@/stores/settings-store'
import { setVocalRangePreset } from '@/stores/settings-store'
import styles from './VoiceTypeDetectorModal.module.css'

interface VoiceTypeDetectorModalProps {
  onClose: () => void
}

export const VoiceTypeDetectorModal: Component<VoiceTypeDetectorModalProps> = (
  props,
) => {
  let dialogRef: HTMLDivElement | undefined
  useFocusTrap(() => dialogRef, {
    isOpen: () => true,
    onClose: () => props.onClose(),
  })

  const { practiceEngine } = useEngines()
  const [step, setStep] = createSignal<'intro' | 'listening' | 'result'>(
    'intro',
  )
  const [progress, setProgress] = createSignal(0)

  const [detectedPreset, setDetectedPreset] =
    createSignal<VocalRangePreset | null>(null)
  const [detectedNote, setDetectedNote] = createSignal<string>('')

  let pitches: number[] = []
  let animFrame: number | null = null

  const startListening = async (e?: Event) => {
    if (e) e.stopPropagation()
    try {
      await practiceEngine.startMic()
      setStep('listening')
      pitches = []
      setProgress(0)

      let goodFrames = 0
      const TARGET_FRAMES = 120 // ~2 seconds of good pitch at 60fps

      const loop = () => {
        const pitch = practiceEngine.detectPitch()
        if (pitch && pitch.clarity > 0.6) {
          // Add MIDI note derived from frequency
          const midi = Math.round(69 + 12 * Math.log2(pitch.frequency / 440))
          pitches.push(midi)
          goodFrames++
        } else {
          // Slowly decay goodFrames if they stop singing instead of instantly resetting
          goodFrames = Math.max(0, goodFrames - 2)
        }

        const currentProgress = Math.min(
          100,
          (goodFrames / TARGET_FRAMES) * 100,
        )
        setProgress(currentProgress)

        if (currentProgress >= 100) {
          finishListening()
          return
        }

        animFrame = requestAnimationFrame(loop)
      }

      animFrame = requestAnimationFrame(loop)
    } catch (err) {
      console.error('Mic access failed', err)
      props.onClose()
    }
  }

  const finishListening = () => {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame)
      animFrame = null
    }
    practiceEngine.stopMic()

    // Calculate median pitch
    pitches.sort((a, b) => a - b)
    const median = pitches[Math.floor(pitches.length / 2)]

    // Map midi note to voice type
    let preset: VocalRangePreset = 'baritone' // Default
    let noteName = ''

    // MIDI 60 is C4.
    // Bass: E2 - E4 (~40-64) - Middle ~52
    // Baritone: G2 - G4 (~43-67) - Middle ~55
    // Tenor: C3 - C5 (~48-72) - Middle ~60
    // Alto: F3 - F5 (~53-77) - Middle ~65
    // Mezzo: A3 - A5 (~57-81) - Middle ~69
    // Soprano: C4 - C6 (~60-84) - Middle ~72

    // We categorize based on tessitura (comfortable speaking/singing note)
    if (median <= 52) {
      preset = 'bass'
      noteName = 'E3 or lower'
    } else if (median <= 56) {
      preset = 'baritone'
      noteName = 'G3 area'
    } else if (median <= 60) {
      preset = 'tenor'
      noteName = 'C4 area'
    } else if (median <= 64) {
      preset = 'alto'
      noteName = 'E4 area'
    } else if (median <= 69) {
      preset = 'mezzo-soprano'
      noteName = 'A4 area'
    } else {
      preset = 'soprano'
      noteName = 'C5 or higher'
    }

    setDetectedPreset(preset)
    setDetectedNote(noteName)
    setStep('result')
  }

  onCleanup(() => {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame)
    }
    practiceEngine.stopMic()
  })

  const handleApply = () => {
    const preset = detectedPreset()
    if (preset) {
      setVocalRangePreset(preset)
    }
    props.onClose()
  }

  return (
    <div
      class={styles.modalOverlay}
      onClick={(e) => {
        e.stopPropagation()
        props.onClose()
      }}
    >
      <div
        class={styles.modalContent}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Voice type detector"
        onClick={(e) => e.stopPropagation()}
      >
        <div class={styles.modalHeader}>
          <h2>Find My Voice Type</h2>
          <button class={styles.closeBtn} onClick={() => props.onClose()}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>

        <div class={styles.modalBody}>
          <Show when={step() === 'intro'}>
            <div class={styles.centerContainer}>
              <div class={styles.iconCircle}>
                <svg
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  stroke="currentColor"
                  fill="none"
                  stroke-width="2"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <p>
                We'll determine your natural voice type. Take a deep breath and
                sing a comfortable, steady <strong>"Ah"</strong> in your normal
                speaking range.
              </p>
              <button
                type="button"
                class={styles.actionBtn}
                onClick={(e) => void startListening(e)}
              >
                Start
              </button>
            </div>
          </Show>

          <Show when={step() === 'listening'}>
            <div class={styles.centerContainer}>
              <h3>Sing "Ah" steadily...</h3>
              <div class={styles.progressBar}>
                <div
                  class={styles.progressFill}
                  style={{ width: `${progress()}%` }}
                ></div>
              </div>
              <p class={styles.helperText}>Hold the note for a few seconds.</p>
            </div>
          </Show>

          <Show when={step() === 'result'}>
            <div class={styles.centerContainer}>
              <div class={styles.successIcon}>
                <svg
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  fill="currentColor"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
              <h3>We heard you around {detectedNote()}!</h3>
              <p>Based on your comfortable pitch, your likely voice type is:</p>
              <div class={styles.resultBadge}>{detectedPreset()}</div>

              <div class={styles.resultActions}>
                <button
                  type="button"
                  class={styles.secondaryBtn}
                  onClick={(e) => void startListening(e)}
                >
                  Try Again
                </button>
                <button
                  type="button"
                  class={styles.actionBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleApply()
                  }}
                >
                  Use This Preset
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
