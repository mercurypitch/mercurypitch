import { createSignal } from 'solid-js'
import { createUvrUploadQueue } from '@/lib/uvr-upload-queue'
import type { UvrProcessingMode } from './uvr-store'

/**
 * App-lifetime upload queue.
 *
 * UvrPanel is mounted only while the Karaoke tab is visible. Keeping the queue
 * here lets a running batch survive that component's disposal and gives the
 * next UvrPanel instance access to the same progress and cancellation hooks.
 * Files intentionally remain memory-only: an internal tab change is safe, but
 * a full page reload does not attempt to serialize user-selected File objects.
 */
export const uvrUploadQueue = createUvrUploadQueue()

export const [activeUvrUploadQueueMode, setActiveUvrUploadQueueMode] =
  createSignal<UvrProcessingMode>('local')
