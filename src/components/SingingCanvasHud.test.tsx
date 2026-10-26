// The Sing rail's docked Merc steps aside while a coach tour runs, so the
// bubble's Merc is the only one on screen, and comes back when it ends.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setCoachActive } from '@/lib/coach-state'
import { setShowMascot } from '@/stores/settings-store'
import { SingingCanvasHud } from './SingingCanvasHud'

vi.mock('@/components/MascotDock', () => ({
  MascotDock: () => {
    const dock = document.createElement('div')
    dock.dataset.testid = 'mascot-dock'
    return dock
  },
}))

afterEach(() => {
  cleanup()
  setCoachActive(null)
})

function mountHud(): void {
  render(() => (
    <SingingCanvasHud
      noteResults={() => []}
      pitch={() => null}
      targetNoteName={() => null}
      liveScore={() => null}
      isPlaying={() => false}
    />
  ))
}

describe('SingingCanvasHud', () => {
  it('hides the docked Merc while a coach tour runs, and brings him back after', () => {
    setShowMascot(true)
    mountHud()
    expect(screen.queryByTestId('mascot-dock')).not.toBeNull()

    setCoachActive('sing')
    expect(screen.queryByTestId('mascot-dock')).toBeNull()

    setCoachActive(null)
    expect(screen.queryByTestId('mascot-dock')).not.toBeNull()
  })

  it('keeps him hidden when the setting says so, tour or not', () => {
    setShowMascot(false)
    mountHud()
    expect(screen.queryByTestId('mascot-dock')).toBeNull()
  })
})
