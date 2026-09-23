// Adventure input regression — deliberate direction changes request one camera-basis rebase.
import { describe, expect, it, vi } from 'vitest'
import { createAdventureInput } from './input'

function keyboardEvent(code: string): KeyboardEvent {
  return {
    code,
    target: null,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

describe('adventure movement reference intent', () => {
  it('requests one rebase for each changed net keyboard direction', () => {
    const input = createAdventureInput()

    input.key(keyboardEvent('KeyA'), true)
    expect(input.consumeMovementReferenceChange()).toBe(true)
    expect(input.consumeMovementReferenceChange()).toBe(false)

    input.key(keyboardEvent('KeyA'), true)
    expect(input.consumeMovementReferenceChange()).toBe(false)

    input.key(keyboardEvent('KeyW'), true)
    expect(input.consumeMovementReferenceChange()).toBe(true)
    expect(input.consumeMovementReferenceChange()).toBe(false)

    input.key(keyboardEvent('KeyA'), false)
    expect(input.consumeMovementReferenceChange()).toBe(true)
  })

  it('ignores key aliases that leave the normalized net direction unchanged', () => {
    const input = createAdventureInput()

    input.key(keyboardEvent('KeyW'), true)
    expect(input.consumeMovementReferenceChange()).toBe(true)
    input.key(keyboardEvent('ArrowUp'), true)
    expect(input.consumeMovementReferenceChange()).toBe(false)
    input.key(keyboardEvent('KeyW'), false)
    expect(input.consumeMovementReferenceChange()).toBe(false)

    input.key(keyboardEvent('ArrowUp'), false)
    expect(input.consumeMovementReferenceChange()).toBe(false)
    input.key(keyboardEvent('KeyW'), true)
    expect(input.consumeMovementReferenceChange()).toBe(true)
  })

  it('rebases a newly engaged stick but keeps a continuous sweep on one basis', () => {
    const input = createAdventureInput()

    input.setStick(-1, 0)
    expect(input.consumeMovementReferenceChange()).toBe(true)
    input.setStick(-0.5, -0.866)
    expect(input.consumeMovementReferenceChange()).toBe(false)
    input.setStick(0, -0.7)
    expect(input.consumeMovementReferenceChange()).toBe(false)

    input.setStick(0, 0)
    input.setStick(0.6, 0)
    expect(input.consumeMovementReferenceChange()).toBe(true)
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
    expect(input.consumeMovementReferenceChange()).toBe(false)

    input.setStick(0.5, 0)
    expect(input.consumeMovementReferenceChange()).toBe(true)
    input.clear()
    expect(input.hasMovementIntent()).toBe(false)
    expect(input.consumeMovementReferenceChange()).toBe(false)
  })
})
