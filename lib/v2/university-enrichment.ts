import raw from '@/data/university-enrichment.json'
import type {
  DestinationShareObservation,
  EditorialRating,
  UniversityEnrichmentDataset,
  UniversityRequirementProfile,
} from '@/types/university-enrichment'
import type { ProfileLevel, UniversityProfile } from '@/types/profile'

export const universityEnrichmentData = raw as unknown as UniversityEnrichmentDataset

export const requirementProfileById = new Map(
  universityEnrichmentData.requirements.map((profile) => [profile.universityId, profile]),
)

const destinationSharesByUniversity = new Map<string, DestinationShareObservation[]>()
for (const observation of universityEnrichmentData.destinationShares) {
  destinationSharesByUniversity.set(observation.universityId, [
    ...(destinationSharesByUniversity.get(observation.universityId) ?? []),
    observation,
  ])
}

export function requirementProfile(universityId: string): UniversityRequirementProfile | null {
  return requirementProfileById.get(universityId) ?? null
}

export function destinationSharesForUniversity(
  universityId: string,
): DestinationShareObservation[] {
  return destinationSharesByUniversity.get(universityId) ?? []
}

/**
 * 0–100 编辑调研只用于校准同为编辑性质的五档轴；不会冒充官方数据。
 * 固定绝对区间避免每次新增学校后用样本百分位重排旧学校。
 */
export function chinaEcosystemLevel(rating: EditorialRating): ProfileLevel {
  if (rating.value < 65) return 1
  if (rating.value < 75) return 2
  if (rating.value < 82) return 3
  if (rating.value < 90) return 4
  return 5
}

/** 用增强包替换长简介，并校准“中国学生生态”；其余两根编辑轴保持原定义。 */
export function enrichUniversityProfile(profile: UniversityProfile): UniversityProfile {
  const enrichment = requirementProfile(profile.universityId)
  if (!enrichment) return profile
  const china = enrichment.chinaFriendliness
  return {
    ...profile,
    vibe: enrichment.styleBlurbZh || profile.vibe,
    traits: {
      ...profile.traits,
      chinaEcosystem: china
        ? {
            level: chinaEcosystemLevel(china),
            basis: `编辑调研 ${china.value}/100，按固定区间映射为五档：${china.text}`,
            kind: 'editorial',
            sourceIds: [],
          }
        : profile.traits.chinaEcosystem,
    },
  }
}

export function formatDestinationShare(value: number): string {
  const percent = value * 100
  if (percent >= 10) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(2)}%`
}
