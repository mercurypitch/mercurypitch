import type { Component } from 'solid-js'
import { createSignal, mergeProps, onCleanup } from 'solid-js'

export interface ProFaderProps {
  value: number
  min: number
  max: number
  label: string
  color?: string
  onChange?: (val: number) => void
  height?: number
  ticks?: number[]
}

export const ProFader: Component<ProFaderProps> = (props) => {
  const merged = mergeProps({ height: 100, color: '#fb923c' }, props)

  const [isDragging, setIsDragging] = createSignal(false)
  let startY = 0
  let startVal = 0

  const computeNewVal = (clientY: number) => {
    const deltaY = startY - clientY
    const range = merged.max - merged.min
    const newVal = startVal + (deltaY / merged.height) * range
    return Math.max(merged.min, Math.min(merged.max, newVal))
  }

  const beginDrag = (clientY: number) => {
    setIsDragging(true)
    startY = clientY
    startVal = props.value
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handlePointerMove, { passive: false })
    window.addEventListener('touchend', handlePointerUp)
  }

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    beginDrag(e.clientY)
  }
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    beginDrag(e.touches[0].clientY)
  }

  const handlePointerMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging()) return
    const clientY =
      'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
    const newVal = computeNewVal(clientY)
    if (merged.onChange) merged.onChange(newVal)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
    window.removeEventListener('mousemove', handlePointerMove)
    window.removeEventListener('mouseup', handlePointerUp)
    window.removeEventListener('touchmove', handlePointerMove)
    window.removeEventListener('touchend', handlePointerUp)
  }

  onCleanup(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handlePointerMove)
      window.removeEventListener('touchend', handlePointerUp)
    }
  })

  const normValue = () =>
    (merged.value - merged.min) / (merged.max - merged.min)
  // 0 is bottom, 1 is top
  const handleY = () => (1 - normValue()) * merged.height

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: `${merged.height + 24}px`, // extra padding for handle overflow
          position: 'relative',
          cursor: isDragging() ? 'grabbing' : 'grab',
          display: 'flex',
          'justify-content': 'center',
          'padding-top': '12px',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Track Line */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            bottom: '12px',
            left: '50%',
            width: '2px',
            'margin-left': '-1px',
            background: 'rgba(255,255,255,0.05)',
            'border-radius': '1px',
          }}
        />

        {/* Ticks */}
        {merged.ticks &&
          merged.ticks.map((tick) => {
            const normTick = (tick - merged.min) / (merged.max - merged.min)
            const tickY = 12 + (1 - normTick) * merged.height
            return (
              <div
                style={{
                  position: 'absolute',
                  top: `${tickY}px`,
                  left: '50%',
                  width: '12px',
                  height: '1px',
                  background: 'rgba(255,255,255,0.3)',
                  'margin-left': '-6px',
                }}
              />
            )
          })}

        {/* Active Track (optional, Klevgrand often doesn't have an active track for faders, just the handle) */}

        {/* Handle */}
        <div
          style={{
            position: 'absolute',
            top: `${12 + handleY() - 6}px`,
            left: '50%',
            width: '16px',
            height: '12px',
            'margin-left': '-8px',
            'background-color': merged.color,
            'border-radius': '3px',
            'box-shadow': '0 2px 4px rgba(0,0,0,0.5)',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
          }}
        >
          {/* Fader Handle Ridge */}
          <div
            style={{
              width: '8px',
              height: '2px',
              background: 'rgba(255,255,255,0.4)',
              'border-radius': '1px',
            }}
          />
        </div>
      </div>

      <span
        style={{
          color: 'rgba(255,255,255,0.8)',
          'font-size': '0.75rem',
          'font-weight': '600',
        }}
      >
        {merged.label}
      </span>
    </div>
  )
}
