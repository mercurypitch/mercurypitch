// ProfileView counts runs, not the chart's input.
// ============================================================
//
// The regression this locks: the profile read its figures from
// `profileStats(sessions)`, and `sessions` is the device-local practice
// history. A singer with nineteen exercises and thirteen challenges saw
// "0 sessions" on their own profile.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSession } from '@/features/community/profile-model'
import { ProfileView } from '@/features/community/ProfileView'
import type { ProgressRun } from '@/features/progress/run-kinds'

afterEach(cleanup)

function run(
  kind: ProgressRun['kind'],
  score: number,
  day: number,
): ProgressRun {
  return {
    kind,
    score,
    completedAt: Date.UTC(2026, 0, day),
    hasNoteDetail: false,
  }
}

function base(): {
  displayName: string
  bio: string
  sessions: readonly ProfileSession[]
  runs: readonly ProgressRun[]
  streak: number
  sharedMelodies: number
  sharedSetlists: number
} {
  return {
    displayName: 'Maff',
    bio: '',
    sessions: [],
    runs: [],
    streak: 0,
    sharedMelodies: 0,
    sharedSetlists: 0,
  }
}

describe('ProfileView run counts', () => {
  it('counts runs of every kind, not just the local practice history', () => {
    const runs = [
      run('exercise', 70, 1),
      run('challenge', 80, 2),
      run('weekly', 90, 3),
    ]
    // No local practice history at all — the exact state that produced the
    // original "0 sessions" report.
    render(() => <ProfileView {...base()} runs={runs} sessions={[]} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('runs')).toBeInTheDocument()
  })

  it('says "run" when there is one', () => {
    render(() => <ProfileView {...base()} runs={[run('practice', 50, 1)]} />)
    expect(screen.getByText('run')).toBeInTheDocument()
  })

  it('takes best and recent average from the runs too', () => {
    const runs = [
      run('practice', 40, 1),
      run('challenge', 96, 2),
      run('exercise', 60, 3),
    ]
    render(() => <ProfileView {...base()} runs={runs} />)

    expect(screen.getByText('96%')).toBeInTheDocument()
    // Mean of all three, since the window is five.
    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('breaks the headline down by kind', () => {
    const runs = [run('exercise', 70, 1), run('exercise', 72, 2)]
    render(() => <ProfileView {...base()} runs={runs} />)

    expect(
      screen.getByText('Exercise').previousElementSibling,
    ).toHaveTextContent('2')
    expect(
      screen.getByText('Challenge').previousElementSibling,
    ).toHaveTextContent('0')
  })

  it('says where the count came from when the caller knows', () => {
    render(() => (
      <ProfileView
        {...base()}
        runs={[run('practice', 50, 1)]}
        runScope="account"
      />
    ))
    expect(screen.getByText(/across your account/i)).toBeInTheDocument()
  })

  it('opens the explanation from the pill row', () => {
    const onExplainRuns = vi.fn()
    render(() => (
      <ProfileView
        {...base()}
        runs={[run('practice', 50, 1)]}
        onExplainRuns={onExplainRuns}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: /what counts here/i }))
    expect(onExplainRuns).toHaveBeenCalledTimes(1)
  })

  it('invites a first run rather than printing confident zeros', () => {
    render(() => <ProfileView {...base()} />)

    expect(screen.getByText(/Nothing to show yet/i)).toBeInTheDocument()
    expect(screen.queryByText('best')).toBeNull()
  })

  it('still draws the trend from the local history that has pitch detail', () => {
    const sessions: ProfileSession[] = [
      { score: 60, avgCents: 30, completedAt: Date.UTC(2026, 0, 1) },
      { score: 70, avgCents: 20, completedAt: Date.UTC(2026, 0, 2) },
    ]
    render(() => (
      <ProfileView
        {...base()}
        sessions={sessions}
        runs={[run('practice', 60, 1), run('practice', 70, 2)]}
      />
    ))

    expect(screen.getByText('How it has been going')).toBeInTheDocument()
  })

  it('shows the figures even when the trend has nothing to draw', () => {
    // Signed in on a fresh device: cloud runs, no local pitch history.
    render(() => (
      <ProfileView {...base()} runs={[run('challenge', 88, 1)]} sessions={[]} />
    ))

    // One run is both the best and the whole recent window, so 88% twice.
    expect(screen.getAllByText('88%')).toHaveLength(2)
    expect(screen.getByText('run')).toBeInTheDocument()
    expect(screen.queryByText('How it has been going')).toBeNull()
  })
})

describe('ProfileView published shelf', () => {
  it('calls published work published, and setlists setlists', () => {
    render(() => (
      <ProfileView {...base()} sharedMelodies={2} sharedSetlists={4} />
    ))

    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('setlists')).toBeInTheDocument()
    expect(screen.getByText('melodies')).toBeInTheDocument()
    // The old wording put "4 sessions" directly beneath a run count that
    // meant something else entirely.
    expect(screen.queryByText('sessions')).toBeNull()
    expect(screen.queryByText('Shared')).toBeNull()
  })

  it('uses the singular for one of each', () => {
    render(() => (
      <ProfileView {...base()} sharedMelodies={1} sharedSetlists={1} />
    ))

    expect(screen.getByText('melody')).toBeInTheDocument()
    expect(screen.getByText('setlist')).toBeInTheDocument()
  })

  it('hides the shelf entirely when nothing has been published', () => {
    render(() => <ProfileView {...base()} />)
    expect(screen.queryByText('Published')).toBeNull()
  })
})

describe('ProfileView identity', () => {
  it('shows the voice twin portrait once one has been measured', () => {
    render(() => <ProfileView {...base()} twinName="Elvis Presley" />)

    const portrait = screen.getByRole('img', {
      name: /Elvis Presley — your voice twin/,
    })
    // The `mid` tier, at the 90px box it was chosen to land on.
    expect(portrait).toHaveAttribute('src', '/legends/mid/elvis.webp')
    expect(portrait).toHaveAttribute('width', '90')
    expect(screen.getByText('Voice twin: Elvis Presley')).toBeInTheDocument()
  })

  it('falls back to a monogram, not an empty box, with no twin', () => {
    render(() => <ProfileView {...base()} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('falls back to a monogram when the twin has no art', () => {
    render(() => <ProfileView {...base()} twinName="Nobody At All" />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('offers the constellation only on the singer’s own profile', () => {
    const onExploreVoiceConstellation = vi.fn()
    render(() => (
      <ProfileView
        {...base()}
        twinName="Elvis Presley"
        onExploreVoiceConstellation={onExploreVoiceConstellation}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: /Explore constellation/i }),
    )
    expect(onExploreVoiceConstellation).toHaveBeenCalledTimes(1)
  })

  it('hides the constellation on a profile somebody else is reading', () => {
    render(() => <ProfileView {...base()} twinName="Elvis Presley" />)
    expect(screen.queryByText(/Explore constellation/i)).toBeNull()
  })
})

describe('ProfileView badges', () => {
  it('shows earned badges beside the twin', () => {
    render(() => (
      <ProfileView
        {...base()}
        badges={[{ iconName: 'crown', name: 'First Light', tier: 'gold' }]}
      />
    ))

    expect(screen.getByText('Badges')).toBeInTheDocument()
    expect(screen.getByText('First Light')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'First Light' })).toHaveAttribute(
      'src',
      '/badges/crown.webp',
    )
  })

  it('draws a placeholder for a badge whose medallion is not drawn yet', () => {
    render(() => (
      <ProfileView
        {...base()}
        badges={[{ iconName: 'not-drawn-yet', name: 'Mystery', tier: 'gold' }]}
      />
    ))

    expect(screen.getByText('Mystery')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Mystery' })).toBeNull()
  })

  it('hides the section entirely when no badges are earned', () => {
    render(() => <ProfileView {...base()} />)
    expect(screen.queryByText('Badges')).toBeNull()
  })
})

describe('ProfileView streak and trend', () => {
  it('shows a streak as days running', () => {
    render(() => (
      <ProfileView {...base()} runs={[run('practice', 50, 1)]} streak={3} />
    ))
    expect(screen.getByText('days running')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('uses the singular for a one-day streak', () => {
    render(() => (
      <ProfileView {...base()} runs={[run('practice', 50, 1)]} streak={1} />
    ))
    expect(screen.getByText('day streak')).toBeInTheDocument()
  })

  it('hides the streak figure entirely at zero', () => {
    render(() => <ProfileView {...base()} runs={[run('practice', 50, 1)]} />)
    expect(screen.queryByText(/day streak|days running/)).toBeNull()
  })

  it('says how far the score has moved, and which way', () => {
    const sessions: ProfileSession[] = [
      { score: 50, avgCents: 40, completedAt: Date.UTC(2026, 0, 1) },
      { score: 52, avgCents: 38, completedAt: Date.UTC(2026, 0, 2) },
      { score: 70, avgCents: 20, completedAt: Date.UTC(2026, 0, 3) },
      { score: 72, avgCents: 18, completedAt: Date.UTC(2026, 0, 4) },
    ]
    render(() => (
      <ProfileView
        {...base()}
        sessions={sessions}
        runs={[run('practice', 72, 4)]}
      />
    ))

    // Mean of the last two minus mean of the first two: 71 - 51 = 20.
    expect(screen.getByText(/points/).textContent).toBe('+20 points')
    expect(screen.getByText(/Since January 2026/)).toBeInTheDocument()
  })

  it('says so plainly when the score has gone the other way', () => {
    const sessions: ProfileSession[] = [
      { score: 90, avgCents: 10, completedAt: Date.UTC(2026, 0, 1) },
      { score: 88, avgCents: 12, completedAt: Date.UTC(2026, 0, 2) },
      { score: 50, avgCents: 40, completedAt: Date.UTC(2026, 0, 3) },
      { score: 48, avgCents: 42, completedAt: Date.UTC(2026, 0, 4) },
    ]
    render(() => (
      <ProfileView
        {...base()}
        sessions={sessions}
        runs={[run('practice', 48, 4)]}
      />
    ))

    expect(screen.getByText(/points/).textContent).toBe('-40 points')
  })
})
