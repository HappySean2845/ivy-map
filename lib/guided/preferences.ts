export const DESTINATIONS = [
  { id: 'US', label: '美国' },
  { id: 'UK', label: '英国' },
  { id: 'HK', label: '中国香港' },
  { id: 'CA', label: '加拿大' },
  { id: 'JP', label: '日本' },
] as const

export type DestinationId = (typeof DESTINATIONS)[number]['id']

export const INTERESTS = [
  { id: 'engineering', label: '计算机与工程' },
  { id: 'business', label: '商科与经济' },
  { id: 'medicine', label: '医学与生命科学' },
  { id: 'social', label: '法律与社会科学' },
  { id: 'humanities', label: '人文与教育' },
  { id: 'arts', label: '艺术与创意' },
  { id: 'science', label: '数学与自然科学' },
] as const

export type InterestId = (typeof INTERESTS)[number]['id']

export const CURRICULA = [
  {
    id: 'AP',
    label: 'AP / 美国高中路线',
    description: '按单科选课和考试，通常搭配美国高中课程使用，选课相对灵活。',
  },
  {
    id: 'IB',
    label: 'IB 路线',
    description: '完整的两年制课程：六门学科加论文和实践活动，比较看重均衡发展。',
  },
  {
    id: 'ALEVEL',
    label: 'A-Level 路线',
    description: '通常集中学习三到四门课程，适合方向较明确或有偏科优势的学生。',
  },
  {
    id: 'UNKNOWN',
    label: '我还不清楚 / 学校还没定',
    description: '可以先跳过；我们不会因为这一项排除大学。',
  },
] as const

export type GuidedCurriculum = (typeof CURRICULA)[number]['id']

export const PRIORITIES = [
  { id: 'ecosystem', label: '中国学生生态', note: '社区、支持与在华连接的成熟度' },
  { id: 'campus', label: '校园沉浸感', note: '住宿与校园生活是否集中' },
  { id: 'breadth', label: '更多探索机会', note: '学术选择范围' },
  { id: 'evidence', label: '数据依据', note: '真实案例支持' },
] as const

export type PriorityId = (typeof PRIORITIES)[number]['id']

export interface GuideAnswers {
  destinations: DestinationId[]
  interests: InterestId[]
  curriculum: GuidedCurriculum
  priorities: PriorityId[]
}

export const DEFAULT_GUIDE_ANSWERS: GuideAnswers = {
  destinations: [],
  interests: [],
  curriculum: 'UNKNOWN',
  priorities: ['evidence'],
}

type SearchRecord = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function validList<T extends string>(value: string, allowed: readonly T[], max: number): T[] {
  const valid = new Set(allowed)
  return [...new Set(value.split(',').filter((item): item is T => valid.has(item as T)))].slice(
    0,
    max,
  )
}

export function parseGuideAnswers(search: SearchRecord): GuideAnswers {
  const destinations = validList(
    first(search.destinations),
    DESTINATIONS.map((item) => item.id),
    DESTINATIONS.length,
  )
  const interests = validList(
    first(search.interests),
    INTERESTS.map((item) => item.id),
    3,
  )
  const curriculumValue = first(search.curriculum)
  const curriculum = CURRICULA.some((item) => item.id === curriculumValue)
    ? (curriculumValue as GuidedCurriculum)
    : DEFAULT_GUIDE_ANSWERS.curriculum
  const priorities = validList(
    first(search.priorities),
    PRIORITIES.map((item) => item.id),
    2,
  )

  return {
    destinations,
    interests,
    curriculum,
    priorities: priorities.length ? priorities : DEFAULT_GUIDE_ANSWERS.priorities,
  }
}

export function guideSearchParams(answers: GuideAnswers): URLSearchParams {
  const params = new URLSearchParams()
  if (answers.destinations.length) params.set('destinations', answers.destinations.join(','))
  if (answers.interests.length) params.set('interests', answers.interests.join(','))
  if (answers.curriculum !== 'UNKNOWN') params.set('curriculum', answers.curriculum)
  if (answers.priorities.length) params.set('priorities', answers.priorities.join(','))
  return params
}

export function labelFor<T extends { id: string; label: string }>(
  options: readonly T[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? id
}
