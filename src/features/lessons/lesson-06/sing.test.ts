// ============================================================
// Lesson 6 Sing it tests — a press during a run stops it, then acts
// ============================================================
//
// On the page's own markup, with no microphone: Move do, Start the guide
// and a voice change, pressed while Merc sings a version, stop the version
// and then act; a version cut short has not been played, so the guide
// still waits for one; and a sound anywhere else on the page stops a
// version too. The status line and the do line, both live regions, are
// written only when their words change.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { el, listen, loadPage } from './page-dom.test-fixtures'
import { initSing, RUNNING } from './sing'
import { STATUS } from './sing-flow'
import { readoutHtml, ringLabel } from './sing-guide'
import { initWords } from './words'

/** Sing it on the page's markup, past the comfort check, with the lower voice chosen. */
function mountSing(): void {
  loadPage()
  initSing({ blue: 'blue.png', orange: 'orange.png' })
  el('[data-comfort="sing"]').click()
  el('[data-panel="voice"] [data-voice="lower"]').click()
}

const lit = (selector: string): boolean =>
  el(selector).classList.contains('is-on')

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 6's Sing it: a press while Merc sings", () => {
  it('stops the version at Move do, then moves do; the version has not been played', () => {
    // Arrange: the first version, its fourth note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSing()
    el('[data-version="1"]').click()
    vi.advanceTimersByTime(2000)

    // Act
    el('[data-move-do="1"]').click()
    vi.advanceTimersByTime(10000)

    // Assert
    expect(heard).toHaveLength(4)
    expect(heard[3].stopped).toBe(true)
    expect(el('[data-do-readout]').innerHTML).toBe(readoutHtml('lower', 1))
    expect(el('#singStatus').textContent).toBe(STATUS.first)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('true')
    expect(lit('[data-version="1"]')).toBe(false)
    expect(el('#ring .ring-state').textContent).toBe('Rest')
  })

  it('stops the second version at Start the guide, and counts in on the first version, the one played', async () => {
    // Arrange: the first version played to its end, the second sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSing()
    el('[data-version="1"]').click()
    await vi.advanceTimersByTimeAsync(9700)
    el('[data-version="2"]').click()
    await vi.advanceTimersByTimeAsync(2000)
    const sung = heard.length

    // Act
    el('[data-guide-start]').click()
    await vi.advanceTimersByTimeAsync(3000)
    const during = el('#singStatus').textContent
    await vi.advanceTimersByTimeAsync(9000)

    // Assert: the second version cut off; one note since, do of the first version, D3
    expect(heard[sung - 1].stopped).toBe(true)
    expect(heard.slice(sung).map((v) => v.midi)).toEqual([50])
    expect(lit('[data-version="2"]')).toBe(false)
    expect(during).toBe(RUNNING.guide)
    expect(el('#singStatus').textContent).toBe(STATUS.feel)
  })

  it('stops a version when a sound starts anywhere else on the page', () => {
    // Arrange: the first version, its second note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSing()
    initWords()
    el('[data-version="1"]').click()
    vi.advanceTimersByTime(1000)

    // Act: "step", in the four words
    el('[data-word-play="step"]').click()
    vi.advanceTimersByTime(10000)

    // Assert: Merc cut off after two notes, then A4 and G4 whole
    expect(heard[1].stopped).toBe(true)
    expect(heard.slice(2).map((v) => [v.midi, v.stopped])).toEqual([
      [69, false],
      [67, false],
    ])
    expect(el('#singStatus').textContent).toBe(STATUS.first)
    expect(lit('[data-version="1"]')).toBe(false)
  })

  it("stops the version at a voice change, and the do line and the ring's do follow the new voice at once", () => {
    // Arrange: the first version in the lower voice, its fourth note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountSing()
    el('[data-version="1"]').click()
    vi.advanceTimersByTime(2000)

    // Act
    el('[data-panel="voice"] [data-voice="higher"]').click()
    vi.advanceTimersByTime(10000)

    // Assert: Merc cut off, and the higher voice's do, D4, where the lower's was
    expect(heard).toHaveLength(4)
    expect(heard[3].stopped).toBe(true)
    expect(el('[data-do-readout]').innerHTML).toBe(readoutHtml('higher', 0))
    expect(el('#ring .ring-note').innerHTML).toBe(ringLabel(62))
    expect(el('#singStatus').textContent).toBe(STATUS.first)
    expect(lit('[data-version="1"]')).toBe(false)
  })
})

describe("Lesson 6's Sing it: its live lines", () => {
  /** Watches a line from now on; the words of every write it has had, when asked. */
  function watchWrites(target: HTMLElement): () => string[] {
    const records: MutationRecord[] = []
    const watch = new MutationObserver((found) => records.push(...found))
    watch.observe(target, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    return () =>
      [...records, ...watch.takeRecords()].flatMap((r) =>
        Array.from(r.addedNodes, (n) => n.textContent ?? ''),
      )
  }

  it('writes the do line once and the status only on a change, however often a version is pressed', async () => {
    // Arrange: Sing it mounted, its do line written then, both lines watched from now on
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    mountSing()
    const doLine = watchWrites(el('[data-do-readout]'))
    const status = watchWrites(el('#singStatus'))

    // Act: the voice already chosen pressed again, then the first version twice, to its end each time
    el('[data-panel="voice"] [data-voice="lower"]').click()
    el('[data-version="1"]').click()
    await vi.advanceTimersByTimeAsync(9700)
    el('[data-version="1"]').click()
    await vi.advanceTimersByTimeAsync(9700)

    // Assert
    expect(doLine()).toEqual([])
    expect(el('[data-do-readout]').textContent).toBe('do is D3, then F3')
    expect(status()).toEqual([
      RUNNING.model(1),
      STATUS.ready,
      RUNNING.model(1),
      STATUS.ready,
    ])
  })
})
