// ============================================================
// RoomVoiceControl
// ============================================================
// Piano Night and Drum Night had no voice control at all: voice could carry
// somebody into either room and then had nothing that left it, because the
// phrases that leave belong to the shell's tab set and a standalone document
// never loads it. This is what those two rooms mount, and what it has to
// bring with it.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { matchVoiceCommand } from './command-grammar'
import RoomVoiceControl from './RoomVoiceControl'
import { activeVoiceCommands } from './voice-command-registry'

afterEach(cleanup)

describe('RoomVoiceControl', () => {
  it('gives the room a way out that can be spoken', () => {
    render(() => <RoomVoiceControl />)

    const commands = activeVoiceCommands()
    expect(matchVoiceCommand('go home', commands)?.command.id).toBe(
      'nav.leave.home',
    )
    expect(matchVoiceCommand('go to singing', commands)?.command.id).toBe(
      'nav.leave.singing',
    )
  })

  it('offers the other rooms too, so a night is not a cul-de-sac', () => {
    render(() => <RoomVoiceControl />)

    const commands = activeVoiceCommands()
    expect(matchVoiceCommand('go to karaoke night', commands)?.command.id).toBe(
      'nav.karaokeNight',
    )
  })

  it('answers "what can I say"', () => {
    render(() => <RoomVoiceControl />)

    expect(
      matchVoiceCommand('what can i say', activeVoiceCommands()),
    ).not.toBeNull()
  })

  it('shows the pill', () => {
    render(() => <RoomVoiceControl />)

    expect(screen.queryByTestId('voice-control-pill')).not.toBeNull()
  })

  it('takes its commands with it when the room closes', () => {
    const dispose = render(() => <RoomVoiceControl />)
    expect(activeVoiceCommands().length).toBeGreaterThan(0)

    dispose.unmount()

    // A room that left its phrases registered would have the studio offering
    // "go home" from inside a document that has no home to go to.
    expect(matchVoiceCommand('go home', activeVoiceCommands())).toBeNull()
  })
})
