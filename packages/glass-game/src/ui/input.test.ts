// Adventure input regression — deliberate direction changes request one camera-basis rebase.
import { describe, expect, it, vi } from 'vitest'
import { createAdventureInput } from './input'

function keyboardEvent(
  code: string,
  target: EventTarget | null = null,
): KeyboardEvent {
  return {
    code,
    target,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

function editableTarget(kind: 'select' | 'contenteditable'): EventTarget {
  const target = {
    isContentEditable: kind === 'contenteditable',
    closest: vi.fn((selector: string) =>
      kind === 'select' && selector === 'input, textarea, select'
        ? target
        : null,
    ),
  }
  return target as unknown as EventTarget
}

describe('adventure movement reference intent', () => {
  it('requests one rebase for each changed net keyboard direction', () => {
    const input = createAdventureInput()

    input.key(keyboardEvent('KeyA'), true)
    expect(input.consumeMovementReferenceChange()).toBe('keyboard')
    expect(input.consumeMovementReferenceChange()).toBeNull()

    input.key(keyboardEvent('KeyA'), true)
    expect(input.consumeMovementReferenceChange()).toBeNull()

    input.key(keyboardEvent('KeyW'), true)
    expect(input.consumeMovementReferenceChange()).toBe('keyboard')
    expect(input.consumeMovementReferenceChange()).toBeNull()

    input.key(keyboardEvent('KeyA'), false)
    expect(input.consumeMovementReferenceChange()).toBe('keyboard')
  })

  it('reserves the arrow keys for camera input', () => {
    const input = createAdventureInput()

    const arrow = keyboardEvent('ArrowUp')
    expect(input.key(arrow, true)).toBe(true)
    expect(input.hasMovementIntent()).toBe(false)
    expect(input.consumeMovementReferenceChange()).toBeNull()
    expect(input.cameraOrbitAxes()).toEqual({ yaw: 0, pitch: -1 })
    expect(arrow.preventDefault).toHaveBeenCalledOnce()
  })

  it('normalizes diagonal camera keys and clears them with other contacts', () => {
    const input = createAdventureInput()

    input.key(keyboardEvent('ArrowRight'), true)
    input.key(keyboardEvent('ArrowUp'), true)
    expect(input.cameraOrbitAxes().yaw).toBeCloseTo(Math.SQRT1_2)
    expect(input.cameraOrbitAxes().pitch).toBeCloseTo(-Math.SQRT1_2)

    input.clear()
    expect(input.cameraOrbitAxes()).toEqual({ yaw: 0, pitch: 0 })
  })

  it('rebases a newly engaged stick but keeps a continuous sweep on one basis', () => {
    const input = createAdventureInput()

    input.setStick(-1, 0)
    expect(input.consumeMovementReferenceChange()).toBe('stick')
    input.setStick(-0.5, -0.866)
    expect(input.consumeMovementReferenceChange()).toBeNull()
    input.setStick(0, -0.7)
    expect(input.consumeMovementReferenceChange()).toBeNull()

    input.setStick(0, 0)
    input.setStick(0.6, 0)
    expect(input.consumeMovementReferenceChange()).toBe('stick')
  })

  it('reports keyboard and continuous-stick headings on the stable movement basis', () => {
    const input = createAdventureInput()
    const basis = Math.PI / 3

    input.key(keyboardEvent('KeyW'), true)
    expect(input.desiredTravelYaw(basis)).toBeCloseTo(basis)
    input.key(keyboardEvent('KeyA'), true)
    expect(input.desiredTravelYaw(basis)).toBeCloseTo(basis + Math.PI / 4)
    input.key(keyboardEvent('KeyW'), false)
    expect(input.desiredTravelYaw(basis)).toBeCloseTo(basis + Math.PI / 2)

    input.clear()
    input.setStick(-1, 0)
    expect(input.desiredTravelYaw(basis)).toBeCloseTo(basis + Math.PI / 2)
    input.setStick(-Math.SQRT1_2, -Math.SQRT1_2)
    expect(input.desiredTravelYaw(basis)).toBeCloseTo(basis + Math.PI / 4)
    input.setStick(0, 0)
    expect(input.desiredTravelYaw(basis)).toBeNull()
  })

  it('uses the movement threshold consistently and clears stale requests', () => {
    const input = createAdventureInput()

    input.setStick(0.0005, 0)
    expect(input.hasMovementIntent()).toBe(false)
    expect(input.read(0)).toMatchObject({ moveX: 0, moveZ: 0 })
    expect(input.consumeMovementReferenceChange()).toBeNull()

    input.setStick(0.5, 0)
    expect(input.consumeMovementReferenceChange()).toBe('stick')
    input.clear()
    expect(input.hasMovementIntent()).toBe(false)
    expect(input.consumeMovementReferenceChange()).toBeNull()
  })

  it.each(['select', 'contenteditable'] as const)(
    'releases a held movement key after focus moves into a %s target',
    (kind) => {
      const input = createAdventureInput()
      input.key(keyboardEvent('KeyW'), true)
      expect(input.hasMovementIntent()).toBe(true)

      const release = keyboardEvent('KeyW', editableTarget(kind))
      expect(input.key(release, false)).toBe(true)
      expect(input.hasMovementIntent()).toBe(false)
      expect(release.preventDefault).not.toHaveBeenCalled()
    },
  )
})
