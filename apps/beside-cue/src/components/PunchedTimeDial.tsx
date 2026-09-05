import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { useCopy } from '@/i18n/ui-copy'
import { NoSelect } from '@/interaction/selection'
import type { TimeDialLayer } from './punched-time-dial-math'
import { applyDialAngularDelta, classifyTimeDialLayer, classifyTimeDialTouchIntent, formatClockTime, normalizeAngularDelta, parseClockTime, snapMinutesToInterval, stepDialTime, wrapDayMinutes, } from './punched-time-dial-math'
import type { TimeDialPointerReadiness } from './punched-time-dial-readiness'
import { createTimeDialPointerReadiness } from './punched-time-dial-readiness'
import styles from './PunchedTimeDial.module.css'

export interface PunchedTimeDialProps {
  /** A strict local HH:mm value, or an empty string while no time is chosen. */
  readonly value: string
  /** The face position shown before the user makes a choice. */
  readonly defaultValue?: string
  readonly disabled?: boolean
  readonly compact?: boolean
  readonly ariaLabel?: string
  readonly inputLabel?: string
  readonly onValueChange: (localTime: string) => void
  readonly onHaptic?: (strength: 'light' | 'medium') => void
}

interface DialGesture {
  readonly pointerId: number
  readonly layer: TimeDialLayer
  readonly scrollRevision: number
  readonly startMinutes: number
  readonly startMinuteAngle: number
  readonly startHourAngle: number
  lastAngle: number
  lastTime: number
  accumulatedAngle: number
  velocity: number
}

interface DialGestureCandidate {
  readonly pointerId: number
  readonly layer: TimeDialLayer
  readonly startAngle: number
  readonly startTime: number
  readonly startX: number
  readonly startY: number
  readonly centerX: number
  readonly centerY: number
  readonly scrollRevision: number
}

interface RegistrationMark {
  readonly major: boolean
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

const CENTER = 220
const GROOVE_RADII = Array.from({ length: 26 }, (_, index) => 84 + index * 4)
const PRINT_ARCS = [
  [100, 2.2],
  [116, 2.8],
  [132, 3.4],
  [148, 4.2],
  [163, 5],
  [177, 6],
  [188, 6.8],
] as const
const REGISTRATION_MARKS = Array.from({ length: 60 }, (_, index) => {
  const major = index % 5 === 0
  const angle = ((index * 6 - 90) * Math.PI) / 180
  const innerRadius = major ? 196 : 199
  const outerRadius = major ? 203 : 202
  return {
    major,
    x1: CENTER + innerRadius * Math.cos(angle),
    y1: CENTER + innerRadius * Math.sin(angle),
    x2: CENTER + outerRadius * Math.cos(angle),
    y2: CENTER + outerRadius * Math.sin(angle),
  } satisfies RegistrationMark
})
const FALLBACK_TIME = 9 * 60
const RELEASE_PROJECTION_MS = 165
const MINUTE_COAST_LIMIT_DEGREES = 75
const HOUR_COAST_LIMIT_DEGREES = 30
const SETTLE_DURATION_MS = 260
const HAPTIC_INTERVAL_MS = 45

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function canonicalMinuteAngle(totalMinutes: number): number {
  return (wrapDayMinutes(totalMinutes) % 60) * 6
}

function canonicalHourAngle(totalMinutes: number): number {
  return (wrapDayMinutes(totalMinutes) % 720) * 0.5
}

function eventTime(event: PointerEvent): number {
  return event.timeStamp > 0 ? event.timeStamp : performance.now()
}

export function PunchedTimeDial(props: PunchedTimeDialProps) {
  const copy = useCopy()
  const id = createUniqueId()
  const initialValue = untrack(() => parseClockTime(props.value))
  const initialDefault = untrack(() => parseClockTime(props.defaultValue ?? ''))
  const initialMinutes = initialValue ?? initialDefault ?? FALLBACK_TIME
  const [displayMinutes, setDisplayMinutes] = createSignal(initialMinutes)
  const [minuteAngle, setMinuteAngle] = createSignal(
    canonicalMinuteAngle(initialMinutes),
  )
  const [hourAngle, setHourAngle] = createSignal(
    canonicalHourAngle(initialMinutes),
  )
  const [activeLayer, setActiveLayer] = createSignal<TimeDialLayer>('minute')
  const [dragging, setDragging] = createSignal(false)
  const [selectionMade, setSelectionMade] = createSignal(initialValue !== null)
  const [reducedMotion, setReducedMotion] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal('')
  const [pulse, setPulse] = createSignal<
    { readonly id: number; readonly major: boolean } | undefined
  >()

  let dialElement!: HTMLDivElement
  let gesture: DialGesture | undefined
  let gestureCandidate: DialGestureCandidate | undefined
  let pointerReadiness: TimeDialPointerReadiness | undefined
  let settling = false
  let settleAnimation: number | undefined
  let pulseTimer: number | undefined
  let pulseId = 0
  let lastRegistration: number | undefined
  let lastHapticAt = Number.NEGATIVE_INFINITY

  const formattedTime = createMemo(() => formatClockTime(displayMinutes()))
  const modeLabel = createMemo(() =>
    copy.t(
      activeLayer() === 'hour' ? 'Gold hub · hours' : 'Vinyl edge · minutes',
    ),
  )
  const sliderValueText = createMemo(() => {
    if (selectionMade()) {
      return copy.t(
        activeLayer() === 'hour'
          ? 'Around {time}; editing hours'
          : 'Around {time}; editing minutes',
        { time: formattedTime() },
      )
    }
    return copy.t(
      activeLayer() === 'hour'
        ? 'Preview {time}; no reminder time selected; editing hours'
        : 'Preview {time}; no reminder time selected; editing minutes',
      { time: formattedTime() },
    )
  })

  function syncFromControlledValue(
    value: string,
    defaultValue: string | undefined,
    fallbackMinutes = FALLBACK_TIME,
  ): number {
    const selectedMinutes = parseClockTime(value)
    const defaultMinutes = parseClockTime(defaultValue ?? '')
    const nextMinutes = selectedMinutes ?? defaultMinutes ?? fallbackMinutes
    setSelectionMade(selectedMinutes !== null)
    setDisplayMinutes(nextMinutes)
    syncRotors(nextMinutes)
    return nextMinutes
  }

  function syncRotors(totalMinutes: number): void {
    if (reducedMotion()) {
      setMinuteAngle(0)
      setHourAngle(0)
      return
    }
    setMinuteAngle(canonicalMinuteAngle(totalMinutes))
    setHourAngle(canonicalHourAngle(totalMinutes))
  }

  function stopSettle(syncToTime: boolean): void {
    if (settleAnimation !== undefined) {
      window.cancelAnimationFrame(settleAnimation)
      settleAnimation = undefined
    }
    settling = false
    if (syncToTime) {
      syncFromControlledValue(props.value, props.defaultValue, displayMinutes())
    }
  }

  function emitMinutes(totalMinutes: number): void {
    const nextMinutes = wrapDayMinutes(Math.round(totalMinutes))
    setDisplayMinutes(nextMinutes)
    setSelectionMade(true)
    props.onValueChange(formatClockTime(nextMinutes))
  }

  function triggerFeedback(
    totalMinutes: number,
    layer: TimeDialLayer,
    force = false,
  ): void {
    const registration =
      layer === 'hour'
        ? Math.floor(wrapDayMinutes(totalMinutes) / 60)
        : Math.floor(wrapDayMinutes(totalMinutes) / 5)
    if (!force && registration === lastRegistration) return
    lastRegistration = registration

    const minute = wrapDayMinutes(totalMinutes) % 60
    const major = layer === 'hour' || minute % 15 === 0
    const now = performance.now()
    if (force || now - lastHapticAt >= HAPTIC_INTERVAL_MS) {
      props.onHaptic?.(major ? 'medium' : 'light')
      lastHapticAt = now
    }

    if (!reducedMotion()) {
      pulseId += 1
      setPulse({ id: pulseId, major })
      if (pulseTimer !== undefined) window.clearTimeout(pulseTimer)
      pulseTimer = window.setTimeout(() => setPulse(undefined), 210)
    }
  }

  function settleRotors(totalMinutes: number): void {
    const fromMinute = minuteAngle()
    const fromHour = hourAngle()
    const targetMinute =
      fromMinute +
      normalizeAngularDelta(canonicalMinuteAngle(totalMinutes) - fromMinute)
    const targetHour =
      fromHour +
      normalizeAngularDelta(canonicalHourAngle(totalMinutes) - fromHour)

    const finish = (): void => {
      settling = false
      settleAnimation = undefined
      const latestMinutes = syncFromControlledValue(
        props.value,
        props.defaultValue,
        totalMinutes,
      )
      setAnnouncement(
        copy.t('Around {time}', { time: formatClockTime(latestMinutes) }),
      )
    }

    if (reducedMotion() || typeof window.requestAnimationFrame !== 'function') {
      if (!reducedMotion()) {
        setMinuteAngle(targetMinute)
        setHourAngle(targetHour)
      }
      finish()
      return
    }

    settling = true
    const startedAt = performance.now()
    const frame = (now: number): void => {
      const elapsed = Math.min(1, (now - startedAt) / SETTLE_DURATION_MS)
      const progress = 1 - Math.exp(-8 * elapsed) * (1 + 8 * elapsed)
      setMinuteAngle(fromMinute + (targetMinute - fromMinute) * progress)
      setHourAngle(fromHour + (targetHour - fromHour) * progress)

      if (elapsed < 1) {
        settleAnimation = window.requestAnimationFrame(frame)
      } else {
        finish()
      }
    }
    settleAnimation = window.requestAnimationFrame(frame)
  }

  function pointOnDial(event: PointerEvent): {
    readonly angle: number
    readonly radius: number
  } {
    const bounds = dialElement.getBoundingClientRect()
    const size = Math.min(bounds.width, bounds.height)
    const x = ((event.clientX - bounds.left) / size) * 440 - CENTER
    const y = ((event.clientY - bounds.top) / size) * 440 - CENTER
    return {
      angle: (Math.atan2(y, x) * 180) / Math.PI,
      radius: Math.hypot(x, y),
    }
  }

  function pointerInteractionReady(): boolean {
    return pointerReadiness?.isReady() ?? false
  }

  function safelyReleasePointer(pointerId: number): void {
    if (
      typeof dialElement.hasPointerCapture !== 'function' ||
      typeof dialElement.releasePointerCapture !== 'function'
    ) {
      return
    }
    try {
      if (dialElement.hasPointerCapture(pointerId)) {
        dialElement.releasePointerCapture(pointerId)
      }
    } catch {
      // Pointer capture can already be gone after a native cancellation.
    }
  }

  function finishGesture(pointerId: number, projectVelocity: boolean): void {
    const currentGesture = gesture
    if (
      currentGesture === undefined ||
      currentGesture.pointerId !== pointerId
    ) {
      return
    }

    const coastLimit =
      currentGesture.layer === 'hour'
        ? HOUR_COAST_LIMIT_DEGREES
        : MINUTE_COAST_LIMIT_DEGREES
    const coast =
      projectVelocity &&
      currentGesture.scrollRevision === pointerReadiness?.revision() &&
      !reducedMotion()
        ? clamp(
            currentGesture.velocity * RELEASE_PROJECTION_MS,
            -coastLimit,
            coastLimit,
          )
        : 0
    const projectedAngle = currentGesture.accumulatedAngle + coast
    const projectedMinutes = applyDialAngularDelta(
      currentGesture.startMinutes,
      projectedAngle,
      currentGesture.layer,
    )
    const finalMinutes =
      currentGesture.layer === 'minute'
        ? snapMinutesToInterval(projectedMinutes)
        : projectedMinutes

    gesture = undefined
    settling = true
    setDragging(false)
    safelyReleasePointer(pointerId)
    emitMinutes(finalMinutes)
    triggerFeedback(finalMinutes, currentGesture.layer)
    settleRotors(finalMinutes)
  }

  function cancelActiveGesture(): void {
    gestureCandidate = undefined
    if (gesture === undefined) return
    finishGesture(gesture.pointerId, false)
  }

  function beginGesture(
    event: PointerEvent,
    layer: TimeDialLayer,
    startAngle: number,
    startTime: number,
  ): void {
    stopSettle(true)
    setActiveLayer(layer)
    lastRegistration =
      layer === 'hour'
        ? Math.floor(displayMinutes() / 60)
        : Math.floor(displayMinutes() / 5)
    gesture = {
      pointerId: event.pointerId,
      layer,
      scrollRevision: pointerReadiness?.revision() ?? 0,
      startMinutes: displayMinutes(),
      startMinuteAngle: minuteAngle(),
      startHourAngle: hourAngle(),
      lastAngle: startAngle,
      lastTime: startTime,
      accumulatedAngle: 0,
      velocity: 0,
    }
    setDragging(true)
    try {
      dialElement.setPointerCapture(event.pointerId)
    } catch {
      // Browsers without capture still receive an ordinary tap safely.
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (
      props.disabled === true ||
      event.button !== 0 ||
      event.isPrimary === false ||
      gesture !== undefined ||
      gestureCandidate !== undefined ||
      !pointerInteractionReady()
    ) {
      return
    }

    const point = pointOnDial(event)
    const layer = classifyTimeDialLayer(point.radius)
    if (layer === null) return

    if (event.pointerType === 'touch') {
      const bounds = dialElement.getBoundingClientRect()
      const size = Math.min(bounds.width, bounds.height)
      gestureCandidate = {
        pointerId: event.pointerId,
        layer,
        startAngle: point.angle,
        startTime: eventTime(event),
        startX: event.clientX,
        startY: event.clientY,
        centerX: bounds.left + size / 2,
        centerY: bounds.top + size / 2,
        scrollRevision: pointerReadiness?.revision() ?? 0,
      }
      return
    }

    event.preventDefault()
    beginGesture(event, layer, point.angle, eventTime(event))
  }

  function handlePointerMove(event: PointerEvent): void {
    const candidate = gestureCandidate
    if (candidate !== undefined && event.pointerId === candidate.pointerId) {
      if (
        candidate.scrollRevision !== pointerReadiness?.revision() ||
        !pointerInteractionReady()
      ) {
        gestureCandidate = undefined
        return
      }
      const intent = classifyTimeDialTouchIntent({
        startX: candidate.startX,
        startY: candidate.startY,
        currentX: event.clientX,
        currentY: event.clientY,
        centerX: candidate.centerX,
        centerY: candidate.centerY,
      })
      if (intent === 'yield') {
        gestureCandidate = undefined
        return
      }
      if (intent === 'pending') return

      gestureCandidate = undefined
      event.preventDefault()
      beginGesture(
        event,
        candidate.layer,
        candidate.startAngle,
        candidate.startTime,
      )
    }

    const currentGesture = gesture
    if (
      currentGesture === undefined ||
      event.pointerId !== currentGesture.pointerId
    ) {
      return
    }

    if (currentGesture.scrollRevision !== pointerReadiness?.revision()) {
      finishGesture(event.pointerId, false)
      return
    }

    event.preventDefault()
    const point = pointOnDial(event)
    const now = eventTime(event)
    const delta = normalizeAngularDelta(point.angle - currentGesture.lastAngle)
    const elapsed = Math.max(8, now - currentGesture.lastTime)
    currentGesture.accumulatedAngle += delta
    currentGesture.velocity =
      currentGesture.velocity * 0.56 + (delta / elapsed) * 0.44
    currentGesture.lastAngle = point.angle
    currentGesture.lastTime = now

    const nextMinutes = applyDialAngularDelta(
      currentGesture.startMinutes,
      currentGesture.accumulatedAngle,
      currentGesture.layer,
    )
    if (!reducedMotion()) {
      if (currentGesture.layer === 'hour') {
        setHourAngle(
          currentGesture.startHourAngle + currentGesture.accumulatedAngle,
        )
      } else {
        setMinuteAngle(
          currentGesture.startMinuteAngle + currentGesture.accumulatedAngle,
        )
        setHourAngle(
          currentGesture.startHourAngle + currentGesture.accumulatedAngle / 12,
        )
      }
    }
    emitMinutes(nextMinutes)
    triggerFeedback(nextMinutes, currentGesture.layer)
  }

  function handlePointerEnd(
    event: PointerEvent,
    projectVelocity: boolean,
  ): void {
    if (gestureCandidate?.pointerId === event.pointerId) {
      gestureCandidate = undefined
      return
    }
    finishGesture(event.pointerId, projectVelocity)
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (props.disabled === true) return

    const positive =
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'PageUp'
    const negative =
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowDown' ||
      event.key === 'PageDown'
    if (positive || negative) {
      event.preventDefault()
      stopSettle(true)
      const nextMinutes = stepDialTime(
        displayMinutes(),
        activeLayer(),
        positive ? 1 : -1,
        {
          large: event.key.startsWith('Page') || event.shiftKey,
        },
      )
      emitMinutes(nextMinutes)
      syncRotors(nextMinutes)
      triggerFeedback(nextMinutes, activeLayer(), true)
      setAnnouncement(
        copy.t('Around {time}', { time: formatClockTime(nextMinutes) }),
      )
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveLayer(activeLayer() === 'hour' ? 'minute' : 'hour')
    }
  }

  function chooseLayer(layer: TimeDialLayer): void {
    if (props.disabled === true) return
    setActiveLayer(layer)
    dialElement.focus({ preventScroll: true })
  }

  function handleExactTime(value: string): void {
    cancelActiveGesture()
    stopSettle(false)
    if (value === '') {
      setSelectionMade(false)
      props.onValueChange('')
      setAnnouncement(copy.t('No reminder time chosen'))
      return
    }

    const nextMinutes = parseClockTime(value)
    if (nextMinutes === null) return
    emitMinutes(nextMinutes)
    syncRotors(nextMinutes)
    triggerFeedback(nextMinutes, activeLayer(), true)
    setAnnouncement(
      copy.t('Around {time}', { time: formatClockTime(nextMinutes) }),
    )
  }

  createEffect(() => {
    const value = props.value
    const defaultValue = props.defaultValue
    if (gesture !== undefined || settling) return
    syncFromControlledValue(value, defaultValue)
  })

  createEffect(() => {
    if (props.disabled === true) cancelActiveGesture()
  })

  onMount(() => {
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = (): void => {
      const nextReducedMotion = motionQuery?.matches ?? false
      setReducedMotion(nextReducedMotion)
      if (nextReducedMotion && settling) stopSettle(true)
      syncRotors(displayMinutes())
    }
    updateMotionPreference()
    pointerReadiness = createTimeDialPointerReadiness(dialElement)
    motionQuery?.addEventListener?.('change', updateMotionPreference)
    window.addEventListener('blur', cancelActiveGesture)

    onCleanup(() => {
      motionQuery?.removeEventListener?.('change', updateMotionPreference)
      window.removeEventListener('blur', cancelActiveGesture)
      pointerReadiness?.dispose()
      pointerReadiness = undefined
    })
  })

  onCleanup(() => {
    if (settleAnimation !== undefined) {
      window.cancelAnimationFrame(settleAnimation)
    }
    if (pulseTimer !== undefined) window.clearTimeout(pulseTimer)
    if (gesture !== undefined) safelyReleasePointer(gesture.pointerId)
  })

  return (
    <section
      class={styles.dial}
      data-compact={props.compact === true ? 'true' : undefined}
      data-mode={activeLayer()}
      data-dragging={dragging() ? 'true' : 'false'}
      aria-label={copy.t('Punched Clock time picker')}
    >
      <header class={styles.header}>
        <div class={styles.modeCopy}>
          <span>Punched Clock · BC–T01</span>
          <strong>{modeLabel()}</strong>
        </div>
        <p
          class={styles.readout}
          aria-label={
            selectionMade()
              ? copy.t('Around {time}', { time: formattedTime() })
              : copy.t('Preview {time}; no reminder time selected', {
                  time: formattedTime(),
                })
          }
        >
          <span>{copy.t(selectionMade() ? 'Around' : 'Preview')}</span>
          <strong>{formattedTime()}</strong>
        </p>
      </header>

      <div class={styles.recordShell}>
        <div
          ref={dialElement}
          class={styles.stage}
          {...NoSelect}
          data-callout="none"
          role="slider"
          tabIndex={props.disabled === true ? -1 : 0}
          aria-label={
            props.ariaLabel ??
            copy.t('Turn the record to choose a reminder time')
          }
          aria-valuemin="0"
          aria-valuemax="1439"
          aria-valuenow={displayMinutes()}
          aria-valuetext={sliderValueText()}
          aria-disabled={props.disabled === true ? 'true' : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => handlePointerEnd(event, true)}
          onPointerCancel={(event) => handlePointerEnd(event, false)}
          onLostPointerCapture={(event) =>
            finishGesture(event.pointerId, false)
          }
          onKeyDown={handleKeyDown}
        >
          <svg viewBox="0 0 440 440" aria-hidden="true">
            <defs>
              <path id={`${id}-label-top`} d="M168 220A52 52 0 0 1 272 220" />
              <path
                id={`${id}-label-bottom`}
                d="M166 220A54 54 0 0 0 274 220"
              />
              <radialGradient id={`${id}-label-gold`} cx="35%" cy="28%">
                <stop offset="0" stop-color="#f7d86a" />
                <stop offset="0.72" stop-color="#efc13b" />
                <stop offset="1" stop-color="#dca82b" />
              </radialGradient>
            </defs>

            <g
              class={styles.minuteRotor}
              style={{ transform: `rotate(${minuteAngle()}deg)` }}
            >
              <circle cx="220" cy="220" r="194" fill="#0f0c0a" />
              <circle cx="220" cy="220" r="192" fill="#1a1512" />
              <circle
                cx="220"
                cy="220"
                r="189"
                fill="none"
                stroke="#fff5dd"
                stroke-opacity="0.14"
                stroke-width="1.5"
              />
              <For each={GROOVE_RADII}>
                {(radius) => (
                  <circle
                    cx="220"
                    cy="220"
                    r={radius}
                    fill="none"
                    stroke="#fff5dd"
                    stroke-opacity={radius % 12 === 0 ? '0.09' : '0.04'}
                    stroke-width="1"
                  />
                )}
              </For>
              <For each={PRINT_ARCS}>
                {([radius, width]) => (
                  <circle
                    cx="220"
                    cy="220"
                    r={radius}
                    fill="none"
                    stroke="#1b8482"
                    stroke-width={width}
                    pathLength="360"
                    stroke-dasharray="175 185"
                    stroke-dashoffset="-130"
                    stroke-linecap="round"
                  />
                )}
              </For>
              <For each={REGISTRATION_MARKS}>
                {(mark) => (
                  <path
                    d={`M${mark.x1.toFixed(1)} ${mark.y1.toFixed(1)}L${mark.x2.toFixed(1)} ${mark.y2.toFixed(1)}`}
                    stroke={mark.major ? '#c93513' : '#fff5dd'}
                    stroke-opacity={mark.major ? '1' : '0.62'}
                    stroke-width={mark.major ? '2.4' : '1'}
                    stroke-linecap="round"
                  />
                )}
              </For>
            </g>

            <g class={styles.fixedLabel}>
              <circle
                cx="220"
                cy="220"
                r="70"
                fill={`url(#${id}-label-gold)`}
              />
              <circle
                cx="220"
                cy="220"
                r="70"
                fill="none"
                stroke="rgb(0 0 0 / 28%)"
              />
              <circle
                cx="220"
                cy="220"
                r="63"
                fill="none"
                stroke="rgb(0 0 0 / 14%)"
                stroke-width="0.8"
              />
              <text
                class={styles.labelText}
                font-size="11.5"
                letter-spacing="1.6"
                fill="#241913"
              >
                <textPath
                  href={`#${id}-label-top`}
                  startOffset="50%"
                  text-anchor="middle"
                >
                  BESIDE CUE · SIDE A
                </textPath>
              </text>
              <text
                class={styles.labelText}
                font-size="10"
                letter-spacing="1.3"
                fill="#241913"
              >
                <textPath
                  href={`#${id}-label-bottom`}
                  startOffset="50%"
                  text-anchor="middle"
                >
                  CORKY · COMPANION PRESSING · BC-000
                </textPath>
              </text>
            </g>

            <g
              class={styles.hourRotor}
              style={{ transform: `rotate(${hourAngle()}deg)` }}
            >
              <g transform="translate(220 220) scale(.78)">
                <path
                  d="M0-52C22-18 34 0 34 14A34 34 0 1 1-34 14C-34 0-22-18 0-52Z"
                  fill="#241913"
                />
                <path
                  d="M-16 2C-20-8-12-20-4-24C-2-16-10-6-12 6Z"
                  fill="#fff7e6"
                />
                <circle cx="14" cy="22" r="5" fill="#d8451f" />
              </g>
              <path
                d="M220 165v17"
                stroke="#fff5dd"
                stroke-width="8"
                stroke-linecap="round"
              />
              <path
                d="M220 165v17"
                stroke="#c93513"
                stroke-width="4"
                stroke-linecap="round"
              />
            </g>
            <circle cx="220" cy="220" r="4.5" fill="#fff5dd" stroke="#241913" />
          </svg>
          <span class={styles.gestureHint} aria-hidden="true">
            {dragging()
              ? activeLayer() === 'hour'
                ? copy.t('Turning hours')
                : copy.t('Turning minutes')
              : selectionMade()
                ? copy.t('Sweep sideways')
                : copy.t('Sweep to choose')}
          </span>
          <Show when={pulse()} keyed>
            {(currentPulse) => (
              <span
                class={styles.pulseRing}
                classList={{ [styles.pulseRingMajor]: currentPulse.major }}
                data-pulse-id={currentPulse.id}
                aria-hidden="true"
              />
            )}
          </Show>
        </div>
      </div>

      <div
        class={styles.modeControl}
        role="group"
        aria-label={copy.t('Choose dial layer')}
      >
        <button
          type="button"
          class={styles.modeButton}
          classList={{ [styles.modeButtonActive]: activeLayer() === 'hour' }}
          aria-label={copy.t('Edit hours')}
          aria-pressed={activeLayer() === 'hour'}
          disabled={props.disabled}
          onClick={() => chooseLayer('hour')}
        >
          <span class={styles.hourSwatch} aria-hidden="true" />
          <span>
            <strong>{copy.t('Hours')}</strong>
            <small>{copy.t('Gold hub')}</small>
          </span>
        </button>
        <button
          type="button"
          class={styles.modeButton}
          classList={{ [styles.modeButtonActive]: activeLayer() === 'minute' }}
          aria-label={copy.t('Edit minutes')}
          aria-pressed={activeLayer() === 'minute'}
          disabled={props.disabled}
          onClick={() => chooseLayer('minute')}
        >
          <span class={styles.minuteSwatch} aria-hidden="true" />
          <span>
            <strong>{copy.t('Minutes')}</strong>
            <small>{copy.t('Vinyl edge')}</small>
          </span>
        </button>
      </div>

      <label class={styles.exactTime}>
        <span>{props.inputLabel ?? copy.t('Type exact time')}</span>
        <input
          type="time"
          step="300"
          required
          aria-label={props.inputLabel ?? copy.t('Type exact time')}
          value={selectionMade() ? formattedTime() : ''}
          disabled={props.disabled}
          onInput={(event) => handleExactTime(event.currentTarget.value)}
        />
      </label>
      <p class={styles.mechanicCaption}>
        {copy.t(
          'Swipe sideways at the top or bottom. Outer edge sets minutes; gold hub sets hours.',
        )}
      </p>
      <span class={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement()}
      </span>
    </section>
  )
}
