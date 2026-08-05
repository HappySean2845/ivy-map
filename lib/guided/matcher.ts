import { universityCourseEvidence } from '@/lib/v2/course-attribution'
import { deckOrder, type UniversityView } from '@/lib/v2/profile'
import type { CuratedDim } from '@/types/profile'

import {
  CURRICULA,
  INTERESTS,
  labelFor,
  type DestinationId,
  type GuideAnswers,
  type GuidedCurriculum,
  type InterestId,
  type PriorityId,
} from './preferences'

const INTEREST_PATTERNS: Record<InterestId, RegExp> = {
  engineering: /计算机|人工智能|机器人|工程|建筑|航空航天/,
  business: /商学|商科|经济|金融|酒店管理|营销|创业|风险投资/,
  medicine: /医学|生物|护理|生命科学|公共卫生|全球卫生|农业/,
  social: /法学|政治|政策|国际关系|社会学|PPE|哲政经/,
  humanities: /历史|人文|教育|文学|创意写作|本科教学|中文/,
  arts: /艺术|戏剧|音乐|影视|新闻|创意写作/,
  science: /数学|物理|化学|天文|自然科学|心理学/,
}

const PRIORITY_DIM: Partial<Record<PriorityId, CuratedDim>> = {
  affinity: 'affinity',
  safety: 'safety',
  facilities: 'facilities',
}

export interface GuidedMatch {
  view: UniversityView
  score: number
  reasons: string[]
  cautions: string[]
  evidenceCount: number
}

function matchedInterests(strengths: string[], selected: InterestId[]): InterestId[] {
  return selected.filter((interest) =>
    strengths.some((strength) => INTEREST_PATTERNS[interest].test(strength)),
  )
}

function curriculumReason(universityId: string, curriculum: GuidedCurriculum) {
  if (curriculum === 'UNKNOWN') return null
  const route = universityCourseEvidence(universityId).routes.find(
    (item) => item.curriculumCode === curriculum,
  )
  if (!route || route.observations === 0) return null

  const curriculumLabel = labelFor(CURRICULA, curriculum).replace('路线', '').trim()
  const attributable = route.confirmedSchools + route.inferredSchools
  return {
    score: Math.min(4, route.confirmedSchools * 0.5 + route.inferredSchools * 0.25 + 1),
    text:
      attributable > 0
        ? `${curriculumLabel}已有 ${attributable} 所高中具备已证实或方向性去向证据`
        : `${curriculumLabel}已有公开去向记录，但课程归因仍待核实`,
    observations: route.observations,
  }
}

export function matchUniversities(answers: GuideAnswers): GuidedMatch[] {
  const views = deckOrder().filter(
    (view) =>
      answers.destinations.length === 0 ||
      answers.destinations.includes(view.university.country as DestinationId),
  )

  return views
    .map((view): GuidedMatch => {
      const reasons: string[] = []
      const cautions: string[] = []
      let score = 0

      if (answers.destinations.length > 0) {
        score += 5
        reasons.push(`位于你选择的目的地：${view.university.city}`)
      }

      const interestMatches = matchedInterests(view.profile.strengths, answers.interests)
      if (interestMatches.length > 0) {
        score += interestMatches.length * 3
        reasons.push(
          `知名领域覆盖${interestMatches.map((id) => labelFor(INTERESTS, id)).join('、')}`,
        )
      } else if (answers.interests.length > 0) {
        cautions.push('当前知名领域标签没有直接命中你的兴趣')
      }

      const course = curriculumReason(view.university.id, answers.curriculum)
      if (course) {
        score += course.score
        reasons.push(course.text)
      } else if (answers.curriculum !== 'UNKNOWN') {
        cautions.push('当前尚未收录这条课程路线的高中去向证据')
      }

      const evidence = universityCourseEvidence(view.university.id)
      const hasOfficialRate = view.trend.length > 0
      if (answers.priorities.includes('evidence')) {
        score += (hasOfficialRate ? 2 : 0) + Math.min(3, evidence.schools.length / 8)
        if (hasOfficialRate && evidence.schools.length > 0) {
          reasons.push(`有官方全校录取率，也有 ${evidence.schools.length} 所国内高中去向证据`)
        } else if (evidence.schools.length > 0) {
          reasons.push(`已有 ${evidence.schools.length} 所国内高中去向证据`)
        }
      }

      for (const priority of answers.priorities) {
        const dim = PRIORITY_DIM[priority]
        if (!dim) continue
        const value = view.scores[dim].value
        if (value == null) continue
        score += value / 25
        if (value >= 75) {
          const priorityLabel =
            priority === 'affinity' ? '中国学生环境' : priority === 'safety' ? '安全性' : '设施'
          reasons.push(`${priorityLabel}编辑画像较高（${value}/100）`)
        }
      }

      if (!hasOfficialRate) cautions.push('官方全校录取率暂未收录')

      return {
        view,
        score,
        reasons: reasons.slice(0, 3),
        cautions: cautions.slice(0, 2),
        evidenceCount: evidence.observations.length,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.evidenceCount - left.evidenceCount ||
        left.view.university.nameCn.localeCompare(right.view.university.nameCn, 'zh-CN'),
    )
}
