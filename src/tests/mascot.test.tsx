import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { MascotState } from '@/components/Mascot'
import { Mascot } from '@/components/Mascot'

const STATES: MascotState[] = [
  'idle',
  'listening',
  'celebrate',
  'encouraging',
  'singing',
  'sleep',
]

describe('Mascot', () => {
  afterEach(cleanup)

  it('renders exactly one svg for every state', () => {
    for (const state of STATES) {
      const { container, unmount } = render(() => <Mascot state={state} />)
      expect(container.querySelectorAll('svg').length).toBe(1)
      unmount()
    }
  })

  it('labels Merc for a11y by default and hides it when title is empty', () => {
    const { container, unmount } = render(() => <Mascot state="idle" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('Merc')
    unmount()

    const { container: c2 } = render(() => <Mascot state="idle" title="" />)
    const svg2 = c2.querySelector('svg')
    expect(svg2?.getAttribute('role')).toBe('presentation')
    expect(svg2?.getAttribute('aria-label')).toBeNull()
  })

  it('reacts to a state accessor (idle -> celebrate swaps the face)', () => {
    const [state, setState] = createSignal<MascotState>('idle')
    const { container } = render(() => <Mascot state={state} />)
    // celebrate is the only state with this filled open-mouth path
    const openMouth = 'path[d="M52 87 Q60 98 68 87 Q60 91 52 87 Z"]'
    expect(container.querySelector(openMouth)).toBeNull()
    setState('celebrate')
    expect(container.querySelector(openMouth)).not.toBeNull()
  })
})
