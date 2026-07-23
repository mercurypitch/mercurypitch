import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { SheetViewToggle } from '@/components/SheetViewToggle'

describe('SheetViewToggle', () => {
  it('exposes the current view and requests notation', () => {
    const onToggle = vi.fn()
    render(() => <SheetViewToggle active={() => false} onToggle={onToggle} />)

    const melody = screen.getByRole('button', { name: 'Melody' })
    const notation = screen.getByRole('button', { name: 'Notation' })

    expect(melody).toHaveAttribute('aria-pressed', 'true')
    expect(notation).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(notation)

    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('marks notation as active and requests melody', () => {
    const onToggle = vi.fn()
    render(() => <SheetViewToggle active={() => true} onToggle={onToggle} />)

    const melody = screen.getByRole('button', { name: 'Melody' })
    const notation = screen.getByRole('button', { name: 'Notation' })

    expect(melody).toHaveAttribute('aria-pressed', 'false')
    expect(notation).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(melody)
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
