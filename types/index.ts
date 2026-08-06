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
  /** 大学官方全校招生口径；与中国高中生源校 placement 数据严格分开。 */
  officialAdmissions: OfficialAdmissionsSnapshot[]
  /** 经复核的官方录取/成功率序列；不同申请人群与分母永远拆开。 */
  admissionRateSeries: AdmissionRateSeries[]
  /** 香港等无可靠申请分母体系的招生人数序列；绝不冒充录取率。 */
  admissionCountSeries: AdmissionCountSeries[]
}

export interface OfficialAdmissionsSnapshot {
  academicYearStart: number
  applied: number
  admitted: number
  enrolled: number
  campus: string | null
  confidence: Confidence
  sourceId: string
}

export const ADMISSION_RATE_BASES = [
  'admitted_over_applications',
  'confirmed_places_over_applications',
  'offers_over_applications',
  'admitted_over_exam_candidates',
] as const
export type AdmissionRateBasis = (typeof ADMISSION_RATE_BASES)[number]

export interface AdmissionRateScope {
  rateBasis: AdmissionRateBasis
  applicantScope: string | null
  admissionsSystem: string | null
  pathway: string | null
  sourceMetric: string | null
  periodKind: string | null
  geographyDefinition: string | null
  aggregation: string | null
}

export interface AdmissionRatePoint {
  academicYearStart: number | null
  periodStart: string | null
  periodEnd: string | null
  /** 精确值，0–1；隐私抑制区间时为 null。 */
  rate: number | null
  /** 区间上下限，0–1；精确值时均为 null。 */
  rateMin: number | null
  rateMax: number | null
  applied: number | null
  outcome: number | null
  confidence: Confidence
  sourceId: string
  citation: string | null
}

export interface AdmissionRateSeries {
  /** 由大学和完整 scope 签名构成的稳定键。 */
  id: string
  /** 只有一条主口径进入卡片和录取难度轴；详情页仍展示全部口径。 */
  primary: boolean
  scope: AdmissionRateScope
  points: AdmissionRatePoint[]
}

export const ADMISSION_COUNT_KINDS = ['actual', 'estimated', 'planned'] as const
export type AdmissionCountKind = (typeof ADMISSION_COUNT_KINDS)[number]

export const ADMISSION_RATE_AVAILABILITY = [
  'missing_denominator',
  'not_applicable_early_batch',
] as const
export type AdmissionRateAvailability = (typeof ADMISSION_RATE_AVAILABILITY)[number]

export interface AdmissionCountScope {
  applicantScope: string
  pathway: string | null
  admissionsSystem: string | null
  sourceMetric: string
  rateAvailability: AdmissionRateAvailability
}

export interface AdmissionCountPoint {
  academicYearStart: number
  kind: AdmissionCountKind
  /** 精确值或带“约”语义的单值；范围/文本口径时为 null。 */
  value: number | null
  valueMin: number | null
  valueMax: number | null
  /** 例如“>250 (Gaokao applicants)”；不得强转成精确值。 */
  valueText: string | null
  confidence: Confidence
  reviewStatus: 'extracted' | 'reviewed' | 'published'
  sourceId: string
  citation: string | null
}

export interface AdmissionCountSeries {
  id: string
  scope: AdmissionCountScope
  points: AdmissionCountPoint[]
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

/** 有明确高中与大学、但未可靠拆到课程赛道的去向证据。只展示，不参与密度排名。 */
export interface FeederEvidence {
  schoolId: string
  universityId: string
  academicYearStart: number
  admissionRound: 'early_combined' | 'combined' | 'unknown'
  track: Track | null
  countKind: Basis
  countValue: number
  studentScope: string
  isComplete: boolean
  confidence: Confidence
  sourceId: string
}

export interface Source {
  id: string
  type: 'official' | 'media' | 'report' | 'crowdsourced'
  title: string
  /** 本地研究附件可能只有可审计引用、没有公开 URL；不得编造链接。 */
  url: string | null
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
  feederEvidence: FeederEvidence[]
  sources: Source[]
  /** 首屏默认组合（PRD US-1.0）。构建期校验它能演示出排名反转。 */
  defaultView: { universityId: string; cityId: string | null; track: Track } | null
}
