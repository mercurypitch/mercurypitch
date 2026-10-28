// Studio controller backup tests — a backup is refused before its save picker opens, and a song switch for a picked file waits for a save in flight.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioStorageError } from '@/db/services/studio-service'
import type { StudioProject } from '@/lib/studio/model/types'
import { controllerServiceFixture } from './controller/controller.fixture'
import type { StudioController } from './useStudioController'
import { STUDIO_SAVE_WAIT_MS, useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
})

const SWITCH_REFUSED =
  'Save these changes, make a copy, or discard them before opening another project.'

function mount() {
  const service = controllerServiceFixture()
  let serial = 0
  let controller!: StudioController
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service,
      createId: () => `id-${++serial}`,
    })
  })
  return { controller, service }
}

/** Hold the next save until the test lets it land. */
function holdNextSave(service: ReturnType<typeof controllerServiceFixture>) {
  let land!: (project: StudioProject) => void
  vi.mocked(service.saveProject).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        land = resolve
      }),
  )
  return (project: StudioProject) => land(project)
}

describe('Studio controller backups', () => {
  it('says before the save picker opens whether a backup can start: a save in flight is no reason to refuse, a failed one is', async () => {
    const { controller, service } = mount()
    expect(controller.canBackup()).toBe(false)
    await controller.open('one')
    expect(controller.canBackup()).toBe(true)
    expect(controller.canBackup('one')).toBe(true)
    expect(controller.canBackup('two')).toBe(true)

    const land = holdNextSave(service)
    controller.rename('Chorus fix')
    expect(controller.saveState()).toBe('saving')
    expect(controller.canBackup('two')).toBe(true)
    expect(controller.problem()).toBeNull()
    land(controller.project()!)
    await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))

    // Switching away would lose an edit no save could keep.
    vi.mocked(service.saveProject).mockRejectedValueOnce(
      new StudioStorageError('quota-exceeded', 'Full'),
    )
    controller.rename('Bridge fix')
    await vi.waitFor(() => expect(controller.saveState()).toBe('error'))
    expect(controller.canBackup('two')).toBe(false)
    expect(controller.problem()).toBe(SWITCH_REFUSED)
    // The open song's own backup keeps that edit, so it can still start.
    expect(controller.canBackup()).toBe(true)
  })

  it('opens another song for a picked backup once the save in flight lands', async () => {
    const { controller, service } = mount()
    await controller.open('one')
    const land = holdNextSave(service)
    controller.rename('Last edit')
    const edited = controller.project()!

    const opening = controller.openForBackup('two')
    await vi.waitFor(() => expect(service.saveProject).toHaveBeenCalledOnce())
    expect(controller.project()?.id).toBe('one')
    land(edited)

    expect(await opening).toBe(true)
    expect(controller.project()?.id).toBe('two')
    expect(controller.problem()).toBeNull()
    expect(service.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'one', title: 'Last edit' }),
      expect.anything(),
      [],
    )
  })

  it('stops waiting for a save that does not land, and keeps its song open', async () => {
    vi.useFakeTimers()
    const { controller, service } = mount()
    await controller.open('one')
    vi.mocked(service.saveProject).mockImplementationOnce(
      () => new Promise(() => {}),
    )
    controller.rename('Stuck edit')
    let opened: boolean | undefined
    void controller.openForBackup('two').then((result) => {
      opened = result
    })

    await vi.advanceTimersByTimeAsync(STUDIO_SAVE_WAIT_MS - 1)
    expect(opened).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(opened).toBe(false)
    expect(controller.project()?.id).toBe('one')
    expect(controller.problem()).toBe(SWITCH_REFUSED)
  })

  it('needs no wait for the song already open', async () => {
    const { controller, service } = mount()
    await controller.open('one')
    holdNextSave(service)
    controller.rename('Still saving')
    expect(await controller.openForBackup('one')).toBe(true)
    expect(controller.saveState()).toBe('saving')
  })
})
