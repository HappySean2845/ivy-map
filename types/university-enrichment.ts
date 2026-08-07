export const REQUIREMENT_KEYS = [
  'toefl',
  'ielts',
  'sat',
  'act',
  'ap',
  'alevel',
  'ib',
] as const

export type RequirementKey = (typeof REQUIREMENT_KEYS)[number]
export type RequirementBasis =
  | 'minimum'
  | 'competitive'
  | 'mid50'
  | 'typical_offer'
  | 'mixed'
  | 'unavailable'

export interface RequirementValue {
  text: string
  basis: RequirementBasis
}

export interface EditorialRating {
  value: number
  band: string | null
  text: string
}

export interface UniversityRequirementProfile {
  universityId: string
  setting: string
  climate: string | null
  livingCost: 'Low' | 'Med-Low' | 'Med' | 'Med-High' | 'High' | null
  requirements: Record<RequirementKey, RequirementValue>
  safety: EditorialRating | null
  chinaFriendliness: EditorialRating | null
  styleBlurbZh: string
  sourceUrls: string[]
  notes: string
}

export type DestinationOutcomeKind = 'offers' | 'admits' | 'unknown'
export type DestinationValueStatus = 'reported' | 'estimated' | 'missing'

export interface DestinationDenominator {
  id: string
  universityId: string
  year: number
  value: number | null
  outcomeKind: DestinationOutcomeKind
  valueStatus: DestinationValueStatus
  scopeCode: string | null
  scopeLabel: string | null
  source: string
  note: string
}

export interface DestinationShareObservation {
  schoolId: string
  schoolName: string
  universityId: string
  year: number
  numerator: number
  outcomeKind: DestinationOutcomeKind
  denominatorId: string | null
  denominator: number | null
  denominatorStatus: DestinationValueStatus
  denominatorScopeCode: string | null
  denominatorScopeLabel: string | null
  share: number | null
  numeratorSource: string
  denominatorSource: string
  denominatorNote: string
}

export interface QuarantinedDestinationRow {
  file: 'density-2026.csv' | 'density-history.csv'
  row: number
  highSchool: string
  universitySlug: string
  year: string
  reason:
    | 'synthetic_school_heading'
    | 'unknown_school'
    | 'unknown_university'
    | 'invalid_value'
    | 'out_of_scope_year'
}

export interface UniversityEnrichmentDataset {
  schemaVersion: 1
  publishedAt: string
  sources: {
    requirementsSha256: string
    density2026Sha256: string
    denominatorsSha256: string
    densityHistorySha256: string
  }
  requirements: UniversityRequirementProfile[]
  denominators: DestinationDenominator[]
  destinationShares: DestinationShareObservation[]
  quarantined: QuarantinedDestinationRow[]
  report: {
    requirementProfiles: number
    denominatorRows: number
    denominatorRowsWithValues: number
    destinationRows: number
    destinationRowsWithShares: number
    quarantinedRows: number
    schools: number
    universities: number
  }
}

export const REQUIREMENT_LABEL: Record<RequirementKey, string> = {
  toefl: '托福',
  ielts: '雅思',
  sat: 'SAT',
  act: 'ACT',
  ap: 'AP',
  alevel: 'A-Level',
  ib: 'IB',
}

export const REQUIREMENT_BASIS_LABEL: Record<RequirementBasis, string> = {
  minimum: '最低要求',
  competitive: '竞争建议',
  mid50: '提交者中段 50%',
  typical_offer: '典型要求',
  mixed: '按专业 / 路径',
  unavailable: '未公布 / 不适用',
}
