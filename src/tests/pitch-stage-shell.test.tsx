import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { PitchStageShell } from '@/components/pitch-stage/PitchStageShell'

describe('PitchStageShell', () => {
  it('composes the shared pitch-stage chrome without owning mode logic', () => {
    render(() => (
      <PitchStageShell
        mode="zen-exercise"
        testId="exercise-stage"
        ariaLabel="Guided pitch exercise"
        eyebrow="Zen exercise"
        title="NG Five-Tone"
        icon={<span>N</span>}
        referenceColor="#f59e0b"
        userColor="#a78bfa"
        legend={[
          { label: 'Target', color: '#f59e0b' },
          { label: 'Your voice', color: '#a78bfa' },
        ]}
        headerMeta={<span>Take 2 of 5</span>}
        primaryAction={<button type="button">Finish</button>}
        canvas={<div data-testid="pitch-stage-canvas-content" />}
        sidecar={<p>Exercise guidance</p>}
        sidecarAriaLabel="Exercise guide"
        footer={<div>Loop controls</div>}
      />
    ))

    const stage = screen.getByRole('region', {
      name: 'Guided pitch exercise',
    })
    expect(stage).toHaveAttribute('data-pitch-stage-mode', 'zen-exercise')
    expect(stage).toHaveAttribute('data-has-canvas', 'true')
    expect(stage).toHaveAttribute('data-has-sidecar', 'true')
    expect(stage).toHaveAttribute('data-has-footer', 'true')
    expect(stage).toHaveStyle({
      '--pitch-reference': '#f59e0b',
      '--pitch-user': '#a78bfa',
    })
    expect(
      screen.getByRole('heading', { name: 'NG Five-Tone' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Pitch layer legend')).toHaveTextContent(
      'Target',
    )
    expect(
      screen.getByRole('complementary', { name: 'Exercise guide' }),
    ).toHaveTextContent('Exercise guidance')
    expect(screen.getByTestId('pitch-stage-canvas-content')).toBeInTheDocument()
    expect(screen.getByText('Loop controls')).toBeInTheDocument()
  })

  it('supports the external-canvas Stem facade and optional chrome slots', () => {
    render(() => (
      <PitchStageShell
        mode="stem-edit"
        ariaLabel="Pitch Studio note editor"
        eyebrow="Pitch Studio"
        title="Midnight City"
        icon={<span>N</span>}
        referenceColor="#f59e0b"
        userColor="#a78bfa"
      />
    ))

    const stage = screen.getByRole('region', {
      name: 'Pitch Studio note editor',
    })
    expect(stage).toHaveAttribute('data-pitch-stage-mode', 'stem-edit')
    expect(stage).toHaveAttribute('data-has-canvas', 'false')
    expect(stage).toHaveAttribute('data-has-sidecar', 'false')
    expect(stage).toHaveAttribute('data-has-footer', 'false')
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})
