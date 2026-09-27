// Renderer program precompile — own the readiness timer so teardown can cancel it before WebGL disposal.

import type { Camera, Material, Object3D, WebGLRenderer } from 'three'

interface ReadyProgram {
  isReady(): boolean
}

export interface ProgramPrecompileOptions {
  readonly pollIntervalMs?: number
  readonly timeoutMs?: number
}

const DEFAULT_POLL_INTERVAL_MS = 10
const DEFAULT_TIMEOUT_MS = 30_000

function currentProgram(
  renderer: Pick<WebGLRenderer, 'properties'>,
  material: Material,
): ReadyProgram {
  // This intentionally mirrors Three r185 WebGLRenderer.compileAsync: compile
  // first, then read each material's currentProgram from WebGLProperties.
  // Snapshot the programs once so polling never touches renderer-owned state
  // after the owning lifecycle aborts and disposes the WebGLRenderer.
  const properties = renderer.properties.get(material)
  if (
    properties === null ||
    typeof properties !== 'object' ||
    !('currentProgram' in properties)
  )
    throw new Error('Shader precompile could not read Three currentProgram.')
  const program = properties.currentProgram
  if (
    program === null ||
    typeof program !== 'object' ||
    !('isReady' in program) ||
    typeof program.isReady !== 'function'
  )
    throw new Error('Shader precompile found an invalid Three currentProgram.')
  return program as ReadyProgram
}

/** Resolves on completion or cancellation; compilation failures still reject. */
export function precompileRendererPrograms(
  renderer: Pick<WebGLRenderer, 'compile' | 'properties'>,
  scene: Object3D,
  camera: Camera,
  signal: AbortSignal,
  options: ProgramPrecompileOptions = {},
): Promise<void> {
  if (signal.aborted) return Promise.resolve()

  let programs: Set<ReadyProgram>
  try {
    const materials = renderer.compile(scene, camera)
    if (signal.aborted) return Promise.resolve()
    programs = new Set(
      [...materials].map((material) => currentProgram(renderer, material)),
    )
  } catch (error) {
    return Promise.reject(error)
  }
  if (signal.aborted || programs.size === 0) return Promise.resolve()

  const pollIntervalMs = Math.max(
    1,
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
  )
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  return new Promise((resolve, reject) => {
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    let settled = false

    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      if (pollTimer !== undefined) clearTimeout(pollTimer)
      clearTimeout(timeoutTimer)
      signal.removeEventListener('abort', abort)
      if (error === undefined) resolve()
      else reject(error)
    }
    const abort = () => finish()
    const poll = () => {
      if (signal.aborted) {
        finish()
        return
      }
      try {
        for (const program of programs) {
          if (signal.aborted) {
            finish()
            return
          }
          const ready = program.isReady()
          if (signal.aborted) {
            finish()
            return
          }
          if (ready) programs.delete(program)
        }
      } catch (error) {
        finish(error)
        return
      }
      if (programs.size === 0) {
        finish()
        return
      }
      pollTimer = setTimeout(poll, pollIntervalMs)
    }

    const timeoutTimer = setTimeout(
      () =>
        finish(new Error(`Shader precompile timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    )
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      finish()
      return
    }
    poll()
  })
}
