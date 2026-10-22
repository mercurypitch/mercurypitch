// ============================================================
// Words strip tests — a word's button, alone or under one owner
// ============================================================
//
// kit/words-strip.ts: a word's button lights while its play runs, and a
// press of a word already running is ignored. Without an owner a word plays
// to its end, as on Lesson 1. With one (Lesson 7's NowPlaying) a word claims
// the page's sound as it starts; a newer sound stops it at once, its own
// `stop` runs, its play learns so through `stopped()`, and its button goes
// dark.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { createSoundOwner } from './now-playing'
import { Sound } from './sound'
import { bindWordPlays } from './words-strip'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

function strip(): HTMLButtonElement {
  document.body.innerHTML =
    '<div><button data-word-play="siren">Hear it</button></div>'
  const b = document.querySelector<HTMLButtonElement>('[data-word-play]')
  if (b === null) throw new Error('no button')
  return b
}

/** A play that runs until the test ends it, recording what it was told. */
function held() {
  const calls: { word: string; audible: boolean; stopped: () => boolean }[] = []
  let finish: () => void = () => undefined
  const play = vi.fn(
    (word: string, audible: boolean, stopped: () => boolean) =>
      new Promise<void>((resolve) => {
        calls.push({ word, audible, stopped })
        finish = resolve
      }),
  )
  return { play, calls, finish: () => finish() }
}

describe('bindWordPlays', () => {
  it('lights the button while the word plays, and ignores a second press', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
    const b = strip()
    const run = held()
    bindWordPlays(document.body, run.play)

    // Act
    b.click()
    b.click()
    const lit = b.classList.contains('is-on')
    run.finish()
    await Promise.resolve()
    await Promise.resolve()

    // Assert
    expect(run.play).toHaveBeenCalledTimes(1)
    expect(run.calls[0]).toMatchObject({ word: 'siren', audible: true })
    expect(lit).toBe(true)
    expect(b.classList.contains('is-on')).toBe(false)
  })

  it('plays its figure in silence when sound is off', () => {
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const b = strip()
    const run = held()
    bindWordPlays(document.body, run.play)

    b.click()

    expect(run.calls[0].audible).toBe(false)
  })

  it('claims the owner, and stops at once when a newer sound takes over', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
    const owner = createSoundOwner()
    const stop = vi.fn()
    const b = strip()
    const run = held()
    bindWordPlays(document.body, run.play, { owner, stop })
    b.click()

    // Act: another source on the page starts
    owner.claim(() => undefined)

    // Assert
    expect(stop).toHaveBeenCalledWith('siren')
    expect(run.calls[0].stopped()).toBe(true)
    expect(b.classList.contains('is-on')).toBe(false)
  })

  it('lets go of the owner when it ends, so a later sound never stops it twice', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
    const owner = createSoundOwner()
    const stop = vi.fn()
    const b = strip()
    const run = held()
    bindWordPlays(document.body, run.play, { owner, stop })
    b.click()
    run.finish()
    await Promise.resolve()
    await Promise.resolve()

    // Act
    owner.claim(() => undefined)

    // Assert
    expect(stop).not.toHaveBeenCalled()
  })
})
