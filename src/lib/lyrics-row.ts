export function findLyricsRow(
  container: ParentNode,
  canonicalIndex: number,
): HTMLElement | null {
  if (!Number.isInteger(canonicalIndex) || canonicalIndex < 0) return null
  const exact = container.querySelector<HTMLElement>(
    `[data-lyrics-index="${canonicalIndex}"]`,
  )
  if (exact !== null) return exact

  for (const row of container.querySelectorAll<HTMLElement>(
    '[data-lyrics-index][data-lyrics-end-index]',
  )) {
    const start = Number(row.dataset.lyricsIndex)
    const end = Number(row.dataset.lyricsEndIndex)
    if (canonicalIndex >= start && canonicalIndex <= end) return row
  }
  return null
}
