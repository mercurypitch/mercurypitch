// Drum Night roving focus — shared workbench tab and kit radio navigation.

export function nextRovingIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
): number | null {
  if (key === 'Home') return 0
  if (key === 'End') return itemCount - 1
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % itemCount
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + itemCount) % itemCount
  }
  return null
}
