// UnifiedSongFileDrop tests protect injected host identity and owned-picker behavior.
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { UnifiedSongFileDrop } from './UnifiedSongFileDrop'

const classes = {
  root: 'host-root',
  status: 'host-status',
  prompt: 'host-prompt',
  choose: 'host-choose',
  dropAlternative: 'host-or',
  formats: 'host-formats',
  overlay: 'host-overlay',
  input: 'host-input',
}

const copy = {
  chooseFile: 'Open arrangement',
  dropAlternative: 'or place it here',
  formats: 'Audio · MIDI · GPX',
  activeDrop: 'Drop the arrangement',
  oneFile: 'One arrangement at a time',
  opening: (fileName: string) => `Reading ${fileName}`,
}

describe('UnifiedSongFileDrop', () => {
  it('owns an accepted picker and sends its one selected file to the host', () => {
    const onFile = vi.fn()
    render(() => (
      <UnifiedSongFileDrop
        accept=".mid,.gpx,audio/wav"
        copy={copy}
        classes={classes}
        testId="arrangement-drop"
        onFile={onFile}
        onRejected={() => {}}
      >
        <strong>Current arrangement</strong>
      </UnifiedSongFileDrop>
    ))
    const input = screen.getByTestId('arrangement-drop-input')
    const arrangement = new File(['score'], 'pocket.gpx')

    expect(screen.getByTestId('arrangement-drop')).toHaveClass('host-root')
    expect(input).toHaveAttribute('accept', '.mid,.gpx,audio/wav')
    expect(
      screen.getByRole('button', { name: 'Open arrangement' }),
    ).toHaveClass('host-choose')
    fireEvent.change(input, { target: { files: [arrangement] } })

    expect(onFile).toHaveBeenCalledWith(arrangement)
  })

  it('uses an injected picker without rendering a second file input', () => {
    const onChoose = vi.fn()
    render(() => (
      <UnifiedSongFileDrop
        accept=".mid"
        copy={copy}
        classes={classes}
        testId="delegated-drop"
        onChoose={onChoose}
        onFile={() => {}}
        onRejected={() => {}}
      >
        <span>Arrangement</span>
      </UnifiedSongFileDrop>
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Open arrangement' }))

    expect(onChoose).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('delegated-drop-input')).not.toBeInTheDocument()
  })
})
