// v2 大学画像指纹。
//
// 指纹描述大学的差异，不计算综合分，也不暗示面积越大越好。
// `null` 表示没有可比较的数据，永远不用 0 或最低档补空。

export const CURATED_TRAITS = ['chinaEcosystem', 'campusImmersion', 'academicBreadth'] as const
export type CuratedTrait = (typeof CURATED_TRAITS)[number]

/** 顺序即指纹从顶部开始的顺时针顺序。 */
export const PROFILE_TRAITS = ['admissionOpenness', ...CURATED_TRAITS] as const
export type ProfileTrait = (typeof PROFILE_TRAITS)[number]

export const PROFILE_TRAIT_LABEL: Record<ProfileTrait, string> = {
  admissionOpenness: '录取难度',
  chinaEcosystem: '中国友好',
  campusImmersion: '校园氛围',
  academicBreadth: '专业广度',
}

export const PROFILE_TRAIT_SHORT_LABEL: Record<ProfileTrait, string> = {
  admissionOpenness: '录取难度',
  chinaEcosystem: '中国友好',
  campusImmersion: '校园氛围',
  academicBreadth: '专业广度',
}

/** 四根轴都不表达更好；具体分档方向见各轴说明。 */
export const PROFILE_TRAIT_DIRECTION: Record<ProfileTrait, string> = {
  admissionOpenness: '越外代表学校整体录取比例越高、录取难度越低',
  chinaEcosystem: '越外代表中国学生社区与支持越成熟',
  campusImmersion: '越外代表住宿与校园生活越集中',
  academicBreadth: '越外代表本科可选学科越综合',
}

export type ProfileLevel = 1 | 2 | 3 | 4 | 5

export const PROFILE_LEVELS = [1, 2, 3, 4, 5] as const

export const PROFILE_TRAIT_LEVEL_LABEL: Record<ProfileTrait, Record<ProfileLevel, string>> = {
  admissionOpenness: {
    1: '极高（录取率低于 5%）',
    2: '很高（录取率 5%–8%）',
    3: '较高（录取率 8%–12%）',
    4: '中等（录取率 12%–30%）',
    5: '较低（录取率高于 30%）',
  },
  chinaEcosystem: {
    1: '规模很小',
    2: '仍较有限',
    3: '已经稳定',
    4: '比较成熟',
    5: '非常成熟',
  },
  campusImmersion: {
    1: '城市分散型',
    2: '城市校区型',
    3: '城市与校园混合',
    4: '完整校园型',
    5: '强沉浸型',
  },
  academicBreadth: {
    1: '高度专精',
    2: '学科聚焦',
    3: '核心领域较广',
    4: '综合型',
    5: '全学科型',
  },
}

export interface ProfileTraitRating {
  /** 1–5；null = 数据不足，指纹在该轴断开。 */
  level: ProfileLevel | null
  basis: string
  kind: 'measured' | 'editorial'
  /** measured 必须非空。 */
  sourceIds: string[]
}

export interface UniversityProfile {
  universityId: string
  websiteUrl: string | null
  logoPath: string | null
  brandColor: string | null
  monogram: string
  foundedYear: number | null
  strengths: string[]
  vibe: string | null
  traits: Record<CuratedTrait, ProfileTraitRating>
  reviewed: boolean
}

export type { AdmissionRatePoint as AdmitRatePoint } from './index'

export interface ProfileDataset {
  builtAt: string
  profiles: UniversityProfile[]
}
