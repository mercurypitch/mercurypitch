// Studio render attempts keep cancellation separate from the immutable revision they own.
export interface StudioRenderJob {
  abort: AbortController
  projectId: string
  revision: number
}
