// ============================================================
// WarmUpFixture: a state of the Warm-up's path, pinned
// ============================================================
//
// As the rooms' fixtures (LongNoteFixture.tsx): the path itself draws the
// state, from a pinned run (fixture-runs.ts), with every motion settled.
// The shell's bar is stood in for by its back chevron and title, so a
// capture shows the screen as the phone does; the level pill sits where
// the bar's right side would be (RoomBar.tsx draws it in place).
//
// Reached only from the dev server: the native entry imports this behind
// `import.meta.env.DEV` (`?warmFixture=start`), so no build carries it.
// A capture waits for
//   [data-testid="warm-up-fixture"][data-fixture="<name>"][data-ready="true"]
// which is set once the sky is on screen.

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { ChevronLeft } from '@/components/icons'
import { pinnedSource } from '../path-source'
import { WarmUpPath } from '../WarmUpPath'
import type { WarmFixtureName } from './fixture-runs'
import { fixtureRun } from './fixture-runs'

export interface WarmUpFixtureProps {
  name: WarmFixtureName
  /** How many stand-in unlocks the run carries (fixture-runs.ts). */
  unlocks?: number
}

const BAR: JSX.CSSProperties = {
  position: 'absolute',
  top: 'var(--safe-top, 0px)',
  left: '0',
  right: '0',
  height: '56px',
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  padding: '0 12px',
  color: '#e1e4eb',
  font: '600 17px/1 var(--font-body, sans-serif)',
  'pointer-events': 'none',
  'z-index': '4',
}

export function WarmUpFixture(props: WarmUpFixtureProps): JSX.Element {
  const [ready, setReady] = createSignal(false)
  // eslint-disable-next-line solid/reactivity -- a fixture is one frame
  const source = pinnedSource(fixtureRun(props.name, props.unlocks))
  // Two frames after the sky, for the column's last layout to settle.
  const settled = (): void => {
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        '--pushed-top': 'calc(var(--safe-top, 0px) + 56px)',
        '--pushed-bottom': 'var(--safe-bottom, 0px)',
      }}
      data-testid="warm-up-fixture"
      data-fixture={props.name}
      data-ready={ready() ? 'true' : 'false'}
    >
      <WarmUpPath
        source={source}
        still
        onOpenRoom={() => undefined}
        onDone={() => undefined}
        onSong={() => undefined}
        onPremium={() => undefined}
        onSkySettled={settled}
      />
      <div style={BAR} aria-hidden="true">
        <ChevronLeft />
        <span>Warm-up</span>
      </div>
    </div>
  )
}
