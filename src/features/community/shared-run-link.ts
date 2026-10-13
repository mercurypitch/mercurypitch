// Shared run link state belongs to the current route and never enters practice history.
import { createSignal } from 'solid-js'

export type SharedRunRequest =
  | { kind: 'public'; id: string }
  | { kind: 'payload'; payload: string }

export const [sharedRunRequest, setSharedRunRequest] =
  createSignal<SharedRunRequest | null>(null)
