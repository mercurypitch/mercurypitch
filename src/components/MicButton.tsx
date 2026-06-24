// ============================================================
// MicButton — Microphone toggle button
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { IconMic, IconMicOff } from './hidden-features-icons'
import styles from './MicButton.module.css'

interface MicButtonProps {
  active: boolean
  onClick: () => void
  disabled?: boolean
}

export const MicButton: Component<MicButtonProps> = (props) => {
  const { audioEngine } = useEngines()
  const [level, setLevel] = createSignal(0)

  createEffect(() => {
    if (!props.active || props.disabled === true) {
      setLevel(0)
      return
    }

    let frameId: number
    const checkLevel = () => {
      const data = audioEngine.getTimeData()
      let max = 0
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i])
        if (abs > max) max = abs
      }
      setLevel(max)
      frameId = requestAnimationFrame(checkLevel)
    }
    frameId = requestAnimationFrame(checkLevel)

    onCleanup(() => {
      cancelAnimationFrame(frameId)
    })
  })

  // Map level (0 to 1) to a height percentage
  // Multiply by 2 or 3 to make it more sensitive (normal speech might only peak at 0.3)
  const fillHeight = () => Math.min(1, level() * 2.5)

  return (
    <button
      id="btn-mic"
      class={`${styles.ctrlBtn} ${props.active ? styles.recording : ''}`}
      onClick={() => props.onClick?.()}
      disabled={props.disabled}
      aria-pressed={props.active}
      aria-label={props.active ? 'Disable microphone' : 'Enable microphone'}
      title={props.active ? 'Disable microphone' : 'Enable microphone'}
      style={{
        '--mic-level': fillHeight(),
      }}
    >
      <div class={styles.micWave} />
      {props.active ? <IconMic /> : <IconMicOff />}
    </button>
  )
}
