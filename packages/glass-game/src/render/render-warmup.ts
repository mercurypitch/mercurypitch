// ============================================================
// Renderer warmup — expose resident draw variants during loading, then restore presentation state exactly.
// ============================================================

import type { Object3D } from 'three'

interface ObjectPresentationState {
  readonly frustumCulled: boolean
  readonly visible: boolean
}

function isRenderable(object: Object3D): boolean {
  const candidate = object as Object3D & {
    readonly isLine?: boolean
    readonly isMesh?: boolean
    readonly isPoints?: boolean
    readonly isSprite?: boolean
  }
  return (
    candidate.isLine === true ||
    candidate.isMesh === true ||
    candidate.isPoints === true ||
    candidate.isSprite === true
  )
}

/** Runs one synchronous draw with every resident renderable and its ancestry exposed. */
export function withResidentRenderablesVisible(
  root: Object3D,
  draw: () => void,
): void {
  const original = new Map<Object3D, ObjectPresentationState>()
  const expose = (object: Object3D) => {
    if (!original.has(object))
      original.set(object, {
        frustumCulled: object.frustumCulled,
        visible: object.visible,
      })
    object.visible = true
  }

  root.traverse((object) => {
    if (!isRenderable(object)) return
    let ancestor: Object3D | null = object
    while (ancestor !== null) {
      expose(ancestor)
      if (ancestor === root) break
      ancestor = ancestor.parent
    }
    object.frustumCulled = false
  })

  try {
    draw()
  } finally {
    for (const [object, state] of original) {
      object.visible = state.visible
      object.frustumCulled = state.frustumCulled
    }
  }
}
