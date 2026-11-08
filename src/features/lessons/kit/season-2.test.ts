// ============================================================
// Season 2 map tests — Lessons 15 to 28, their edges and their close
// ============================================================

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRAFT_LESSONS } from './drafts'
import { TEASE_MAX } from './lesson-copy'
import { ancestors, lessonPath, LESSONS, SEASON_1, unlocks } from './season'
import { EDGES_2, LESSONS_2, SEASON_2, TOPICS_2 } from './season-2'
import { ALL_LESSONS, ALL_PREREQ, seasonOf, SEASONS, seasonsTitle, topicName, } from './seasons'

describe('Season 2', () => {
  it('is Lessons 15 to 28 in order, numbered on from Season 1', () => {
    // Assert
    expect(LESSONS_2.map((L) => L.n)).toEqual([
      15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
    ])
    expect(SEASON_2.n).toBe(2)
    expect(SEASON_2.lessons).toBe(LESSONS_2)
  })

  it('knows its last lesson, and so does Season 1', () => {
    // Assert
    for (const s of SEASONS)
      expect(s.last, `season ${s.n}`).toBe(
        Math.max(...s.lessons.map((L) => L.n)),
      )
    expect(SEASON_1.last).toBe(14)
    expect(SEASON_2.last).toBe(28)
  })

  it('takes its name from its plan, "Read it, harmonise it"', () => {
    expect(SEASON_2.name).toBe('Read it, harmonise it')
  })

  it('alternates theory and voice, and ends on both', () => {
    // Assert: SEASON-2 § 2, odd lessons theory, even voice, Lesson 28 both
    for (const L of LESSONS_2) {
      const lane = L.n === 28 ? 'both' : L.n % 2 === 1 ? 'theory' : 'voice'
      expect(L.lane, `lesson ${L.n}`).toBe(lane)
    }
  })

  it('has no page, no reading time and no film for Lessons 18, 20 and 25 to 28 yet: each is coming later', () => {
    // Assert
    for (const L of LESSONS_2.filter(
      (L) => ![15, 16, 17, 19, 21, 22, 23, 24].includes(L.n),
    )) {
      expect(L.page, `lesson ${L.n}`).toBeUndefined()
      expect(L.minutes, `lesson ${L.n}`).toBeUndefined()
      expect(L.film, `lesson ${L.n}`).toBeUndefined()
      expect(L.len, `lesson ${L.n}`).toBeUndefined()
    }
  })

  it("gives Lesson 15 its page and its reading time, a draft with no film, and Compose's link", () => {
    // Act
    const L15 = LESSONS_2.find((L) => L.n === 15)

    // Assert: Lesson 15's WEB-SPEC, Explorer and season data
    expect([L15?.page, L15?.minutes, L15?.film, L15?.len]).toEqual([
      '/learn/15',
      15,
      undefined,
      undefined,
    ])
    expect(DRAFT_LESSONS[15]).toBe(
      "the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
    )
    expect(L15?.pr.link).toEqual({
      href: '/?lesson=15#/compose',
      addr: 'mercurypitch.com/#/compose',
      label: 'Compose',
      note: 'then choose Sheet Music',
    })
    // the drill it still needs stays the team's
    expect(L15?.pr.needs).toMatch(/^A note-reading drill/)
    expect(SEASON_2.prereq[15]).toEqual([2])
  })

  it("gives Lesson 16 its page and its reading time, a draft with no film, and the Exercises' link", () => {
    // Act
    const L16 = LESSONS_2.find((L) => L.n === 16)

    // Assert: Lesson 16's WEB-SPEC, Explorer and season data
    expect([L16?.page, L16?.minutes, L16?.film, L16?.len]).toEqual([
      '/learn/16',
      15,
      undefined,
      undefined,
    ])
    // it publishes only after Lessons 9 and 15, whose pages its chips and
    // recall link (Lesson 16's WEB-SPEC, the page's public home)
    expect(DRAFT_LESSONS[16]).toBe(
      "Lessons 9 and 15's pages at /learn/09 and /learn/15, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
    )
    expect(L16?.pr.link).toEqual({
      href: '/pitch-training?lesson=16',
      addr: 'mercurypitch.com/pitch-training',
      label: 'Exercises',
      note: 'then tap Sight-Singing',
    })
    // the drill it still needs stays the team's
    expect(L16?.pr.needs).toMatch(/^Sight-Singing for the lessons/)
    // Lesson 9 from Season 1, and Lesson 15
    expect(SEASON_2.prereq[16]).toEqual([9, 15])
  })

  it("gives Lesson 17 its page and its reading time, a draft with no film, and the Ear Lab's link", () => {
    // Act
    const L17 = LESSONS_2.find((L) => L.n === 17)

    // Assert: Lesson 17's WEB-SPEC, Explorer and season data
    expect([L17?.page, L17?.minutes, L17?.film, L17?.len]).toEqual([
      '/learn/17',
      16,
      undefined,
      undefined,
    ])
    expect(DRAFT_LESSONS[17]).toBe(
      "Lesson 8's page at /learn/08, and the vocal coach's look at the sung part",
    )
    expect(L17?.pr.link).toEqual({
      href: '/ear-lab?lesson=17',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap The Chart',
    })
    // the drill it still needs stays the team's
    expect(L17?.pr.needs).toMatch(/^The Chart without triplets/)
    // Lesson 15 only helps, so Lesson 8 is its one way in
    expect(SEASON_2.prereq[17]).toEqual([8])
  })

  it("gives Lesson 19 its page and its reading time, a draft with no film, and the Ear Lab's link", () => {
    // Act
    const L19 = LESSONS_2.find((L) => L.n === 19)

    // Assert: Lesson 19's WEB-SPEC, Explorer and season data
    expect([L19?.page, L19?.minutes, L19?.film, L19?.len]).toEqual([
      '/learn/19',
      12,
      undefined,
      undefined,
    ])
    expect(DRAFT_LESSONS[19]).toBe("Lesson 17's page at /learn/17")
    expect(L19?.pr.link).toEqual({
      href: '/ear-lab?lesson=19',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap Subdivide',
    })
    // the drill it still needs stays the team's
    expect(L19?.pr.needs).toMatch(/^Subdivide with only 3\/4 and 6\/8/)
    // Lesson 17 is its one way in
    expect(SEASON_2.prereq[19]).toEqual([17])
  })

  it("gives Lesson 22 its page and its reading time, a draft with no film, and Voice Mirror's link", () => {
    // Act
    const L22 = LESSONS_2.find((L) => L.n === 22)

    // Assert: Lesson 22's WEB-SPEC, Explorer and season data
    expect([L22?.page, L22?.minutes, L22?.film, L22?.len]).toEqual([
      '/learn/22',
      15,
      undefined,
      undefined,
    ])
    expect(DRAFT_LESSONS[22]).toBe(
      "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
    )
    expect(L22?.pr.link).toEqual({
      href: '/mirror?lesson=22',
      addr: 'mercurypitch.com/mirror',
      label: 'Voice Mirror',
      note: 'its Hold: a vibrato reported, never scored',
    })
    // the drill it still needs stays the team's
    expect(L22?.pr.needs).toMatch(/^The Vibrato exercise's copy and default/)
    // Lesson 14 is its one way in
    expect(SEASON_2.prereq[22]).toEqual([14])
  })

  it("gives Lesson 23 its page and its reading time, a draft with no film, and the Ear Lab's link", () => {
    // Act
    const L23 = LESSONS_2.find((L) => L.n === 23)

    // Assert: Lesson 23's WEB-SPEC, Explorer and season data
    expect([L23?.page, L23?.minutes, L23?.film, L23?.len]).toEqual([
      '/learn/23',
      14,
      undefined,
      undefined,
    ])
    expect(DRAFT_LESSONS[23]).toBe(
      "Lesson 6's page at /learn/06, and the vocal coach's look at Sing it",
    )
    expect(L23?.pr.link).toEqual({
      href: '/ear-lab?lesson=23',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap Leap',
    })
    // the drill it still needs stays the team's
    expect(L23?.pr.needs).toMatch(/^Leap with only the perfect intervals/)
    // a cross-season edge: Lesson 6 is its one way in
    expect(SEASON_2.prereq[23]).toEqual([6])
  })

  it("gives Lesson 21 its page and its reading time, a draft with no film, and Compose's link", () => {
    // Act
    const L21 = LESSONS_2.find((L) => L.n === 21)

    // Assert: Lesson 21's WEB-SPEC, Explorer and season data
    expect([L21?.page, L21?.minutes, L21?.film, L21?.len]).toEqual([
      '/learn/21',
      15,
      undefined,
      undefined,
    ])
    // it publishes only after Lessons 6 and 15, whose pages its chips and
    // recall link (Lesson 21's WEB-SPEC, the page's public home)
    expect(DRAFT_LESSONS[21]).toBe(
      "Lessons 6 and 15's pages at /learn/06 and /learn/15, and the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
    )
    expect(L21?.pr.link).toEqual({
      href: '/?lesson=21#/compose',
      addr: 'mercurypitch.com/#/compose',
      label: 'Compose',
      note: 'then choose Sheet Music',
    })
    // the drills it still needs stay the team's
    expect(L21?.pr.needs).toBe(
      'A note-reading drill that reads key signatures, and Sight-Singing that spells by key',
    )
    // Lesson 6 from Season 1, and Lesson 15
    expect(SEASON_2.prereq[21]).toEqual([6, 15])
  })

  it("gives Lesson 24 its page and its reading time, a draft with no film, and Drone Intonation's link", () => {
    // Act
    const L24 = LESSONS_2.find((L) => L.n === 24)

    // Assert: Lesson 24's WEB-SPEC, Explorer and season data
    expect([L24?.page, L24?.minutes, L24?.film, L24?.len]).toEqual([
      '/learn/24',
      16,
      undefined,
      undefined,
    ])
    // the lab's two tests come first, then the coach (Lesson 24's WEB-SPEC,
    // What the kit and the app still need, items 2 and 7)
    expect(DRAFT_LESSONS[24]).toBe(
      "the lab's two tests (its WEB-SPEC, What the kit and the app still need, item 7), and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
    )
    expect(L24?.pr.link).toEqual({
      href: '/exercises/thirds-on-a-drone?lesson=24',
      addr: 'mercurypitch.com/exercises/thirds-on-a-drone',
      label: 'Drone Intonation',
      note: 'the two thirds',
    })
    // the drill it still needs stays the team's
    expect(L24?.pr.needs).toMatch(/^The fifth, third and octave slug/)
    // Lessons 5 and 10 from Season 1, and Lesson 23
    expect(SEASON_2.prereq[24]).toEqual([5, 10, 23])
  })

  it('has a page in the repository exactly where an entry has one: Lessons 15, 16, 17, 19, 21, 22, 23 and 24', () => {
    // Arrange: learn/NN.html for 15 and up
    const learn = resolve(__dirname, '../../../../learn')
    const pages = readdirSync(learn)
      .map((f) => /^(\d{2})\.html$/.exec(f)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number)
      .filter((n) => n >= 15)

    // Assert
    expect(pages).toEqual([15, 16, 17, 19, 21, 22, 23, 24])
    expect(
      LESSONS_2.filter((L) => L.page !== undefined).map((L) => L.n),
    ).toEqual(pages)
  })

  it('names every topic of its lessons, and asks every hook as a question', () => {
    // Assert
    for (const L of LESSONS_2) {
      expect(L.topics.length, `lesson ${L.n}`).toBeGreaterThan(0)
      for (const t of L.topics)
        expect(TOPICS_2[t], `lesson ${L.n}, ${t}`).toBeTruthy()
      expect(L.hook, `lesson ${L.n}`).toMatch(/\?$/)
    }
  })

  it('names none of its topics that no lesson teaches', () => {
    const taught = new Set(LESSONS_2.flatMap((L) => L.topics))
    expect(Object.keys(TOPICS_2).filter((t) => !taught.has(t))).toEqual([])
  })

  it("sends every practise link to this site, marked with the lesson's number", () => {
    // Assert
    for (const L of LESSONS_2) {
      const link = L.pr.link
      expect(link, `lesson ${L.n}`).toBeDefined()
      const url = new URL(link?.href ?? '', 'https://mercurypitch.com')
      expect(url.origin, `lesson ${L.n}`).toBe('https://mercurypitch.com')
      expect(url.searchParams.get('lesson'), `lesson ${L.n}`).toBe(String(L.n))
      expect(link?.href.startsWith('/'), `lesson ${L.n}`).toBe(true)
    }
  })

  it('holds the prerequisites of SEASON-2 § 4.3, Season 1 lessons among them', () => {
    // Assert
    expect(SEASON_2.prereq).toEqual({
      15: [2],
      16: [9, 15],
      17: [8],
      18: [16, 17],
      19: [17],
      20: [5, 9, 10],
      21: [6, 15],
      22: [14],
      23: [6],
      24: [5, 10, 23],
      25: [10, 21, 23],
      26: [12, 24],
      27: [12, 23],
      28: [18, 26],
    })
  })

  it('leads every edge into one of its lessons, from a lesson before it', () => {
    // Assert
    for (const [a, b] of EDGES_2) {
      expect(b >= 15 && b <= 28, `${a}-${b}`).toBe(true)
      expect(a, `${a}-${b}`).toBeLessThan(b)
      expect(seasonOf(a), `${a}-${b}`).toBeDefined()
    }
  })

  it('leaves out every edge implied through another, across both seasons', () => {
    // Assert: no prerequisite of a lesson is already behind another of them
    for (const L of LESSONS_2) {
      const pre = SEASON_2.prereq[L.n] ?? []
      for (const p of pre)
        for (const q of pre) {
          if (p === q) continue
          expect(
            ancestors(q, ALL_PREREQ).has(p),
            `lesson ${L.n}: ${p} is behind ${q}`,
          ).toBe(false)
        }
    }
  })

  it('walks a path back into Season 1, and opens only its own lessons', () => {
    // Act
    const path = lessonPath(16, SEASON_2.edges, ALL_PREREQ)

    // Assert: 16 needs 9 and 15; 9 needs 3 and 6; 15 needs 2
    expect([...path.ancestors].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 6, 9, 15,
    ])
    expect(path.roles).toHaveLength(EDGES_2.length)
    expect(unlocks(15, SEASON_2.prereq)).toEqual([16, 21])
    expect(unlocks(28, SEASON_2.prereq)).toEqual([])
  })

  it("closes on Lesson 28's lines, with a rest line beside its invitation", () => {
    // Assert
    expect(SEASON_2.close.eyebrow).toBe('End of Season 2')
    expect(SEASON_2.close.line).toBe(
      "You've read a song in two parts. Now sing a whole song.",
    )
    expect(SEASON_2.close.rest).toBe("You've read a song in two parts.")
    expect(SEASON_2.close.song).toEqual({
      label: 'Karaoke Night',
      path: '/karaoke-night',
    })
    expect(SEASON_2.close.map.href).toBe('#explorer')
  })

  it('spans its arcs over its lessons, Read it then Harmonise it', () => {
    expect(SEASON_2.arcs).toEqual([
      ['Read it', 'Lessons 15 to 21', 15, 21],
      ['Harmonise it', 'Lessons 22 to 28', 22, 28],
    ])
  })

  it('teases each of Lessons 16 to 25 on the card before it, and carries no other copy of its own yet', () => {
    // Arrange
    const L16 = LESSONS_2.find((L) => L.n === 16)
    const L17 = LESSONS_2.find((L) => L.n === 17)
    const L18 = LESSONS_2.find((L) => L.n === 18)
    const L19 = LESSONS_2.find((L) => L.n === 19)
    const L20 = LESSONS_2.find((L) => L.n === 20)

    // Assert: Lesson 16 FACTS 5b; a tease lands with the page that draws it
    expect(L16?.tease).toBe(
      'Five notes on the staff. Tavi has never heard them.',
    )
    expect(L16?.teaseAlts).toEqual([
      { id: 'any-note', text: 'Now you can see where any note sits.' },
    ])
    // Lesson 17 FACTS 5b: the cold open's set-up, and the season plan's line
    expect(L17?.tease).toBe(
      'Same written bar, played twice. Only the tempo changes.',
    )
    expect(L17?.teaseAlts).toEqual([
      {
        id: 'shapes',
        text: 'Same five notes, twice as fast: the note shapes change.',
      },
    ])
    // Lesson 17 FACTS 5: on Lesson 17's next-lesson card, above its tease still
    expect(L18?.tease).toBe(
      'Now you can read when each note comes, and where it sits.',
    )
    expect(L18?.teaseAlts).toBeUndefined()
    // Lesson 19 FACTS 5b: on Lesson 18's card, the cold open in miniature,
    // and an alternative that claims only what Season 2 has written
    expect(L19?.tease).toBe(
      'Same six notes, same speed. Only the accents move.',
    )
    expect(L19?.teaseAlts).toEqual([
      {
        id: 'written',
        text: 'Every bar written this season has had four beats.',
      },
    ])
    // Lesson 19 FACTS 5: on Lesson 19's card, Lesson 20's opening in
    // miniature, and the season plan's line
    expect(L20?.tease).toBe(
      'Merc sings a run of nine notes, five every second.',
    )
    expect(L20?.teaseAlts).toEqual([
      {
        id: 'plan',
        text: 'Squeeze three notes into a beat, then four, then more.',
      },
    ])
    // Lesson 22 FACTS 5b: on Lesson 21's card, the cold open in miniature,
    // and Lesson 21's plan's bridge from its fifths
    const L22 = LESSONS_2.find((L) => L.n === 22)
    expect(L22?.tease).toBe(
      'Merc holds one note, and its line swings past both edges of the band.',
    )
    expect(L22?.teaseAlts).toEqual([
      {
        id: 'nudged',
        text: 'Each fifth is nudged two cents. A held note can move far more.',
      },
    ])
    // Lesson 23 FACTS 5b: on Lesson 22's card, two notes held together, and
    // Lesson 22's planned line as it stands
    const L23 = LESSONS_2.find((L) => L.n === 23)
    const L24 = LESSONS_2.find((L) => L.n === 24)
    expect(L23?.tease).toBe(
      'One note, swinging. Now two notes together: one pair wants to move.',
    )
    expect(L23?.teaseAlts).toEqual([
      {
        id: 'hold',
        text: 'One note, swinging. Now hold two together: one pair wants to move.',
      },
    ])
    // Lesson 23 FACTS 5: on Lesson 23's card, Lesson 24's opening in
    // miniature, and the plan's line mended
    expect(L24?.tease).toBe(
      'A drone, and a second note just above it, almost in tune.',
    )
    expect(L24?.teaseAlts).toEqual([
      {
        id: 'fifths',
        text: 'Fifths count as settled, tritones lean. Next, a note against a drone.',
      },
    ])
    // Lesson 24 FACTS 5b: on Lesson 24's card, Lesson 25's opening in
    // miniature, and Lesson 24's planned line, which leans softly
    const L25 = LESSONS_2.find((L) => L.n === 25)
    expect(L25?.tease).toBe(
      'A minor tune, played twice. The second ending changes one note.',
    )
    expect(L25?.teaseAlts).toEqual([
      {
        id: 'plan',
        text: 'Do, mi and so made a major chord. Minor keys hide another change.',
      },
    ])
    // Lesson 21 FACTS 5b: on Lesson 20's card, Lesson 21's opening in
    // miniature, and Lesson 20's planned line, cut to fit
    const L21 = LESSONS_2.find((L) => L.n === 21)
    expect(L21?.tease).toBe(
      'D major: seven notes, two black keys, F♯ and C♯. Now step up a fifth.',
    )
    expect(L21?.teaseAlts).toEqual([
      {
        id: 'lesson-4',
        text: 'Lesson 4 slid the scale to G, with one sharp, and to D, with two.',
      },
    ])
    for (const L of [L19, L20, L21, L22, L23, L24, L25])
      for (const line of [L?.tease, ...(L?.teaseAlts ?? []).map((a) => a.text)])
        expect(line?.length ?? 0).toBeLessThanOrEqual(TEASE_MAX)
    for (const L of LESSONS_2) {
      expect(L.hookAlts, `lesson ${L.n}`).toBeUndefined()
      if (L.n >= 16 && L.n <= 25) continue
      expect(L.tease, `lesson ${L.n}`).toBeUndefined()
      expect(L.teaseAlts, `lesson ${L.n}`).toBeUndefined()
    }
    expect(TEASE_MAX).toBe(70)
  })
})

describe('the seasons', () => {
  it('put every lesson in exactly one season, the trailer and Lessons 1 to 28', () => {
    // Assert
    expect(ALL_LESSONS.map((L) => L.n)).toEqual(
      Array.from({ length: 29 }, (_, n) => n),
    )
    for (const L of ALL_LESSONS)
      expect(
        SEASONS.filter((s) => s.lessons.includes(L)).length,
        `lesson ${L.n}`,
      ).toBe(1)
  })

  it("find a lesson's season by its number", () => {
    expect(seasonOf(0)).toBe(SEASON_1)
    expect(seasonOf(14)).toBe(SEASON_1)
    expect(seasonOf(15)).toBe(SEASON_2)
    expect(seasonOf(28)).toBe(SEASON_2)
    expect(seasonOf(29)).toBeUndefined()
  })

  it('are named together as a heading names them', () => {
    expect(seasonsTitle([1])).toBe('Season 1')
    expect(seasonsTitle([1, 2])).toBe('Seasons 1 and 2')
    expect(seasonsTitle([1, 2, 3])).toBe('Seasons 1, 2 and 3')
    expect(seasonsTitle()).toBe('Seasons 1 and 2')
  })

  it("name a topic in its own lesson's season's words", () => {
    // Lesson 14 touches cadences lightly; Lesson 28 teaches them
    expect(topicName(14, 'T22')).toBe('Phrases and cadences (light)')
    expect(topicName(28, 'T22')).toBe('Phrases and cadences')
    // a lesson no season holds keeps the topic's id
    expect(topicName(29, 'T22')).toBe('T22')
  })

  it("keep Season 1's map as it was: its own lessons, edges and topics", () => {
    expect(SEASON_1.lessons).toBe(LESSONS)
    expect(SEASON_1.edges.every(([, b]) => b <= 14)).toBe(true)
    for (const L of LESSONS)
      for (const t of L.topics)
        expect(SEASON_1.topics[t], `lesson ${L.n}, ${t}`).toBeTruthy()
  })
})
