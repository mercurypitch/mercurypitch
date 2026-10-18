// Museum card fixtures and geometry — saved rewards and entry actions must remain fully readable.
import { MUSEUM_CAMPAIGN } from '../../../../packages/glass-game/src/content/campaign'
import { replayProfilesForLevel } from '../../../../packages/glass-game/src/content/replay-profiles'
import { readProgress } from '../../../../packages/glass-game/src/core/progress'
import { resolveReplayProfile } from '../../../../packages/glass-game/src/core/replay-profile'
import { beginReplayAttempt, highestReplayTier, readReplayProgress, saveReplayAttempt, } from '../../../../packages/glass-game/src/core/replay-progress'

export function completedMuseumCardStorage(): Record<string, string> {
  const storage: Record<string, string> = {
    'beside-cue:glass-adventure:tutorial': 'seen',
  }
  for (const [index, { level }] of MUSEUM_CAMPAIGN.entries()) {
    const legacy = readProgress(level, {
      ...readProgress(level, null),
      completedBreakableIds: level.breakables.map((item) => item.id),
      finished: true,
    })
    storage[`beside-cue:glass-adventure:progress:${level.id}`] =
      JSON.stringify(legacy)
    if (!index) continue
    const profiles = replayProfilesForLevel(level).map((profile) =>
      resolveReplayProfile(level, profile),
    )
    const profile = profiles.find(
      (candidate) => candidate.profile.tier === index,
    )!
    const replay = saveReplayAttempt(
      beginReplayAttempt(
        readReplayProgress(level, profiles, null, legacy),
        profile,
        true,
      ),
      profile,
      readProgress(profile.level, {
        ...readProgress(profile.level, null),
        completedBreakableIds: profile.level.breakables.map((item) => item.id),
        finished: true,
      }),
      1_791_744_000_000,
    )
    if (
      highestReplayTier(readReplayProgress(level, profiles, replay, legacy)) !==
      index
    )
      throw new Error(`Completed museum fixture rejected for ${level.id}`)
    storage[`beside-cue:glass-adventure:replays:v1:${level.id}`] =
      JSON.stringify(replay)
  }
  return storage
}

/** Read actual glyph rectangles and clipping ancestors, not just the nominal button size. */
export function museumCardContainment(button: HTMLElement): string[] {
  const card = button.closest('article')!
  const content = button.parentElement!
  const issues: string[] = []
  const action = button.getBoundingClientRect()
  const title = content.querySelector('h2')!
  const keepsakes = content.querySelector(':scope > div')!
  const inside = (
    rect: DOMRect,
    bounds: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>,
  ) =>
    rect.left >= bounds.left - 0.5 &&
    rect.top >= bounds.top - 0.5 &&
    rect.right <= bounds.right + 0.5 &&
    rect.bottom <= bounds.bottom + 0.5
  const check = (rect: DOMRect, owner: Element, label: string) => {
    for (const boundary of [card, content])
      if (!inside(rect, boundary.getBoundingClientRect()))
        issues.push(
          `${label} exceeds ${boundary === card ? 'card' : 'content'}`,
        )
    if (
      !inside(rect, { left: 0, top: 0, right: innerWidth, bottom: innerHeight })
    )
      issues.push(`${label} exceeds viewport`)
    for (
      let ancestor: Element | null = owner;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor)
      const bounds = ancestor.getBoundingClientRect()
      if (
        /hidden|clip|auto|scroll/.test(style.overflowX) &&
        (rect.left < bounds.left - 0.5 || rect.right > bounds.right + 0.5)
      )
        issues.push(`${label} clipped horizontally`)
      if (
        /hidden|clip|auto|scroll/.test(style.overflowY) &&
        (rect.top < bounds.top - 0.5 || rect.bottom > bounds.bottom + 0.5)
      )
        issues.push(`${label} clipped vertically`)
    }
  }
  if (action.height < 44) issues.push(`entry action is ${action.height}px high`)
  check(action, button.parentElement!, 'entry action')
  if (title.getBoundingClientRect().bottom > action.top + 0.5)
    issues.push('title overlaps entry action')
  if (keepsakes.getBoundingClientRect().bottom > action.top + 0.5)
    issues.push('keepsakes overlap entry action')
  for (const element of [title, keepsakes, button]) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects())
        check(rect, node.parentElement!, node.textContent.trim())
    }
  }
  for (const element of keepsakes.querySelectorAll('img, svg'))
    check(element.getBoundingClientRect(), element, 'earned keepsake image')
  return [...new Set(issues)]
}

/** A scrolled catalogue action needs its entire touch target inside its card and clipping ancestors. */
export function catalogueActionContainment(button: HTMLElement): string[] {
  const action = button.getBoundingClientRect()
  const issues: string[] = []
  if (action.height < 44) issues.push(`action is ${action.height}px high`)
  if (action.width < 44) issues.push(`action is ${action.width}px wide`)
  const bounds = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
  for (
    let ancestor = button.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const style = getComputedStyle(ancestor)
    const rect = ancestor.getBoundingClientRect()
    if (
      ancestor.tagName === 'ARTICLE' ||
      /hidden|clip|auto|scroll/.test(style.overflowX)
    ) {
      bounds.left = Math.max(bounds.left, rect.left)
      bounds.right = Math.min(bounds.right, rect.right)
    }
    if (
      ancestor.tagName === 'ARTICLE' ||
      /hidden|clip|auto|scroll/.test(style.overflowY)
    ) {
      bounds.top = Math.max(bounds.top, rect.top)
      bounds.bottom = Math.min(bounds.bottom, rect.bottom)
    }
  }
  if (
    action.left < bounds.left - 0.5 ||
    action.right > bounds.right + 0.5 ||
    action.top < bounds.top - 0.5 ||
    action.bottom > bounds.bottom + 0.5
  )
    issues.push('action is not fully visible inside its card and viewport')
  return issues
}

/** Use the actual opaque surface, or conservative RGB bounds of the museum's pale gradient stops. */
export function museumTextContrast(text: HTMLElement): number {
  const rgb = (color: string): number[] | undefined => {
    const channels = color.match(
      /^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?\)$/,
    )
    if (!channels)
      throw new Error(`Expected rendered RGB color, received ${color}`)
    const alpha = channels[4] === undefined ? 1 : Number(channels[4])
    if (alpha === 0) return undefined
    if (alpha !== 1)
      throw new Error(`Unsupported translucent surface: ${color}`)
    return channels.slice(1, 4).map(Number)
  }
  const luminance = (channels: number[]): number => {
    const linear = channels.map((channel) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
  }
  const foreground = luminance(rgb(getComputedStyle(text).color)!)
  for (
    let surface: HTMLElement | null = text;
    surface;
    surface = surface.parentElement
  ) {
    const style = getComputedStyle(surface)
    let colors: number[][] = []
    if (style.backgroundImage !== 'none') {
      if (style.backgroundImage.includes('url('))
        throw new Error('Image background needs a separate contrast inspection')
      colors = [...style.backgroundImage.matchAll(/rgba?\([^)]*\)/g)]
        .map(([color]) => rgb(color))
        .filter((color): color is number[] => color !== undefined)
      if (
        !style.backgroundImage.includes('linear-gradient(') ||
        colors.length < 2
      )
        throw new Error('Expected the museum opaque pale gradient backing')
    } else {
      const color = rgb(style.backgroundColor)
      if (color) colors.push(color)
    }
    if (!colors.length) continue
    // Channel extrema bound every interpolation of these layered pale stops,
    // including blends whose luminance differs from either individual stop.
    const low = luminance(
      [0, 1, 2].map((channel) =>
        Math.min(...colors.map((color) => color[channel]!)),
      ),
    )
    const high = luminance(
      [0, 1, 2].map((channel) =>
        Math.max(...colors.map((color) => color[channel]!)),
      ),
    )
    if (foreground >= low && foreground <= high) return 1
    const background = foreground < low ? low : high
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    )
  }
  throw new Error('No known opaque text backing found')
}
