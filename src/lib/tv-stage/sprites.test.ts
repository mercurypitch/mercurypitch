// ============================================================
// TV stage sprites tests — painted once per size, stamped after that
// ============================================================
//
// A frame asks for every sprite it stamps; the cache must paint each only
// the first time, paint again for a new size, and forget them all when the
// screen changes. And the stage's own frames ask for no blur at all: every
// blur is painted into a sprite, once.

import { describe, expect, it } from 'vitest'
import type { TvStageState } from '@/lib/tv-stage/model'
import { LONG_AGO } from '@/lib/tv-stage/model'
import { recordingContext, recordingSprites, } from '@/lib/tv-stage/recording-context.fixture'
import { createTvStageView, drawTvStage } from '@/lib/tv-stage/renderer'
import { createSpriteCache } from '@/lib/tv-stage/sprites'

const SIZE = { width: 40, height: 20 }

describe('the sprite cache', () => {
  it('paints a sprite the first time it is asked for, and hands back the same one after', () => {
    const { factory, painted } = recordingSprites()
    const sprites = createSpriteCache(factory)
    let paints = 0
    const paint = (): void => {
      paints += 1
    }

    const first = sprites.get('note:glass:30', SIZE, paint)
    const again = sprites.get('note:glass:30', SIZE, paint)

    expect(paints).toBe(1)
    expect(painted).toEqual(['note:glass:30'])
    expect(again).toBe(first)
    expect(first).toMatchObject({ width: 40, height: 20 })
  })

  it('paints anew for another size', () => {
    const sprites = createSpriteCache(recordingSprites().factory)
    let paints = 0
    const paint = (): void => {
      paints += 1
    }

    sprites.get('note:glass:30', SIZE, paint)
    sprites.get('note:glass:60', { width: 80, height: 40 }, paint)

    expect(paints).toBe(2)
  })

  it('forgets every sprite when the screen changes size, and keeps them while it does not', () => {
    const sprites = createSpriteCache(recordingSprites().factory)
    let paints = 0
    const paint = (): void => {
      paints += 1
    }

    sprites.screen(1920, 1080)
    sprites.get('panel', SIZE, paint)
    sprites.screen(1920, 1080)
    sprites.get('panel', SIZE, paint)
    sprites.screen(3840, 2160)
    sprites.get('panel', SIZE, paint)

    expect(paints).toBe(2)
  })

  it('draws without a sprite where no canvas can be made, and does not keep asking', () => {
    let asked = 0
    const sprites = createSpriteCache(() => {
      asked += 1
      return null
    })

    expect(sprites.get('panel', SIZE, () => undefined)).toBeNull()
    expect(sprites.get('panel', SIZE, () => undefined)).toBeNull()
    expect(asked).toBe(1)
  })
})

describe('a frame of the stage', () => {
  const state: TvStageState = {
    song: {
      v: 1,
      kind: 'song',
      title: 'River Road',
      duration: 60,
      notes: [
        { t0: 9, t1: 10.2, midi: 64 },
        { t0: 10.4, t1: 11, midi: 67 },
        { t0: 12, t1: 13, midi: 60 },
      ],
      lyrics: [],
    },
    clock: { at: 0, position: 10, playing: false, rate: 1 },
    trail: [
      [9.5, 64.1],
      [9.6, 64],
      [9.7, 63.9],
      [9.8, 64.2],
    ],
    score: null,
    turn: LONG_AGO,
  }

  it('paints its sprites on the first frame and only stamps them on the next', () => {
    const { factory, painted } = recordingSprites()
    const view = createTvStageView(factory)
    const size = { width: 1920, height: 1080 }

    drawTvStage(recordingContext().ctx, state, 0, size, view)
    const first = painted.length
    const second = recordingContext()
    drawTvStage(second.ctx, state, 0, size, view)

    expect(first).toBeGreaterThan(4)
    expect(painted).toHaveLength(first)
    expect(second.images.length).toBeGreaterThan(4)
  })

  it('asks the screen’s canvas for no blur at all', () => {
    const view = createTvStageView(recordingSprites().factory)
    const frame = recordingContext()

    drawTvStage(frame.ctx, state, 0, { width: 1920, height: 1080 }, view)

    expect(frame.blurs.filter((blur) => blur > 0)).toEqual([])
  })
})
