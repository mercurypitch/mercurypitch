// Archive Hush awards — earned protection waits for a valid physical room before opening its route.
export function createArchiveHushAwards(options: {
  canCommit(): boolean
  accept(roomId: string): boolean
  onCommit(roomId: string): void
}) {
  const pending = new Set<string>()
  const committed = new Set<string>()
  let updating = false
  const update = (): void => {
    if (updating || !options.canCommit()) return
    updating = true
    try {
      for (const id of [...pending]) {
        if (!options.canCommit()) return
        if (!options.accept(id)) continue
        // Retire before the host saves/refreshes, which may synchronously reenter.
        pending.delete(id)
        committed.add(id)
        options.onCommit(id)
      }
    } finally {
      updating = false
    }
  }
  return {
    award(roomId: string): void {
      if (committed.has(roomId)) return
      pending.add(roomId)
      update()
    },
    update,
    pending: (): string[] => [...pending],
  }
}
