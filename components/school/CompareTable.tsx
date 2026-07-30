'use client'

// 多校对比（PRD US-3.2）。2–4 所并排，维度为行、学校为列。
//
// 两条约束决定了这个布局：
//   1. 移动端必须能横向滚动且「学校名不跟丢」 —— 所以整张表放在一个限高的滚动盒里，
//      表头（学校名）sticky top、维度列 sticky left，两个方向都不会丢参照。
//   2. 差异要能一眼看出 —— 数值行标出本行最高值，文字行标「有差异」。
//      只陈述事实，不做任何评价性表述（PRD §9 那条禁用词与评价性表述的规定）。
//
// 是 client 组件：它会被榜单（client）直接渲染，且 SourcePopover 需要交互。

import type { ReactNode } from 'react'
import { BasisNote } from '@/components/trust/BasisNote'
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge'
import { SourcePopover } from '@/components/trust/SourcePopover'
import { MAX_COMPARE } from '@/lib/filters'
import { SCHOOL_TYPE_LABEL, TRACK_LABEL } from '@/types'
import { CorrectionLink } from './CorrectionLink'
import {
  DASH,
  actionItems,
  costView,
  fmtNum,
  fmtPct,
  fmtWan,
  gateItems,
  schoolProfile,
  targetStat,
  type SchoolProfile,
  type TargetStat,
} from './schoolData'

// ---------------------------------------------------------------------------
// 行模型

interface Cell {
  node: ReactNode
  /** 数值行用来找本行最高值。null = 缺数据，不参与比较 */
  num?: number | null
  /** 差异判定用的可比字符串。相同 = 无差异 */
  cmp: string
}

interface Row {
  label: string
  hint?: string
  cells: Cell[]
  /** 数值行才标「本行最高」；文字行只标「有差异」 */
  numeric?: boolean
}

interface Group {
  title: string
  rows: Row[]
}

function textCell(text: string | null, missingText = '待补充'): Cell {
  if (text == null || text === '') {
    return {
      node: <span className="text-ink/40">{missingText}</span>,
      cmp: `__missing__:${missingText}`,
    }
  }
  return { node: <span>{text}</span>, cmp: text }
}

function numCell(
  value: number | null,
  render: (n: number) => string,
  sourceIds: string[] = [],
  missingNote?: string,
): Cell {
  if (value == null) {
    return {
      node: (
        <span className="text-ink/40">
          {DASH}
          {missingNote && <span className="ml-1 text-[11px]">· {missingNote}</span>}
        </span>
      ),
      num: null,
      cmp: '__missing__',
    }
  }
  const text = render(value)
  return {
    node:
      sourceIds.length > 0 ? (
        <SourcePopover sourceIds={sourceIds}>
          <span className="cursor-pointer font-mono tabular-nums underline decoration-dotted decoration-neutral-400 underline-offset-4">
            {text}
          </span>
        </SourcePopover>
      ) : (
        <span className="font-mono tabular-nums" title="这项数据尚未关联来源">
          {text}
        </span>
      ),
    num: value,
    cmp: text,
  }
}

// ---------------------------------------------------------------------------

export function CompareTable({
  schoolIds,
  universityId,
}: {
  schoolIds: string[]
  universityId: string | null
}) {
  // 去重 + 截到上限。多勾的部分明确告知，不静默丢弃。
  const unique = [...new Set(schoolIds)]
  const overflow = unique.length > MAX_COMPARE
  const used = unique.slice(0, MAX_COMPARE)

  const profiles = used
    .map((id) => schoolProfile(id))
    .filter((p): p is SchoolProfile => p != null)

  if (profiles.length < 2) {
    return (
      <div className=" border border-dashed border-ink/15 p-4 text-sm">
        <p className="font-medium">还不能对比</p>
        <p className="mt-1.5 text-ink/60">
          在榜单里勾选 2–{MAX_COMPARE} 所学校加入对比。
          {profiles.length === 1 && ' 现在只勾了 1 所。'}
          {unique.length > profiles.length && ' 其中有学校不在当前收录范围内，已跳过。'}
        </p>
      </div>
    )
  }

  const stats: (TargetStat | null)[] = profiles.map((p) =>
    targetStat(p.school.id, universityId),
  )
  const uniName = stats.find((s) => s)?.universityName ?? null

  const groups: Group[] = [
    {
      title: '基本信息',
      rows: [
        {
          label: '城市 / 区',
          cells: profiles.map((p) =>
            textCell(p.cityName + (p.school.district ? ` · ${p.school.district}` : '')),
          ),
        },
        {
          label: '学校性质',
          cells: profiles.map((p) => textCell(SCHOOL_TYPE_LABEL[p.school.type])),
        },
        {
          label: '开设赛道',
          cells: profiles.map((p) =>
            textCell(p.school.tracks.map((t) => TRACK_LABEL[t]).join(' / ') || null),
          ),
        },
      ],
    },
    {
      title: uniName ? `去向（对${uniName}）` : '去向',
      rows: [
        {
          label: '加权录取人数',
          hint: '近三年时间加权，口径见指标说明',
          numeric: true,
          cells: profiles.map((p, i) => {
            const s = stats[i]
            return numCell(
              s?.volume ?? null,
              fmtNum,
              s?.sourceIds ?? [],
              uniName ? '暂未收录' : '未选定目标大学',
            )
          }),
        },
        {
          label: '人均密度',
          hint: '录取人数 ÷ 该赛道毕业生数；分母缺失时不估算',
          numeric: true,
          cells: profiles.map((p, i) => {
            const s = stats[i]
            return numCell(
              s?.density ?? null,
              fmtPct,
              s?.sourceIds ?? [],
              s?.denominatorMissing ? '分母缺失' : '暂未收录',
            )
          }),
        },
        {
          label: '口径 / 置信',
          cells: profiles.map((p, i) => {
            const s = stats[i]
            if (!s || s.volume == null) return textCell(null, '暂未收录')
            return {
              node: (
                <span className="flex flex-wrap items-center gap-1.5">
                  <ConfidenceBadge level={s.confidence} estimated={s.basis === 'estimated'} />
                  <BasisNote basis={s.basis} />
                </span>
              ),
              cmp: `${s.confidence}/${s.basis}`,
            }
          }),
        },
        {
          label: '近三年收录去向',
          hint: '全部去向大学，未加权',
          numeric: true,
          cells: profiles.map((p) =>
            numCell(
              p.hasAnyAdmission ? p.destinations.length : null,
              (n) => `${n} 所`,
              [],
              '暂未收录',
            ),
          ),
        },
        {
          label: '主要去向 Top 3',
          cells: profiles.map((p) =>
            textCell(
              p.destinations.length
                ? p.destinations
                    .slice(0, 3)
                    .map((d) => `${d.nameCn} ${fmtNum(d.admits)}`)
                    .join('、')
                : null,
              '暂未收录',
            ),
          ),
        },
        {
          label: '毕业生规模',
          hint: '取最近一个有收录的届次，按赛道统计；它是人均密度的分母',
          numeric: true,
          cells: profiles.map((p) => {
            const latest = p.byYear.find((y) => y.graduates != null)
            return numCell(
              latest?.graduates ?? null,
              (n) => `${fmtNum(n)} 人`,
              latest?.sourceIds ?? [],
              '未收录',
            )
          }),
        },
      ],
    },
    {
      title: '门槛（你进得去吗）',
      rows: ['nationality', 'hukou', 'entryGrades', 'examTypes', 'applicationWindow'].map(
        (key) => {
          const sample = gateItems(profiles[0].school).find((g) => g.key === key)
          return {
            label: sample?.label ?? key,
            cells: profiles.map((p) => {
              const item = gateItems(p.school).find((g) => g.key === key)
              if (!item || !item.known) {
                return {
                  node: (
                    <span className="flex flex-col items-start gap-1.5">
                      <span className="text-ink/40">待补充</span>
                      <CorrectionLink school={p.school} field={key} />
                    </span>
                  ),
                  cmp: '__missing__',
                }
              }
              return textCell(item.value)
            }),
          }
        },
      ),
    },
    {
      title: '费用',
      rows: [
        {
          label: '学费 / 学年',
          numeric: true,
          cells: profiles.map((p) => numCell(costView(p.school).tuition, fmtWan, [], '待补充')),
        },
        {
          label: '三年学费合计',
          hint: '下限口径：当年学费 × 3，不含住宿；上限缺公示数据，不估算',
          numeric: true,
          cells: profiles.map((p) => {
            const c = costView(p.school)
            return numCell(c.threeYearLow, (n) => `${fmtWan(n)} 起`, [], '待补充')
          }),
        },
        {
          label: '住宿',
          cells: profiles.map((p) => {
            const b = costView(p.school).boarding
            return textCell(b == null ? null : b ? '提供住宿' : '不提供住宿')
          }),
        },
      ],
    },
    {
      title: '下一步做什么',
      rows: [
        {
          label: '可执行动作',
          hint: '全部来自上方门槛字段，没有门槛数据就没有动作',
          cells: profiles.map((p) => {
            const items = actionItems(p.school)
            if (items.length === 0) {
              return {
                node: <span className="text-ink/40">门槛数据未收录，给不出可追溯的动作</span>,
                cmp: '__missing__',
              }
            }
            return {
              node: (
                <ul className="space-y-1">
                  {items.map((a) => (
                    <li key={a.title} className="leading-snug">
                      · {a.title}
                    </li>
                  ))}
                </ul>
              ),
              cmp: items.map((a) => a.title).join('|'),
            }
          }),
        },
      ],
    },
  ]

  const colWidth = 'min-w-[10.5rem]'

  return (
    <div className="text-sm">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          对比 {profiles.length} 所学校
        </h2>
        <span className="text-xs text-ink/60">
          左右滑动查看全部；数值行标出本行最高，文字行标出有差异
        </span>
      </div>
      {overflow && (
        <p className="mb-2 text-xs text-ink/60">
          最多同时对比 {MAX_COMPARE} 所，已显示前 {MAX_COMPARE} 所。
        </p>
      )}

      <div className="max-h-[75vh] overflow-auto border border-ink/15">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                scope="col"
                className={`sticky top-0 left-0 z-30 w-32 min-w-32 border-b border-ink/15 bg-paper p-2.5 text-left text-xs font-normal text-ink/60`}
              >
                维度
              </th>
              {profiles.map((p) => (
                <th
                  key={p.school.id}
                  scope="col"
                  className={`sticky top-0 z-20 ${colWidth} border-b border-l border-ink/15 bg-paper p-2.5 text-left align-top`}
                >
                  <span className="block text-[13px] leading-snug font-medium">
                    {p.school.nameCn}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-normal text-ink/60">
                    {p.cityName}
                    {p.school.tracks.length
                      ? ` · ${p.school.tracks.map((t) => TRACK_LABEL[t]).join('/')}`
                      : ''}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={profiles.length + 1}
                  className="sticky left-0 border-y border-ink/15 bg-paper px-2.5 py-1.5 text-left text-[11px] font-medium text-ink/60"
                >
                  {g.title}
                </th>
              </tr>
              {g.rows.map((row) => {
                const cmps = new Set(row.cells.map((c) => c.cmp))
                const differs = cmps.size > 1
                const nums = row.cells.map((c) => c.num).filter((n): n is number => n != null)
                const max = nums.length > 1 ? Math.max(...nums) : null
                const highlightMax =
                  row.numeric === true && max != null && nums.some((n) => n !== max) // 全相等就不用强调

                return (
                  <tr key={row.label} className="align-top">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 w-32 min-w-32 border-t border-ink/15 bg-paper p-2.5 text-left text-xs font-normal text-ink/60"
                    >
                      <span className="block">{row.label}</span>
                      {row.hint && (
                        <span className="mt-0.5 block text-[11px] text-ink/40">{row.hint}</span>
                      )}
                      {differs && (
                        <span className="mt-1 inline-block bg-ink/[0.05] px-1 py-0.5 text-[10px] leading-3 text-ink/50">
                          有差异
                        </span>
                      )}
                    </th>
                    {row.cells.map((cell, i) => {
                      const isMax = highlightMax && cell.num != null && cell.num === max
                      return (
                        <td
                          key={profiles[i].school.id}
                          className={`${colWidth} border-t border-l border-ink/15 p-2.5 ${
                            isMax ? 'bg-paper/60' : ''
                          }`}
                        >
                          <span className={isMax ? 'font-medium' : ''}>{cell.node}</span>
                          {isMax && (
                            <span className="mt-1 block text-[10px] text-ink/40">
                              本行数值最高
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-ink/40">
        「有差异」只表示各校在这一行上的取值不同，「本行数值最高」只是数值比较，
        两者都不代表哪所学校更好。缺数据的格子显示「{DASH}」或「待补充」，不按 0 参与比较。
      </p>
    </div>
  )
}

export default CompareTable
