import { describe, expect, it } from 'vitest'
import type { GuitarNoteNotation } from '@/lib/guitar/guitar-notation'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import type { SheetLane } from './sheet-model'
import { buildSheetPlacement } from './sheet-model'
import type { SheetMetrics, SheetTheme } from './sheet-render'
import { DEFAULT_SHEET_METRICS, layoutSystemLanes } from './sheet-render'
import { noteLabel, tabSheetRenderer } from './sheet-tab-renderer'

const metrics: SheetMetrics = { ...DEFAULT_SHEET_METRICS, width: 800 }

const theme: SheetTheme = {
  staffLine: 'staff',
  barLine: 'bar',
  laneLabel: 'label',
  noteText: 'note',
  noteBackdrop: 'backdrop',
  scoredAccent: 'accent',
  mutedNoteText: 'muted',
}

interface RecordedOp {
  op: string
  args: readonly number[] | readonly string[]
  fillStyle: string
  strokeStyle: string
  textAlign: string
}

function fakeContext(): {
  ctx: CanvasRenderingContext2D
  ops: RecordedOp[]
} {
  const ops: RecordedOp[] = []
  const state = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 0,
  }
  const record = (op: string, ...args: Array<number | string>): void => {
    ops.push({
      op,
      args: args as readonly number[],
      fillStyle: state.fillStyle,
      strokeStyle: state.strokeStyle,
      textAlign: state.textAlign,
    })
  }

  const ctx = {
    get fillStyle(): string {
      return state.fillStyle
    },
    set fillStyle(value: string) {
      state.fillStyle = value
    },
    get strokeStyle(): string {
      return state.strokeStyle
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value
    },
    get font(): string {
      return state.font
    },
    set font(value: string) {
      state.font = value
    },
    get textAlign(): string {
      return state.textAlign
    },
    set textAlign(value: string) {
      state.textAlign = value
    },
    get textBaseline(): string {
      return state.textBaseline
    },
    set textBaseline(value: string) {
      state.textBaseline = value
    },
    get lineWidth(): number {
      return state.lineWidth
    },
    set lineWidth(value: number) {
      state.lineWidth = value
    },
    save: () => record('save'),
    restore: () => record('restore'),
    beginPath: () => record('beginPath'),
    moveTo: (x: number, y: number) => record('moveTo', x, y),
    lineTo: (x: number, y: number) => record('lineTo', x, y),
    stroke: () => record('stroke'),
    fillRect: (x: number, y: number, w: number, h: number) =>
      record('fillRect', x, y, w, h),
    fillText: (text: string, x: number, y: number) =>
      record('fillText', text, x, y),
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops }
}

function note(
  startBeat: number,
  fret: number,
  stringIndex = 0,
  id = `n${startBeat}`,
): GuitarNote {
  return {
    id,
    midi: 64,
    noteName: 'E4',
    stringIndex,
    fret,
    startBeat,
    duration: 1,
    targetFreq: 329.63,
  }
}

function lane(overrides: Partial<SheetLane> = {}): SheetLane {
  return {
    trackId: 'track-1',
    trackName: 'Lead guitar',
    kind: 'authored',
    instrument: 'guitar',
    tuning: DEFAULT_GUITAR_TUNING,
    notes: [],
    outOfRangeNotes: 0,
    ...overrides,
  }
}

function paint(
  lanes: readonly SheetLane[],
  scoredTrackId?: string,
): RecordedOp[] {
  const placement = buildSheetPlacement({
    lanes,
    totalBeats: 8,
    barsPerSystem: 2,
  })
  const layout = layoutSystemLanes(
    lanes,
    metrics,
    tabSheetRenderer,
    scoredTrackId,
  )
  const { ctx, ops } = fakeContext()
  const system = placement.systems[0]
  if (system === undefined) throw new Error('expected a system to paint')
  tabSheetRenderer.paintSystem({
    ctx,
    system,
    placement,
    layout,
    metrics,
    theme,
  })
  return ops
}

function segments(ops: readonly RecordedOp[]): Array<{
  from: readonly number[]
  to: readonly number[]
  strokeStyle: string
}> {
  const pairs: Array<{
    from: readonly number[]
    to: readonly number[]
    strokeStyle: string
  }> = []
  for (let index = 0; index < ops.length - 1; index += 1) {
    const from = ops[index]
    const to = ops[index + 1]
    if (from?.op === 'moveTo' && to?.op === 'lineTo') {
      pairs.push({
        from: from.args as readonly number[],
        to: to.args as readonly number[],
        strokeStyle: from.strokeStyle,
      })
    }
  }
  return pairs
}

describe('tabSheetRenderer.laneHeight', () => {
  it('needs one line per string, plus room for the name', () => {
    expect(tabSheetRenderer.laneHeight(lane(), metrics)).toBe(
      metrics.labelHeight + 5 * metrics.rowHeight,
    )
  })

  it('draws a bass on four lines', () => {
    expect(
      tabSheetRenderer.laneHeight(
        lane({ tuning: DEFAULT_BASS_TUNING }),
        metrics,
      ),
    ).toBe(metrics.labelHeight + 3 * metrics.rowHeight)
  })
})

describe('tabSheetRenderer.paintSystem', () => {
  it('draws one line per string across the system', () => {
    const horizontal = segments(paint([lane()])).filter(
      (segment) => segment.from[1] === segment.to[1],
    )
    expect(horizontal).toHaveLength(6)
    expect(horizontal[0]?.from[0]).toBe(metrics.gutterWidth)
    expect(horizontal[0]?.to[0]).toBe(metrics.width)
  })

  it('closes every bar, and the system itself', () => {
    const vertical = segments(paint([lane()])).filter(
      (segment) => segment.from[0] === segment.to[0],
    )
    // Two bars in the system: an opening line for each, and a closing one.
    expect(vertical).toHaveLength(3)
    expect(vertical[0]?.from[0]).toBeCloseTo(metrics.gutterWidth + 0.5, 5)
  })

  it('writes each fret where its beat falls', () => {
    const ops = paint([lane({ notes: [note(0, 3), note(4, 12)] })])
    const frets = ops.filter(
      (entry) => entry.op === 'fillText' && /^\d+$/.test(`${entry.args[0]}`),
    )
    expect(frets.map((entry) => entry.args[0])).toEqual(['3', '12'])
    expect(frets[0]?.args[1]).toBe(metrics.gutterWidth)
    // Beat 4 of an eight beat system is exactly halfway across it.
    expect(frets[1]?.args[1]).toBe(
      metrics.gutterWidth + (metrics.width - metrics.gutterWidth) / 2,
    )
  })

  it('breaks the string line behind every fret number', () => {
    const ops = paint([lane({ notes: [note(0, 3), note(2, 5)] })])
    const backdrops = ops.filter(
      (entry) =>
        entry.op === 'fillRect' && entry.fillStyle === theme.noteBackdrop,
    )
    expect(backdrops).toHaveLength(2)
  })

  it('reads the scored part in full ink and the rest quietly', () => {
    const ops = paint(
      [
        lane({ notes: [note(0, 3)] }),
        lane({ trackId: 'track-2', trackName: 'Bass', notes: [note(0, 7)] }),
      ],
      'track-2',
    )
    const byLabel = (text: string): RecordedOp | undefined =>
      ops.find((entry) => entry.op === 'fillText' && entry.args[0] === text)
    expect(byLabel('7')?.fillStyle).toBe(theme.noteText)
    expect(byLabel('3')?.fillStyle).toBe(theme.mutedNoteText)
  })

  it('names each part, marking the one being scored', () => {
    const ops = paint(
      [lane(), lane({ trackId: 'track-2', trackName: 'Bass' })],
      'track-2',
    )
    const names = ops.filter(
      (entry) =>
        entry.op === 'fillText' &&
        (entry.args[0] === 'Lead guitar' || entry.args[0] === 'Bass'),
    )
    expect(names.map((entry) => entry.fillStyle)).toEqual([
      theme.laneLabel,
      theme.scoredAccent,
    ])
  })

  it('labels the strings in the gutter', () => {
    const ops = paint([lane()])
    const labels = ops.filter(
      (entry) => entry.op === 'fillText' && entry.textAlign === 'right',
    )
    expect(labels).toHaveLength(6)
    expect(labels.map((entry) => entry.args[0])).toEqual([
      ...DEFAULT_GUITAR_TUNING.labels,
    ])
    expect(Number(labels[0]?.args[1])).toBeLessThan(metrics.gutterWidth)
  })

  it('keeps a note off the end of the neck on the last line it has', () => {
    const ops = paint([
      lane({ tuning: DEFAULT_BASS_TUNING, notes: [note(0, 5, 9)] }),
    ])
    const fret = ops.find(
      (entry) => entry.op === 'fillText' && entry.args[0] === '5',
    )
    const staffTop = metrics.systemPaddingTop + metrics.labelHeight
    expect(fret?.args[2]).toBe(staffTop + 3 * metrics.rowHeight)
  })

  it('draws an empty part as bare staff', () => {
    const ops = paint([lane()])
    expect(
      ops.filter(
        (entry) => entry.op === 'fillText' && /^\d/.test(`${entry.args[0]}`),
      ),
    ).toHaveLength(0)
  })

  it('draws nothing at all when no part is shown', () => {
    const ops = paint([])
    expect(ops.filter((entry) => entry.op === 'fillText')).toHaveLength(0)
  })
})

describe('noteLabel', () => {
  function withNotation(notation: GuitarNoteNotation): GuitarNote {
    return { ...note(0, 7), notation }
  }

  it('is the fret on its own when nothing was authored', () => {
    expect(noteLabel(note(0, 7))).toBe('7')
    expect(noteLabel(withNotation({ techniques: [] }))).toBe('7')
  })

  it('never writes a fret below the nut', () => {
    expect(noteLabel(note(0, -3))).toBe('0')
    expect(noteLabel(note(0, 6.6))).toBe('7')
  })

  it('marks the techniques tab has a symbol for', () => {
    expect(
      noteLabel(
        withNotation({
          techniques: [{ kind: 'bend', bendType: 'bend', semitones: 2 }],
        }),
      ),
    ).toBe('7b')
    expect(
      noteLabel(withNotation({ techniques: [{ kind: 'hammer-on' }] })),
    ).toBe('7h')
    expect(
      noteLabel(withNotation({ techniques: [{ kind: 'pull-off' }] })),
    ).toBe('7p')
    expect(
      noteLabel(
        withNotation({ techniques: [{ kind: 'vibrato', width: 'wide' }] }),
      ),
    ).toBe('7~')
  })

  it('slides in the direction the source wrote', () => {
    expect(
      noteLabel(
        withNotation({ techniques: [{ kind: 'slide', slideType: 'shift' }] }),
      ),
    ).toBe('7/')
    expect(
      noteLabel(
        withNotation({
          techniques: [{ kind: 'slide', slideType: 'out-down' }],
        }),
      ),
    ).toBe('7\\')
  })

  it('leaves span marks off the note head', () => {
    expect(
      noteLabel(withNotation({ techniques: [{ kind: 'palm-mute' }] })),
    ).toBe('7')
    expect(
      noteLabel(withNotation({ techniques: [{ kind: 'let-ring' }] })),
    ).toBe('7')
  })
})
