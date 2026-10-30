// First Light's microphone chips: the input Merc hears, the list that opens
// by itself once help is due, a switch in progress, and the fixes.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioInput } from '@/features/mic-check/fake-capture.fixture'
import type { MicRoster } from '@/features/mic-check/mic-roster'
import { buildRoster, EMPTY_ROSTER } from '@/features/mic-check/mic-roster'
import { FIRST_LIGHT_FIX_MUTED, FIRST_LIGHT_FIX_PICK, FIRST_LIGHT_SILENT_PICK, } from '../copy'
import { FirstLightMic } from './FirstLightMic'

const SCARLETT = audioInput('usb', 'Scarlett 4i4 USB', 'focusrite')
const BUILT_IN = audioInput('built-in', 'Built-in Microphone')
const HEADSET = audioInput('headset', 'USB Headset Microphone')

/** These inputs, with the Scarlett the one the capture opened. */
const heardOnScarlett = (inputs: MediaDeviceInfo[]): MicRoster =>
  buildRoster(inputs, {
    deviceId: 'usb',
    groupId: 'focusrite',
    label: 'Scarlett 4i4 USB',
  })

interface Setup {
  roster?: MicRoster
  helpDue?: boolean
  showInputs?: boolean
  switching?: string | null
  silentPick?: string | null
  listeningSilent?: boolean
}

/** The chips under props a case can change after the first render. */
function mount(setup: Setup = {}) {
  const [roster, setRoster] = createSignal(
    setup.roster ?? heardOnScarlett([SCARLETT, BUILT_IN]),
  )
  const [helpDue, setHelpDue] = createSignal(setup.helpDue ?? false)
  const onPick = vi.fn<(deviceId: string) => void>()
  render(() => (
    <FirstLightMic
      roster={roster()}
      settings={null}
      helpDue={helpDue()}
      showInputs={setup.showInputs ?? true}
      switching={setup.switching ?? null}
      silentPick={setup.silentPick ?? null}
      listeningSilent={setup.listeningSilent}
      onPick={onPick}
    />
  ))
  return { setRoster, setHelpDue, onPick }
}

const inputsChip = () =>
  screen.getByRole('button', { name: /^Microphone in use:/ })

afterEach(() => {
  cleanup()
})

describe('FirstLightMic', () => {
  it('names the input Merc hears on its chip', () => {
    // Act
    mount()

    // Assert
    expect(inputsChip()).toHaveAccessibleName(
      'Microphone in use: Scarlett 4i4 USB',
    )
  })

  it('opens every input by itself once help falls due', () => {
    // Arrange
    const chips = mount()

    // Act
    chips.setHelpDue(true)

    // Assert
    expect(inputsChip()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Use this' })).toBeVisible()
  })

  it('opens the fixes instead when there is no other input to switch to', () => {
    // Arrange
    const chips = mount({ roster: heardOnScarlett([SCARLETT]) })

    // Act
    chips.setHelpDue(true)

    // Assert
    expect(inputsChip()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(FIRST_LIGHT_FIX_MUTED)).toBeVisible()
  })

  it('moves the fixes it opened over to the inputs once they are listed', () => {
    // Arrange: help fell due before the inputs were listed.
    const chips = mount({ roster: EMPTY_ROSTER, helpDue: true })

    // Act
    chips.setRoster(heardOnScarlett([SCARLETT, BUILT_IN]))

    // Assert
    expect(inputsChip()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Use this' })).toBeVisible()
  })

  it('leaves the fixes a singer opened when the inputs arrive', () => {
    // Arrange
    const chips = mount({ roster: EMPTY_ROSTER, helpDue: true })
    const fixes = screen.getByRole('button', { name: 'Mic not behaving?' })
    fireEvent.click(fixes)
    fireEvent.click(fixes)

    // Act
    chips.setRoster(heardOnScarlett([SCARLETT, BUILT_IN]))

    // Assert
    expect(fixes).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull()
  })

  it('leaves a list the singer closed shut when the inputs change', () => {
    // Arrange
    const chips = mount({ helpDue: true })
    fireEvent.click(inputsChip())

    // Act
    chips.setRoster(heardOnScarlett([SCARLETT, BUILT_IN, HEADSET]))

    // Assert
    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull()
  })

  it('hands the input picked to its owner', () => {
    // Arrange
    const chips = mount({ helpDue: true })

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))

    // Assert
    expect(chips.onPick).toHaveBeenCalledWith('built-in')
  })

  it('holds every switch while one input opens, and says which one', () => {
    // Act
    mount({
      roster: heardOnScarlett([SCARLETT, BUILT_IN, HEADSET]),
      helpDue: true,
      switching: 'built-in',
    })

    // Assert
    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled()
  })

  it('says on its row when a picked input sent no sound at all', () => {
    // Act
    mount({ helpDue: true, silentPick: 'built-in' })

    // Assert
    const row = screen.getByText('Built-in Microphone').closest('li')
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(FIRST_LIGHT_SILENT_PICK),
    ).toBeVisible()
  })

  it('says the input it listens to sent nothing when the beat failed on it', () => {
    // Act
    mount({ helpDue: true, listeningSilent: true })

    // Assert: the Scarlett, the one opened, no longer claims to be heard,
    // and leaves the why to the beat, which says it above the list.
    const row = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Scarlett 4i4 USB'))
    expect(row).toHaveTextContent('No signal')
    expect(row).not.toHaveTextContent('Listening')
    expect(row).not.toHaveTextContent(FIRST_LIGHT_SILENT_PICK)
  })

  it('offers only the fixes where the microphone never opened', () => {
    // Act
    mount({ helpDue: true, showInputs: false })

    // Assert
    expect(
      screen.queryByRole('button', { name: /^Microphone in use:/ }),
    ).toBeNull()
    expect(screen.getByText(FIRST_LIGHT_FIX_MUTED)).toBeVisible()
    expect(screen.queryByText(FIRST_LIGHT_FIX_PICK)).toBeNull()
  })

  it('offers no input chip while the browser lists no input', () => {
    // Act
    mount({ roster: EMPTY_ROSTER })

    // Assert
    expect(
      screen.queryByRole('button', { name: /^Microphone in use:/ }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Mic not behaving?' }),
    ).toBeVisible()
  })
})
