// The beat machine on a fake beat clock: each state shows its own controls,
// the cells are toggles only where the grid is editable, a state change
// stops what plays, a play cut short resolves false, the page's one owner
// stops it when another sound starts, and its live line is written once a
// change, never again with the same words.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as BeatClockModule from './beat-clock'
import type { MachineState } from './beat-layout'
import type { Lane } from './beat-patterns'

interface FakeRun {
  o: { bar: (i: number) => unknown; bpm: () => number; audible: boolean }
  stopped: boolean
  end: (heard: boolean) => void
}
const runs: FakeRun[] = []

vi.mock('./beat-clock', async (actual) => {
  const real = await actual<typeof BeatClockModule>()
  return {
    ...real,
    BeatClock: {
      start(o: FakeRun['o']) {
        let end: (heard: boolean) => void = () => undefined
        const done = new Promise<boolean>((r) => (end = r))
        const run: FakeRun = { o, stopped: false, end }
        runs.push(run)
        return {
          done,
          get running() {
            return !run.stopped
          },
          stop() {
            run.stopped = true
            end(false)
          },
          pageTimeOfBeat: () => 0,
        }
      },
    },
  }
})

const { mountBeatMachine, METRONOME_STARTED } = await import('./beat-machine')
const { createSoundOwner } = await import('./now-playing')

const LANES: readonly Lane[] = [
  {
    id: 'kick',
    name: 'Kick',
    one: 'kick',
    many: 'kick',
    voice: 'kick',
    level: 0.8,
    accent: 1,
    perBeat: 1,
  },
  {
    id: 'clap',
    name: 'Clap',
    one: 'clap',
    many: 'claps',
    voice: 'clap',
    level: 0.7,
    perBeat: 1,
    backbeat: true,
  },
  {
    id: 'hat',
    name: 'Hi-hat',
    one: 'hi-hat',
    many: 'hi-hat',
    voice: 'hh-closed',
    level: 0.5,
    perBeat: 2,
  },
]
const PATTERNS = {
  rock: {
    name: 'Rock',
    bpm: 90,
    pattern: {
      beats: 4,
      cells: { kick: [1, 0, 1, 0], clap: [0, 1, 0, 1], hat: [1, 1, 1, 1] },
    },
  },
  march: {
    name: 'March',
    bpm: 120,
    pattern: {
      beats: 4,
      cells: { kick: [2, 0, 0, 0], clap: [0, 1, 1, 1], hat: [0, 0, 0, 0] },
    },
  },
} as const

const START = (label: string) =>
  `<button type="button" data-bm-start="${label}"><svg><use href="#i-play"/></svg><span data-label>${label}</span></button>`
const FIXTURE = `
<div id="toy">
  <div data-bm><p data-bm-summary></p><p aria-live="polite" data-bm-said></p></div>
  <div data-bm-for="metronome tempo">${START('Start')}<button type="button" data-bm-pad>Tap</button></div>
  <div data-bm-for="tempo"><input type="range" id="t1" min="60" max="140" value="90" data-bm-tempo="metro"></div>
  <div data-bm-for="bars">${START('Start')}<button data-bars="2"></button><button data-bars="3"></button><button data-bars="4"></button></div>
  <div data-bm-for="grid">${START('Play')}<button type="button" data-bm-reset>Reset</button></div>
  <div data-bm-for="patterns">${START('Play')}<button data-bm-pattern="march"></button><button data-bm-pattern="rock"></button></div>
  <div data-bm-hits></div>
</div>`

function mount(state: MachineState = 'metronome') {
  document.body.innerHTML = FIXTURE
  const root = document.getElementById('toy') as HTMLElement
  const figure = root.querySelector<HTMLElement>('[data-bm]') as HTMLElement
  Object.defineProperty(figure, 'clientWidth', { value: 600 })
  Object.defineProperty(figure, 'clientHeight', { value: 250 })
  const owner = createSoundOwner()
  const machine = mountBeatMachine({
    root,
    lanes: LANES,
    patterns: PATTERNS,
    grid: 'rock',
    shown: 'march',
    bpm: 90,
    id: 'mt-test',
    owner,
    state,
  })
  const said = root.querySelector<HTMLElement>('[data-bm-said]') as HTMLElement
  const shown = () =>
    [...root.querySelectorAll<HTMLElement>('[data-bm-for]')]
      .filter((r) => !r.hidden)
      .map((r) => r.dataset.bmFor)
  const cell = (lane: string, i: number) =>
    root.querySelector<HTMLButtonElement>(
      `.bm-cell[data-lane="${lane}"][data-cell="${i}"]`,
    ) as HTMLButtonElement
  const start = () =>
    [...root.querySelectorAll<HTMLButtonElement>('[data-bm-start]')].find(
      (b) => b.closest('[hidden]') === null,
    ) as HTMLButtonElement
  return { root, machine, owner, said, shown, cell, start }
}

beforeEach(() => {
  runs.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mountBeatMachine', () => {
  it("shows each state's own controls and none of the others'", () => {
    // Arrange
    const m = mount()

    // Assert
    expect(m.shown()).toEqual(['metronome tempo'])

    // Act, Assert
    m.machine.setState('tempo')
    expect(m.shown()).toEqual(['metronome tempo', 'tempo'])
    m.machine.setState('bars')
    expect(m.shown()).toEqual(['bars'])
    m.machine.setState('patterns')
    expect(m.shown()).toEqual(['patterns'])
  })

  it('makes the cells toggles in the grid state only, and says what each toggle changed', () => {
    // Arrange
    const m = mount('grid')

    // Act
    m.cell('clap', 0).click()

    // Assert
    expect(m.cell('clap', 0).getAttribute('aria-pressed')).toBe('true')
    expect(m.cell('clap', 0).getAttribute('aria-label')).toBe('Clap on beat 1')
    expect(m.said.textContent).toBe('Claps on 1, 2 and 4')
    // the backbeat's claps are drawn in gold, a clap on 1 is not
    expect(m.cell('clap', 1).classList.contains('gold')).toBe(true)
    expect(m.cell('clap', 0).classList.contains('gold')).toBe(false)

    // Act
    m.machine.setState('patterns')

    // Assert: Step 5's grid shows the pattern playing, and is not edited
    expect(m.cell('clap', 2).disabled).toBe(true)
    expect(m.cell('kick', 0).classList.contains('acc')).toBe(true)
  })

  it('speaks the tapped tempo on its live line, at most every 2 s and once more when the taps change it', () => {
    // Arrange
    vi.useFakeTimers()
    const m = mount()
    const pad = m.root.querySelector('[data-bm-pad]') as HTMLButtonElement
    const tapAt = (t: number): void => {
      const e = new KeyboardEvent('keydown', { key: ' ' })
      Object.defineProperty(e, 'timeStamp', { value: t })
      pad.dispatchEvent(e)
    }

    // Act: four taps 750 ms apart, then three quicker ones inside 2 s
    for (const t of [0, 750, 1500, 2250]) tapAt(t)
    const first = m.said.textContent
    for (const t of [2850, 3450, 4050]) tapAt(t)
    const meanwhile = m.said.textContent
    vi.advanceTimersByTime(2000)

    // Assert
    expect(first).toBe('Your taps: 80 beats per minute')
    expect(meanwhile).toBe(first)
    expect(m.said.textContent).toBe('Your taps: 89 beats per minute')
    vi.useRealTimers()
  })

  it('presses the pattern free play just loaded, as its live line names it', () => {
    // Arrange: the fixture's machine shows March pressed to start
    const m = mount('free')
    const march = m.root.querySelector(
      '[data-bm-pattern="march"]',
    ) as HTMLButtonElement
    const rock = m.root.querySelector(
      '[data-bm-pattern="rock"]',
    ) as HTMLButtonElement

    // Act
    rock.click()

    // Assert
    expect(rock.getAttribute('aria-pressed')).toBe('true')
    expect(march.getAttribute('aria-pressed')).toBe('false')
    expect(m.said.textContent).toMatch(/^Rock at /)
  })

  it('puts Rock back on Reset, and says so', () => {
    // Arrange
    const m = mount('grid')
    m.cell('clap', 1).click()

    // Act
    m.root.querySelector<HTMLButtonElement>('[data-bm-reset]')?.click()

    // Assert
    expect(m.cell('clap', 1).getAttribute('aria-pressed')).toBe('true')
    expect(m.said.textContent).toBe(
      'Rock is back: kick on 1 and 3, claps on 2 and 4, hi-hat on every half beat',
    )
  })

  it('plays as the page’s one sound, and stops when another sound claims the page', () => {
    // Arrange
    const m = mount()

    // Act
    m.start().click()

    // Assert
    expect(m.machine.playing).toBe(true)
    expect(m.said.textContent).toBe(METRONOME_STARTED)
    expect(m.start().textContent).toBe('Stop')

    // Act: another sound on the page starts
    m.owner.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(m.machine.playing).toBe(false)
    expect(m.start().textContent).toBe('Start')
  })

  it('stops what it plays when the state changes, and the run books no more bars', () => {
    // Arrange
    const m = mount()
    m.start().click()

    // Act
    m.machine.setState('tempo')

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(m.machine.playing).toBe(false)
    // a bar asked for after the change ends the run, whatever was booked before
    expect(runs[0].o.bar(5)).toBeNull()
  })

  it('stops nothing when the same state is shown again, as a layout change does', () => {
    // Arrange
    const m = mount()
    m.start().click()

    // Act
    m.machine.setState('metronome')

    // Assert
    expect(runs[0].stopped).toBe(false)
    expect(m.machine.playing).toBe(true)
  })

  it("changes a playing pattern's tempo with the pattern, at the next bar line", () => {
    // Arrange: Rock playing on Step 5's grid, its first bar booked
    const m = mount('patterns')
    m.root.querySelector<HTMLButtonElement>('[data-bm-pattern="rock"]')?.click()
    m.start().click()
    runs[0].o.bar(0)

    // Act: March chosen part way through that bar, then the next bar comes up
    m.root
      .querySelector<HTMLButtonElement>('[data-bm-pattern="march"]')
      ?.click()
    const restOfBar = runs[0].o.bpm()
    runs[0].o.bar(1)
    const nextBar = runs[0].o.bpm()

    // Assert: Rock's 90 to its bar line, then March's 120
    expect([restOfBar, nextBar]).toEqual([90, 120])
  })

  it('resolves a pattern played to its end true, and one cut short false', async () => {
    // Arrange
    const m = mount('patterns')

    // Act
    const heard = m.machine.playPattern('rock', 90, 2, true)
    runs[0].end(true)
    const cut = m.machine.playPattern('march', 120, 2, true)
    m.machine.setState('grid')

    // Assert
    await expect(heard).resolves.toBe(true)
    await expect(cut).resolves.toBe(false)
    // two bars, then the end
    expect(runs[1].o.bar(1)).not.toBeNull()
    expect(runs[1].o.bar(2)).toBeNull()
    expect(runs[1].o.bpm()).toBe(120)
  })

  it('writes its live line only when the words change', () => {
    // Arrange
    const m = mount('bars')
    const writes = vi.fn()
    new MutationObserver(writes).observe(m.said, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    const bars3 = m.root.querySelector<HTMLButtonElement>(
      '[data-bars="3"]',
    ) as HTMLButtonElement

    // Act
    bars3.click()
    bars3.click()

    // Assert
    return Promise.resolve().then(() => {
      expect(m.said.textContent).toBe('Bars of 3')
      expect(writes).toHaveBeenCalledTimes(1)
      expect(bars3.getAttribute('aria-pressed')).toBe('true')
    })
  })

  it('moves the tempo by 10 on Page Up and Page Down, within 60 and 140, and speaks it', () => {
    // Arrange
    const m = mount()
    m.machine.setState('tempo')
    const t = m.root.querySelector<HTMLInputElement>('#t1') as HTMLInputElement

    // Act
    for (let i = 0; i < 6; i++)
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp' }))

    // Assert
    expect(t.value).toBe('140')
    expect(t.getAttribute('aria-valuetext')).toBe('140 beats per minute')

    // Act
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))

    // Assert
    expect(t.value).toBe('130')
  })
})
