// ============================================================
// The room header: the chip names the ROOM
// ============================================================
//
// Device round 1, P4: the chip read "Sing" while the room was the Retro
// Analog Studio. The title travels from the room's `registerRunControls`
// through the bridge to this component, so the check that stays honest is
// that whatever the room registered is what the chip shows — verbatim, and
// reactively, because the room can rename itself when the singer changes it.
//
// P6 is the other half: the header is fixed one step ABOVE a pushed screen,
// so while one is up it has to stop being on screen AND stop taking taps.
// The first is a class the stylesheet animates; the second is `inert`, which
// is asserted here because jsdom applies no stylesheet and a test that
// checked the class alone would pass against a header that still swallowed
// the screen's Back.

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

  describe('while a screen is pushed', () => {
    it('is in, and touchable, with nothing pushed', () => {
      const rendered = renderShell(() => (
        <RoomHeader title={() => 'Retro Analog Studio'} onBack={() => {}} />
      ))
      unmount = rendered.unmount

      const header = rendered.container.querySelector(
        '[data-testid="shell-room-header"]',
      )
      expect(header?.classList.contains('is-in')).toBe(true)
      expect(header?.hasAttribute('inert')).toBe(false)
    })

    it('goes out and inert when the screen is pushed, and back on the pop', () => {
      const [visible, setVisible] = createSignal(true)
      const rendered = renderShell(() => (
        <RoomHeader
          title={() => 'Retro Analog Studio'}
          visible={visible}
          onBack={() => {}}
        />
      ))
      unmount = rendered.unmount

      const header = rendered.container.querySelector(
        '[data-testid="shell-room-header"]',
      )
      expect(header?.classList.contains('is-in')).toBe(true)

      setVisible(false)
      expect(header?.classList.contains('is-in')).toBe(false)
      expect(header?.hasAttribute('inert')).toBe(true)

      setVisible(true)
      expect(header?.classList.contains('is-in')).toBe(true)
      expect(header?.hasAttribute('inert')).toBe(false)
    })

    it('keeps Back in the tree while it is out — this is a fade, not an unmount', () => {
      // The header animates out with the rail's own tokens, which needs a
      // live element. Unmounting it would skip the transition and would take
      // the room's own Back away from anything that reaches for it by
      // reference.
      const rendered = renderShell(() => (
        <RoomHeader
          title={() => 'Retro Analog Studio'}
          visible={() => false}
          onBack={() => {}}
        />
      ))
      unmount = rendered.unmount

      expect(
        rendered.container.querySelector('[data-testid="shell-room-back"]'),
      ).not.toBe(null)
    })
  })

  describe('the room chip', () => {
    it('is a label while the room offers nothing behind it', () => {
      // A chip that is always a button and sometimes inert teaches nothing.
      const rendered = renderShell(() => (
        <RoomHeader title={() => 'Retro Analog Studio'} onBack={() => {}} />
      ))
      unmount = rendered.unmount

      const chip = rendered.container.querySelector(
        '[data-testid="shell-room-chip"]',
      )
      expect(chip?.tagName).toBe('SPAN')
      expect(chip?.getAttribute('aria-label')).toBeNull()
    })

    it('is a button, and says what it opens, when the room hands one over', () => {
      const onChip = vi.fn()
      const rendered = renderShell(() => (
        <RoomHeader
          title={() => 'Retro Analog Studio'}
          onBack={() => {}}
          onChip={onChip}
        />
      ))
      unmount = rendered.unmount

      const chip = rendered.container.querySelector<HTMLButtonElement>(
        '[data-testid="shell-room-chip"]',
      )
      expect(chip?.tagName).toBe('BUTTON')
      expect(chip?.getAttribute('aria-label')).toBe(
        'Retro Analog Studio. Tap to choose the room',
      )
      chip?.click()
      expect(onChip).toHaveBeenCalledTimes(1)
    })
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
