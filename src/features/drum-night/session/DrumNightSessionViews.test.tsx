// Drum Night session view tests — semantic score, kit evidence, and state truth.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumCapturedHit } from './drum-coaching'
import type { DrumSessionImportState } from './drum-session'
import { drumSongFixture, percussionTrackFixture, readySessionFixture, } from './drum-session.test-fixtures'
import { DrummerSeatView } from './DrummerSeatView'
import { DrumScoreSheet } from './DrumScoreSheet'
import { DrumSessionCoach } from './DrumSessionCoach'
import { drumSessionStateCopy, DrumSessionStateView, } from './DrumSessionStateView'
import { createFirstPocketGroove } from './prepared-grooves'

let restoreClientWidth: (() => void) | undefined

afterEach(() => {
  cleanup()
  restoreClientWidth?.()
  restoreClientWidth = undefined
  vi.unstubAllGlobals()
})

function setElementClientWidth(width: number): void {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientWidth',
  )
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  restoreClientWidth = () => {
    if (original === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
      return
    }
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', original)
  }
}

function dispatchSeatPointerDown(
  target: Element,
  init: {
    readonly button: number
    readonly isPrimary: boolean
    readonly pressure: number
  },
): void {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: init.button },
    isPrimary: { value: init.isPrimary },
    pressure: { value: init.pressure },
  })
  fireEvent(target, event)
}

describe('Drum session state views', () => {
  it.each([
    [
      { status: 'idle' } as const,
      'No drum part loaded',
      'Bring a MIDI or Guitar Pro file',
    ],
    [
      { status: 'loading', fileName: 'pocket.gpx' } as const,
      'Reading pocket.gpx',
      'Keeping tempo, meter, articulation, and velocity together',
    ],
    [
      { status: 'empty', fileName: 'empty.mid' } as const,
      'This file is empty',
      'Export the part again',
    ],
    [
      {
        status: 'too-large',
        fileName: 'huge.gpx',
        actualBytes: 21 * 1024 * 1024,
        maximumBytes: 20 * 1024 * 1024,
      } as const,
      'This file is too large to open safely',
      'Choose a file smaller than 20 MB',
    ],
    [
      {
        status: 'unsupported',
        fileName: 'vendor.mid',
        reason: 'drum-mapping',
        droppedHitCount: 2,
      } as const,
      'No safely mapped drum hits',
      'will not guess a substitute sound',
    ],
    [
      {
        status: 'no-drums',
        fileName: 'lead.mid',
        pitchedTrackCount: 2,
      } as const,
      'No drum track in this file',
      '2 pitched parts were found',
    ],
    [
      {
        status: 'error',
        fileName: 'broken.gp5',
        message: 'Export it again and retry.',
      } as const,
      'The drum part could not be opened',
      'Export it again and retry',
    ],
  ])(
    'explains %s without claiming a playable session',
    (state, title, detail) => {
      render(() => (
        <DrumSessionStateView
          state={() => state as DrumSessionImportState}
          context="score"
        />
      ))

      expect(screen.getByRole('heading', { name: title })).toBeVisible()
      expect(screen.getByText(new RegExp(detail))).toBeVisible()
    },
  )

  it('does not provide empty-state copy for a ready document', () => {
    expect(drumSessionStateCopy(readySessionFixture())).toBeNull()
  })
})

describe('DrumScoreSheet', () => {
  it.each([
    { viewportWidth: 920, expectedCanvasWidth: 920 },
    { viewportWidth: 360, expectedCanvasWidth: 480 },
  ])(
    'fits two bars to a $viewportWidth px viewport while preserving a readable minimum',
    ({ viewportWidth, expectedCanvasWidth }) => {
      vi.stubGlobal('ResizeObserver', undefined)
      setElementClientWidth(viewportWidth)
      const groove = createFirstPocketGroove('source')
      const session = {
        status: 'ready',
        document: groove.document,
      } as const

      render(() => (
        <DrumScoreSheet
          session={() => session}
          playheadBeat={() => 0}
          visibleBarCount={() => 4}
        />
      ))

      expect(screen.getByRole('img')).toHaveAttribute(
        'width',
        String(expectedCanvasWidth),
      )
      expect(screen.getByRole('img')).toHaveAttribute(
        'viewBox',
        `0 0 ${expectedCanvasWidth} 244`,
      )
      expect(screen.getByRole('img')).toHaveAttribute(
        'preserveAspectRatio',
        'none',
      )
    },
  )

  it('keeps percussion notation semantic and horizontally contained at phone width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    const session = readySessionFixture()

    const view = render(() => (
      <DrumScoreSheet session={() => session} playheadBeat={() => 1} />
    ))

    expect(
      screen.getByRole('img', { name: /Midnight Pocket.*4 indexed authored/i }),
    ).toBeVisible()
    const viewport = screen.getByLabelText('Windowed percussion score')
    expect(viewport).toHaveAttribute('tabindex', '0')
    expect(viewport.querySelector('svg')).toHaveAttribute('viewBox')
    expect(screen.getByText('Now: Acoustic Snare')).toBeVisible()
    expect(
      screen.getByText('Read this score window as an event list'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Acoustic Snare, bar 1, quarter-note position 2, velocity 108/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /play|pause|stop/i }),
    ).not.toBeInTheDocument()
    const liveRegions = view.container.querySelectorAll('[aria-live="polite"]')
    expect(liveRegions).toHaveLength(1)
    expect(liveRegions[0]).toHaveTextContent('Bar 1')
  })

  it('renders the next page as a dimmed look-ahead row and hides it on the last page', () => {
    // 24 quarter-note beats of snares = 6 bars in 4/4: two 4-bar pages.
    const hits = Array.from({ length: 24 }, (_, beat) => ({
      id: `snare-${beat}`,
      gmKey: 38,
      startBeat: beat,
      velocity: 100,
    }))
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [percussionTrackFixture({ hits })],
      }),
    })

    const firstPage = render(() => (
      <DrumScoreSheet
        session={() => session}
        playheadBeat={() => 0}
        visibleBarCount={() => 4}
      />
    ))
    const preview = screen.getByTestId('drum-score-next-window')
    expect(preview).toHaveAttribute('aria-hidden', 'true')
    expect(preview).toHaveTextContent('Up next · bars 5–6')
    expect(preview.querySelectorAll('[data-gm-key]').length).toBeGreaterThan(0)
    firstPage.unmount()

    render(() => (
      <DrumScoreSheet
        session={() => session}
        playheadBeat={() => 17}
        visibleBarCount={() => 4}
      />
    ))
    expect(screen.queryByTestId('drum-score-next-window')).toBeNull()
  })

  it('projects a pending A mark with one-based, read-only score context', () => {
    const session = readySessionFixture()
    const view = render(() => (
      <DrumScoreSheet
        session={() => session}
        playheadBeat={() => 0}
        markA={() => 0}
        markB={() => null}
      />
    ))

    const context = screen.getByRole('status', {
      name: 'Practice loop in score',
    })
    expect(context).toHaveAttribute('data-state', 'pending')
    expect(context).toHaveTextContent('A · Beat 1')
    expect(context).toHaveTextContent(
      'Set B on the song timeline to finish the loop.',
    )
    expect(
      view.container.querySelector(
        '[data-testid="drum-score-loop-boundary-a"] path',
      ),
    ).toHaveAttribute('d', 'M64 42V194')
    expect(
      view.container.querySelector(
        '[data-testid="drum-score-loop-boundary-a"] text',
      ),
    ).toHaveTextContent('A')
    expect(
      view.container.querySelector('[data-testid="drum-score-loop-region"]'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /A and B project the read-only practice loop from the song timeline/i,
    )
  })

  it('clips a half-open loop across score windows, keeps song-end B on the edge, and clears reactively', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    setElementClientWidth(480)
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              {
                id: 'opening',
                gmKey: 36,
                startBeat: 0,
                velocity: 100,
                writtenDuration: 0.25,
              },
              {
                id: 'song-end',
                gmKey: 38,
                startBeat: 15.75,
                velocity: 108,
                writtenDuration: 0.25,
              },
            ],
          }),
        ],
      }),
    })
    const [playheadBeat, setPlayheadBeat] = createSignal(4)
    const [markA, setMarkA] = createSignal<number | null>(4)
    const [markB, setMarkB] = createSignal<number | null>(16)
    const view = render(() => (
      <DrumScoreSheet
        session={() => session}
        playheadBeat={playheadBeat}
        visibleBarCount={() => 2}
        markA={markA}
        markB={markB}
      />
    ))

    const firstWindowRegion = screen.getByTestId('drum-score-loop-region')
    expect(firstWindowRegion).toHaveAttribute('x', '240')
    expect(firstWindowRegion).toHaveAttribute('width', '176')
    expect(firstWindowRegion).toHaveAttribute('data-clipped-start', 'false')
    expect(firstWindowRegion).toHaveAttribute('data-clipped-end', 'true')
    expect(
      view.container.querySelector(
        '[data-testid="drum-score-loop-boundary-a"]',
      ),
    ).toBeInTheDocument()
    expect(
      view.container.querySelector(
        '[data-testid="drum-score-loop-boundary-b"]',
      ),
    ).not.toBeInTheDocument()

    setPlayheadBeat(8)

    const finalWindowRegion = screen.getByTestId('drum-score-loop-region')
    expect(finalWindowRegion).toHaveAttribute('x', '64')
    expect(finalWindowRegion).toHaveAttribute('width', '352')
    expect(finalWindowRegion).toHaveAttribute('data-clipped-start', 'true')
    expect(finalWindowRegion).toHaveAttribute('data-clipped-end', 'false')
    expect(
      view.container.querySelector(
        '[data-testid="drum-score-loop-boundary-a"]',
      ),
    ).not.toBeInTheDocument()
    expect(
      view.container.querySelector(
        '[data-testid="drum-score-loop-boundary-b"] path',
      ),
    ).toHaveAttribute('d', 'M416 42V194')
    const context = screen.getByRole('status', {
      name: 'Practice loop in score',
    })
    expect(context).toHaveAttribute('data-state', 'active')
    expect(context).toHaveTextContent('A · Beat 5 → B · Beat 17')
    expect(context).toHaveTextContent(
      'Read-only in Score; adjust it on the song timeline.',
    )

    setMarkA(null)
    setMarkB(null)

    expect(
      screen.queryByRole('status', { name: 'Practice loop in score' }),
    ).not.toBeInTheDocument()
    expect(
      view.container.querySelector('[data-testid="drum-score-loop-region"]'),
    ).not.toBeInTheDocument()
    expect(
      view.container.querySelector(
        '[data-testid^="drum-score-loop-boundary-"]',
      ),
    ).not.toBeInTheDocument()
  })

  it('discloses source events that could not be mapped without hiding retained hits', () => {
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [percussionTrackFixture({ droppedHitCount: 2 })],
      }),
    })

    render(() => (
      <DrumScoreSheet session={() => session} playheadBeat={() => 0} />
    ))

    expect(screen.getByText(/4 mapped hits/)).toBeVisible()
    expect(
      screen.getByText(
        '2 unsupported source events were reported but not mapped, drawn, or substituted.',
      ),
    ).toBeVisible()
  })

  it('labels quarter-note position, opening tempo, GP source evidence, and written duration', () => {
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            {
              id: 'gp-open-hat',
              gmKey: 46,
              startBeat: 1,
              velocity: 101,
              writtenDuration: 0.5,
              source: {
                format: 'guitar-pro',
                midiKey: 114,
                articulationId: 23,
                articulationIndex: 4,
                label: 'Authored open hat',
              },
            },
          ],
        }),
      ],
    })
    song.timeSignatures = [{ beat: 0, numerator: 6, denominator: 8 }]
    song.tempoChanges = [
      { beat: 0, usPerBeat: 500_000 },
      { beat: 1, usPerBeat: 600_000 },
    ]
    const session = readySessionFixture({ song })

    render(() => (
      <DrumScoreSheet session={() => session} playheadBeat={() => 1} />
    ))

    expect(
      screen.getByText(
        /1 mapped hits · authored attack span 1.50 quarter-note beats/,
      ),
    ).toHaveTextContent('120 BPM opening · 1 tempo change')
    expect(
      screen.getByRole('list', { name: 'Meter in displayed score' }),
    ).toHaveTextContent('Bar 1 · 6/8')
    expect(
      screen.getByText(
        /quarter-note position 2, velocity 101, written duration 0.5 quarter-note beats, Guitar Pro label Authored open hat, articulation 23, table index 4, source value 114/,
      ),
    ).toBeInTheDocument()
  })

  it('shows 6/8 and 3/4 as distinct visible and semantic meter', () => {
    const renderMeter = (numerator: number, denominator: number) => {
      const song = drumSongFixture()
      song.timeSignatures = [{ beat: 0, numerator, denominator }]
      const session = readySessionFixture({ song })
      return render(() => (
        <DrumScoreSheet session={() => session} playheadBeat={() => 0} />
      ))
    }

    const sixEight = renderMeter(6, 8)
    expect(
      screen.getByRole('list', { name: 'Meter in displayed score' }),
    ).toHaveTextContent('Bar 1 · 6/8')
    expect(
      [...sixEight.container.querySelectorAll('svg text')].some(
        (node) => node.textContent === '6/8',
      ),
    ).toBe(true)

    cleanup()
    const threeFour = renderMeter(3, 4)
    expect(
      screen.getByRole('list', { name: 'Meter in displayed score' }),
    ).toHaveTextContent('Bar 1 · 3/4')
    expect(
      [...threeFour.container.querySelectorAll('svg text')].some(
        (node) => node.textContent === '3/4',
      ),
    ).toBe(true)
  })

  it('marks the first displayed meter and an authored 4/4 to 7/8 change', () => {
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            { id: 'opening', gmKey: 36, startBeat: 0, velocity: 90 },
            { id: 'change', gmKey: 38, startBeat: 4, velocity: 96 },
          ],
        }),
      ],
    })
    song.timeSignatures = [
      { beat: 0, numerator: 4, denominator: 4 },
      { beat: 4, numerator: 7, denominator: 8 },
    ]
    const session = readySessionFixture({ song })
    const view = render(() => (
      <DrumScoreSheet session={() => session} playheadBeat={() => 0} />
    ))

    const summary = screen.getByRole('list', {
      name: 'Meter in displayed score',
    })
    expect(summary).toHaveTextContent('Bar 1 · 4/4')
    expect(summary).toHaveTextContent('Bar 2 · 7/8')
    const visibleMeter = [...view.container.querySelectorAll('svg text')].map(
      (node) => node.textContent,
    )
    expect(visibleMeter).toContain('4/4')
    expect(visibleMeter).toContain('7/8')
    expect(screen.getByRole('img')).toHaveAccessibleName(/bar 2: 7\/8/i)
  })

  it('renders a valid late score window after more than 2048 opening hits', () => {
    const earlyHits = Array.from({ length: 2050 }, (_, index) => ({
      id: `early-${index}`,
      gmKey: 38,
      startBeat: index / 1000,
      velocity: 80,
    }))
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              ...earlyHits,
              { id: 'late-kick', gmKey: 36, startBeat: 12_000, velocity: 111 },
            ],
          }),
        ],
      }),
    })
    const view = render(() => (
      <DrumScoreSheet
        session={() => session}
        playheadBeat={() => 12_000}
        visibleBarCount={() => 2}
      />
    ))

    expect(screen.getByText('Now: Bass Drum 1')).toBeVisible()
    expect(screen.getByRole('img')).toHaveAccessibleName(/Bars 3001 through/)
    expect(
      view.container.querySelector('[data-gm-key="36"]'),
    ).toBeInTheDocument()
  })

  it('discloses score-index and bar-range omissions instead of moving late hits', () => {
    const hits = Array.from({ length: 2050 }, (_, index) => ({
      id: `dense-${index}`,
      gmKey: 38,
      startBeat: index / 1000,
      velocity: 90,
    }))
    hits.push({
      id: 'beyond-bars',
      gmKey: 36,
      startBeat: 20_000,
      velocity: 100,
    })
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [percussionTrackFixture({ hits })],
      }),
    })

    const view = render(() => (
      <DrumScoreSheet
        session={() => session}
        playheadBeat={() => 0}
        visibleBarCount={() => 2}
      />
    ))

    expect(
      screen.getByText(
        /2 mapped hits in these bars are outside the 2048-event display limit/,
      ),
    ).toBeVisible()
    expect(
      screen.getByText(/1 hit falls beyond the 4,096-bar safety range/),
    ).toBeVisible()
    expect(screen.getByText(/None were moved into the last bar/)).toBeVisible()
    expect(screen.getByRole('img', { name: /Bars 1 through 2/ })).toBeVisible()
    expect(view.container.querySelectorAll('[data-gm-key]')).toHaveLength(2048)
  })
})

describe('DrummerSeatView', () => {
  it('keeps all six photographed kit surfaces playable without an imported part', () => {
    const onStrike = vi.fn()
    render(() => (
      <DrummerSeatView
        session={() => ({ status: 'idle' })}
        playheadBeat={() => 0}
        onStrike={onStrike}
      />
    ))

    expect(
      screen.getByRole('heading', { name: 'Playable drummer’s seat' }),
    ).toBeInTheDocument()
    const kit = screen.getByRole('group', {
      name: 'Playable photographed drum kit',
    })
    const pads = Array.from(kit.querySelectorAll('button'))
    expect(pads).toHaveLength(6)
    expect(pads.map((pad) => pad.getAttribute('data-pad'))).toEqual([
      'hi-hat',
      'snare',
      'kick',
      'tom',
      'ride',
      'crash',
    ])
    expect(pads.every((pad) => pad.getAttribute('tabindex') !== '-1')).toBe(
      true,
    )
    expect(screen.getByText('No authored part · free play')).toBeVisible()
    expect(screen.queryByText('No drum part loaded')).not.toBeInTheDocument()
  })

  it('filters pointer input and preserves pressure as bounded kit velocity', () => {
    const onStrike = vi.fn()
    render(() => (
      <DrummerSeatView
        session={() => ({ status: 'idle' })}
        playheadBeat={() => 0}
        onStrike={onStrike}
      />
    ))
    const snare = screen.getByRole('button', {
      name: 'Play Acoustic snare',
    })

    dispatchSeatPointerDown(snare, {
      button: 2,
      isPrimary: true,
      pressure: 0.25,
    })
    dispatchSeatPointerDown(snare, {
      button: 0,
      isPrimary: false,
      pressure: 0.25,
    })
    expect(onStrike).not.toHaveBeenCalled()

    dispatchSeatPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.25,
    })
    expect(onStrike).toHaveBeenCalledOnce()
    expect(onStrike).toHaveBeenLastCalledWith('snare', 68)

    dispatchSeatPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0,
    })
    expect(onStrike).toHaveBeenLastCalledWith('snare', 105)
  })

  it('fires once for each native Enter or Space button activation', () => {
    const onStrike = vi.fn()
    render(() => (
      <DrummerSeatView
        session={() => ({ status: 'idle' })}
        playheadBeat={() => 0}
        onStrike={onStrike}
      />
    ))
    const kick = screen.getByRole('button', { name: 'Play Bass drum' })

    fireEvent.keyDown(kick, { key: 'Enter', code: 'Enter' })
    fireEvent.click(kick, { detail: 0 })
    fireEvent.keyUp(kick, { key: 'Enter', code: 'Enter' })
    expect(onStrike).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(kick, { key: ' ', code: 'Space' })
    fireEvent.keyUp(kick, { key: ' ', code: 'Space' })
    fireEvent.click(kick, { detail: 0 })
    expect(onStrike).toHaveBeenCalledTimes(2)
    expect(onStrike).toHaveBeenNthCalledWith(1, 'kick', 100)
    expect(onStrike).toHaveBeenNthCalledWith(2, 'kick', 100)
  })

  it('keeps authored-target and live-hit evidence on the same hit surfaces', () => {
    const session = readySessionFixture()
    const view = render(() => (
      <DrummerSeatView
        session={() => session}
        playheadBeat={() => 0}
        liveHits={() => [
          { gmKey: 36, velocity: 96 },
          { gmKey: 38, velocity: 91 },
        ]}
      />
    ))

    const kick = view.container.querySelector('[data-kit-anchor="kick"]')
    const snare = view.container.querySelector('[data-kit-anchor="snare"]')
    expect(kick).toHaveAttribute('data-target-active', 'true')
    expect(kick).toHaveAttribute('data-live-active', 'true')
    expect(snare).toHaveAttribute('data-target-active', 'false')
    expect(snare).toHaveAttribute('data-live-active', 'true')
    expect(
      kick?.querySelector('[data-visual-layer="authored-target"]'),
    ).toBeInTheDocument()
    expect(
      kick?.querySelector('[data-visual-layer="live-input"]'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Target Bass Drum 1 · Live Bass Drum 1, Acoustic Snare'),
    ).toBeVisible()
    expect(screen.getByText('Next Acoustic Snare · bar 1')).toBeVisible()
    expect(view.container.querySelectorAll('[aria-live]')).toHaveLength(0)
  })

  it('illuminates a late authored target without scanning an opening prefix', () => {
    const earlyHits = Array.from({ length: 2050 }, (_, index) => ({
      id: `early-${index}`,
      gmKey: 38,
      startBeat: index / 1000,
      velocity: 80,
    }))
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              ...earlyHits,
              { id: 'late-kick', gmKey: 36, startBeat: 12_000, velocity: 111 },
            ],
          }),
        ],
      }),
    })
    const view = render(() => (
      <DrummerSeatView session={() => session} playheadBeat={() => 12_000} />
    ))

    expect(
      view.container.querySelector('[data-kit-anchor="kick"]'),
    ).toHaveAttribute('data-target-active', 'true')
    expect(screen.getByText(/Target Bass Drum 1/)).toBeVisible()
  })

  it('discloses a locally capped simultaneous kit highlight', () => {
    const session = readySessionFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: Array.from({ length: 2050 }, (_, index) => ({
              id: `flam-${index}`,
              gmKey: index % 2 === 0 ? 36 : 38,
              startBeat: 0,
              velocity: 90,
            })),
          }),
        ],
      }),
    })

    render(() => (
      <DrummerSeatView session={() => session} playheadBeat={() => 0} />
    ))

    expect(screen.getByText('+2 simultaneous authored hits')).toBeVisible()
  })
})

describe('DrumSessionCoach', () => {
  it('hands a measured recovery loop to the owning transport boundary', () => {
    const session = readySessionFixture()
    const onRequestRecoveryLoop = vi.fn()
    const capturedHits: DrumCapturedHit[] = [
      {
        id: 'snare-1',
        source: 'midi',
        gmKey: 38,
        beat: 1.1,
        velocity: 110,
      },
      {
        id: 'snare-2',
        source: 'midi',
        gmKey: 38,
        beat: 2.08,
        velocity: 106,
      },
    ]
    render(() => (
      <DrumSessionCoach
        session={() => session}
        playheadBeat={() => 2.08}
        capturedHits={() => capturedHits}
        onRequestRecoveryLoop={onRequestRecoveryLoop}
      />
    ))

    expect(
      screen.getByText('Matched attacks landed about 45 ms late.'),
    ).toBeVisible()
    expect(
      screen.getByText('E-kit MIDI · mapped timing and velocity'),
    ).toBeVisible()
    expect(screen.getByText('High-confidence evidence')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Set recovery loop to bar 1',
      }),
    )
    expect(onRequestRecoveryLoop).toHaveBeenCalledWith(
      expect.objectContaining({ startBeat: 0, endBeat: 4, focus: 'timing' }),
    )
  })

  it('labels room-microphone coaching as timing-only', () => {
    const session = readySessionFixture()
    const capturedHits: DrumCapturedHit[] = [
      {
        id: 'mic-kick',
        source: 'room-mic',
        beat: 0.02,
        confidence: 0.9,
        timingUncertaintyMs: 18,
      },
      {
        id: 'mic-snare',
        source: 'room-mic',
        beat: 1.02,
        confidence: 0.88,
        timingUncertaintyMs: 18,
      },
    ]
    render(() => (
      <DrumSessionCoach
        session={() => session}
        playheadBeat={() => 1}
        capturedHits={() => capturedHits}
      />
    ))

    expect(screen.getByText('Room mic · onset timing only')).toBeVisible()
    expect(screen.getByText('Not measured by this input')).toBeVisible()
    expect(
      screen.getByText(/No limb, sticking, grip, or acoustic-kit identity/),
    ).toBeVisible()
  })
})
