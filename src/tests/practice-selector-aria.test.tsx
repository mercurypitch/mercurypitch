// ============================================================
// The practice-engine selectors say which one is chosen
// ============================================================
//
// Voice range, accuracy tier, buffer size, play mode, and the karaoke
// processing pills were all bare <button>s: no role, no aria-checked, no
// aria-pressed. The ARIA snapshot read "button Tenor" before and after
// choosing Tenor, so a screen-reader or high-contrast user could not tell
// which of six voices the pitch engine was set to, and got no confirmation
// that a press had landed. Selection was carried by a background tint alone.
//
// The app already had the right pattern one panel away — SegmentedControl is
// a radiogroup whose selected item reports aria-checked — so this is the
// inconsistency being closed, not a new convention.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { LoopControls } from '@/components/shared/control-bar/LoopControls'
import { TierSelector } from '@/components/TierSelector'
import { VocalRangeSelector } from '@/components/VocalRangeSelector'
import { applyAccuracyTier, setVocalRangePreset } from '@/stores/settings-store'

afterEach(cleanup)

describe('TierSelector', () => {
  it('is a radiogroup with one checked tier', () => {
    applyAccuracyTier('singer')
    const { getByRole, getAllByRole } = render(() => <TierSelector />)

    expect(getByRole('radiogroup', { name: 'Accuracy tier' })).toBeTruthy()
    const radios = getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(
      radios.filter((r) => r.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(1)
  })

  it('moves the checked state when a tier is chosen', () => {
    applyAccuracyTier('learning')
    const { getAllByRole } = render(() => <TierSelector />)
    const [learning, singer] = getAllByRole('radio')

    expect(learning?.getAttribute('aria-checked')).toBe('true')
    expect(singer?.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(singer!)

    expect(learning?.getAttribute('aria-checked')).toBe('false')
    expect(singer?.getAttribute('aria-checked')).toBe('true')
  })
})

describe('VocalRangeSelector', () => {
  it('is a radiogroup over the six voices', () => {
    setVocalRangePreset('tenor')
    const { getByRole, getAllByRole } = render(() => <VocalRangeSelector />)

    expect(
      getByRole('radiogroup', { name: 'Singing voice range' }),
    ).toBeTruthy()
    const radios = getAllByRole('radio')
    expect(radios).toHaveLength(6)
    const checked = radios.filter(
      (r) => r.getAttribute('aria-checked') === 'true',
    )
    expect(checked).toHaveLength(1)
    expect(checked[0]?.textContent).toContain('Tenor')
  })

  it('announces the voice the singer picks', () => {
    setVocalRangePreset('tenor')
    const { getAllByRole } = render(() => <VocalRangeSelector />)
    const bass = getAllByRole('radio')[5]

    fireEvent.click(bass!)

    expect(bass?.getAttribute('aria-checked')).toBe('true')
    expect(
      getAllByRole('radio').filter(
        (r) => r.getAttribute('aria-checked') === 'true',
      ),
    ).toHaveLength(1)
  })
})

describe('LoopControls', () => {
  // A and B are not radios — each is a toggle in its own right, set or not —
  // so they report aria-pressed rather than joining a group.
  const renderLoop = (a: number, b: number, enabled: boolean) =>
    render(() => (
      <LoopControls
        loopA={() => a}
        loopB={() => b}
        loopEnabled={() => enabled}
        onSetLoopA={() => {}}
        onSetLoopB={() => {}}
        onToggleLoop={() => {}}
        onClearLoop={() => {}}
      />
    ))

  it('reports an unset loop as unpressed', () => {
    const { getByTestId } = renderLoop(0, 0, false)
    expect(getByTestId('loop-a-btn').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('loop-b-btn').getAttribute('aria-pressed')).toBe('false')
  })

  it('reports the points that are set, and whether the loop is running', () => {
    const { getByTestId } = renderLoop(2, 8, true)
    expect(getByTestId('loop-a-btn').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('loop-b-btn').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('loop-toggle-btn').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('separates a set loop from a running one', () => {
    const { getByTestId } = renderLoop(2, 8, false)
    expect(getByTestId('loop-toggle-btn').getAttribute('aria-pressed')).toBe(
      'false',
    )
  })
})

// The remaining groups live inside components that need a whole app around
// them (the settings panel, the two control bars, the karaoke workspace), so
// the contract is read off the source. What matters is that the group and its
// state markers stay together — half of this pattern is worse than none.
describe('the rest of the practice-engine selectors', () => {
  const read = (path: string): string => readFileSync(path, 'utf8')

  it('makes the buffer-size pills a radiogroup', () => {
    const src = read('src/components/SettingsPanel.tsx')
    expect(src).toMatch(/role="radiogroup"\s*\n\s*aria-label="Buffer size"/)
    expect(src).toMatch(/aria-checked=\{pitchBufferSize\(\) === size\}/)
  })

  it('makes both play-mode segments radiogroups', () => {
    for (const bar of [
      'src/components/singing/SingingControlBar.tsx',
      'src/components/piano/PianoControlBar.tsx',
    ]) {
      const src = read(bar)
      expect(src).toContain('role="radiogroup" aria-label="Play mode"')
      expect(src).toMatch(
        /aria-checked=\{props\.playMode\(\) === PLAYBACK_MODE_ONCE\}/,
      )
      expect(src).toMatch(
        /aria-checked=\{props\.playMode\(\) === PLAYBACK_MODE_REPEAT\}/,
      )
    }
  })

  it('makes the karaoke processing, stem and device pills radiogroups', () => {
    const src = read('src/components/UvrPanel.tsx')
    for (const label of ['Processing', 'Stems', 'Device']) {
      expect(src).toMatch(
        new RegExp(`role="radiogroup"\\s*\\n?\\s*aria-label="${label}"`),
      )
    }
    expect(src).toMatch(/aria-checked=\{uvrProcessingMode\(\) === 'server'\}/)
    expect(src).toMatch(/aria-checked=\{uvrProcessingMode\(\) === 'local'\}/)
    expect(src).toMatch(/aria-checked=\{bandSplitChoice\(\)\}/)
    expect(src).toMatch(/aria-checked=\{uvrForceWebGpu\(\)\}/)
  })
})
