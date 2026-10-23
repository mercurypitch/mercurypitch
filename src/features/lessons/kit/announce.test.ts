// ============================================================
// Lesson announcer tests — one status line, written after a beat
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announce, ANNOUNCE_CLEAR_MS, ANNOUNCE_DELAY_MS, announcer, spokenText, } from './announce'

const lines = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-announcer]'))

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<main id="main"></main>'
})

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('announcer', () => {
  it('makes one visually hidden status line inside main, however often it is asked for', () => {
    // Act
    const first = announcer()
    const second = announcer()

    // Assert
    expect(second).toBe(first)
    expect(lines()).toHaveLength(1)
    expect(first.getAttribute('role')).toBe('status')
    expect(first.classList.contains('sr')).toBe(true)
    expect(first.parentElement?.id).toBe('main')
  })

  it('makes a new line when the page it was in has gone', () => {
    // Arrange
    const old = announcer()
    document.body.innerHTML = '<main></main>'

    // Act
    const fresh = announcer()

    // Assert
    expect(fresh).not.toBe(old)
    expect(lines()).toEqual([fresh])
  })
})

describe('announce', () => {
  it('writes the words after a beat with the line empty, so a repeat still counts as a change', () => {
    // Arrange
    announce('Your taps: 88 beats per minute')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    const line = announcer()

    // Act: the same words again
    announce('Your taps: 88 beats per minute')
    const between = line.textContent
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert
    expect(between).toBe('')
    expect(line.textContent).toBe('Your taps: 88 beats per minute')
  })

  it('keeps only the latest words when two come within the beat', () => {
    // Act
    announce('Your taps: 80 beats per minute')
    announce('Your taps: 84 beats per minute')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert
    expect(announcer().textContent).toBe('Your taps: 84 beats per minute')
  })

  it('says nothing for empty words', () => {
    // Act
    announce('')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert
    expect(announcer().textContent).toBe('')
  })

  it('holds the words until the clear delay, then empties the line, so the page keeps no stale news', () => {
    // Arrange
    announce('Step 4 of 6: Seven letters')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Act
    vi.advanceTimersByTime(ANNOUNCE_CLEAR_MS - 1)
    const held = announcer().textContent
    vi.advanceTimersByTime(1)

    // Assert
    expect(held).toBe('Step 4 of 6: Seven letters')
    expect(announcer().textContent).toBe('')
  })

  it("keeps a second announce's words for their own full delay when they come before the first's clear", () => {
    // Arrange: the first words, most of their delay gone
    announce('Pitch: climbing')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS + ANNOUNCE_CLEAR_MS - 1000)

    // Act
    announce('Pitch: falling')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS + ANNOUNCE_CLEAR_MS - 1)
    const held = announcer().textContent
    vi.advanceTimersByTime(1)

    // Assert
    expect(held).toBe('Pitch: falling')
    expect(announcer().textContent).toBe('')
  })
})

/** Lesson 2 step 5's reveal, as learn/02.html ships it. */
const L2_STEP5 = `<p class="reveal" hidden data-e-reveal>
                    <span class="mono">Your guess</span><b>The evidence:</b> one
                    semitone up from E is F, a white key, so E<span
                      aria-hidden="true"
                      >♯</span
                    ><span class="sr"> sharp</span> is F.
                  </p>`

/** Lesson 4's D major reveal, as learn/04.html ships it. */
const L4_FROM_D = `<div class="reveal" hidden aria-live="polite">
                    <span class="mono">Your guess</span>
                    <p>
                      It changes. From D, the white keys climb tone, semitone,
                      tone, tone, tone, semitone, tone: the short steps land in
                      the wrong places, and the third and seventh notes come out
                      a semitone low. Keep the major pattern instead and you
                      need two black keys, F<span aria-hidden="true">♯</span
                      ><span class="sr"> sharp</span> and C<span
                        aria-hidden="true"
                        >♯</span
                      ><span class="sr"> sharp</span>. That's do-re-mi from D,
                      called D major: a major scale is named after its first
                      note.
                    </p>
                  </div>`

/** Lesson 2 step 3's reveal, with its Play E to F button, as learn/02.html ships it. */
const L2_STEP3 = `<div class="reveal" hidden aria-live="polite">
                    <span class="mono">Your guess</span>
                    <p>
                      C to D is the bigger step, two semitones; B to C is one. E
                      to F is one too.
                    </p>
                    <button
                      class="btn sm tint"
                      type="button"
                      data-example="ef"
                      style="--c: var(--chrome)"
                    >
                      <svg class="ico" aria-hidden="true">
                        <use href="#i-play" /></svg
                      >Play E to F
                    </button>
                  </div>`

/** A reveal from its markup, shown, with the guess line the predict writes. */
function shownReveal(markup: string, guess: string): HTMLElement {
  const box = document.createElement('div')
  box.innerHTML = markup
  const el = box.querySelector<HTMLElement>('.reveal') ?? box
  el.hidden = false
  const line = el.querySelector('.mono')
  if (line !== null) line.textContent = guess
  document.querySelector('main')?.append(el)
  return el
}

describe('spokenText', () => {
  it("speaks Lesson 2 step 5's reveal as it reads, the sign as its word", () => {
    // Arrange
    const el = shownReveal(L2_STEP5, 'You said: a black key')

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe(
      'You said: a black key. The evidence: one semitone up from E is F, a white key, so E sharp is F.',
    )
  })

  it("says the sharps of Lesson 4's reveal as words, never as glyphs", () => {
    // Arrange
    const el = shownReveal(L4_FROM_D, 'You said: it changes')

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe(
      "You said: it changes. It changes. From D, the white keys climb tone, semitone, tone, tone, tone, semitone, tone: the short steps land in the wrong places, and the third and seventh notes come out a semitone low. Keep the major pattern instead and you need two black keys, F sharp and C sharp. That's do-re-mi from D, called D major: a major scale is named after its first note.",
    )
    expect(said).not.toContain('♯')
  })

  it('leaves the label of a button inside the reveal out of the words', () => {
    // Arrange
    const el = shownReveal(L2_STEP3, 'You said: the same')

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe(
      'You said: the same. C to D is the bigger step, two semitones; B to C is one. E to F is one too.',
    )
  })

  it('reads the words of the markup, whatever innerText would draw', () => {
    // Arrange: a browser's innerText, in the capitals and the glyphs of the layout
    const el = shownReveal(L2_STEP5, 'You said: a black key')
    Object.defineProperty(el, 'innerText', {
      value: 'YOU SAID: A BLACK KEY\nTHE EVIDENCE: E\n♯\n sharp\nis F.',
    })

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe(
      'You said: a black key. The evidence: one semitone up from E is F, a white key, so E sharp is F.',
    )
  })

  it('turns each line into a sentence, a br ending one too, and keeps a line that ends in a comma', () => {
    // Arrange
    const el = document.createElement('p')
    el.innerHTML =
      '<span class="mono">You said: higher</span>One after the other,<br>  440 sounds higher.'

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe(
      'You said: higher. One after the other, 440 sounds higher.',
    )
  })

  it('runs inline words together on one line, spaces collapsed', () => {
    // Arrange
    const el = document.createElement('p')
    el.innerHTML = '<span>You said: lower</span>  and   more'

    // Act
    const said = spokenText(el)

    // Assert
    expect(said).toBe('You said: lower and more')
  })
})
