// Drum Night session view tests — semantic score, kit evidence, and state truth.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumCapturedHit } from './drum-coaching'
import type { DrumSessionImportState } from './drum-session'
import { drumSongFixture, percussionTrackFixture, readySessionFixture, } from './drum-session.test-fixtures'
import { DrummerSeatView } from './DrummerSeatView'
import { DrumScoreSheet } from './DrumScoreSheet'
import { DrumSessionCoach } from './DrumSessionCoach'
import { drumSessionStateCopy, DrumSessionStateView, } from './DrumSessionStateView'

afterEach(cleanup)

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
  it('separates the authored playhead target from current live input', () => {
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

    expect(
      screen.getByRole('img', { name: /Top-down drum kit/i }),
    ).toBeVisible()
    // SVG kit regions are descriptive shapes, so their explicit data contract
    // is the only stable way to inspect target/live visual state in jsdom.
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
    const targetOutline = kick?.querySelector(
      '[data-visual-layer="authored-target"] ellipse',
    )
    const liveOutline = kick?.querySelector(
      '[data-visual-layer="live-input"] ellipse',
    )
    expect(targetOutline).not.toHaveAttribute(
      'rx',
      liveOutline?.getAttribute('rx') ?? '',
    )
    expect(
      screen.getByLabelText('Scrollable drummer-seat kit'),
    ).toHaveAttribute('tabindex', '0')
    expect(
      screen.getByText(
        'Authored now: Bass Drum 1. Live now: Bass Drum 1, Acoustic Snare.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Next: Acoustic Snare, bar 1')).toBeVisible()
    const liveRegions = view.container.querySelectorAll('[aria-live="polite"]')
    expect(liveRegions).toHaveLength(1)
    expect(liveRegions[0]).toHaveTextContent('Bar 1')
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
    expect(screen.getByText(/Authored now: Bass Drum 1/)).toBeVisible()
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

    expect(
      screen.getByText(
        '2 simultaneous mapped hits exceed this kit-highlight limit. The canonical session is unchanged.',
      ),
    ).toBeVisible()
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
