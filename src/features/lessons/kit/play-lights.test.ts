// ============================================================
// Lesson play lights tests — lit while the sound plays, out when it ends
// ============================================================
//
// A play's button lights as its sound starts and goes out when the sound
// ends, heard to its end or cut short; a newer play puts out the one
// before, and the older one's ending, arriving later, leaves the newer one
// lit. A press of the same button again lights it again for the new sound.

import { afterEach, describe, expect, it } from 'vitest'
import { playLights } from './play-lights'

afterEach(() => {
  document.body.textContent = ''
})

/** A sound in flight, ended by the test: heard to its end (true) or cut short (false). */
function sound(): { done: Promise<boolean>; end: (heard: boolean) => void } {
  let end: (heard: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    end = resolve
  })
  return { done, end }
}

/** Two play buttons on the page. */
function buttons(): [HTMLButtonElement, HTMLButtonElement] {
  const a = document.createElement('button')
  const b = document.createElement('button')
  document.body.append(a, b)
  return [a, b]
}

const lit = (...bs: HTMLButtonElement[]): boolean[] =>
  bs.map((b) => b.classList.contains('is-on'))

/** Lets the sounds' endings reach the light. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

describe("a play's light", () => {
  it.each([
    ['heard to its end', true],
    ['cut short', false],
  ])(
    'lights the button while its sound plays, and puts it out once the sound is %s',
    async (_, heard) => {
      // Arrange
      const light = playLights()
      const [a] = buttons()
      const s = sound()

      // Act
      light(a, s.done)
      const playing = lit(a)
      s.end(heard)
      await settle()

      // Assert
      expect(playing).toEqual([true])
      expect(lit(a)).toEqual([false])
    },
  )

  it('puts out the play before as a newer one lights, and keeps the newer lit when the older ends', async () => {
    // Arrange
    const light = playLights()
    const [a, b] = buttons()
    const first = sound()
    const second = sound()

    // Act
    light(a, first.done)
    light(b, second.done)
    const both = lit(a, b)
    first.end(false)
    await settle()

    // Assert
    expect(both).toEqual([false, true])
    expect(lit(a, b)).toEqual([false, true])
  })

  it('lights the same button again for its new sound, and the first sound ending leaves it lit', async () => {
    // Arrange
    const light = playLights()
    const [a] = buttons()
    const first = sound()
    const again = sound()

    // Act
    light(a, first.done)
    light(a, again.done)
    first.end(false)
    await settle()
    const stillLit = lit(a)
    again.end(true)
    await settle()

    // Assert
    expect(stillLit).toEqual([true])
    expect(lit(a)).toEqual([false])
  })
})
