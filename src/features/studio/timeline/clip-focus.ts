// Studio clip focus — the focus handed back to a clip on the timeline by its id, when what held it closes or goes away.

/** Focus the clip `clipId` on the timeline, if it is on the page. */
export function focusStudioClip(clipId: string): void {
  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-studio-clip]',
  ))
    if (element.dataset.studioClip === clipId) element.focus()
}
