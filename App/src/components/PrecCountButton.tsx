// ============================================================
// PrecCountButton — Toggle precount (always 4 beats) (GH #149)
// ============================================================

import type { Component } from 'solid-js'
import { Tooltip } from '@/components/Tooltip'
import { appStore } from '@/stores/app-store'

export const PrecCountButton: Component = () => {
  const isOn = () => appStore.countIn() > 0

  const toggle = () => {
    appStore.setCountIn(isOn() ? 0 : 4)
  }

  return (
    <Tooltip text="Precount">
      <button
        id="btn-precount"
        class={`ctrl-btn precount-btn ${isOn() ? 'active' : ''}`}
        onClick={toggle}
        title={isOn() ? 'Precount: On' : 'Precount: Off'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"
          />
        </svg>
      </button>
    </Tooltip>
  )
}
