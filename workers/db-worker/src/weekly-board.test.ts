import { describe, expect, it } from 'vitest'
import type { PlacedBoardEntry } from './weekly-board'
import { BOARD_TOP_SIZE, boardTop } from './weekly-board'

const singer = (rank: number, best: number): PlacedBoardEntry => ({
  rank,
  userId: `singer-${rank}`,
  displayName: `Singer ${rank}`,
  best,
  isFounder: false,
})

const FOUNDER: PlacedBoardEntry = {
  rank: 2,
  userId: null,
  displayName: 'The Founder',
  best: 88,
  isFounder: true,
}

describe('the top of the Legend’s board', () => {
  it('names each singer by their id, and the Founder by none', () => {
    const top = boardTop([singer(1, 95), FOUNDER, singer(3, 70)])

    expect(top).toEqual([
      {
        rank: 1,
        userId: 'singer-1',
        displayName: 'Singer 1',
        best: 95,
        isFounder: false,
      },
      {
        rank: 2,
        displayName: 'The Founder',
        best: 88,
        isFounder: true,
      },
      {
        rank: 3,
        userId: 'singer-3',
        displayName: 'Singer 3',
        best: 70,
        isFounder: false,
      },
    ])
    expect('userId' in top[1]).toBe(false)
  })

  it('keeps every place across a singer hidden from the viewer', () => {
    // Place 2 was dropped for this viewer (blocks.ts): the rest keep theirs.
    const top = boardTop([singer(1, 95), singer(3, 80), singer(4, 70)])

    expect(top.map((entry) => [entry.userId, entry.rank])).toEqual([
      ['singer-1', 1],
      ['singer-3', 3],
      ['singer-4', 4],
    ])
  })

  it('sends the first ten entries and no more', () => {
    const many = Array.from({ length: 14 }, (_, index) =>
      singer(index + 1, 100 - index),
    )

    const top = boardTop(many)

    expect(top).toHaveLength(BOARD_TOP_SIZE)
    expect(top.at(-1)?.rank).toBe(10)
  })
})
