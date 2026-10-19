// ============================================================
// Lesson 2 names arrows tests — a sharp is up, a flat is down, any colour
// ============================================================

import { describe, expect, it } from 'vitest'
import { signName } from '@/features/lessons/kit/notes'
import { arrowFrom, namesAbove, writtenNames } from './names-arrows'

const C4 = 60
const C_SHARP_4 = 61
const D4 = 62
const E4 = 64
const F4 = 65

const names = (list: readonly Parameters<typeof signName>[0][]): string[] =>
  list.map((n) => signName(n))

describe('arrowFrom', () => {
  it('steps one semitone up from C and names the black key C♯, and down from D to name it D♭', () => {
    const up = arrowFrom(C4, 'sharp')
    const down = arrowFrom(D4, 'flat')
    expect(up?.to).toBe(C_SHARP_4)
    expect(down?.to).toBe(C_SHARP_4)
    expect(up && signName(up.name)).toBe('C♯4')
    expect(down && signName(down.name)).toBe('D♭4')
  })

  it('lands on a white key from E and from F: E♯ is F, and F♭ is E', () => {
    const up = arrowFrom(E4, 'sharp')
    const down = arrowFrom(F4, 'flat')
    expect(up?.to).toBe(F4)
    expect(up && signName(up.name)).toBe('E♯4')
    expect(down?.to).toBe(E4)
    expect(down && signName(down.name)).toBe('F♭4')
  })

  it('asks for a lettered key: there is no arrow from a black key', () => {
    expect(arrowFrom(C_SHARP_4, 'sharp')).toBeNull()
    expect(arrowFrom(C_SHARP_4, 'flat')).toBeNull()
  })
})

describe('writtenNames', () => {
  it('rings a key once the arrows have given it two names, the sharp listed first', () => {
    const w = writtenNames()
    const down = arrowFrom(D4, 'flat')
    const up = arrowFrom(C4, 'sharp')
    if (down === null || up === null) throw new Error('no arrow')
    w.add(down)
    expect(w.ringed(C_SHARP_4)).toBe(false)
    w.add(up)
    w.add(up)
    expect(w.ringed(C_SHARP_4)).toBe(true)
    expect(names(w.on(C_SHARP_4))).toEqual(['C♯4', 'D♭4'])
    w.clear()
    expect(w.on(C_SHARP_4)).toEqual([])
  })
})

describe('namesAbove', () => {
  it("writes a white key's second names above its letter, the rare one only while those show, never twice", () => {
    const w = writtenNames()
    const fromE = arrowFrom(E4, 'sharp')
    if (fromE === null) throw new Error('no arrow')
    expect(namesAbove(F4, w, false)).toEqual([])
    expect(names(namesAbove(F4, w, true))).toEqual(['E♯4'])
    w.add(fromE)
    expect(names(namesAbove(F4, w, false))).toEqual(['E♯4'])
    expect(names(namesAbove(F4, w, true))).toEqual(['E♯4'])
    expect(names(namesAbove(C4, w, true))).toEqual(['B♯3'])
  })
})
