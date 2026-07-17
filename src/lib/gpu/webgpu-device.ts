// ============================================================
// WebGPU device acquisition (seam for the planned TypeGPU backend)
// ============================================================
//
// Adapted from the chaos-master project's WebgpuAdapter: a single shared device
// per page with graceful device-loss handling. Used by the renderer factory to
// decide the backend; the actual WebGPU/TypeGPU pipeline lands in a follow-up
// (see the plan doc). Kept small and dependency-free so it type-checks today.

let gpuDevice: GPUDevice | null = null
let gpuAdapter: GPUAdapter | null = null
let initInFlight: Promise<void> | null = null

/** Synchronous capability check used by the renderer factory. */
export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

async function initializeDevice(): Promise<void> {
  if (!isWebGpuSupported()) {
    throw new Error('WebGPU is not supported in this browser.', {
      cause: 'WebGPU',
    })
  }
  const adapter = await navigator.gpu.requestAdapter()
  if (adapter === null) {
    throw new Error('Failed to acquire a GPUAdapter.', { cause: 'WebGPU' })
  }
  const device = await adapter.requestDevice()

  // Devices can be lost at any time (driver updates, resource pressure). Drop
  // our references so the next acquire re-initialises cleanly.
  device.lost
    .then((info) => {
      console.warn(`[tab-3d] WebGPU device lost: ${info.message}`)
      gpuDevice = null
      gpuAdapter = null
    })
    .catch(console.error)

  gpuAdapter = adapter
  gpuDevice = device
}

/**
 * Acquire (or reuse) the shared WebGPU device. Concurrent callers coalesce onto
 * a single in-flight init so only one device is created per page.
 */
export async function acquireWebGpuDevice(): Promise<{
  adapter: GPUAdapter
  device: GPUDevice
}> {
  if (gpuDevice === null || gpuAdapter === null) {
    initInFlight ??= initializeDevice().finally(() => {
      initInFlight = null
    })
    await initInFlight
  }
  if (gpuAdapter === null || gpuDevice === null) {
    throw new Error('WebGPU device unavailable after initialisation.', {
      cause: 'WebGPU',
    })
  }
  return { adapter: gpuAdapter, device: gpuDevice }
}
