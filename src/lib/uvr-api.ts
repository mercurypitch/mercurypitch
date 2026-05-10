// ============================================================
// UVR API Client - Frontend Integration
// ============================================================

const API_BASE = '/api/uvr'

/**
 * Processing request parameters
 */
export interface ProcessRequest {
  model?: string
  output_format?: string
  stems?: string[]
  cpu_profile?: 'high' | 'mid' | 'low'
}

// Default processing options
export const DEFAULT_PROCESS_REQUEST: ProcessRequest = {
  model: 'UVR-MDX-NET-Inst_HQ_3',
  output_format: 'WAV',
  stems: ['vocal', 'instrumental'],
  cpu_profile: 'high',
}

/**
 * Response after starting processing
 */
export interface ProcessResponse {
  session_id: string
  status: string
  message: string
  model: string
  output_format: string
}

/**
 * Status response with processing info
 */
export interface ProcessStatusResponse {
  session_id: string
  status: 'processing' | 'completed' | 'not_started' | 'error'
  progress?: number
  estimated_total_secs?: number
  cpu_profile?: string
  message?: string
  files: OutputFile[]
  error?: string
}

/**
 * Processed output file info
 */
export interface OutputFile {
  stem: string
  filename: string
  path: string
  size?: number
  duration?: number
}

/**
 * Available UVR models
 */
export const UVR_MODELS = [
  {
    name: 'UVR-MDX-NET-Inst_HQ',
    display: 'MDX-Net HQ',
    quality: 'High',
    speed: 'Medium',
  },
  {
    name: 'UVR-MDX-NET-Karaoke_3',
    display: 'MDX-Net Karaoke',
    quality: 'High',
    speed: 'Medium',
  },
  {
    name: 'UVR-MDX-NET-Voc_FT',
    display: 'MDX-Net Vocals',
    quality: 'Medium',
    speed: 'Fast',
  },
  {
    name: 'VR-Architecture',
    display: 'VR Architecture',
    quality: 'High',
    speed: 'Slow',
  },
]

/**
 * List available UVR models
 */
export async function listModels(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/models`)
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`)
  }
  const data = await response.json()
  return Array.isArray(data.models) ? data.models : []
}

/**
 * Start processing an audio file
 */
export async function processAudio(
  file: File,
  options: ProcessRequest = DEFAULT_PROCESS_REQUEST,
): Promise<ProcessResponse> {
  const formData = new FormData()
  formData.append('file', file)

  if (options.model !== undefined) {
    formData.append('model', options.model)
  }
  if (options.output_format !== undefined) {
    formData.append('output_format', options.output_format)
  }
  if (options.stems) {
    formData.append('stems', JSON.stringify(options.stems))
  }
  if (options.cpu_profile) {
    formData.append('cpu_profile', options.cpu_profile)
  }

  const response = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `Failed to process audio: ${response.statusText}`)
  }

  return response.json() as Promise<ProcessResponse>
}

/**
 * Get processing status for a session
 */
export async function getProcessStatus(
  sessionId: string,
): Promise<ProcessStatusResponse> {
  const response = await fetch(`${API_BASE}/status/${sessionId}`)
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`)
  }
  return response.json() as Promise<ProcessStatusResponse>
}

/**
 * Get output file
 */
export async function getOutputFile(
  sessionId: string,
  path: string,
): Promise<Response> {
  return fetch(`${API_BASE}/output/${sessionId}/${encodeURIComponent(path)}`)
}

/**
 * Delete a processing session
 */
export async function deleteSession(
  sessionId: string,
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/session/${sessionId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.statusText}`)
  }
  return response.json() as Promise<{ status: string; message: string }>
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{
  status: string
  version: string
}> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`)
  }
  return response.json() as Promise<{ status: string; version: string }>
}
/**
 * Poll for processing completion with timeout and abort support
 */
export async function pollForCompletion(
  sessionId: string,
  onProgress: (progress: number, indeterminate?: boolean) => void,
  onComplete: (files: OutputFile[]) => void,
  onError: (error: string) => void,
  intervalMs: number = 1000,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = Date.now()
  const maxTimeMs = 30 * 60 * 1000 // 30 minutes absolute max
  let estimateExceeded = false

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (signal?.aborted ?? false) {
        reject(new DOMException('Polling aborted', 'AbortError'))
        return
      }

      const elapsed = Date.now() - startTime
      if (elapsed > maxTimeMs) {
        const timeoutErr = 'Processing timed out after 30 minutes'
        onError(timeoutErr)
        reject(new Error(timeoutErr))
        return
      }

      try {
        const status = await getProcessStatus(sessionId)

        if (status.status === 'completed') {
          onComplete(status.files)
          resolve()
          return
        }

        if (status.status === 'error') {
          onError(status.error ?? 'Processing failed')
          reject(new Error(status.error ?? 'Processing failed'))
          return
        }

        if (status.status === 'not_started') {
          const errMsg = 'Processing server restarted unexpectedly. Please retry.'
          onError(errMsg)
          reject(new Error(errMsg))
          return
        }

        // Use server progress if available
        if (status.progress !== undefined && status.progress !== null) {
          onProgress(status.progress, estimateExceeded)
        } else {
          // Fallback: estimate from server's estimated_total_secs or default
          const estimatedSecs = status.estimated_total_secs ?? 120
          const estimatedMs = Math.max(estimatedSecs * 1000, 10000)
          const pct = (elapsed / estimatedMs) * 100

          if (pct >= 95 && !estimateExceeded) {
            estimateExceeded = true
            onProgress(95, true)
          } else if (estimateExceeded) {
            onProgress(95, true)
          } else {
            onProgress(Math.min(95, pct), false)
          }
        }

        setTimeout(() => {
          void poll()
        }, intervalMs)
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Unknown error')
        reject(error)
      }
    }

    poll()
  })
}

/**
 * Convert file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
