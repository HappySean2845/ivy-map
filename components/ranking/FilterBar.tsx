'use client'

// 榜单筛选（PRD US-1.3）：城市 / 赛道 / 学校性质。
//
// 赛道只有 AP / IB / A-Level 三个，**没有「其他」** —— 不同体系不可比，
// 混排就是在制造一个看起来能比、实际上不能比的榜单（PRD §4 术语表、原则 §5.4）。
//
// 「隐藏不可申请的学校」这个开关也放在这里：它改的是 Filters，而
// FeasibilityGate 的 onChange 只回传 Gate，够不到。只在闸门填了内容时才出现 ——
// 没填的时候没有任何学校会被判为不可申请，摆一个不起作用的开关只会让人困惑。

import { isGateActive, type Filters } from '@/lib/filters'
import { SCHOOL_TYPES, SCHOOL_TYPE_LABEL, TRACKS, TRACK_LABEL, type City } from '@/types'
import { Chip, Field, SELECT_CLASS } from './_shared'

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterBar({
  filters,
  cities,
  onChange,
}: {
  filters: Filters
  cities: City[]
  onChange: (f: Filters) => void
}) {
  const gateActive = isGateActive(filters.gate)
  const dirty =
    filters.cityId !== null || filters.tracks.length > 0 || filters.schoolTypes.length > 0

  return (
    <div className="space-y-3">
      <Field label="城市">
        <select
          value={filters.cityId ?? ''}
          onChange={(e) => onChange({ ...filters, cityId: e.target.value || null })}
          aria-label="按城市筛选"
          className={SELECT_CLASS}
        >
          <option value="">不限城市</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="赛道" hint="不同赛道的出口差别很大，也不在同一个口径上，所以不混排。">
        <Chip selected={filters.tracks.length === 0} onClick={() => onChange({ ...filters, tracks: [] })}>
          不限
        </Chip>
        {TRACKS.map((t) => (
          <Chip
            key={t}
            selected={filters.tracks.includes(t)}
            onClick={() => onChange({ ...filters, tracks: toggle(filters.tracks, t) })}
          >
            {TRACK_LABEL[t]}
          </Chip>
        ))}
      </Field>

      <Field label="学校性质">
        <Chip
          selected={filters.schoolTypes.length === 0}
          onClick={() => onChange({ ...filters, schoolTypes: [] })}
        >
          不限
        </Chip>
        {SCHOOL_TYPES.map((t) => (
          <Chip
            key={t}
            selected={filters.schoolTypes.includes(t)}
            onClick={() =>
              onChange({ ...filters, schoolTypes: toggle(filters.schoolTypes, t) })
            }
          >
            {SCHOOL_TYPE_LABEL[t]}
          </Chip>
        ))}
      </Field>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
        {gateActive ? (
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={filters.hideIneligible}
              onChange={(e) => onChange({ ...filters, hideIneligible: e.target.checked })}
              className="size-3.5 accent-neutral-900 dark:accent-neutral-100"
            />
            隐藏不可申请的学校
          </label>
        ) : null}

        {dirty ? (
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, cityId: null, tracks: [], schoolTypes: [] })
            }
            className="text-[12px] text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            清空筛选
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default FilterBar
