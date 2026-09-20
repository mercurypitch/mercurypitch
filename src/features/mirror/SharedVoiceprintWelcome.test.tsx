import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SharedVoiceprintWelcome } from './SharedVoiceprintWelcome'

afterEach(cleanup)

const FULL = { lo: 48, hi: 74, st: 26, ac: 12, sd: 9, tw: 'Freddie Mercury' }

describe('SharedVoiceprintWelcome', () => {
  it('leads with the voiceprint that was sent, not with an invitation to sing', () => {
    render(() => <SharedVoiceprintWelcome data={FULL} onStart={() => {}} />)

    expect(screen.getByText('Someone sent you this')).toBeTruthy()
    expect(screen.getByText('C3 – D5')).toBeTruthy()
    expect(screen.getByText('2 octaves + 2 semitones')).toBeTruthy()
    expect(screen.getByText(/Freddie Mercury/)).toBeTruthy()
    expect(screen.getByText('±12¢')).toBeTruthy()
    expect(screen.getByText('±9¢ on holds')).toBeTruthy()
  })

  it('stays anonymous unless the sender opted into a name', () => {
    render(() => <SharedVoiceprintWelcome data={FULL} onStart={() => {}} />)
    expect(screen.getByText('A voiceprint')).toBeTruthy()

    cleanup()
    render(() => (
      <SharedVoiceprintWelcome
        data={{ ...FULL, n: 'Marko' }}
        onStart={() => {}}
      />
    ))
    expect(screen.getByText("Marko's voiceprint")).toBeTruthy()
  })

  it('renders a partial take without empty rows', () => {
    // A take can measure accuracy without completing the glide. The card
    // must not show a blank range or a stray dash where a number goes.
    render(() => (
      <SharedVoiceprintWelcome data={{ ac: 14 }} onStart={() => {}} />
    ))

    expect(screen.getByText('±14¢')).toBeTruthy()
    expect(screen.queryByText(/–/)).toBeNull()
    expect(screen.queryByText(/Voice twin/)).toBeNull()
    expect(screen.queryByText(/on holds/)).toBeNull()
  })

  it('hands off to the recipient’s own take', () => {
    const onStart = vi.fn()
    render(() => <SharedVoiceprintWelcome data={FULL} onStart={onStart} />)

    fireEvent.click(screen.getByRole('button', { name: 'Meet your voice' }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

describe('when the card cannot be drawn', () => {
  it('falls back to the written numbers rather than an empty frame', async () => {
    // No portrait loads under jsdom, so this is the fallback path by
    // construction — the same path a payload naming an unknown twin takes.
    render(() => <SharedVoiceprintWelcome data={FULL} onStart={() => {}} />)

    expect(screen.getByText('C3 – D5')).toBeTruthy()
    expect(document.querySelector('.shared-vp-figure')).toBeNull()
  })
})
