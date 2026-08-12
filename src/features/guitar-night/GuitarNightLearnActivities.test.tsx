// Guitar Night Learn activity tests protect silent entry and active-tuning rendering.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { instrumentTuningFromSource, standardTuning, } from '@/lib/guitar/instrument-tuning'
import { GuitarNightEchoPhrase } from './GuitarNightEchoPhrase'
import { GuitarNightHearAndFind } from './GuitarNightHearAndFind'
import { GuitarNightShapeWalk } from './GuitarNightShapeWalk'

describe('Guitar Night Learn activities', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders Hear & Find from a five-string bass without opening audio', () => {
    const audioContext = vi.fn()
    vi.stubGlobal('AudioContext', audioContext)
    render(() => (
      <GuitarNightHearAndFind
        tuning={() => standardTuning('bass', 5)}
        active={() => true}
        onBack={vi.fn()}
      />
    ))

    const room = screen.getByTestId('guitar-night-hear-find')
    expect(
      within(room).getByRole('heading', { name: 'Find that sound.' }),
    ).toHaveFocus()
    expect(room.querySelectorAll('button[data-midi]')).toHaveLength(20)
    fireEvent.click(
      room.querySelector<HTMLButtonElement>(
        'button[data-string-index="0"][data-fret="0"]',
      )!,
    )
    expect(within(room).getByRole('status')).toHaveTextContent(
      'Hear the reference first',
    )
    expect(audioContext).not.toHaveBeenCalled()
  })

  it('keeps Echo a Phrase silent and bounded on a four-string bass', () => {
    render(() => (
      <GuitarNightEchoPhrase
        tuning={() => standardTuning('bass')}
        active={() => true}
        onBack={vi.fn()}
      />
    ))

    const room = screen.getByTestId('guitar-night-echo-phrase')
    expect(within(room).getByRole('heading')).toHaveTextContent('Echo 3 notes')
    expect(room.querySelectorAll('button[data-midi]')).toHaveLength(24)
    expect(
      within(room).getByRole('button', { name: /Hear the phrase/ }),
    ).toBeVisible()
    expect(
      within(room).queryByRole('button', { name: /Start listening/ }),
    ).not.toBeInTheDocument()
  })

  it('states why Shape Walk is unavailable for alternate string intervals', () => {
    const dropD = instrumentTuningFromSource(
      'guitar',
      [64, 59, 55, 50, 45, 38],
      { name: 'Drop D' },
    )!
    render(() => (
      <GuitarNightShapeWalk
        tuning={() => dropD}
        active={() => true}
        onBack={vi.fn()}
      />
    ))

    const room = screen.getByTestId('guitar-night-shape-walk')
    expect(room).toHaveTextContent(
      'Shape Walk needs a six-string guitar with standard string intervals',
    )
    expect(room.querySelector('button[data-midi]')).toBeNull()
    expect(
      within(room).queryByRole('button', { name: /Hear this shape/ }),
    ).not.toBeInTheDocument()
  })
})
