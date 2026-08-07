import { describe, expect, it } from 'vitest'

import { matchUniversities } from './matcher'
import { DEFAULT_GUIDE_ANSWERS, guideSearchParams, parseGuideAnswers } from './preferences'

describe('guided preference state', () => {
  it('round-trips valid values through query parameters', () => {
    const answers = {
      destinations: ['US', 'UK'] as const,
      interests: ['engineering', 'business'] as const,
      curriculum: 'AP' as const,
      priorities: ['campus', 'evidence'] as const,
    }
    const params = guideSearchParams({
      destinations: [...answers.destinations],
      interests: [...answers.interests],
      curriculum: answers.curriculum,
      priorities: [...answers.priorities],
    })

    expect(parseGuideAnswers(Object.fromEntries(params))).toEqual({
      destinations: ['US', 'UK'],
      interests: ['engineering', 'business'],
      curriculum: 'AP',
      priorities: ['campus', 'evidence'],
    })
  })

  it('drops unknown values and caps multi-select answers', () => {
    expect(
      parseGuideAnswers({
        destinations: 'US,XX',
        interests: 'engineering,business,medicine,arts,bogus',
        curriculum: 'NOPE',
        priorities: 'bogus',
      }),
    ).toEqual({
      destinations: ['US'],
      interests: ['engineering', 'business', 'medicine'],
      curriculum: 'UNKNOWN',
      priorities: ['evidence'],
    })
  })
})

describe('guided university matcher', () => {
  it('treats selected destinations as a hard filter', () => {
    const matches = matchUniversities({
      ...DEFAULT_GUIDE_ANSWERS,
      destinations: ['UK'],
      interests: ['engineering'],
      curriculum: 'ALEVEL',
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every((match) => match.view.university.country === 'UK')).toBe(true)
    expect(matches.some((match) => match.view.university.id === 'cambridge')).toBe(true)
  })

  it('returns explanations and cautions instead of personal admission odds', () => {
    const [match] = matchUniversities({
      ...DEFAULT_GUIDE_ANSWERS,
      destinations: ['US'],
      interests: ['engineering'],
      curriculum: 'AP',
    })
    const copy = [...match.reasons, ...match.cautions].join(' ')

    expect(match.reasons.length).toBeGreaterThan(0)
    expect(copy).not.toContain('录取概率')
    expect(copy).not.toContain('保底')
  })
})
