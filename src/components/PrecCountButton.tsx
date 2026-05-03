// ============================================================
// PrecCountButton — Toggle precount (always 4 beats) (GH #149)
// ============================================================
import type { Component } from 'solid-js'
import { Tooltip } from '@/components/Tooltip'
import { countIn, setCountIn } from '@/stores'
import styles from "./HeaderControls.module.css"

export const PrecCountButton: Component = () => {
  const isOn = () => countIn() > 0

  const toggle = () => {
    setCountIn(isOn() ? 0 : 4)
  }

  return (
    <Tooltip text="Precount">
      <button
        id="btn-precount"
        class={`${styles.ctrlBtn} ${styles.precountBtn} ${isOn() ? 'active' : ''}`}
        onClick={toggle}
        title={isOn() ? 'Precount: On' : 'Precount: Off'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M6 2h12v5.17l-4 4v1.66l4 4V22H6v-5.17l4-4v-1.66l-4-4V2zm2 2v3.17l4 4 4-4V4H8zm0 13.17v3.83h8v-3.83l-4-4-4 4z"
          />
        </svg>
      </button>
    </Tooltip>
  )
}
