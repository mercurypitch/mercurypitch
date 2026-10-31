// A sung answer's pad: in the room, the room kit's mic in place of the
// keys (the mock-ups' "Answering by voice"); on the web, the lead pad it
// always was.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MicPad, StageSkinContext } from '@/features/ear-lab/EarStage'
import { ROOM_SKIN } from './skin'

afterEach(cleanup)

function inRoom(mic: 'ready' | 'wait' | 'sing' | 'done', onClick = vi.fn()) {
  render(() => (
    <StageSkinContext.Provider value={ROOM_SKIN}>
      <MicPad
        mic={mic}
        level={() => 0.4}
        label="Done"
        sub="or wait for silence to close it"
        onClick={onClick}
      />
    </StageSkinContext.Provider>
  ))
  return screen.getByTestId('merc-mic') as HTMLButtonElement
}

describe('a sung answer', () => {
  it("is the room kit's mic in the room, lit while it is the singer's turn", () => {
    const judge = vi.fn()
    const mic = inRoom('sing', judge)
    expect(mic.getAttribute('data-state')).toBe('sing')
    expect(mic.getAttribute('aria-label')).toBe(
      'Done, or wait for silence to close it',
    )
    expect(screen.getByText('Your turn')).toBeTruthy()
    // A press closes the answer now, as Done does.
    mic.click()
    expect(judge).toHaveBeenCalledOnce()
  })

  it('waits, still, while the phrase plays, and takes no press', () => {
    const mic = inRoom('wait')
    expect(mic.getAttribute('data-state')).toBe('wait')
    expect(mic.disabled).toBe(true)
    expect(screen.getByText('Listen first')).toBeTruthy()
  })

  it('closes to an outline at the reveal', () => {
    const mic = inRoom('done')
    expect(mic.getAttribute('data-state')).toBe('done')
    expect(mic.disabled).toBe(true)
    expect(screen.getByText('Closed')).toBeTruthy()
  })

  it("is the web's lead pad, as it was, outside the room", () => {
    render(() => (
      <MicPad
        mic="sing"
        level={() => 0}
        label="Done"
        sub="or wait for silence to close it"
        onClick={vi.fn()}
      />
    ))
    expect(screen.queryByTestId('merc-mic')).toBeNull()
    expect(screen.getByText('Done')).toBeTruthy()
  })
})
