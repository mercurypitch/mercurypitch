// ============================================================
// RoomBarEnd: a room's level pill and "?" in the bar, or in place
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { registerPushedBarEnd } from '@/stores/native-shell-store'
import { RoomAsk, RoomBarEnd } from './RoomBar'

let asked = 0
let unregister: (() => void) | null = null

/** A bar's right-hand slot, as the shell registers it. */
function barSlot(): HTMLElement {
  const slot = document.createElement('div')
  document.body.append(slot)
  unregister = registerPushedBarEnd(slot)
  return slot
}

function Room() {
  return (
    <div data-testid="room">
      <RoomBarEnd>
        <RoomAsk
          onAsk={() => (asked += 1)}
          label="How it works"
          testId="room-ask"
        />
      </RoomBarEnd>
    </div>
  )
}

afterEach(() => {
  cleanup()
  unregister?.()
  unregister = null
  asked = 0
  document.body.replaceChildren()
})

describe("the room's side of the bar", () => {
  it('draws the room controls into the slot the shell gives it', () => {
    const slot = barSlot()

    render(() => <Room />)

    const ask = screen.getByTestId('room-ask')
    expect(slot.contains(ask)).toBe(true)
    expect(screen.getByTestId('room').contains(ask)).toBe(false)
  })

  it('draws them in the room itself with no shell up', () => {
    render(() => <Room />)

    expect(
      screen.getByTestId('room').contains(screen.getByTestId('room-ask')),
    ).toBe(true)
  })

  it('moves them up into the bar when the shell comes after the room', () => {
    render(() => <Room />)

    const slot = barSlot()

    expect(slot.contains(screen.getByTestId('room-ask'))).toBe(true)
  })

  it('takes them out of the bar when the room goes', () => {
    const slot = barSlot()
    const { unmount } = render(() => <Room />)

    unmount()

    expect(slot.querySelector('button')).toBeNull()
  })

  it('hands a tap on "?" to the room', () => {
    barSlot()
    render(() => <Room />)

    fireEvent.click(screen.getByTestId('room-ask'))

    expect(asked).toBe(1)
  })

  it('names "?" for a screen reader as the room says', () => {
    barSlot()
    render(() => <Room />)

    expect(screen.getByRole('button', { name: 'How it works' })).toBe(
      screen.getByTestId('room-ask'),
    )
  })
})

describe('the slot', () => {
  it('stays with the shell that registered last when an earlier one leaves', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    document.body.append(first, second)
    const leaveFirst = registerPushedBarEnd(first)
    unregister = registerPushedBarEnd(second)

    leaveFirst()
    render(() => <Room />)

    expect(second.contains(screen.getByTestId('room-ask'))).toBe(true)
  })
})
