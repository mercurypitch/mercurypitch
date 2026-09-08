// Session settings tests cover opt-in defaults, independent persistence and honest preview status.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, expect, it } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarChordSettings } from './GuitarChordSettings'
import { useGuitarChordSettings } from './useGuitarChordSettings'
import { useGuitarLiveChords } from './useGuitarLiveChords'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function mount() {
  return render(() => {
    const settings = useGuitarChordSettings()
    const live = useGuitarLiveChords({
      enabled: () => false,
      recording: () => false,
      tuning: () => DEFAULT_GUITAR_TUNING,
      listening: {
        status: () => 'off',
        inputProfile: () => 'interface',
        recordingInput: () => null,
      },
    })
    return (
      <GuitarChordSettings
        settings={settings}
        live={live}
        liveAvailable={true}
      />
    )
  })
}

it('persists independent Live and after-Stop switches with conservative defaults', () => {
  const first = mount()
  const live = screen.getByRole('switch', { name: 'Live chords' })
  const after = screen.getByRole('switch', { name: 'Refine after Stop' })
  expect(live).not.toBeChecked()
  expect(after).toBeChecked()
  fireEvent.click(live)
  expect(live).toBeChecked()
  expect(after).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent('Turn on Listening')
  fireEvent.click(after)
  expect(after).not.toBeChecked()
  first.unmount()
  mount()
  expect(screen.getByRole('switch', { name: 'Live chords' })).toBeChecked()
  expect(
    screen.getByRole('switch', { name: 'Refine after Stop' }),
  ).not.toBeChecked()
})

it('rejects malformed stored preferences', () => {
  localStorage.setItem('guitar-live-chords-v1', '"yes"')
  localStorage.setItem('guitar-chords-after-stop-v1', '4')
  mount()
  expect(screen.getByRole('switch', { name: 'Live chords' })).not.toBeChecked()
  expect(
    screen.getByRole('switch', { name: 'Refine after Stop' }),
  ).toBeChecked()
})
