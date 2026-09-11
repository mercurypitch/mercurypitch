// ============================================================
// The Top Shelf, climbed without a voice
// ============================================================
//
// Steps 6b and 6c (docs/games/top-shelf.md §8) are done when every room
// is climbed in the browser by hook, and by voice on the phone. This is
// the first half: the real stage, loop and sim, entered from the Games
// list, with the voice replaced by the hook's held note (`shelf-hook`)
// because a headless browser has nobody to hum.

import { expect, test } from '@playwright/test'
import { CATCH, MAX_LEAP, SHELF_1, SHELF_3, SHELVES, topsOf, } from '../src/games/glass3d/levels/shelf'
import { enter, framed, HALF, holdNote, landed, leapAt, leapThenHold, move, read, shoot, sing, walkToRiser, } from './shelf-hook'

const RISER = SHELF_1.shelves[1]!.from
const LIP = topsOf(SHELF_1)[1]!

test.describe('the Top Shelf, room 1', () => {
  test('a note, a fifth above it, and he is on the shelf and out', async ({
    page,
  }, info) => {
    test.setTimeout(60_000)
    await enter(page)
    expect(await read(page)).toMatchObject({
      phase: 'climbing',
      room: SHELF_1.id,
      shelf: 0,
      reference: null,
    })

    // Any note will do: the first one only becomes the reference.
    await holdNote(page, 57)
    expect(await read(page)).toMatchObject({ y: 0, shelf: 0, leaps: 0 })

    // Walking never climbs: the riser holds him by his mitt.
    await walkToRiser(page, RISER)
    await move(page, 1)
    await page.waitForTimeout(400)
    await move(page, 0)
    const pinned = await read(page)
    expect(pinned.x).toBeCloseTo(RISER - HALF, 3)
    expect(pinned.y).toBe(0)
    await shoot(page, info, 'shelf-1-at-the-riser')

    // A fifth above it: 0.7 m, exactly the rise.
    await sing(page, 64)
    const up = await landed(page, 1)
    expect(up.shelf).toBe(1)
    expect(up.y).toBeCloseTo(LIP, 6)
    expect(up.apex).toBeCloseTo(LIP, 3)
    expect(up.reference).toBe(64)
    // And the carry walks him on until all of him is past the lip.
    await expect
      .poll(async () => (await read(page)).x, { timeout: 5_000 })
      .toBeGreaterThan(RISER + HALF - 0.01)
    await shoot(page, info, 'shelf-1-on-the-shelf')

    // Out, and on into room 2.
    await move(page, 1)
    await expect
      .poll(async () => (await read(page)).room, { timeout: 15_000 })
      .toBe(SHELVES[1]!.id)
    expect(await read(page)).toMatchObject({
      phase: 'climbing',
      shelf: 0,
      y: 0,
    })
  })

  test('down is free, a flat leap hops back, and a stop in the air leaps nowhere', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await enter(page)

    // Down only moves the reference (§3.3).
    await holdNote(page, 60)
    await holdNote(page, 52)
    expect(await read(page)).toMatchObject({ y: 0, shelf: 0, leaps: 0 })

    // 0.7 of a semitone flat of the fifth: short of the catch, so the
    // riser holds him and he comes back down where he was (§3.5).
    await walkToRiser(page, RISER)
    await sing(page, 58.3)
    const hop = await landed(page, 1)
    expect(hop.shelf).toBe(0)
    expect(hop.y).toBe(0)
    expect(hop.apex).toBeCloseTo(0.63, 3)
    expect(hop.x).toBeCloseTo(RISER - HALF, 3)

    // Back down to a comfortable note, and a fifth from there; a note
    // settled on the way up moves the reference and never leaps (§3.6).
    await holdNote(page, 55)
    await leapThenHold(page, 62, 66)
    const up = await landed(page, 2)
    expect(up).toMatchObject({ shelf: 1, leaps: 2, reference: 66 })
    expect(up.y).toBeCloseTo(LIP, 6)
    expect(up.apex).toBeCloseTo(LIP, 3)
  })
})

test.describe('the Top Shelf, every room', () => {
  test('climbs all three, room 3 octave only by way of its ledge, framed on a phone', async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await enter(page)
    for (const room of SHELVES) {
      await expect
        .poll(async () => (await read(page)).room, { timeout: 15_000 })
        .toBe(room.id)
      const tops = topsOf(room)
      for (let k = 1; k < room.shelves.length; k++) {
        const label = `${room.id} riser ${String(k)}`
        if (room.id === SHELF_3.id && k === 1) {
          // An octave from the floor is more than any leap: he tops out
          // at his spring and comes down on the ledge, a fifth up --
          // never on the octave shelf behind it (§4).
          const octave = await leapAt(page, room, k, 12)
          expect(octave.shelf, `${label}: the ledge`).toBe(1)
          expect(octave.apex).toBeCloseTo(MAX_LEAP, 3)
          expect(octave.apex).toBeLessThan(tops[2]! - CATCH)
        } else {
          const up = await leapAt(page, room, k, room.shelves[k]!.rise)
          expect(up.shelf, label).toBe(k)
          expect(up.y, label).toBeCloseTo(tops[k]!, 6)
        }
        await framed(page, label)
      }
      await shoot(page, info, `${room.id}-top`)
      await move(page, 1)
      await expect
        .poll(async () => (await read(page)).phase, { timeout: 15_000 })
        .not.toBe('climbing')
      await move(page, 0)
    }
    await expect
      .poll(async () => (await read(page)).phase, { timeout: 15_000 })
      .toBe('done')
    await expect(page.getByText('The Top Shelf, climbed.')).toBeVisible()
  })
})
