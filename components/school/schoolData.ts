// 学校深度卡片 / 对比表共用的数据整形与格式化。
//
// 这里只做「把 dataset 里的记录整理成一屏能读的形状」，不发明任何数字：
//   - 加权口径一律走 lib/scoring 的 scoreFeeders / resolveAdmits，不在这里重算公式；
//   - 缺分母、缺学费、缺门槛都原样往上传 null，由组件显示「—」或「待补充」。
//
// 之所以放在 components/school/ 而不是 lib/：它是这两个组件的展示层整形逻辑，
// 换个展示形态就会跟着变，不属于对全站承诺的口径层。

import { cityById, dataset, schoolById, universityById } from '@/lib/data'
import { resolveAdmits, scoreFeeders, yearWeight, type FeederRow } from '@/lib/scoring'
import { LATEST_YEAR } from '@/lib/view'
import type { Basis, Cohort, Confidence, School, Track } from '@/types'

// ---------------------------------------------------------------------------
// 格式化。缺数据一律是 DASH，永远不是 0（types/index.ts 开头那条铁律）。

export const DASH = '—'

/** 加权人数是小数，一位足够；整数不拖 .0 */
export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** 人均密度。null = 分母缺失，调用方还要额外标注原因 */
export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH
  return `${(n * 100).toFixed(1)}%`
}

/** 手写千分位，不用 toLocaleString —— 避免 SSR 与浏览器 ICU 不一致导致水合报错 */
export function fmtCny(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH
  return '¥' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 费用一律说「万元」量级，避免给出精确到个位的假精度 */
export function fmtWan(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH
  const w = n / 10000
  return `${w >= 10 ? Math.round(w) : Math.round(w * 10) / 10} 万元`
}

// ---------------------------------------------------------------------------
// 三年窗口

/** 近三年 = 全库最新年份往回三届（与榜单同一个窗口，见 lib/view 的说明） */
export function windowYears(): number[] {
  if (LATEST_YEAR == null) return []
  return [LATEST_YEAR, LATEST_YEAR - 1, LATEST_YEAR - 2]
}

function inWindow(year: number): boolean {
  return LATEST_YEAR != null && yearWeight(year, LATEST_YEAR) > 0
}

const cohortKey = (schoolId: string, year: number, track: Track) =>
  `${schoolId}|${year}|${track}`

const cohortMap = new Map(
  dataset.cohorts.map((c) => [cohortKey(c.schoolId, c.year, c.track), c]),
)

// 口径与置信都取最保守的那一档，规则与 lib/view.ts 保持一致：
// 一行数据的可信度由它最弱的那条来源决定。
function worstBasis(list: { basis: Basis }[]): Basis {
  if (list.some((a) => a.basis === 'estimated')) return 'estimated'
  if (list.some((a) => a.basis === 'offers')) return 'offers'
  return 'admits'
}

function worstConfidence(list: { confidence: Confidence }[]): Confidence {
  if (list.some((a) => a.confidence === 'L3')) return 'L3'
  if (list.some((a) => a.confidence === 'L2')) return 'L2'
  return 'L1'
}

// ---------------------------------------------------------------------------
// 第一段：它送谁去了哪

export interface DestinationRow {
  universityId: string
  nameCn: string
  nameEn: string
  country: string
  /** 近三年**未加权**的人数合计。加权口径见 targetStat()，两者在 UI 上必须分别标注 */
  admits: number
  byYear: { year: number; admits: number | null }[]
  tracks: Track[]
  sourceIds: string[]
  basis: Basis
  confidence: Confidence
}

export interface YearRow {
  year: number
  /** 该年收录到的录取人数合计（全部去向大学） */
  admits: number | null
  /** 该届毕业生数。null = 未收录，密度的分母就此缺失 */
  graduates: number | null
  /** 上面这个毕业生数覆盖了哪些赛道 —— 不覆盖全部赛道时不能当成全校规模用 */
  graduateTracks: Track[]
  sourceIds: string[]
}

export interface SchoolProfile {
  school: School
  cityName: string
  years: number[]
  /** 已按近三年人数降序，调用方自己 slice(0, 10) */
  destinations: DestinationRow[]
  totalAdmits: number | null
  trackMix: { track: Track; admits: number }[]
  byYear: YearRow[]
  cohorts: Cohort[]
  hasAnyAdmission: boolean
}

/** 把一所学校近三年的录取记录整理成卡片能直接渲染的形状。学校不存在时返回 null。 */
export function schoolProfile(schoolId: string): SchoolProfile | null {
  const school = schoolById.get(schoolId)
  if (!school) return null

  const years = windowYears()
  const mine = dataset.admissions.filter(
    (a) => a.schoolId === schoolId && inWindow(a.year),
  )

  const byUni = new Map<string, DestinationRow>()
  const byTrack = new Map<Track, number>()
  const byYearAdmits = new Map<number, number>()

  for (const a of mine) {
    const admits = resolveAdmits(a, cohortMap.get(cohortKey(a.schoolId, a.year, a.track)))
    if (admits == null) continue // 折算不出来就是没有数据，不能当 0

    const uni = universityById.get(a.universityId)
    let row = byUni.get(a.universityId)
    if (!row) {
      row = {
        universityId: a.universityId,
        nameCn: uni?.nameCn ?? a.universityId,
        nameEn: uni?.nameEn ?? '',
        country: uni?.country ?? '',
        admits: 0,
        byYear: years.map((y) => ({ year: y, admits: null })),
        tracks: [],
        sourceIds: [],
        basis: 'admits',
        confidence: 'L1',
      }
      byUni.set(a.universityId, row)
    }

    row.admits += admits
    const slot = row.byYear.find((y) => y.year === a.year)
    if (slot) slot.admits = (slot.admits ?? 0) + admits
    if (!row.tracks.includes(a.track)) row.tracks.push(a.track)
    for (const id of [a.sourceId, ...(a.conflict?.otherSourceIds ?? [])]) {
      if (id && !row.sourceIds.includes(id)) row.sourceIds.push(id)
    }

    byTrack.set(a.track, (byTrack.get(a.track) ?? 0) + admits)
    byYearAdmits.set(a.year, (byYearAdmits.get(a.year) ?? 0) + admits)
  }

  // 口径 / 置信按每所大学各自的记录集重算
  for (const row of byUni.values()) {
    const contributing = mine.filter((a) => a.universityId === row.universityId)
    row.basis = worstBasis(contributing)
    row.confidence = worstConfidence(contributing)
  }

  const cohorts = dataset.cohorts.filter(
    (c) => c.schoolId === schoolId && inWindow(c.year),
  )

  const byYear: YearRow[] = years.map((y) => {
    const cs = cohorts.filter((c) => c.year === y)
    const known = cs.filter((c) => c.graduates != null)
    return {
      year: y,
      admits: byYearAdmits.has(y) ? (byYearAdmits.get(y) as number) : null,
      graduates: known.length
        ? known.reduce((s, c) => s + (c.graduates as number), 0)
        : null,
      graduateTracks: known.map((c) => c.track),
      sourceIds: [...new Set(cs.map((c) => c.sourceId).filter(Boolean))],
    }
  })

  const destinations = [...byUni.values()].sort((a, b) => b.admits - a.admits)
  const total = destinations.reduce((s, d) => s + d.admits, 0)

  return {
    school,
    cityName: cityById.get(school.cityId)?.name ?? DASH,
    years,
    destinations,
    totalAdmits: destinations.length ? total : null,
    trackMix: [...byTrack.entries()]
      .map(([track, admits]) => ({ track, admits }))
      .sort((a, b) => b.admits - a.admits),
    byYear,
    cohorts,
    hasAnyAdmission: destinations.length > 0,
  }
}

// ---------------------------------------------------------------------------
// 对目标大学的加权口径

// scoreFeeders 的归一化是在传进去的结果集内做的，所以这里固定用「该大学的全部
// 生源校」这一个集合 —— 换个筛选条件 volume/density 也不会变（score 会变，但
// 深度卡片不展示 score，展示的是绝对值）。
const statCache = new Map<string, Map<string, FeederRow>>()

function statsFor(universityId: string): Map<string, FeederRow> {
  const hit = statCache.get(universityId)
  if (hit) return hit
  const rows = scoreFeeders({
    admissions: dataset.admissions.filter((a) => a.universityId === universityId),
    cohorts: dataset.cohorts,
    alpha: 0.5, // 只取 volume / density，score 在这里不用
    latestYear: LATEST_YEAR,
  })
  const map = new Map(rows.map((r) => [r.schoolId, r]))
  statCache.set(universityId, map)
  return map
}

export interface TargetStat {
  universityId: string
  universityName: string
  /** 加权录取人数（metrics.md §4）。null = 该校没有向这所大学输送的收录记录 */
  volume: number | null
  density: number | null
  denominatorMissing: boolean
  sourceIds: string[]
  basis: Basis
  confidence: Confidence
}

/** 这所学校对某所目标大学的加权口径。没有记录时 volume 为 null，UI 显示「暂无收录」。 */
export function targetStat(schoolId: string, universityId: string | null): TargetStat | null {
  if (!universityId) return null
  const uni = universityById.get(universityId)
  const row = statsFor(universityId).get(schoolId)
  const contributing = dataset.admissions.filter(
    (a) => a.schoolId === schoolId && a.universityId === universityId && inWindow(a.year),
  )
  const sourceIds = [
    ...new Set([
      ...contributing.flatMap((a) => [a.sourceId, ...(a.conflict?.otherSourceIds ?? [])]),
      ...dataset.cohorts
        .filter(
          (c) =>
            c.schoolId === schoolId &&
            inWindow(c.year) &&
            contributing.some((a) => a.year === c.year && a.track === c.track),
        )
        .map((c) => c.sourceId),
    ]),
  ].filter(Boolean)

  return {
    universityId,
    universityName: uni?.nameCn ?? universityId,
    volume: row?.volume ?? null,
    density: row?.density ?? null,
    denominatorMissing: row ? row.denominatorMissing : true,
    sourceIds,
    basis: contributing.length ? worstBasis(contributing) : 'admits',
    confidence: contributing.length ? worstConfidence(contributing) : 'L3',
  }
}

// ---------------------------------------------------------------------------
// 第二段：你进得去吗（PRD US-2.3 的字段清单）

export const NATIONALITY_LABEL: Record<School['requirement']['nationality'], string> = {
  none: '不限国籍/身份',
  foreign: '仅招收外籍人员子女（需持外国护照）',
  hk_mo_tw: '面向港澳台侨学生',
  foreign_or_pr: '外籍人员子女，或持境外永久居留权',
  unknown: '待补充',
}

export const HUKOU_LABEL: Record<School['requirement']['hukou'], string> = {
  none: '不限学籍/户籍',
  local_city: '需本市学籍/户籍',
  local_district: '需本市户籍，且对口指定学区',
  unknown: '待补充',
}

export interface GateItem {
  /** 用于第四段回溯引用，必须与展示的 label 一致 */
  key: string
  label: string
  value: string
  known: boolean
  hint?: string
}

/** 门槛七项。查不到的一律 known=false + 「待补充」，绝不留空、绝不猜（US-2.3）。 */
export function gateItems(school: School): GateItem[] {
  const r = school.requirement
  return [
    {
      key: 'nationality',
      label: '国籍 / 身份',
      value: NATIONALITY_LABEL[r.nationality],
      known: r.nationality !== 'unknown',
      hint: '国籍这一条没有变通空间，先看它',
    },
    {
      key: 'hukou',
      label: '学籍 / 户籍',
      value: HUKOU_LABEL[r.hukou],
      known: r.hukou !== 'unknown',
      hint:
        r.hukou === 'local_city' || r.hukou === 'local_district'
          ? '非本市户籍通常还有借读或积分入学的政策口径，需向学校确认'
          : undefined,
    },
    {
      key: 'entryGrades',
      label: '开放入学年级',
      value:
        r.entryGrades && r.entryGrades.length
          ? [...r.entryGrades].sort((a, b) => a - b).map((g) => `${g} 年级`).join(' / ')
          : '待补充',
      known: !!r.entryGrades && r.entryGrades.length > 0,
    },
    {
      key: 'examTypes',
      label: '入学考试形式',
      value: r.examTypes.length ? r.examTypes.join('、') : '待补充',
      known: r.examTypes.length > 0,
    },
    {
      key: 'applicationWindow',
      label: '报名窗口',
      value: r.applicationWindow ?? '待补充',
      known: r.applicationWindow != null,
      hint: '本站不解析具体日期，报名与考试时间以学校官网当年公告为准',
    },
    {
      key: 'admitRate',
      label: '近年录取率',
      value: '暂未收录',
      known: false,
      hint: '各校极少公布，收录到之前这里保持空缺',
    },
    {
      key: 'notes',
      label: '其他说明',
      value: r.notes ?? '暂无',
      known: r.notes != null,
    },
  ]
}

/** 门槛是不是整条都没收录 —— 决定第二段显示「待补充」大块还是逐项表格 */
export function gateIsEmpty(school: School): boolean {
  const r = school.requirement
  return (
    r.nationality === 'unknown' &&
    r.hukou === 'unknown' &&
    (r.entryGrades == null || r.entryGrades.length === 0) &&
    r.examTypes.length === 0 &&
    r.applicationWindow == null
  )
}

// ---------------------------------------------------------------------------
// 第三段：要花多少钱

/** 明确未包含的项目。只列名目不估金额 —— 没有公示的数字一个都不编（PRD US-5.3）。 */
export const COST_EXCLUDED = [
  '校外培训与一对一辅导',
  '竞赛报名与集训',
  '游学、海外交流项目',
  '标化考试（雅思/托福/SAT 等）报名与送分',
  '大学申请费与文书服务',
  '校服、活动、耗材等杂费',
]

export interface CostView {
  tuition: number | null
  boarding: boolean | null
  /** 三年学费合计的下限。上限缺住宿费与学费涨幅两项数据，故不给 */
  threeYearLow: number | null
}

export function costView(school: School): CostView {
  return {
    tuition: school.tuitionCny,
    boarding: school.boarding,
    threeYearLow: school.tuitionCny != null ? school.tuitionCny * 3 : null,
  }
}

// ---------------------------------------------------------------------------
// 第四段：下一步做什么
//
// 每一项都由第二段的某个字段推出来，并把依据的字段名带上（`from`）。
// 没有门槛数据就返回空数组 —— 这一段宁可空着，也不放自由生成的建议。

export interface ActionItem {
  title: string
  detail: string
  /** 依据的门槛字段，与 gateItems() 的 label 对应 */
  from: string
}

export function actionItems(school: School): ActionItem[] {
  const r = school.requirement
  const out: ActionItem[] = []

  if (r.nationality !== 'unknown' && r.nationality !== 'none') {
    out.push({
      title: '先核对孩子的身份是否符合',
      detail: `该校要求：${NATIONALITY_LABEL[r.nationality]}。这一条不符合的话，后面的准备都用不上，建议第一步就确认。`,
      from: '国籍 / 身份',
    })
  }

  if (r.hukou === 'local_city' || r.hukou === 'local_district') {
    out.push({
      title: '向学校确认学籍/户籍口径',
      detail: `该校要求：${HUKOU_LABEL[r.hukou]}。非本市户籍通常另有借读或积分入学的口径，需要直接问招生办当年的执行标准。`,
      from: '学籍 / 户籍',
    })
  }

  if (r.entryGrades && r.entryGrades.length) {
    const list = [...r.entryGrades].sort((a, b) => a - b).join(' / ')
    out.push({
      title: `按 ${list} 年级的入学窗口倒排时间`,
      detail: `该校只在 ${list} 年级开放入学。孩子当前年级不在其中时，需要规划到最近的一个窗口年级，中间年份的安排要提前想好。`,
      from: '开放入学年级',
    })
  }

  if (r.examTypes.length) {
    out.push({
      title: `准备入学考试：${r.examTypes.join('、')}`,
      detail: '按该校公布的考试形式安排备考科目与模拟，具体题型与时长以官方招生简章为准。',
      from: '入学考试形式',
    })
  }

  if (r.applicationWindow) {
    out.push({
      title: `盯住报名窗口：${r.applicationWindow}`,
      detail: '本站只收录窗口的文字描述，不解析具体日期。请到学校官网/公众号核对当年的准确起止时间。',
      from: '报名窗口',
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// 纠错入口（PRD US-7.4 最小版：只是一个外链，产品自身不接收任何写入）

/** TODO 上线前替换为真实的飞书表单/问卷 URL */
const CORRECTION_FORM = 'https://example.com/ivy-map-correction'

/** 尽可能预填学校名，减少填写成本（US-7.4 验收标准） */
export function correctionUrl(school: School, field?: string): string {
  const q = new URLSearchParams({ school: school.nameCn })
  if (field) q.set('field', field)
  return `${CORRECTION_FORM}?${q.toString()}`
}
