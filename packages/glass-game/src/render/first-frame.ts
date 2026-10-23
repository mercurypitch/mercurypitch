// First-frame health — surface GPU upload failures through the existing fresh-scene retry.

import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'

export function verifyFirstFrame(
  gl: Pick<
    WebGL2RenderingContext,
    'getError' | 'drawingBufferWidth' | 'drawingBufferHeight'
  >,
): void {
  // WebGL records most failures instead of throwing. Check at the loading
  // boundary only: polling getError in the live frame loop can stall the GPU.
  const error = gl.getError()
  if (error !== 0)
    throw new Error(
      `The first gallery frame failed (WebGL 0x${error.toString(16)}).`,
    )
  if (gl.drawingBufferWidth < 2 || gl.drawingBufferHeight < 2)
    throw new Error('The first gallery frame has no usable drawing buffer.')
}

/** Present the same scene with temporary first-person visibility and one health boundary. */
export function createGalleryFramePresenter(
  renderer: Pick<WebGLRenderer, 'render' | 'getContext'>,
  scene: Scene,
  camera: Camera,
  onFirstFrame: () => void,
): (
  actor: Pick<Object3D, 'visible'> | undefined,
  firstPerson: boolean,
) => void {
  let verified = false
  return (actor, firstPerson) => {
    const visible = actor?.visible
    if (actor !== undefined && firstPerson) actor.visible = false
    try {
      renderer.render(scene, camera)
    } finally {
      if (actor !== undefined && visible !== undefined) actor.visible = visible
    }
    if (!verified) {
      verifyFirstFrame(renderer.getContext())
      verified = true
      onFirstFrame()
    }
  }
}
