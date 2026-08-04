export const CURRICULUM_CODES = [
  'AP',
  'IB',
  'ALEVEL',
  'BC',
  'OSSD',
  'VCE',
  'DSE',
  'EJU',
  'GERMAN',
  'IFY',
  'SABIS',
  'ALBERTA',
  'SACE',
  'GAC',
  'DOMESTIC',
] as const

export type CurriculumCode = (typeof CURRICULUM_CODES)[number]
export type AttributionStatus = 'confirmed' | 'inferred' | 'possible' | 'excluded'

export const CURRICULUM_LABEL: Record<CurriculumCode, string> = {
  AP: 'AP',
  IB: 'IB',
  ALEVEL: 'A-Level',
  BC: '加拿大 BC',
  OSSD: '加拿大 OSSD',
  VCE: '澳洲 VCE',
  DSE: '香港 DSE',
  EJU: '日本 EJU',
  GERMAN: '德国课程',
  IFY: 'IFY 预科',
  SABIS: 'SABIS',
  ALBERTA: '加拿大 Alberta',
  SACE: '澳洲 SACE',
  GAC: 'GAC',
  DOMESTIC: '国内课程',
}

export const ATTRIBUTION_STATUS_LABEL: Record<AttributionStatus, string> = {
  confirmed: '已证实',
  inferred: '方向性',
  possible: '来源未拆分',
  excluded: '排除',
}

export interface CourseAttributionSchool {
  id: string
  nameCn: string
  nameEn: string | null
  region: string
}

export interface SchoolProgram {
  schoolId: string
  curriculumCode: CurriculumCode
  role: 'primary' | 'secondary' | 'elective' | 'unknown'
  validFromYear: number | null
  firstGraduatingYear: number | null
  validToYear: number | null
  isSingleTrack: boolean
  sourceLine: number
}

export interface AdmissionAttribution {
  curriculumCode: CurriculumCode
  status: AttributionStatus
  basis:
    | 'source_named'
    | 'single_track'
    | 'program_report'
    | 'student_profile'
    | 'destination_pattern'
    | 'temporal_elimination'
    | 'unknown'
  allocationKind: 'full' | 'partial' | 'unallocated'
  allocatedCount: number | null
  exclusionRisk: boolean
}

export interface CourseAdmissionObservation {
  schoolId: string
  universityId: string
  year: number
  track: 'AP' | 'IB' | 'ALEVEL' | null
  countKind: 'admits' | 'offers' | 'reported' | 'estimated' | 'enrolled' | 'interviews'
  countValue: number
  sourceLine: number
  sourceExcerpt: string
  attributionStatus: AttributionStatus
  attributions: AdmissionAttribution[]
}

export interface CourseAttributionDataset {
  schemaVersion: 1
  source: {
    filename: string
    sha256: string
    capturedAt: string
  }
  schools: CourseAttributionSchool[]
  programs: SchoolProgram[]
  observations: CourseAdmissionObservation[]
}
