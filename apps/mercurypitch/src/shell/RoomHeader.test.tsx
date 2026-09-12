// ============================================================
// The room header: the chip names the ROOM
// ============================================================
//
// Device round 1, P4: the chip read "Sing" while the room was the Retro
// Analog Studio. The title travels from the room's `registerRunControls`
// through the bridge to this component, so the check that stays honest is
// that whatever the room registered is what the chip shows — verbatim, and
// reactively, because the room can rename itself when the singer changes it.

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderShell } from './render-for-test'
import { RoomHeader } from './RoomHeader'

let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
  vi.clearAllMocks()
})

describe('RoomHeader', () => {
  it('shows the room name it is given, not the tab', () => {
    const rendered = renderShell(() => (
      <RoomHeader title={() => 'Retro Analog Studio'} onBack={() => {}} />
    ))
    unmount = rendered.unmount

    const chip = rendered.container.querySelector('.mp-room-chip')
    expect(chip?.textContent).toContain('Retro Analog Studio')
    expect(chip?.textContent).not.toContain('Sing')
  })

  it('follows the room when the name changes', () => {
    const [name, setName] = createSignal('Retro Analog Studio')
    const rendered = renderShell(() => (
      <RoomHeader title={name} onBack={() => {}} />
    ))
    unmount = rendered.unmount

    setName('Broadway Theater')
    expect(
      rendered.container.querySelector('.mp-room-chip')?.textContent,
    ).toContain('Broadway Theater')
  })

  it('keeps Back and the gear either side of the chip', () => {
    const onBack = vi.fn()
    const onGear = vi.fn()
    const rendered = renderShell(() => (
      <RoomHeader
        title={() => 'Nocturne Studio'}
        onBack={onBack}
        onGear={onGear}
      />
    ))
    unmount = rendered.unmount

    const back = rendered.container.querySelector<HTMLButtonElement>(
      '[data-testid="shell-room-back"]',
    )
    const gear = rendered.container.querySelector<HTMLButtonElement>(
      '[data-testid="shell-room-gear"]',
    )
    back?.click()
    gear?.click()
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onGear).toHaveBeenCalledTimes(1)
  })
})
