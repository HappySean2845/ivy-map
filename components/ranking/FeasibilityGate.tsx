'use client'

// 可行性闸门表单（PRD US-2.1）。
//
// 这是所有竞品的盲区，也是本产品第二条护城河的入口。但它的定位很明确：
// **增强，不是门槛**。不填照样能浏览一切，所以默认折叠；填了立即生效，没有提交按钮。
//
// 折叠态那句「先看看你报不报得了」是这个表单唯一的推销机会 ——
// 家长不知道「可行性闸门」是什么，但他知道「报不报得了」是什么。

import { useState } from 'react'
import { dataset } from '@/lib/data'
import { EMPTY_GATE, isGateActive, type Gate } from '@/lib/filters'
import type { City } from '@/types'
import { Chip, Field, SELECT_CLASS } from './_shared'

const NATIONALITIES: { value: NonNullable<Gate['nationality']>; label: string }[] = [
  { value: 'cn', label: '中国大陆' },
  { value: 'foreign', label: '外籍（外国护照）' },
  { value: 'hk_mo_tw', label: '港澳台侨' },
  { value: 'pr', label: '境外永久居留权' },
]

/** 家长说的是「初二」，不是「8 年级」。表单里跟着家长的话走。 */
const GRADES: { value: number; label: string }[] = [
  { value: 5, label: '五年级' },
  { value: 6, label: '六年级' },
  { value: 7, label: '初一（7）' },
  { value: 8, label: '初二（8）' },
  { value: 9, label: '初三（9）' },
  { value: 10, label: '高一（10）' },
  { value: 11, label: '高二（11）' },
  { value: 12, label: '高三（12）' },
]

/** 用 builtAt 而不是 new Date()，避免服务端和客户端算出不同的年份列表。 */
function targetYears(): number[] {
  const d = new Date(dataset.builtAt)
  const base = (Number.isNaN(d.getTime()) ? new Date() : d).getUTCFullYear()
  return [base, base + 1, base + 2, base + 3, base + 4]
}

export function FeasibilityGate({
  gate,
  cities,
  onChange,
}: {
  gate: Gate
  cities: City[]
  onChange: (g: Gate) => void
}) {
  const active = isGateActive(gate)
  // 从分享链接进来时闸门已经有内容，直接展开 —— 否则用户看到一堆灰行不知道为什么
  const [open, setOpen] = useState(active)

  const gateCityName = gate.cityId
    ? (cities.find((c) => c.id === gate.cityId)?.name ?? null)
    : null

  const set = (patch: Partial<Gate>) => onChange({ ...gate, ...patch })

  return (
    <div className={` border ${active ? 'border-ink' : 'border-ink/15'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="text-[13px] font-medium">先看看你报不报得了</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-ink/60">
            {active
              ? summarize(gate, gateCityName)
              : '填孩子的国籍、学籍、年级，榜单会标出哪些学校根本报不了、卡在哪一条。不填不影响任何浏览。'}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-ink/40">{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-ink/15 px-3 py-3">
          <Field label="国籍 / 身份">
            {NATIONALITIES.map((n) => (
              <Chip
                key={n.value}
                selected={gate.nationality === n.value}
                onClick={() =>
                  set({ nationality: gate.nationality === n.value ? null : n.value })
                }
              >
                {n.label}
              </Chip>
            ))}
          </Field>

          <Field label="学籍所在城市">
            <select
              value={gate.cityId ?? ''}
              onChange={(e) => set({ cityId: e.target.value || null })}
              aria-label="孩子学籍所在城市"
              className={SELECT_CLASS}
            >
              <option value="">未填写</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={gateCityName ? `是否${gateCityName}户籍` : '是否本市户籍'}
            hint="户籍和国籍不一样：国籍想不了办法，户籍通常还有借读、积分入学这类政策口径可以查。"
          >
            <Chip
              selected={gate.localHukou === true}
              onClick={() => set({ localHukou: gate.localHukou === true ? null : true })}
            >
              本市户籍
            </Chip>
            <Chip
              selected={gate.localHukou === false}
              onClick={() => set({ localHukou: gate.localHukou === false ? null : false })}
            >
              非本市户籍
            </Chip>
          </Field>

          <Field label="当前年级">
            <select
              value={gate.grade ?? ''}
              onChange={(e) => set({ grade: e.target.value ? Number(e.target.value) : null })}
              aria-label="孩子当前年级"
              className={SELECT_CLASS}
            >
              <option value="">未填写</option>
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="目标入学年份"
            hint="不填也行 —— 不填时按「当前年级」和「下一学年」两种情况一起判，不会因为少填一项就把学校误判成报不了。"
          >
            <select
              value={gate.targetYear ?? ''}
              onChange={(e) =>
                set({ targetYear: e.target.value ? Number(e.target.value) : null })
              }
              aria-label="目标入学年份"
              className={SELECT_CLASS}
            >
              <option value="">未填写</option>
              {targetYears().map((y) => (
                <option key={y} value={y}>
                  {y} 年秋季
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <p className="text-[11px] leading-relaxed text-ink/40">
              这些条件只用来筛学校，不包含任何能识别孩子身份的信息，也会一起写进分享链接。
            </p>
            <button
              type="button"
              disabled={!active}
              onClick={() => onChange({ ...EMPTY_GATE })}
              className="shrink-0 text-[12px] text-ink/60 underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
            >
              清空
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** 折叠态的摘要：填了什么要一眼看得见，否则用户不知道榜单为什么变灰了。 */
function summarize(gate: Gate, cityName: string | null): string {
  const parts: string[] = []
  const nat = NATIONALITIES.find((n) => n.value === gate.nationality)
  if (nat) parts.push(nat.label)
  if (cityName) parts.push(`${cityName}学籍`)
  if (gate.localHukou !== null) parts.push(gate.localHukou ? '本市户籍' : '非本市户籍')
  const grade = GRADES.find((g) => g.value === gate.grade)
  if (grade) parts.push(grade.label)
  if (gate.targetYear != null) parts.push(`${gate.targetYear} 年入学`)
  return `已填：${parts.join(' · ')}`
}

export default FeasibilityGate
