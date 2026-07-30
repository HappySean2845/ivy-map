// URL ↔ 应用状态（PRD US-8.2 可复现链接 / US-1.3 刷新后保持 / US-2.1 闸门保持）。
//
// **URL 就是状态**，不引入任何状态管理库。三条约定：
//   1. 参数名尽量短 —— 这个链接是要发到微信里的。
//   2. 解析必须健壮：非法值一律回落，绝不抛异常。一个坏链接不能让页面白屏。
//   3. 往返一致：parseFilters(new URLSearchParams(toQueryString(f))) 等价于 f。
//
// 链接里不含任何可识别个人身份的信息 —— 闸门存的是「初二 / 非本市户籍」这类
// 条件本身，不是孩子是谁。

import type { ReadonlyURLSearchParams } from 'next/navigation'
import { cityById, schoolById, universityById } from '@/lib/data'
import {
  DEFAULT_FILTERS,
  EMPTY_GATE,
  GRADE_MAX,
  GRADE_MIN,
  MAX_COMPARE,
  type Filters,
  type Gate,
} from '@/lib/filters'
import { SCHOOL_TYPES, TRACKS, type SchoolType, type Track } from '@/types'

type Params = URLSearchParams | ReadonlyURLSearchParams

/** 全部参数名。集中在这里，改名只改一处。 */
const KEYS = [
  'u', // 目标大学
  'city', // 榜单筛的城市
  'track', // 赛道，逗号分隔
  'type', // 学校性质，逗号分隔
  'alpha', // 滑杆位置
  'cmp', // 对比集合，逗号分隔
  'nat', // 闸门：国籍/身份
  'hukou', // 闸门：是否本市户籍
  'gcity', // 闸门：学籍所在城市
  'grade', // 闸门：当前年级
  'gyear', // 闸门：目标入学年份
  'hide', // 隐藏不可申请的学校
] as const

const NATIONALITIES = ['cn', 'foreign', 'hk_mo_tw', 'pr'] as const

/** 目标入学年份的合理区间，超出的一律当没填 */
const YEAR_MIN = 2000
const YEAR_MAX = 2100

// ---------------------------------------------------------------------------
// 解析

function splitList(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 赛道容错：a-level / alevel / IB 大小写混用都认 */
function parseTrack(raw: string): Track | null {
  const v = raw.toUpperCase().replace(/[-_\s]/g, '')
  return (TRACKS as readonly string[]).includes(v) ? (v as Track) : null
}

function parseNumber(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseGate(sp: Params): Gate {
  const nat = sp.get('nat')
  const hukou = sp.get('hukou')
  const gcity = sp.get('gcity')
  const grade = parseNumber(sp.get('grade'))
  const gyear = parseNumber(sp.get('gyear'))

  return {
    nationality: (NATIONALITIES as readonly string[]).includes(nat ?? '')
      ? (nat as Gate['nationality'])
      : null,
    localHukou: hukou === 'local' ? true : hukou === 'non_local' ? false : null,
    cityId: gcity && cityById.has(gcity) ? gcity : null,
    grade:
      grade != null && Number.isInteger(grade) && grade >= GRADE_MIN && grade <= GRADE_MAX
        ? grade
        : null,
    targetYear:
      gyear != null && Number.isInteger(gyear) && gyear >= YEAR_MIN && gyear <= YEAR_MAX
        ? gyear
        : null,
  }
}

/**
 * 从 URL 还原筛选状态。
 *
 * 一个参数都没有（裸链接 / 只带 utm 的分享链接）时返回 DEFAULT_FILTERS ——
 * 首屏必须落地即有内容（US-1.0）。只要带了任意一个已知参数，就按 URL 逐字段还原，
 * 缺省的字段一律当「没选」，这样往返才是精确的。
 */
export function parseFilters(sp: Params): Filters {
  const touched = KEYS.some((k) => sp.get(k) != null)
  if (!touched) return { ...DEFAULT_FILTERS, gate: { ...EMPTY_GATE } }

  const u = sp.get('u')
  const city = sp.get('city')
  const alpha = parseNumber(sp.get('alpha'))

  const tracks: Track[] = []
  for (const raw of splitList(sp.get('track'))) {
    const t = parseTrack(raw)
    if (t && !tracks.includes(t)) tracks.push(t)
  }

  const schoolTypes: SchoolType[] = []
  for (const raw of splitList(sp.get('type'))) {
    if (
      (SCHOOL_TYPES as readonly string[]).includes(raw) &&
      !schoolTypes.includes(raw as SchoolType)
    ) {
      schoolTypes.push(raw as SchoolType)
    }
  }

  const compare: string[] = []
  for (const id of splitList(sp.get('cmp'))) {
    if (schoolById.has(id) && !compare.includes(id) && compare.length < MAX_COMPARE) {
      compare.push(id)
    }
  }

  return {
    // u= （空值）表示用户主动清空了大学；u 是无效 id 时回落到默认组合
    universityId:
      u == null
        ? null
        : u.trim() === ''
          ? null
          : universityById.has(u)
            ? u
            : DEFAULT_FILTERS.universityId,
    cityId: city && cityById.has(city) ? city : null,
    tracks,
    schoolTypes,
    alpha: alpha == null ? DEFAULT_FILTERS.alpha : roundAlpha(clamp01(alpha)),
    compare,
    hideIneligible: sp.get('hide') === '1',
    gate: parseGate(sp),
  }
}

// ---------------------------------------------------------------------------
// 序列化

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** 滑杆保留两位小数 —— 链接短，也够精细 */
function roundAlpha(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 滑杆值的规范形式：裁到 [0,1] 且保留两位小数。
 * 组件在 onChange 里用它，保证「拖出来的值」和「链接里的值」永远一致。
 */
export function normalizeAlpha(n: number): number {
  return roundAlpha(clamp01(Number.isFinite(n) ? n : DEFAULT_FILTERS.alpha))
}

/**
 * 序列化成 query string（不含前导 `?`）。
 * 空值一律省略；alpha 始终写出，所以产物永远非空 —— 这保证了 parseFilters
 * 的「裸链接回落默认」分支不会被往返触发。
 */
export function toQueryString(f: Filters): string {
  const sp = new URLSearchParams()

  if (f.universityId) sp.set('u', f.universityId)
  else sp.set('u', '') // 主动清空，和「没写过 u」区分开
  if (f.cityId) sp.set('city', f.cityId)
  if (f.tracks.length) sp.set('track', f.tracks.join(','))
  if (f.schoolTypes.length) sp.set('type', f.schoolTypes.join(','))
  sp.set('alpha', roundAlpha(clamp01(f.alpha)).toFixed(2))
  if (f.compare.length) sp.set('cmp', f.compare.slice(0, MAX_COMPARE).join(','))

  const g = f.gate
  if (g.nationality) sp.set('nat', g.nationality)
  if (g.localHukou !== null) sp.set('hukou', g.localHukou ? 'local' : 'non_local')
  if (g.cityId) sp.set('gcity', g.cityId)
  if (g.grade != null) sp.set('grade', String(g.grade))
  if (g.targetYear != null) sp.set('gyear', String(g.targetYear))

  if (f.hideIneligible) sp.set('hide', '1')

  return sp.toString()
}
