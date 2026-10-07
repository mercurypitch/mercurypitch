// ============================================================
// KaraokeMoreSheet: the phone stage's options
// ============================================================
//
// The phone stage had no speed and no loop at all (owner decision 1, 2
// October 2026: both behind one More button). The rules are the desktop
// capsule's: B goes at least 0.1 s after A, and the loop switch stays off
// until A and B make a loop. A refused point says why inside the sheet,
// where the singer is looking, not in a toast over it.
//
// Text size and the notes over the lyrics came in from the header after
// (owner, 2 October 2026), grouped the way the room's options group them:
// Lyrics (text size, the notes), then Playing (autoplay, speed, the loop).
// The notes row is there only for a song that has its notes, as in the
// room: absent, never dead.
//
// The binding below places points with the mixer's own rule
// (placeLoopPoint), at a playhead the test moves, the way StemMixer wires
// it.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KaraokeMoreBinding, KaraokeMoreLyrics, } from '@/components/mobile/KaraokeMoreSheet'
import { KaraokeMoreSheet } from '@/components/mobile/KaraokeMoreSheet'
import { placeLoopPoint } from '@/features/stem-mixer/loop-points'

afterEach(cleanup)

const SIZES = [
  { value: 'smaller', label: 'Small' },
  { value: 'current', label: 'Medium' },
  { value: 'bigger', label: 'Large' },
] as const

function mountSheet(
  opts: { autoplay?: boolean; noLoop?: boolean; hasNotes?: boolean } = {},
) {
  const [size, setSize] = createSignal<string>('current')
  const [hasNotes, setHasNotes] = createSignal(opts.hasNotes === true)
  const [notesOn, setNotesOn] = createSignal(false)
  const lyrics: KaraokeMoreLyrics = {
    sizes: SIZES.map((choice) => ({
      label: choice.label,
      chosen: () => size() === choice.value,
      choose: () => setSize(choice.value),
    })),
    notes: {
      has: hasNotes,
      on: notesOn,
      toggle: () => setNotesOn((on) => !on),
    },
  }
  const [speed, setSpeed] = createSignal(1)
  const [start, setStart] = createSignal<number | null>(null)
  const [end, setEnd] = createSignal<number | null>(null)
  const [loopOn, setLoopOn] = createSignal(false)
  const [playhead, setPlayhead] = createSignal(0)
  const [autoplayOn, setAutoplayOn] = createSignal(false)
  const binding: KaraokeMoreBinding = {
    speed,
    onSpeed: setSpeed,
    loopStart: start,
    loopEnd: end,
    loopOn,
    onSetPoint: (which) => {
      const result = placeLoopPoint(which, playhead(), {
        start: start(),
        end: end(),
      })
      if (!result.placed) return result.reason
      setStart(result.points.start)
      setEnd(result.points.end)
      // Setting B turns the loop on, as the audio controller does.
      if (which === 'B') setLoopOn(true)
      return null
    },
    onToggleLoop: () => setLoopOn((on) => !on),
    onClearLoop: () => {
      setStart(null)
      setEnd(null)
      setLoopOn(false)
    },
  }
  const close = vi.fn()
  render(() => (
    <KaraokeMoreSheet
      isOpen
      close={close}
      lyrics={lyrics}
      binding={opts.noLoop === true ? undefined : binding}
      autoplay={
        opts.autoplay === true
          ? { on: autoplayOn, toggle: () => setAutoplayOn((on) => !on) }
          : undefined
      }
    />
  ))
  return {
    speed,
    start,
    end,
    setStart,
    setEnd,
    loopOn,
    setPlayhead,
    autoplayOn,
    size,
    setHasNotes,
    notesOn,
  }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const loopSwitch = () => screen.getByRole('switch', { name: 'Loop A to B' })
const status = () => screen.getByTestId('karaoke-more-loop-status').textContent

describe('the speed', () => {
  it('offers 0.5x to 2x and plays at the one chosen', () => {
    const { speed } = mountSheet()
    const speeds = screen
      .getAllByRole('radio')
      .map((radio) => radio.textContent?.trim())

    fireEvent.click(screen.getByRole('radio', { name: '1.5x' }))

    expect(speeds).toEqual([
      '0.5x',
      '0.75x',
      '0.85x',
      '1x',
      '1.2x',
      '1.5x',
      '1.75x',
      '2x',
    ])
    expect(speed()).toBe(1.5)
    expect(
      screen
        .getAllByRole('radio')
        .filter((radio) => radio.getAttribute('aria-checked') === 'true')
        .map((radio) => radio.textContent?.trim()),
    ).toEqual(['1.5x'])
  })
})

describe('the speed, by keyboard', () => {
  it('steps with the arrow keys and keeps one stop in the tab order', () => {
    const { speed } = mountSheet()
    const radio = (name: string) => screen.getByRole('radio', { name })
    const tabStops = () =>
      screen
        .getAllByRole('radio')
        .filter((r) => r.getAttribute('tabindex') === '0')
        .map((r) => r.textContent?.trim())
    const before = tabStops()

    radio('1x').focus()
    fireEvent.keyDown(radio('1x'), { key: 'ArrowRight' })
    const right = [speed(), document.activeElement?.textContent?.trim()]
    fireEvent.keyDown(radio('1.2x'), { key: 'ArrowLeft' })
    fireEvent.keyDown(radio('1x'), { key: 'ArrowLeft' })

    expect([before, right, speed(), tabStops()]).toEqual([
      ['1x'],
      [1.2, '1.2x'],
      0.85,
      ['0.85x'],
    ])
  })
})

describe('the A/B loop', () => {
  it('keeps the loop switch off until A and B make a loop', () => {
    const { setPlayhead, loopOn } = mountSheet()
    const before = loopSwitch().hasAttribute('disabled')

    setPlayhead(4)
    fireEvent.click(button('Set A'))
    const withA = loopSwitch().hasAttribute('disabled')
    setPlayhead(9.5)
    fireEvent.click(button('Set B'))

    expect([before, withA, loopSwitch().hasAttribute('disabled')]).toEqual([
      true,
      true,
      false,
    ])
    expect(loopOn()).toBe(true)
    expect(loopSwitch().getAttribute('aria-checked')).toBe('true')
  })

  it('refuses a B within 0.1 s of A, says why in the sheet, and keeps the loop as it was', () => {
    const { setPlayhead, start, end } = mountSheet()
    setPlayhead(4)
    fireEvent.click(button('Set A'))

    setPlayhead(4.05)
    fireEvent.click(button('Set B'))

    expect([start(), end()]).toEqual([4, null])
    expect(status()).toBe(
      'The loop end (B) has to be at least 0.1 s after its start (A).',
    )
    expect(loopSwitch().hasAttribute('disabled')).toBe(true)
  })

  it('keeps the loop switch off for a span too short to play, however it got there', () => {
    // The sheet's own B goes 0.1 s or more past A; a voice command or a
    // dragged marker can leave less.
    const { setStart, setEnd } = mountSheet()
    setStart(5)

    setEnd(5.05)
    expect(loopSwitch().hasAttribute('disabled')).toBe(true)

    setEnd(5.2)
    expect(loopSwitch().hasAttribute('disabled')).toBe(false)
  })

  it('drops the refusal once a point is placed', () => {
    const { setPlayhead } = mountSheet()
    setPlayhead(4)
    fireEvent.click(button('Set A'))
    fireEvent.click(button('Set B'))
    const refused = status()

    setPlayhead(6)
    fireEvent.click(button('Set B'))

    expect([refused !== '', status()]).toEqual([true, ''])
  })

  it('shows where A and B are, to the tenth of a second', () => {
    const { setPlayhead } = mountSheet()
    const before = [
      screen.getByTestId('karaoke-more-point-a').textContent,
      screen.getByTestId('karaoke-more-point-b').textContent,
    ]

    setPlayhead(12.34)
    fireEvent.click(button('Set A'))
    setPlayhead(75)
    fireEvent.click(button('Set B'))

    expect([
      before,
      [
        screen.getByTestId('karaoke-more-point-a').textContent,
        screen.getByTestId('karaoke-more-point-b').textContent,
      ],
    ]).toEqual([
      ['Not set', 'Not set'],
      ['0:12.3', '1:15.0'],
    ])
  })

  it('turns the loop off and on with the switch once it is ready', () => {
    const { setPlayhead, loopOn } = mountSheet()
    setPlayhead(2)
    fireEvent.click(button('Set A'))
    setPlayhead(5)
    fireEvent.click(button('Set B'))
    const states = [loopOn()]

    fireEvent.click(loopSwitch())
    states.push(loopOn())
    fireEvent.click(loopSwitch())
    states.push(loopOn())

    expect(states).toEqual([true, false, true])
  })

  it('clears both points, and has nothing to clear before one is set', () => {
    const { setPlayhead, start, end, loopOn } = mountSheet()
    const clearBefore = button('Clear loop').hasAttribute('disabled')
    setPlayhead(2)
    fireEvent.click(button('Set A'))
    setPlayhead(5)
    fireEvent.click(button('Set B'))

    fireEvent.click(button('Clear loop'))

    expect([clearBefore, start(), end(), loopOn()]).toEqual([
      true,
      null,
      null,
      false,
    ])
    expect(loopSwitch().hasAttribute('disabled')).toBe(true)
  })
})

describe('the next song', () => {
  it('turns autoplay on from its switch where the stage has one', () => {
    const { autoplayOn } = mountSheet({ autoplay: true })
    const sw = screen.getByRole('switch', {
      name: 'Play the next song automatically',
    })

    fireEvent.click(sw)

    expect([autoplayOn(), sw.getAttribute('aria-checked')]).toEqual([
      true,
      'true',
    ])
  })

  it('has no autoplay row where the stage has none', () => {
    mountSheet()

    expect(
      screen.queryAllByRole('switch').map((s) => s.getAttribute('aria-label')),
    ).toEqual(['Loop A to B'])
  })
})

describe('the lyrics', () => {
  it('offers the text sizes the room offers, and marks the one chosen', () => {
    const { size } = mountSheet()
    const sizes = within(screen.getByRole('group', { name: 'Text size' }))
    const pressed = () =>
      sizes
        .getAllByRole('button')
        .map((b) => [b.textContent?.trim(), b.getAttribute('aria-pressed')])
    const before = pressed()

    fireEvent.click(sizes.getByRole('button', { name: 'Large' }))

    expect([before, size(), pressed()]).toEqual([
      [
        ['Small', 'false'],
        ['Medium', 'true'],
        ['Large', 'false'],
      ],
      'bigger',
      [
        ['Small', 'false'],
        ['Medium', 'false'],
        ['Large', 'true'],
      ],
    ])
  })

  it('has a notes row only once the song has its notes, and turns them on', () => {
    const { setHasNotes, notesOn } = mountSheet()
    const switches = () =>
      screen.queryAllByRole('switch').map((s) => s.getAttribute('aria-label'))
    const without = switches()

    setHasNotes(true)
    const withNotes = switches()
    fireEvent.click(
      screen.getByRole('switch', { name: 'Show notes over the lyrics' }),
    )

    expect([without, withNotes, notesOn()]).toEqual([
      ['Loop A to B'],
      ['Show notes over the lyrics', 'Loop A to B'],
      true,
    ])
  })
})

describe('the order of the sheet', () => {
  it('groups the lyrics first, then playing: autoplay, speed and the loop', () => {
    mountSheet({ autoplay: true, hasNotes: true })
    const sheet = screen.getByTestId('karaoke-more-sheet')

    const headings = within(sheet)
      .getAllByRole('heading')
      .map((h) => h.textContent?.trim())
    const controls = [
      ...sheet.querySelectorAll(
        '[role="group"], [role="radiogroup"], [role="switch"]',
      ),
    ].map((el) => el.getAttribute('aria-label'))

    expect([headings, controls]).toEqual([
      ['Lyrics', 'Playing'],
      [
        'Text size',
        'Show notes over the lyrics',
        'Play the next song automatically',
        'Speed',
        'Loop A to B',
      ],
    ])
  })

  it('keeps the lyrics and autoplay where the stage has no speed or loop', () => {
    mountSheet({ autoplay: true, noLoop: true })

    expect(
      [
        ...screen
          .getByTestId('karaoke-more-sheet')
          .querySelectorAll('[role="group"], [role="radiogroup"], button'),
      ].map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim()),
    ).toEqual([
      'Text size',
      'Small',
      'Medium',
      'Large',
      'Play the next song automatically',
    ])
  })
})
