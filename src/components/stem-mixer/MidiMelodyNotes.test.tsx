// ============================================================
// MidiMelodyNotes — the MIDI Melody panel's Notes view
// ============================================================
//
// SheetMusicView engraves with VexFlow, which needs fonts and SVG text
// measurement that jsdom does not have. The stub stands in for it and keeps
// exactly what the Notes view hands it, which is this component's output.

import { cleanup, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShownNote } from '@/lib/vocal-notation'
import { shownNotesToMelody } from '@/lib/vocal-notation'
import type { MelodyItem } from '@/types'
import { MidiMelodyNotes } from './MidiMelodyNotes'

interface SheetProps {
  melody: () => MelodyItem[]
  musicKey: () => string
  scaleType: () => string
  melodyName?: () => string | null
  beatsPerBar?: number
  currentBeat?: () => number
  isPlaying?: () => boolean
  onSeek?: (beat: number) => void
  onMelodyChange?: unknown
  toolbar?: () => JSX.Element
}

const sheet = vi.hoisted(() => ({ props: null as SheetProps | null }))

vi.mock('@/components/SheetMusicView', () => ({
  SheetMusicView: (props: SheetProps) => {
    // eslint-disable-next-line solid/reactivity -- the tests read the live props object, so its getters stay reactive
    sheet.props = props
    const stub = document.createElement('div')
    stub.setAttribute('data-testid', 'sheet-stub')
    // eslint-disable-next-line solid/reactivity -- the stub renders the toolbar once, like a mount
    const toolbar = props.toolbar?.()
    if (toolbar instanceof Node) stub.append(toolbar)
    return stub
  },
}))

const NOTES: ShownNote[] = [
  { id: 'base-0', startBeat: 0.5, endBeat: 1.0, midi: 69 },
  { id: 'base-1', startBeat: 1.0, endBeat: 1.6, midi: 71 },
]

function mount(
  overrides: Partial<{
    notes: readonly ShownNote[]
    bpm: number
    elapsed: number
    onSeek: (seconds: number) => void
  }> = {},
) {
  const [notes, setNotes] = createSignal<readonly ShownNote[]>(
    overrides.notes ?? NOTES,
  )
  const onSeek = overrides.onSeek ?? vi.fn()
  render(() => (
    <MidiMelodyNotes
      notes={notes}
      bpm={() => overrides.bpm ?? 92}
      musicKey={() => 'A'}
      scaleType={() => 'major'}
      title={() => 'Nothing in the Dark'}
      elapsed={() => overrides.elapsed ?? 0}
      playing={() => false}
      onSeek={onSeek}
    />
  ))
  return { setNotes, onSeek }
}

afterEach(() => {
  cleanup()
  sheet.props = null
})

describe('MidiMelodyNotes', () => {
  it('hands the staff the panel melody as notation at the song tempo', async () => {
    mount()

    await screen.findByTestId('sheet-stub')

    expect(sheet.props?.melody()).toEqual(shownNotesToMelody(NOTES, 92))
    expect(sheet.props?.onMelodyChange).toBeUndefined()
    expect(sheet.props?.melodyName?.()).toBe('Nothing in the Dark')
    expect(sheet.props?.beatsPerBar).toBe(4)
  })

  it('says the notes are coming instead of drawing an empty staff', async () => {
    mount({ notes: [] })

    expect(
      screen.getByText(
        'The notes appear here once the pitch analysis has run.',
      ),
    ).toBeInTheDocument()
    await Promise.resolve()
    expect(screen.queryByTestId('sheet-stub')).toBeNull()
  })

  it('names the tempo and metre the bar lines assume', async () => {
    mount()

    const caption = await screen.findByText(/BPM, 4\/4$/)
    expect(caption).toHaveTextContent(/^92 BPM, 4\/4$/)
  })

  it('writes an unknown tempo at 120', async () => {
    mount({ bpm: Number.NaN })

    expect(await screen.findByText('120 BPM, 4/4')).toBeInTheDocument()
    expect(sheet.props?.melody()).toEqual(shownNotesToMelody(NOTES, 120))
  })

  it('puts the cursor where the transport is, in beats', async () => {
    mount({ elapsed: 1.5 })

    await screen.findByTestId('sheet-stub')

    expect(sheet.props?.currentBeat?.()).toBeCloseTo((1.5 * 92) / 60, 9)
  })

  it('seeks the transport to the second a clicked note starts', async () => {
    const onSeek = vi.fn()
    mount({ onSeek })
    await screen.findByTestId('sheet-stub')

    sheet.props?.onSeek?.(2)

    expect(onSeek).toHaveBeenCalledWith((2 * 60) / 92)
  })

  it('follows an edit without remounting the staff', async () => {
    const { setNotes } = mount()
    await screen.findByTestId('sheet-stub')
    const raised = NOTES.map((note) =>
      note.id === 'base-0' ? { ...note, midi: 70 } : note,
    )

    setNotes(raised)

    expect(sheet.props?.melody()).toEqual(shownNotesToMelody(raised, 92))
    const body = screen.getByTestId('stem-mixer-midi-notes')
    expect(body).toHaveAttribute('data-note-count', '2')
    expect(body).toHaveAttribute('data-note-pitches', '70 71')
  })
})
