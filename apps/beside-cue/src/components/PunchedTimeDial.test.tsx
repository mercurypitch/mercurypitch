import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PunchedTimeDial } from './PunchedTimeDial'

class FakePointerEvent extends MouseEvent {
  readonly pointerId: number

  constructor(type: string, init: MouseEventInit & { pointerId?: number }) {
    super(type, { bubbles: true, ...init })
    this.pointerId = init.pointerId ?? 1
  }
}

function dispatchPointer(
  element: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  timeStamp: number,
): void {
  const event = new FakePointerEvent(type, {
    clientX,
    clientY,
    pointerId: 7,
  })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  element.dispatchEvent(event)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function ControlledDial(props: {
  initialValue?: string
  onHaptic?: (strength: 'light' | 'medium') => void
}) {
  const [value, setValue] = createSignal(props.initialValue ?? '18:30')

  return (
    <PunchedTimeDial
      value={value()}
      defaultValue="09:00"
      onValueChange={setValue}
      onHaptic={props.onHaptic}
    />
  )
}

describe('PunchedTimeDial', () => {
  it('keeps the visible readout, slider semantics, and exact input in sync', () => {
    render(() => <ControlledDial />)

    const dial = screen.getByRole('slider', {
      name: 'Turn the record to choose a reminder time',
    })
    const input = screen.getByLabelText('Type exact time')

    expect(screen.getByText('18:30')).toBeVisible()
    expect(dial).toHaveAttribute('aria-valuenow', '1110')
    expect(dial).toHaveAttribute(
      'aria-valuetext',
      'Around 18:30; editing minutes',
    )
    expect(input).toHaveValue('18:30')

    fireEvent.input(input, { target: { value: '07:45' } })

    expect(screen.getByText('07:45')).toBeVisible()
    expect(dial).toHaveAttribute('aria-valuenow', '465')
    expect(dial).toHaveAttribute(
      'aria-valuetext',
      'Around 07:45; editing minutes',
    )
  })

  it('edits five-minute and hour registrations from the keyboard', () => {
    const onHaptic = vi.fn<(strength: 'light' | 'medium') => void>()
    render(() => <ControlledDial onHaptic={onHaptic} />)
    const dial = screen.getByRole('slider')

    fireEvent.keyDown(dial, { key: 'ArrowRight' })
    expect(screen.getByText('18:35')).toBeVisible()
    expect(onHaptic).toHaveBeenLastCalledWith('light')

    fireEvent.click(screen.getByRole('button', { name: 'Edit hours' }))
    fireEvent.keyDown(dial, { key: 'ArrowUp' })
    expect(screen.getByText('19:35')).toBeVisible()
    expect(onHaptic).toHaveBeenLastCalledWith('medium')

    fireEvent.keyDown(dial, { key: 'PageDown' })
    expect(screen.getByText('18:35')).toBeVisible()
  })

  it('shows a useful draft without silently choosing it', () => {
    const onValueChange = vi.fn<(value: string) => void>()
    render(() => (
      <PunchedTimeDial
        value=""
        defaultValue="09:00"
        onValueChange={onValueChange}
      />
    ))

    expect(screen.getByText('09:00')).toBeVisible()
    expect(screen.getByText('Turn to choose')).toBeVisible()
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      'Preview 09:00; no reminder time selected; editing minutes',
    )
    expect(screen.getByLabelText('Type exact time')).toHaveValue('')
    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenCalledWith('09:05')
  })

  it('stops responding while disabled', () => {
    const onValueChange = vi.fn<(value: string) => void>()
    render(() => (
      <PunchedTimeDial value="18:30" disabled onValueChange={onValueChange} />
    ))

    const dial = screen.getByRole('slider')
    fireEvent.keyDown(dial, { key: 'ArrowRight' })

    expect(dial).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Edit hours' })).toBeDisabled()
    expect(screen.getByLabelText('Type exact time')).toBeDisabled()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('honors a newer controlled value during settle and keeps observing later updates', async () => {
    let setExternalValue = (_value: string): void => undefined
    let settleFrame: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      settleFrame = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    function ExternallyControlledDial() {
      const [value, setValue] = createSignal('18:30')
      setExternalValue = (nextValue) => setValue(nextValue)
      return <PunchedTimeDial value={value()} onValueChange={setValue} />
    }

    render(() => <ExternallyControlledDial />)
    const dial = screen.getByRole('slider') as HTMLDivElement
    dial.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 440,
        height: 440,
        right: 440,
        bottom: 440,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
    let capturedPointer: number | undefined
    dial.setPointerCapture = (pointerId) => {
      capturedPointer = pointerId
    }
    dial.hasPointerCapture = (pointerId) => capturedPointer === pointerId
    dial.releasePointerCapture = () => {
      capturedPointer = undefined
    }

    dispatchPointer(dial, 'pointerdown', 400, 220, 10)
    dispatchPointer(dial, 'pointermove', 220, 400, 30)
    dispatchPointer(dial, 'pointerup', 220, 400, 40)
    setExternalValue('20:30')
    await Promise.resolve()

    expect(settleFrame).toBeTypeOf('function')
    settleFrame?.(performance.now() + 1_000)
    await Promise.resolve()
    expect(screen.getByLabelText('Type exact time')).toHaveValue('20:30')

    setExternalValue('07:15')
    await Promise.resolve()
    expect(screen.getByLabelText('Type exact time')).toHaveValue('07:15')
  })

  it('keeps the artwork still in reduced motion while the time remains draggable', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )

    render(() => <ControlledDial />)
    const dial = screen.getByRole('slider') as HTMLDivElement
    dial.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 440,
        height: 440,
        right: 440,
        bottom: 440,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
    dial.setPointerCapture = () => undefined
    dial.hasPointerCapture = () => false
    const rotors = [...dial.querySelectorAll<SVGGElement>('svg > g[style]')]

    expect(rotors).toHaveLength(2)
    expect(rotors.map((rotor) => rotor.style.transform)).toEqual([
      'rotate(0deg)',
      'rotate(0deg)',
    ])
    dispatchPointer(dial, 'pointerdown', 400, 220, 10)
    dispatchPointer(dial, 'pointermove', 220, 400, 30)

    expect(screen.getByLabelText('Type exact time')).toHaveValue('18:45')
    expect(rotors.map((rotor) => rotor.style.transform)).toEqual([
      'rotate(0deg)',
      'rotate(0deg)',
    ])
  })
})
