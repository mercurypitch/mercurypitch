import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { VocalRangePreset } from '@/stores/settings-store'
import { setVocalRangePreset } from '@/stores/settings-store'
import styles from './VoiceTypeDetectorModal.module.css'

interface VoiceTypeDetectorModalProps {
  onClose: () => void
}

// Tuning for the listening loop.
const TARGET_FRAMES = 120 // ~2s of sustained, clear singing at 60fps
const CLARITY_MIN = 0.6 // pitch detector confidence to count a frame
const STRONG_LEVEL = 0.025 // RMS amplitude that counts as "singing"
const HEAR_LEVEL = 0.012 // RMS amplitude that counts as "we can hear something"

export const VoiceTypeDetectorModal: Component<VoiceTypeDetectorModalProps> = (
  props,
) => {
  let dialogRef: HTMLDivElement | undefined
  useFocusTrap(() => dialogRef, {
    isOpen: () => true,
    onClose: () => props.onClose(),
  })

  const { practiceEngine } = useEngines()
  const [step, setStep] = createSignal<
    'requesting' | 'listening' | 'result' | 'error'
  >('requesting')
  const [progress, setProgress] = createSignal(0)
  // Live feedback so the user knows the mic is on and waiting for them.
  const [hearing, setHearing] = createSignal(false)
  const [singing, setSinging] = createSignal(false)

  const [detectedPreset, setDetectedPreset] =
    createSignal<VocalRangePreset | null>(null)
  const [detectedNote, setDetectedNote] = createSignal<string>('')

  let animFrame: number | null = null

  const stopLoop = () => {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame)
      animFrame = null
    }
  }

  /** Request the mic (if needed) and start listening automatically. */
  const begin = async () => {
    setStep('requesting')
    setProgress(0)
    let ok = false
    try {
      ok = await practiceEngine.startMic()
    } catch {
      ok = false
    }
    if (!ok) {
      setStep('error')
      return
    }
    setStep('listening')
    runLoop()
  }

  /**
   * Listen continuously. We only accept a single, uninterrupted take of clear
   * singing: each strong frame advances progress, weak frames decay it, and if a
   * take collapses to zero we scratch it and wait for a fresh one — so a false
   * start or a cleared throat never pollutes the result.
   */
  const runLoop = () => {
    let take: number[] = []
    let goodFrames = 0

    const loop = () => {
      const level = practiceEngine.getInputLevel()
      const pitch = practiceEngine.detectPitch()
      const strong =
        pitch !== null && pitch.clarity > CLARITY_MIN && level > STRONG_LEVEL

      setHearing(level > HEAR_LEVEL)
      setSinging(strong)

      if (strong) {
        const midi = Math.round(69 + 12 * Math.log2(pitch.frequency / 440))
        take.push(midi)
        goodFrames++
      } else {
        goodFrames = Math.max(0, goodFrames - 2)
        if (goodFrames === 0 && take.length > 0) take = [] // scratch the take
      }

      setProgress(Math.min(100, (goodFrames / TARGET_FRAMES) * 100))

      if (goodFrames >= TARGET_FRAMES) {
        finishListening(take)
        return
      }
      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }

  const finishListening = (take: number[]) => {
    stopLoop()
    practiceEngine.stopMic()

    const sorted = [...take].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 55

    // Categorize by tessitura (comfortable mid note). MIDI 60 = C4.
    let preset: VocalRangePreset = 'baritone'
    let noteName = ''
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
    setHearing(false)
    setSinging(false)
    setStep('result')
  }

  onMount(() => {
    void begin()
  })

  onCleanup(() => {
    stopLoop()
    practiceEngine.stopMic()
  })

  const handleApply = () => {
    const preset = detectedPreset()
    if (preset) setVocalRangePreset(preset)
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
          <Show when={step() === 'requesting'}>
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
              <p>Allow microphone access so we can hear your voice…</p>
            </div>
          </Show>

          <Show when={step() === 'listening'}>
            <div class={styles.centerContainer}>
              <div
                class={styles.iconCircle}
                style={{
                  transition: 'box-shadow 0.12s, transform 0.12s',
                  'box-shadow': hearing()
                    ? '0 0 0 8px var(--accent-soft, rgba(99,102,241,0.18))'
                    : 'none',
                  transform: singing() ? 'scale(1.06)' : 'scale(1)',
                }}
              >
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
              <h3>
                Sing a steady <strong>"Ah"</strong>
              </h3>
              <div class={styles.progressBar}>
                <div
                  class={styles.progressFill}
                  style={{ width: `${progress()}%` }}
                ></div>
              </div>
              <p class={styles.helperText}>
                <Show
                  when={singing()}
                  fallback={
                    <Show
                      when={hearing()}
                      fallback="Whenever you're ready — sing a comfortable, steady note."
                    >
                      A little louder, and hold a clear note…
                    </Show>
                  }
                >
                  Hold it… we're measuring your range.
                </Show>
              </p>
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
                  onClick={() => void begin()}
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

          <Show when={step() === 'error'}>
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
                  <line x1="4" y1="3" x2="20" y2="21" />
                </svg>
              </div>
              <h3>We couldn't access your microphone</h3>
              <p class={styles.helperText}>
                Allow microphone access in your browser, then try again.
              </p>
              <button
                type="button"
                class={styles.actionBtn}
                onClick={() => void begin()}
              >
                Allow &amp; retry
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
