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

const gateText = (): string =>
  document.getElementById('gateText')?.textContent ?? ''

afterEach(() => {
  Sound.set('unset')
  document.body.textContent = ''
})

describe('initSoundSwitch', () => {
  it("keeps the page's own line while sound is off, and says so when it is on", () => {
    // Arrange
    chrome()
    initSoundSwitch()
    const before = gateText()

    // Act
    Sound.set('on')
    const on = gateText()
    Sound.set('off')

    // Assert
    expect(before).toBe(LESSON_2)
    expect(on).toBe(
      'Sound is on. Each example plays only when you press its button.',
    )
    expect(gateText()).toBe(LESSON_2)
  })
})
