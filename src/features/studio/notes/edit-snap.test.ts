// Studio note snapping tests — each note value is its ticks at 960 a beat, triplets included; the grid's lines run through the bar line the host gives; Off has no grid but steps a sixteenth; and a drag lands on the nearest line only past half a step.
import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTE_SNAP, lineAfter, NOTE_SNAPS, noteSnapGrid, noteStepGrid, snapCeil, snapFloor, snapNearest, snapTravel, } from './edit-snap'

describe('the grid', () => {
  it.each([
    ['1/4', 960],
    ['1/8', 480],
    ['1/16', 240],
    ['1/32', 120],
    ['1/4T', 640],
    ['1/8T', 320],
    ['1/16T', 160],
  ] as const)('puts the lines of %s %i ticks apart', (snap, ticks) => {
    expect(noteSnapGrid(snap)?.ticks).toBe(ticks)
  })

  it('offers the four note values, three triplets and Off, opening on a sixteenth', () => {
    expect(NOTE_SNAPS).toHaveLength(8)
    expect(DEFAULT_NOTE_SNAP).toBe('1/16')
  })

  it('has no grid when snapping is off, but steps a sixteenth there', () => {
    expect(noteSnapGrid('off')).toBeNull()
    expect(noteStepGrid('off', 30)).toEqual({ ticks: 240, offset: 30 })
  })
})

describe('snapping to the lines', () => {
  // A sixteenth grid whose lines run through tick 100: a count-in before the bar.
  const grid = { ticks: 240, offset: 100 }

  it('finds the nearest line, the line at or before, and the line at or after', () => {
    expect([
      snapNearest(450, grid),
      snapFloor(450, grid),
      snapCeil(450, grid),
    ]).toEqual([340, 340, 580])
  })

  it('keeps a tick that is on a line where it is', () => {
    expect([
      snapNearest(580, grid),
      snapFloor(580, grid),
      snapCeil(580, grid),
    ]).toEqual([580, 580, 580])
  })

  it('gives the line after a note start, even one on a line', () => {
    expect([lineAfter(580, grid), lineAfter(581, grid)]).toEqual([820, 820])
  })
})

describe('snapTravel', () => {
  const grid = { ticks: 240, offset: 0 }

  it('holds a note still until the pointer has gone half a step', () => {
    expect([snapTravel(480, 119, grid), snapTravel(480, -119, grid)]).toEqual([
      0, 0,
    ])
  })

  it('then lands it on the line nearest where it would be', () => {
    expect([
      snapTravel(480, 130, grid),
      snapTravel(480, 400, grid),
      snapTravel(480, -130, grid),
    ]).toEqual([240, 480, -240])
  })

  it('lands a note played off the grid on a line, so its offset is not carried', () => {
    // Arrange: a note 40 ticks late, dragged most of a step right.
    const late = 520

    // Act
    const travel = snapTravel(late, 200, grid)

    // Assert
    expect(late + travel).toBe(720)
  })

  it('travels to the tick without a grid', () => {
    expect(snapTravel(480, 33.6, null)).toBe(34)
  })
})
