// ============================================================
// LrcDiffTool — the Lab's mapping differ
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { LrcDiffTool } from '@/features/lab/LrcDiffTool'

const REFERENCE = '[00:10.00]one [00:11.00]two\n[00:20.00]three [00:21.00]four'
/** Every word 400 ms late — the shape an uncalibrated reaction time makes. */
const LATE = '[00:10.40]one [00:11.40]two\n[00:20.40]three [00:21.40]four'

function paste(reference: string, candidate: string) {
  render(() => <LrcDiffTool />)
  fireEvent.input(screen.getByLabelText('Reference enhanced LRC'), {
    target: { value: reference },
  })
  fireEvent.input(screen.getByLabelText('Candidate enhanced LRC'), {
    target: { value: candidate },
  })
}

describe('LrcDiffTool', () => {
  it('waits for both sides before claiming any numbers', () => {
    render(() => <LrcDiffTool />)
    // The empty state's heading, not its body copy — the heading is the part
    // that has to keep meaning "no result yet" through a visual pass.
    expect(screen.getByText('Nothing to compare yet')).toBeInTheDocument()

    fireEvent.input(screen.getByLabelText('Reference enhanced LRC'), {
      target: { value: REFERENCE },
    })
    expect(screen.getByText('Nothing to compare yet')).toBeInTheDocument()
  })

  it('reports the headline numbers once both are loaded', () => {
    paste(REFERENCE, LATE)
    expect(screen.getByText('Words compared')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getAllByText('0.400 s').length).toBeGreaterThan(0)
    // The summary stat, the bias note and both line rows all say it.
    expect(screen.getAllByText('+0.400 s').length).toBeGreaterThan(0)
  })

  it('points a uniform bias at the control that fixes it', () => {
    paste(REFERENCE, LATE)
    expect(screen.getByText(/Shift all in the mapper/)).toBeInTheDocument()
  })

  it('says nothing about bias when there is none to fix', () => {
    paste(REFERENCE, REFERENCE)
    expect(screen.queryByText(/Shift all in the mapper/)).toBeNull()
  })

  it('names the lines it could not compare rather than scoring them', () => {
    paste(
      REFERENCE,
      '[00:10.00]different [00:11.00]words\n[00:20.00]three [00:21.00]four',
    )
    expect(screen.getByText(/could not be compared/)).toBeInTheDocument()
    expect(screen.getByText('text differs')).toBeInTheDocument()
  })

  it('puts the worst line first, because the table is for finding it', () => {
    paste(
      REFERENCE,
      '[00:10.00]one [00:11.00]two\n[00:20.90]three [00:21.90]four',
    )
    const rows = screen.getAllByRole('row').slice(1)
    // Line 2 drifted 900 ms; line 1 is exact.
    expect(rows[0]).toHaveTextContent('2')
    expect(rows[0]).toHaveTextContent('0.900 s')
  })
})
