// Studio note editing on a kit — in Draw a tap puts a hit in an empty cell, on its step and a step long, a tap on a hit takes it away (with Shift selects it), and a drag paints a hit on every step it crosses that has none, in one commit, each sounding as it goes down; in Select a hit pressed and dragged moves between rows and steps at once, from anywhere on it, never resized, with no grips; Up and Down move to the next row and an octave moves nothing; a marquee takes the hits on the rows and steps it crosses; a finger takes a hit anywhere in its row's height about it and a finger's reach past that; and a pan keeps the rows on the kit.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import { studioRollRow } from '@/lib/studio/midi/roll-keyboard'
import type { NoteEditInit } from './edit-engine'
import type { NoteHost } from './edit-script.fixture'
import { auditionsOf, commitsOf, drag, finger, mouse, note, noteHost, noteOf, play, press, touchDrag, viewportsOf, } from './edit-script.fixture'
import { noteEditView } from './edit-view'

const KICK = 36
const SNARE = 38
const LOW_TOM = 45
const HIGH_TOM = 50
const CLOSED_HAT = 42
const OPEN_HAT = 46

// A kick on the first beat, a closed hat on the second eighth and a snare
// on the second beat, each a sixteenth long.
const HITS = [
  note(1, KICK, 0, 240, 0.8),
  note(2, SNARE, 960, 240, 0.7),
  note(3, CLOSED_HAT, 480, 240, 0.6),
]
// The usual kit's eight rows, crash on top and the kick at the foot.
const ROWS: StudioRollRows = { kind: 'drums', keys: studioDrumRows(HITS) }

/** A computer: a bar across 960 px, 4 ticks a pixel, so a sixteenth is 60 px; the kit's eight rows 40 px each. */
const KIT: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 0,
  maxMidi: 7,
  width: 960,
  height: 320,
}

/** A phone: two bars across 320 px, 24 ticks a pixel, so a sixteenth is 10 px; rows 32 px each. */
const PHONE_KIT: RollViewport = { ...KIT, end: 7680, width: 320, height: 256 }

const x = (tick: number, viewport = KIT) =>
  (tick / (viewport.end - viewport.start)) * viewport.width
/** The middle of `key`'s row. */
const rowY = (key: number, viewport = KIT) => {
  const height = viewport.height / (viewport.maxMidi - viewport.minMidi + 1)
  return (viewport.maxMidi - studioRollRow(ROWS, key)!) * height + height / 2
}
/** The middle of a hit's square on the computer: 26 px from its start. */
const square = (tick: number) => x(tick) + 13.5

function kit(init: NoteEditInit = {}, viewport = KIT): NoteHost {
  return noteHost({ notes: HITS, rows: ROWS, viewport, init })
}

describe('Draw on a kit', () => {
  it('puts a hit in the empty cell a tap lands in, on its step and a step long', () => {
    // Arrange
    const host = kit({ tool: 'draw' })

    // Act: just past the snare row's fourth step of beat two.
    play(
      host,
      mouse('down', x(1500), rowY(SNARE)),
      mouse('up', x(1500), rowY(SNARE)),
    )

    // Assert
    expect(commitsOf(host)).toHaveLength(1)
    expect(noteOf(host, 4)).toMatchObject({
      pitch: SNARE,
      startTick: 1440,
      lengthTicks: 240,
    })
  })

  it('takes away the hit a tap lands on, and takes it out of the selection', () => {
    const host = kit({ tool: 'draw', selection: [1, 2] })

    play(
      host,
      mouse('down', square(960), rowY(SNARE)),
      mouse('up', square(960), rowY(SNARE)),
    )

    expect(commitsOf(host)).toHaveLength(1)
    expect(noteOf(host, 2)).toBeUndefined()
    expect(host.state.selection).toEqual([1])
  })

  it('selects the hit a tap with Shift lands on, rather than taking it away', () => {
    const host = kit({ tool: 'draw' })

    play(
      host,
      mouse('down', square(960), rowY(SNARE), { shift: true }),
      mouse('up', square(960), rowY(SNARE), { shift: true }),
    )

    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([2])
  })

  it('paints a hit on every step a drag crosses, in one commit, past a cell already hit', () => {
    // Arrange
    const host = kit({ tool: 'draw' })

    // Act: along the closed hat's row from the first step to the fifth,
    // where the hat on the third is already.
    play(host, ...drag([x(40), rowY(CLOSED_HAT)], [x(1000), rowY(CLOSED_HAT)]))

    // Assert
    const commits = commitsOf(host)
    expect(commits).toHaveLength(1)
    const painted = commits[0].notes.filter((each) => each.id > 3)
    expect(
      painted.map((each) => [each.pitch, each.startTick, each.lengthTicks]),
    ).toEqual([
      [CLOSED_HAT, 0, 240],
      [CLOSED_HAT, 240, 240],
      [CLOSED_HAT, 720, 240],
      [CLOSED_HAT, 960, 240],
    ])
    expect(host.state.selection).toEqual([4, 5, 6, 7])
  })

  it('sounds each hit it paints as it goes down, the same drum again past the gap', () => {
    const host = kit({ tool: 'draw' })
    const at = (tick: number) => [x(tick), rowY(OPEN_HAT)] as const

    play(
      host,
      mouse('down', ...at(40), { time: 1000 }),
      mouse('move', ...at(280), { time: 1200 }),
      mouse('move', ...at(1000), { time: 1400 }),
      mouse('up', ...at(1000), { time: 1500 }),
    )

    expect(auditionsOf(host).map((sound) => sound.pitch)).toEqual([
      OPEN_HAT,
      OPEN_HAT,
      OPEN_HAT,
    ])
  })
})

describe('Select on a kit', () => {
  it('moves a hit pressed and dragged between rows and steps at once, selected or not', () => {
    const host = kit()

    // Two steps later and two rows up: from the snare to the high tom.
    play(
      host,
      ...drag(
        [square(960), rowY(SNARE)],
        [square(960) + 120, rowY(SNARE) - 80],
      ),
    )

    expect(noteOf(host, 2)).toMatchObject({ pitch: HIGH_TOM, startTick: 1440 })
  })

  it('moves a hit pressed at its far side, never resizing it, and shows no grips', () => {
    // Arrange: the kick selected.
    const host = kit({ selection: [1] })
    const shown = noteEditView(host.state, host.ctx)

    // Act: pressed 30 px from its start, past its square, and dragged a step.
    play(host, ...drag([x(0) + 30, rowY(KICK)], [x(0) + 90, rowY(KICK)]))

    // Assert
    expect(shown.grips).toEqual([])
    expect(noteOf(host, 1)).toMatchObject({ startTick: 240, lengthTicks: 240 })
  })

  it('moves the selection a row with Up and Down, and nowhere with Shift', () => {
    const host = kit({ selection: [2] })

    play(host, ...press('ArrowUp'))
    const up = noteOf(host, 2)?.pitch
    play(host, ...press('ArrowUp', { shift: true }))
    const octave = noteOf(host, 2)?.pitch
    play(host, ...press('ArrowDown'), ...press('ArrowDown'))

    expect([up, octave, noteOf(host, 2)?.pitch]).toEqual([
      LOW_TOM,
      LOW_TOM,
      KICK,
    ])
  })

  it('takes the hits on the rows and steps a marquee crosses', () => {
    const host = kit()

    // From the open hat's row late in the bar, back and down to the snare's.
    play(host, ...drag([x(2800), rowY(OPEN_HAT)], [x(400), rowY(SNARE)]))

    expect(host.state.selection).toEqual([2, 3])
  })
})

describe('A finger on a kit', () => {
  it("takes a hit anywhere in its row's height about it, and a finger's reach past that", () => {
    // A snare on bar 1's fourth beat, its square 8 px wide at 100 px.
    const tapAt = (px: number) => {
      const host = noteHost({
        notes: [note(1, SNARE, 2400, 240)],
        rows: ROWS,
        viewport: PHONE_KIT,
      })
      const y = rowY(SNARE, PHONE_KIT)
      play(host, finger(1, 'down', px, y), finger(1, 'up', px, y))
      return host.state.selection
    }

    expect([tapAt(118), tapAt(130), tapAt(140)]).toEqual([[1], [1], []])
  })

  it('pans the rows no higher than the kit’s first row', () => {
    const host = kit({}, { ...KIT, minMidi: 0, maxMidi: 5 })

    play(host, ...touchDrag([x(3000), 50], [x(3000), 300]))

    expect(viewportsOf(host).at(-1)).toMatchObject({ minMidi: 2, maxMidi: 7 })
  })
})
