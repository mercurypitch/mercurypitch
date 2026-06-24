import type { Component } from 'solid-js'
import { createSignal, mergeProps, onCleanup } from 'solid-js'

export interface ProKnobProps {
  value: number
  min: number
  max: number
  label: string
  color?: string
  bipolar?: boolean
  onChange?: (val: number) => void
  size?: number
  showValue?: boolean
  valueFormatter?: (val: number) => string
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180.0)
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  // If start and end are exactly the same, draw nothing or a tiny dot
  if (Math.abs(endAngle - startAngle) < 0.01) {
    const pt = polarToCartesian(x, y, radius, startAngle)
    return `M ${pt.x} ${pt.y} L ${pt.x + 0.01} ${pt.y}`
  }

  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ')
}

export const ProKnob: Component<ProKnobProps> = (props) => {
  const merged = mergeProps(
    { size: 64, color: '#2dd4bf', bipolar: false, showValue: false },
    props,
  )

  const strokeWidth = () => merged.size * 0.1
  const radius = () => (merged.size - strokeWidth()) / 2
  const center = () => merged.size / 2

  const startAngle = 220
  const endAngle = 140
  const totalSweep = 360 - (startAngle - endAngle) // 280 degrees sweep

  const [isDragging, setIsDragging] = createSignal(false)
  let startY = 0
  let startVal = 0

  const computeNewVal = (clientY: number) => {
    const deltaY = startY - clientY
    const range = merged.max - merged.min
    const newVal = startVal + (deltaY / 150) * range
    return Math.max(merged.min, Math.min(merged.max, newVal))
  }

  const beginDrag = (clientY: number) => {
    setIsDragging(true)
    startY = clientY
    startVal = merged.value
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

  // Calculate arc path
  // angle goes from -140 (bottom left) to +140 (bottom right)
  const normValue = () =>
    (merged.value - merged.min) / (merged.max - merged.min)

  const currentAngle = () => 220 + normValue() * totalSweep

  const activeStart = () => {
    if (merged.bipolar) {
      const centerNorm = (0 - merged.min) / (merged.max - merged.min)
      if (normValue() < centerNorm) return currentAngle()
      return 220 + centerNorm * totalSweep
    }
    return 220
  }

  const activeEnd = () => {
    if (merged.bipolar) {
      const centerNorm = (0 - merged.min) / (merged.max - merged.min)
      if (normValue() < centerNorm) return 220 + centerNorm * totalSweep
      return currentAngle()
    }
    const end = currentAngle()
    return end > 360 ? end - 360 : end
  }

  const drawStart = () => activeStart()
  const drawEnd = () =>
    activeEnd() < activeStart() ? activeEnd() + 360 : activeEnd()

  const innerRadius = () => radius() - strokeWidth() * 1.5
  const pointerPos = () =>
    polarToCartesian(
      center(),
      center(),
      innerRadius() - 2,
      currentAngle() > 360 ? currentAngle() - 360 : currentAngle(),
    )

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
          width: `${merged.size}px`,
          height: `${merged.size}px`,
          position: 'relative',
          cursor: isDragging() ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <svg
          width={merged.size}
          height={merged.size}
          viewBox={`0 0 ${merged.size} ${merged.size}`}
        >
          {/* Track Arc */}
          <path
            d={describeArc(center(), center(), radius(), 220, 140 + 360)}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            stroke-width={strokeWidth()}
            stroke-linecap="round"
          />

          {/* Active Arc */}
          <path
            d={describeArc(
              center(),
              center(),
              radius(),
              drawStart(),
              drawEnd(),
            )}
            fill="none"
            stroke={merged.color}
            stroke-width={strokeWidth()}
            stroke-linecap="round"
          />

          {/* Inner Knob */}
          <circle
            cx={center()}
            cy={center()}
            r={innerRadius()}
            fill="rgba(15, 23, 42, 0.5)"
          />

          {/* Pointer */}
          <circle
            cx={pointerPos().x}
            cy={pointerPos().y}
            r={strokeWidth() * 0.4}
            fill="white"
          />
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.8)',
            'font-size': '0.75rem',
            'font-weight': '600',
          }}
        >
          {merged.label}
        </span>
        {merged.showValue && (
          <span
            style={{
              color: 'rgba(255,255,255,0.4)',
              'font-size': '0.7rem',
              'margin-top': '2px',
            }}
          >
            {merged.valueFormatter
              ? merged.valueFormatter(merged.value)
              : merged.value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}
