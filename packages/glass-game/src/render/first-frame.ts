// First-frame health — surface GPU upload failures through the existing fresh-scene retry.

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
