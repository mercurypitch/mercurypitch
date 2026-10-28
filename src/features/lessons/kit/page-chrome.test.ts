// ============================================================
// Lesson page chrome tests — the sound gate keeps the page's own words
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { initSoundSwitch } from './page-chrome'
import { Sound } from './sound'

const LESSON_2 =
  'This lesson is about small steps in sound. Tap to turn it on: nothing plays until you press a play button.'

/** The masthead switch, the hero's gate (its line spread over two source lines) and the toast. */
function chrome(): void {
  document.body.innerHTML = `<button id="soundSwitch" aria-pressed="false"></button>
    <div id="gate"><p id="gateText">
      This lesson is about small steps in sound. Tap to turn it on: nothing
      plays until you press a play button.
    </p><button id="gateBtn">Turn sound on</button></div>
    <div id="toast"><p id="toastText"></p><button id="toastBtn" hidden></button></div>`
}

/** The gate's line for sound off or on: both stay in it, one cell, one shown at a time. */
const gateLine = (state: 'off' | 'on'): string =>
  document.querySelector(`#gateText [data-gate-line="${state}"]`)
    ?.textContent ?? ''

/** Whether the gate shows its sound-on line: its class picks the line (kit/lesson-stage.css). */
const gateOn = (): boolean =>
  document.getElementById('gate')?.classList.contains('is-on') ?? false

afterEach(() => {
  Sound.set('unset')
  document.body.textContent = ''
})

describe('initSoundSwitch', () => {
  it("keeps the page's own line for sound off and the kit's for sound on, both in the gate, the current one marked", () => {
    // Arrange
    chrome()
    initSoundSwitch()
    const before = gateOn()

    // Act
    Sound.set('on')
    const on = gateOn()
    Sound.set('off')

    // Assert
    expect(gateLine('off')).toBe(LESSON_2)
    expect(gateLine('on')).toBe(
      'Sound is on. Each example plays only when you press its button.',
    )
    expect(document.querySelectorAll('#gateText > *')).toHaveLength(2)
    expect([before, on, gateOn()]).toEqual([false, true, false])
  })

  it("keeps both of the button's labels in it, the current one marked by the gate as its line is", () => {
    // Arrange
    chrome()
    initSoundSwitch()
    const label = (state: 'off' | 'on'): string =>
      document.querySelector(`#gateBtn [data-gate-line="${state}"]`)
        ?.textContent ?? ''
    const labels = (): string[] =>
      [...document.querySelectorAll('#gateBtn > *')].map(
        (el) => el.textContent ?? '',
      )
    const before = labels()

    // Act
    Sound.set('on')
    const on = labels()

    // Assert: one cell holds both (kit/lesson-stage.css), so the button
    // keeps one width; the gate's class picks the label that shows
    expect([label('off'), label('on')]).toEqual([
      'Turn sound on',
      'Turn sound off',
    ])
    expect(on).toEqual(before)
    expect(gateOn()).toBe(true)
  })
})
