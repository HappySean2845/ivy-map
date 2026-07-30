// 领域类型。对应 PRD §8 领域概念、docs/design.md §5。
//
// 铁律：null 表示「没有数据」，永远不用 0 顶替。
// graduates: 0 和 graduates: null 在密度计算里是天壤之别。

export const TRACKS = ['AP', 'IB', 'ALEVEL'] as const
export type Track = (typeof TRACKS)[number]

export const TRACK_LABEL: Record<Track, string> = {
  AP: 'AP',
  IB: 'IB',
  ALEVEL: 'A-Level',
}

/** 录取数的口径。混淆这个是全行业最大的误导源。 */
export const BASES = ['admits', 'offers', 'estimated'] as const
export type Basis = (typeof BASES)[number]

/** L1 官方一手 / L2 权威二手 / L3 推断或众包 */
export const CONFIDENCES = ['L1', 'L2', 'L3'] as const
export type Confidence = (typeof CONFIDENCES)[number]

export const SCHOOL_TYPES = [
  'public_intl_dept', // 公办国际部
  'private_intl', // 民办国际化学校
  'foreign_nationals', // 外籍人员子女学校
] as const
export type SchoolType = (typeof SCHOOL_TYPES)[number]

export const SCHOOL_TYPE_LABEL: Record<SchoolType, string> = {
  public_intl_dept: '公办国际部',
  private_intl: '民办国际化学校',
  foreign_nationals: '外籍人员子女学校',
}

// ---------------------------------------------------------------------------

export interface City {
  id: string
  name: string
  province: string
  lng: number
  lat: number
}

export interface University {
  id: string
  nameCn: string
  nameEn: string
  country: string
  city: string
  lng: number
  lat: number
  /** 中国友好度。构建期算出，null = 数据不足 */
  cai: {
    grade: 'A' | 'B' | 'C' | 'D' | 'E'
    dims: Record<string, number>
    sourceIds: string[]
  } | null
  /** 择校杠杆率。null = 样本不足，UI 必须显示「样本不足」而不是给结论 */
  leverage: { hhi: number; level: 'high' | 'mid' | 'low' } | null
}

/** 可行性闸门的准入条件（PRD E2）。所有字段允许 'unknown'，但不允许缺失。 */
export interface Requirement {
  nationality: 'none' | 'foreign' | 'hk_mo_tw' | 'foreign_or_pr' | 'unknown'
  hukou: 'none' | 'local_city' | 'local_district' | 'unknown'
  /** 开放入学的年级。null = 未查到 */
  entryGrades: number[] | null
  examTypes: string[]
  applicationWindow: string | null
  sourceId: string | null
  notes: string | null
}

export interface School {
  id: string
  nameCn: string
  nameEn: string | null
  cityId: string
  district: string | null
  type: SchoolType
  tracks: Track[]
  tuitionCny: number | null
  boarding: boolean | null
  requirement: Requirement
  /** 学校身份信息是否已人工核对过来源 */
  verified: boolean
}

/** 届次 —— 人均密度的分母。最难拿、也最值钱的一张表。 */
export interface Cohort {
  schoolId: string
  year: number
  track: Track
  /** 该赛道的毕业生数。不是全校总数 —— 填错会让密度系统性偏低 */
  graduates: number | null
  /** 该校当年总 offer 数，用于估算人均 offer 系数 k */
  totalOffers: number | null
  sourceId: string
}

export interface Admission {
  schoolId: string
  universityId: string
  year: number
  track: Track
  admits: number | null
  offers: number | null
  basis: Basis
  confidence: Confidence
  sourceId: string
  /** 多来源数值不一致。UI 必须明示，不得替用户选一个 */
  conflict?: { otherSourceIds: string[]; values: number[] }
}

export interface Source {
  id: string
  type: 'official' | 'media' | 'report' | 'crowdsourced'
  title: string
  url: string
  publishedAt: string | null
  capturedAt: string
  confidence: Confidence
}

// ---------------------------------------------------------------------------

/** 构建产物。整个产品的全部数据，构建时打进 bundle。 */
export interface Dataset {
  builtAt: string
  cities: City[]
  universities: University[]
  schools: School[]
  cohorts: Cohort[]
  admissions: Admission[]
  sources: Source[]
  /** 首屏默认组合（PRD US-1.0）。构建期校验它能演示出排名反转。 */
  defaultView: { universityId: string; cityId: string | null; track: Track } | null
}
