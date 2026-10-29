// ============================================================
// Studio editor keeper — this tab's lease and lock on the open song, kept while the tab edits it
// ============================================================
//
// The lease (src/db/services/studio-editor-lease.ts) fences every write. It
// lasts 30 seconds and is renewed every 10, but a hidden tab's timers run
// late or not at all, so a lease can run out while its tab is still the
// song's only editor. The keeper reclaims it on its own epoch, so the song,
// its history and its waiting saves stay as they are; a reclaim fails only
// when another tab has held the song since. The song's Web Lock
// (./editor-presence.ts) proves no other live tab edits it: a tab holding it
// goes on editing through a late renewal, and a reload takes over the lease
// its old document left at once instead of after its 30 seconds.
import { untrack } from 'solid-js'
import type { StudioEditorLease, StudioService, } from '@/db/services/studio-service'
import { StudioStorageError } from '@/db/services/studio-service'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { EditorPresence, EditorPresenceSource, ProjectOpenHold, } from './editor-presence'
import { EDITOR_CLAIM_WAIT_MS } from './editor-presence'

export const EDITING_TAKEN =
  'This project is no longer editable in this tab. Reload, make a copy, or take over editing.'

/** How often a held lease is renewed, against its 30 seconds. */
const RENEW_EVERY_MS = 10_000

/** Whether a write failed because another tab holds, or has held, the project. */
export function lostOwnership(error: unknown): boolean {
  return (
    error instanceof StudioStorageError &&
    ['locked', 'lease-lost', 'conflict'].includes(error.code)
  )
}

/** This tab's hold on a project: the lease that fences its writes, and its live presence. */
export interface ProjectEditor {
  lease: StudioEditorLease
  presence: EditorPresence
}

/** A song this tab is opening: held as loaded here, and its editor when this tab may edit it. */
export interface StudioSongClaim {
  readonly id: string
  readonly opened: ProjectOpenHold
  readonly editor: ProjectEditor | null
}

export interface StudioEditorKeeperOptions {
  service: StudioService
  presence: EditorPresenceSource
  now: () => Date
  createId: () => string
  /** The open song's generation; work begun for an older one changes nothing. */
  epoch: () => number
  current: (epoch: number) => boolean
  disposed: () => boolean
  loading: () => boolean
  writable: () => boolean
  /** Stop editing: nothing more is written, and what is not saved waits. */
  suspend: (error: unknown) => void
  /** Editing is back on the same token: write what waited. */
  resume: () => void
  /** Editing waits for a reclaim, with nothing to report yet. */
  pause: () => void
}

export function createStudioEditorKeeper(options: StudioEditorKeeperOptions) {
  let lease: StudioEditorLease | null = null
  let presence: EditorPresence | null = null
  /** The open song, held as loaded in this tab: no tab deletes its audio meanwhile. */
  let openHold: ProjectOpenHold | null = null
  /**
   * True while editing is on hold but the token may still be this tab's: a
   * save found the lease gone, or renewing it failed. The next reclaim gives
   * editing back, with the history and the waiting saves intact.
   */
  let editingLapsed = false
  let reclaiming: { epoch: number; done: Promise<void> } | null = null

  /** Another tab took the project over: this tab's token can never write again. */
  function lose(error: unknown): void {
    const held = presence
    lease = null
    presence = null
    editingLapsed = false
    held?.release()
    options.suspend(error)
  }

  function watch(held: EditorPresence, epoch: number): void {
    void held.lost.then(() => {
      if (presence !== held || !options.current(epoch)) return
      lose(new StudioStorageError('lease-lost', EDITING_TAKEN))
    })
  }

  /** Whether this tab's lease ran out on its own clock. The record may still be this tab's. */
  function lapsed(): boolean {
    return lease !== null && lease.expiresAt <= options.now().getTime()
  }

  /** Whether this tab edits the open project, or did until editing was put on hold. */
  function holds(): boolean {
    return (
      lease !== null &&
      !options.disposed() &&
      (options.writable() || editingLapsed)
    )
  }

  /**
   * Renew this tab's lease, or win it back after it lapsed, on the same
   * token, so the project, its history and its waiting saves stay as they
   * are. A page lets the project's lock go on its way into the back-forward
   * cache, so the lock is claimed again first: while this tab holds it, no
   * other live tab can be editing. The lease is then reclaimed on its epoch,
   * which fails only when another tab has held the project since, and
   * editing here is over. Runs on every renewal tick, before a write that
   * finds the lease lapsed, and as the tab comes back into view, into focus
   * or out of the back-forward cache.
   */
  function reclaim(): Promise<void> {
    const token = lease
    const epoch = options.epoch()
    if (!token || options.disposed() || options.loading())
      return Promise.resolve()
    if (reclaiming?.epoch === epoch) return reclaiming.done
    const entry = { epoch, done: Promise.resolve() }
    reclaiming = entry
    entry.done = Promise.resolve()
      .then(() => reclaimToken(token, epoch))
      .finally(() => {
        if (reclaiming === entry) reclaiming = null
      })
    return entry.done
  }

  async function reclaimToken(
    token: StudioEditorLease,
    epoch: number,
  ): Promise<void> {
    const ours = () =>
      options.current(epoch) &&
      lease !== null &&
      lease.ownerId === token.ownerId &&
      lease.epoch === token.epoch
    try {
      if (presence === null) {
        const claimed = await options.presence.claim(token.projectId, {
          waitMs: EDITOR_CLAIM_WAIT_MS,
          steal: false,
        })
        if (!ours()) {
          claimed?.release()
          return
        }
        // Another live tab holds the project's lock, so it edits the project now.
        if (claimed === null) {
          lose(new StudioStorageError('lease-lost', EDITING_TAKEN))
          return
        }
        presence = claimed
        watch(claimed, epoch)
      }
      const renewed = await options.service.reclaimLease(token.projectId, token)
      if (!ours()) return
      lease = renewed
      if (!editingLapsed) return
      editingLapsed = false
      options.resume()
    } catch (error) {
      if (!ours()) return
      if (lostOwnership(error)) {
        lose(error)
        return
      }
      editingLapsed = true
      options.suspend(error)
    }
  }

  /** Whether this tab's token may write now. A lease that lapsed is reclaimed meanwhile. */
  function mayEdit(): boolean {
    if (!lease) return false
    if (!lapsed()) return true
    // The renewal ran late, as a hidden tab's do. While this tab holds the
    // project's lock no other tab can be editing, so the edit goes ahead and
    // its save waits for the reclaim. Without the lock, editing waits.
    void reclaim()
    if (presence?.exclusive === true) return true
    editingLapsed = true
    options.pause()
    return false
  }

  /**
   * A save found the lease gone. Perhaps it only lapsed: the next renewal,
   * or the tab's return to view, wins it back or finds it taken.
   */
  function saveRefused(): void {
    if (lease !== null) editingLapsed = true
  }

  /**
   * This tab's lease and presence on project `id`, or null while another
   * live tab edits it. Holding the project's lock proves the lease's owner,
   * if any, has gone (a reload's old document, a closed or crashed tab), so
   * its lease is taken over at once instead of after its 30 seconds.
   */
  async function acquire(
    id: string,
    takeover: boolean,
  ): Promise<ProjectEditor | null> {
    const claimed = await options.presence.claim(id, {
      waitMs: EDITOR_CLAIM_WAIT_MS,
      steal: takeover,
    })
    // Another editor is a read-only state, not a failed storage operation.
    if (claimed === null) return null
    try {
      const acquired = await options.service.acquireLease(
        id,
        options.createId(),
        { takeover: takeover || claimed.exclusive },
      )
      return { lease: acquired, presence: claimed }
    } catch (error) {
      claimed.release()
      if (!(error instanceof StudioStorageError) || error.code !== 'locked')
        throw error
      return null
    }
  }

  /**
   * Claim song `id` for opening in generation `epoch`, or null once a newer
   * opening replaced it. The song is held as loaded from before it is read
   * until this tab lets it go: while any tab holds it, no tab deletes its
   * unused audio.
   */
  async function claim(
    id: string,
    takeover: boolean,
    epoch: number,
  ): Promise<StudioSongClaim | null> {
    const opened = await options.presence.open(id)
    if (!options.current(epoch)) {
      opened.release()
      return null
    }
    try {
      return { id, opened, editor: await acquire(id, takeover) }
    } catch (error) {
      opened.release()
      throw error
    }
  }

  /** The claimed song's lease while this tab may edit it: not while another tab does, nor once it ran out. */
  function writeToken(claimed: StudioSongClaim): StudioEditorLease | null {
    const token = claimed.editor?.lease ?? null
    return token !== null && token.expiresAt > options.now().getTime()
      ? token
      : null
  }

  /**
   * The song's audio as it opens, less what no clip uses: takes removed in
   * an earlier session stop counting against its audio limit. Only a tab
   * that edits the song and holds its lock deletes, and only once it is
   * proven that no other tab has the song loaded: another tab's history,
   * unsaved edits or copy may still want that audio. A failure keeps
   * everything.
   */
  async function pruneOnOpen(
    claimed: StudioSongClaim,
    token: StudioEditorLease | null,
    snapshot: StudioProject,
    metadata: StudioAsset[],
  ): Promise<StudioAsset[]> {
    if (token === null || claimed.editor?.presence.exclusive !== true)
      return metadata
    const used = new Set(snapshot.clips.map((clip) => clip.assetId))
    if (metadata.every((asset) => used.has(asset.id))) return metadata
    try {
      if (!(await claimed.opened.alone())) return metadata
      return await options.service.pruneUnusedAssets(claimed.id, {
        ...token,
        expectedRevision: snapshot.revision,
      })
    } catch {
      return metadata
    }
  }

  /** Make a claimed song the open one: its hold, and its lease and lock when it has them. */
  function adopt(claimed: StudioSongClaim, epoch: number): void {
    openHold = claimed.opened
    if (claimed.editor === null) return
    lease = claimed.editor.lease
    presence = claimed.editor.presence
    watch(claimed.editor.presence, epoch)
  }

  /** Let go of a song that was claimed but never opened. */
  async function drop(claimed: StudioSongClaim): Promise<void> {
    claimed.opened.release()
    if (claimed.editor === null) return
    try {
      await options.service.releaseLease(claimed.id, claimed.editor.lease)
    } catch {
      /* Expiry also retires this token. */
    } finally {
      claimed.editor.presence.release()
    }
  }

  /** Let the open song go: its lease, its lock and its hold. */
  async function release(): Promise<void> {
    const previous = lease
    const held = presence
    const opened = openHold
    lease = null
    presence = null
    openHold = null
    editingLapsed = false
    try {
      if (previous)
        await options.service.releaseLease(previous.projectId, previous)
    } catch {
      /* Expiry also retires this token. */
    } finally {
      held?.release()
      opened?.release()
    }
  }

  // A tick that runs late, as a hidden tab's do, finds the lease lapsed and
  // reclaims it on the same epoch instead of giving editing up.
  const renewTimer = setInterval(
    () =>
      untrack(() => {
        if (holds()) void reclaim()
      }),
    RENEW_EVERY_MS,
  )

  // Back in view, in focus, or out of the back-forward cache: editing that
  // lapsed meanwhile comes back here, with nothing reloaded.
  const regain = () =>
    untrack(() => {
      if (holds() && (editingLapsed || lapsed() || !presence)) void reclaim()
    })
  const onVisibility = () => {
    if (document.visibilityState === 'visible') regain()
  }
  // Leaving the page: let the project's lock go at once, so a reload or
  // another tab can edit, and the lease too where the page lives long enough
  // to write it. A page kept in the back-forward cache claims both back as it
  // is shown again.
  const onPageHide = () =>
    untrack(() => {
      const held = presence
      presence = null
      held?.release()
      const token = lease
      if (!token || options.disposed()) return
      lease = { ...token, expiresAt: 0 }
      void options.service
        .releaseLease(token.projectId, token)
        .catch(() => undefined)
    })

  /** Follow the page's visibility, focus and lifecycle. */
  function listen(): void {
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', regain)
    window.addEventListener('pageshow', regain)
    window.addEventListener('pagehide', onPageHide)
  }

  /** Stop renewing and following the page. */
  function stop(): void {
    clearInterval(renewTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', regain)
    window.removeEventListener('pageshow', regain)
    window.removeEventListener('pagehide', onPageHide)
  }

  return {
    /** The open song's lease, while this tab holds one. */
    lease: () => lease,
    lapsed,
    mayEdit,
    reclaim,
    saveRefused,
    claim,
    writeToken,
    pruneOnOpen,
    adopt,
    drop,
    release,
    listen,
    stop,
  }
}

export type StudioEditorKeeper = ReturnType<typeof createStudioEditorKeeper>
