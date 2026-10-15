// The key chip: what it says, a stepper that stays open while the singer
// steps, and the stretch warning and disabled reason as words on screen.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftBinding, KeyShiftNotice, } from '@/components/key-shift/KeyShiftControl'
import { KEY_SHIFT_STRETCH_NOTE } from '@/components/key-shift/KeyShiftControl'
import type { KeySuggestion } from '@/lib/key-shift/key-suggest'
import { KEY_CLEAN_NOTE, KEY_FINDING_LABEL, KeyChip } from './KeyChip'

afterEach(cleanup)

interface Options {
  value?: number
  keyLabel?: string
  suggestion?: KeySuggestion | null
  disabledReason?: string
}

const FINDING_NOTICE: KeyShiftNotice = {
  message: 'Finding the melody first. This takes a moment.',
  tone: 'info',
}

function mount(options: Options = {}) {
  const [value, setValue] = createSignal(options.value ?? 0)
  const [reason, setReason] = createSignal(options.disabledReason)
  const onChange = vi.fn(setValue)
  const onFindKey = vi.fn()
  const [finding, setFinding] = createSignal(false)
  const [notice, setNotice] = createSignal<KeyShiftNotice | null>(null)
  const holdNotices = vi.fn()
  const binding: KeyShiftBinding = {
    value,
    heard: value,
    onChange,
    keyLabel: () => options.keyLabel,
    suggestion: () => options.suggestion ?? null,
    onFindKey,
    disabledReason: reason,
    finding,
    notice,
    holdNotices,
  }
  render(() => (
    <>
      <p>Lyrics</p>
      <KeyChip binding={binding} />
    </>
  ))
  return {
    onChange,
    onFindKey,
    setValue,
    setReason,
    setFinding,
    setNotice,
    holdNotices,
  }
}

const chip = () => screen.getByTestId('key-chip')
const openPanel = () => {
  fireEvent.click(chip())
  return screen.getByRole('dialog', { name: 'Key' })
}
const note = () => screen.getByTestId('key-chip-note')

describe('KeyChip', () => {
  it('says Key until the key moves, then by how much', () => {
    const { setValue } = mount()
    expect(chip()).toHaveAccessibleName('Key')

    setValue(2)
    expect(chip()).toHaveAccessibleName('Key +2')
    setValue(-3)
    expect(chip()).toHaveAccessibleName('Key −3')
  })

  it('stays open while the singer steps, one semitone a press', () => {
    const { onChange } = mount()
    openPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Raise the key' }))
    fireEvent.click(screen.getByRole('button', { name: 'Raise the key' }))

    expect(onChange.mock.calls).toEqual([[1], [2]])
    expect(screen.getByRole('dialog', { name: 'Key' })).toBeVisible()
    expect(screen.getByTestId('key-chip-value')).toHaveTextContent('+2')
    expect(chip()).toHaveAttribute('aria-expanded', 'true')
  })

  it('puts the key name on a line of its own, flats and all', () => {
    mount({ keyLabel: 'B♭ major' })
    openPanel()

    const name = screen.getByTestId('key-chip-name')
    expect(name).toHaveTextContent('B♭ major')
    expect(name.parentElement).not.toContainElement(
      screen.getByRole('button', { name: 'Raise the key' }),
    )
  })

  it('warns in words past ±4, and says the range is clean inside it', () => {
    const { setValue } = mount({ value: 4 })
    openPanel()
    expect(note()).toHaveTextContent(KEY_CLEAN_NOTE)

    fireEvent.click(screen.getByRole('button', { name: 'Raise the key' }))

    expect(note()).toHaveTextContent(KEY_SHIFT_STRETCH_NOTE)
    setValue(-5)
    expect(note()).toHaveTextContent(KEY_SHIFT_STRETCH_NOTE)
  })

  it('says why the key cannot change, in words, and holds the stepper', () => {
    const { onChange } = mount({
      value: 2,
      disabledReason: 'Pitch Studio plays the song in its own key',
    })
    openPanel()

    expect(note()).toHaveTextContent(
      'Pitch Studio plays the song in its own key',
    )
    const raise = screen.getByRole('button', { name: 'Raise the key' })
    expect(raise).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Back to original key' }),
    ).toBeDisabled()
    fireEvent.click(raise)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('goes back to the original key', () => {
    const { onChange } = mount({ value: 3 })
    openPanel()

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to original key' }),
    )

    expect(onChange).toHaveBeenCalledWith(0)
    expect(
      screen.getByRole('button', { name: 'Back to original key' }),
    ).toBeDisabled()
  })

  it('offers a known fit on Find my key, and leaves finding to the host', () => {
    const { onFindKey } = mount({
      suggestion: { keyShift: -2, octave: 0, inRange: 0.9 },
    })
    openPanel()

    const find = screen.getByRole('button', { name: 'Find my key: try −2' })
    expect(find).toHaveTextContent('Try −2')
    fireEvent.click(find)

    expect(onFindKey).toHaveBeenCalledTimes(1)
  })

  it('keeps its width while it finds: a spinner takes the chevron', () => {
    const { setFinding } = mount()
    const before = chip().className
    expect(chip()).not.toHaveAttribute('aria-busy')
    expect(chip().querySelector('svg')).not.toBeNull()

    setFinding(true)

    expect(chip()).toHaveAttribute('aria-busy', 'true')
    expect(chip()).toHaveAttribute('data-finding', 'true')
    expect(chip().querySelector('svg')).toBeNull()
    expect(chip()).toHaveAccessibleName('Key')
    expect(chip().className).toBe(before)
  })

  it('says it is finding on the button, and takes no second press', () => {
    const { onFindKey, setFinding } = mount()
    openPanel()
    setFinding(true)

    const find = screen.getByRole('button', { name: KEY_FINDING_LABEL })
    expect(find).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(find)
    expect(onFindKey).not.toHaveBeenCalled()

    setFinding(false)
    expect(screen.getByRole('button', { name: 'Find my key' })).toBeVisible()
  })

  it('holds the find’s notices while open and says them in its note', () => {
    const { holdNotices, setNotice } = mount()
    expect(holdNotices).not.toHaveBeenCalled()

    openPanel()
    expect(holdNotices.mock.calls).toEqual([[true]])
    setNotice(FINDING_NOTICE)
    expect(note()).toHaveTextContent(FINDING_NOTICE.message)
    setNotice(null)
    expect(note()).toHaveTextContent(KEY_CLEAN_NOTE)

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(holdNotices.mock.calls).toEqual([[true], [false]])
  })

  it('lets the notices go when the rail goes with the panel open', () => {
    const { holdNotices } = mount()
    openPanel()

    cleanup()

    expect(holdNotices.mock.calls).toEqual([[true], [false]])
  })

  it('closes on a press outside, without moving the key', () => {
    const { onChange } = mount()
    openPanel()

    fireEvent.pointerDown(screen.getByText('Lyrics'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('takes Escape for itself and hands focus back to the chip', () => {
    mount()
    openPanel()

    const unclaimed = fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(unclaimed).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip()).toHaveFocus()
  })

  it('returns to the chip when Tab runs off the end of the panel', () => {
    mount({ value: 1 })
    openPanel()
    const find = screen.getByRole('button', { name: 'Find my key' })
    find.focus()

    fireEvent.keyDown(find, { key: 'Tab' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip()).toHaveFocus()
  })
})
