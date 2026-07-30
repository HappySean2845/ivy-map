'use client'
// 需要 useLayoutEffect 做重排动画，且 props 里带回调，本来就只能长在客户端树上。

// Feeder 榜单（PRD US-1.3 + US-2.2）。
//
// 这张表最容易犯的两个错，都会直接违反产品原则：
//   1. 把 density === null 显示成 0 —— 那是在替用户猜分母（metrics.md §5）。
//      缺什么就显示「—」，并说清楚缺的是分母。
//   2. 把不可申请的学校直接删掉 —— 用户需要知道它存在，只是他报不了，
//      而且要看到卡在哪一条（US-2.2）。所以默认置灰保留，只有 hideIneligible
//      打开时才隐藏。
//
// 注意 hideIneligible 只隐藏 'ineligible'，不隐藏 'unknown'。
// 门槛信息缺失既不能默认判为可申请，也不能默认判为不可申请，藏起来就等于替用户下了结论。

import { useLayoutEffect, useRef } from 'react'
import { BasisNote } from '@/components/trust/BasisNote'
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge'
import { SourcePopover } from '@/components/trust/SourcePopover'
import { MAX_COMPARE } from '@/lib/filters'
import type { FeederRowView } from '@/lib/view'
import { TRACK_LABEL, SCHOOL_TYPE_LABEL } from '@/types'
import { useReducedMotion } from './_shared'

/** 重排动画。短到不影响跟手，长到能看出「谁超过了谁」。 */
const FLIP_MS = 200

// ---------------------------------------------------------------------------
// 数值格式化。所有「缺失」一律走 DASH，任何分支都不许回落到 0。

const DASH = '—'

/** 加权人数是小数，给一位；整数不拖 .0 */
function fmtVolume(v: number): string {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function fmtDensity(d: number | null): string {
  if (d == null) return DASH
  const pct = d * 100
  return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`
}

function fmtTuition(cny: number | null): string {
  if (cny == null) return DASH
  const wan = cny / 10000
  const r = Math.round(wan * 10) / 10
  return `${Number.isInteger(r) ? r : r.toFixed(1)} 万`
}

// ---------------------------------------------------------------------------

const TH = 'px-2.5 py-2 text-left text-[11px] font-medium text-ink-muted whitespace-nowrap'
const TD = 'px-2.5 py-2.5 align-top text-[13px]'
/** 左侧两列在移动端固定住。背景必须是实色，否则横向滚动时下面的内容会透出来。 */
const STICKY_BG = 'bg-paper group-hover:bg-paper'

export function FeederTable({
  rows,
  compare,
  onToggleCompare,
  onOpen,
  hideIneligible,
}: {
  rows: FeederRowView[]
  compare: string[]
  onToggleCompare: (id: string) => void
  onOpen: (id: string) => void
  hideIneligible: boolean
}) {
  const reduced = useReducedMotion()

  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const prevTops = useRef(new Map<string, number>())

  const hiddenCount = hideIneligible
    ? rows.filter((r) => r.eligibility.status === 'ineligible').length
    : 0
  const visible = hideIneligible
    ? rows.filter((r) => r.eligibility.status !== 'ineligible')
    : rows

  // FLIP：布局已经算完了，动画只改 transform，不会拖慢重排本身。
  useLayoutEffect(() => {
    const next = new Map<string, number>()
    for (const [id, el] of rowRefs.current) next.set(id, el.offsetTop)

    if (!reduced) {
      for (const [id, top] of next) {
        const before = prevTops.current.get(id)
        const el = rowRefs.current.get(id)
        if (before == null || el == null) continue
        const dy = before - top
        if (Math.abs(dy) < 1) continue
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], {
          duration: FLIP_MS,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
    }
    prevTops.current = next
  })

  if (rows.length === 0) {
    return (
      <EmptyBox
        title="当前条件下没有可展示的学校"
        lines={[
          '这不是出错了 —— 目前只收录了公开战报里能逐条对上出处的数据，覆盖面还很窄。',
          '把城市或赛道放宽一档通常就有内容了；也可以换一所目标大学看看。',
        ]}
      />
    )
  }

  if (visible.length === 0) {
    return (
      <EmptyBox
        title={`${rows.length} 所学校都被「隐藏不可申请的学校」隐藏了`}
        lines={[
          '按你填写的孩子情况，这些学校都存在硬性门槛不符合的项。',
          '关掉这个开关可以看到它们分别卡在哪一条 —— 有些是户籍，户籍通常还有政策口径可查。',
        ]}
      />
    )
  }

  const compareFull = compare.length >= MAX_COMPARE

  return (
    <div>
      <p className="px-0.5 pb-2 text-[11px] leading-relaxed text-ink-muted">
        当前口径：近三年加权<strong className="font-medium">去重人数</strong>（最近一届 0.5 /
        前一届 0.3 / 再前一届 0.2）；人均密度 = 加权录取人数 ÷ 该赛道加权毕业生数。
        点数字可以看出处。
      </p>

      <div className="overflow-x-auto overscroll-x-contain rounded-sm border border-rule">
        <table className="w-full min-w-[46rem] border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className={`${TH} sticky left-0 z-20 w-10 bg-paper`}>
                #
              </th>
              <th scope="col" className={`${TH} sticky left-10 z-20 min-w-[11rem] bg-paper`}>
                学校
              </th>
              <th scope="col" className={TH}>
                赛道
              </th>
              <th scope="col" className={`${TH} text-right`}>
                近三年录取
              </th>
              <th scope="col" className={`${TH} text-right`}>
                人均密度
              </th>
              <th scope="col" className={`${TH} text-right`}>
                学费
              </th>
              <th scope="col" className={TH}>
                可申请
              </th>
              <th scope="col" className={TH}>
                置信
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const { school, eligibility } = row
              const ineligible = eligibility.status === 'ineligible'
              const unknown = eligibility.status === 'unknown'
              const checked = compare.includes(school.id)

              return (
                <tr
                  key={school.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(school.id, el)
                    else rowRefs.current.delete(school.id)
                  }}
                  className={`group border-b border-rule last:border-0 hover:bg-paper ${
                    ineligible ? 'opacity-55' : ''
                  }`}
                >
                  <td className={`${TD} sticky left-0 z-10 w-10 ${STICKY_BG}`}>
                    <span className="font-mono text-[13px] tabular-nums text-ink-faint">
                      {row.rank}
                    </span>
                  </td>

                  <td className={`${TD} sticky left-10 z-10 min-w-[11rem] ${STICKY_BG}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && compareFull}
                        onChange={() => onToggleCompare(school.id)}
                        aria-label={`把${school.nameCn}加入对比`}
                        title={
                          !checked && compareFull
                            ? `最多对比 ${MAX_COMPARE} 所，先取消一所`
                            : '加入对比'
                        }
                        className="mt-1 size-3.5 shrink-0 accent-neutral-900"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpen(school.id)}
                          className="text-left text-[13px] font-medium leading-snug underline-offset-2 hover:underline"
                        >
                          {school.nameCn}
                        </button>
                        <div className="mt-0.5 text-[11px] leading-tight text-ink-faint">
                          {row.cityName}
                          {school.district ? ` · ${school.district}` : ''} ·{' '}
                          {SCHOOL_TYPE_LABEL[school.type]}
                        </div>
                        {/* 原因跟着学校名走，因为这一列在移动端是固定住的 ——
                            用户不用横向滚就能看到自己为什么报不了 */}
                        {(ineligible || unknown) && eligibility.reasons.length > 0 ? (
                          <ul
                            className={`mt-1 space-y-0.5 text-[11px] leading-snug ${
                              ineligible ? 'text-ink-muted' : 'text-signal'
                            }`}
                          >
                            {eligibility.reasons.map((r) => (
                              <li key={r}>· {r}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className={`${TD} whitespace-nowrap text-ink-muted`}>
                    {school.tracks.length
                      ? school.tracks.map((t) => TRACK_LABEL[t]).join(' / ')
                      : DASH}
                  </td>

                  <td className={`${TD} text-right`}>
                    <SourcePopover sourceIds={row.sourceIds}>
                      <span className="font-mono tabular-nums underline decoration-dotted underline-offset-2">
                        {fmtVolume(row.volume)}
                      </span>
                    </SourcePopover>
                    <div className="mt-1 flex justify-end">
                      <BasisNote basis={row.basis} />
                    </div>
                  </td>

                  <td className={`${TD} text-right`}>
                    <span
                      className={`font-mono tabular-nums ${
                        row.density == null ? 'text-ink-faint' : ''
                      }`}
                    >
                      {fmtDensity(row.density)}
                    </span>
                    {row.density == null ? (
                      <div
                        className="mt-1 text-[11px] leading-tight text-ink-faint"
                        title="该校该赛道的毕业生数（密度的分母）尚未收录。分母是这个算法的地基，我们不猜分母，所以这里不显示任何数字。"
                      >
                        分母缺失
                      </div>
                    ) : null}
                  </td>

                  <td className={`${TD} whitespace-nowrap text-right`}>
                    <span
                      className={`font-mono tabular-nums ${
                        school.tuitionCny == null ? 'text-ink-faint' : ''
                      }`}
                    >
                      {fmtTuition(school.tuitionCny)}
                    </span>
                    {school.tuitionCny != null ? (
                      <span className="ml-0.5 text-[11px] text-ink-faint">/年</span>
                    ) : (
                      <div className="mt-1 text-[11px] leading-tight text-ink-faint">
                        暂未收录
                      </div>
                    )}
                  </td>

                  <td className={TD}>
                    <EligibilityTag status={eligibility.status} />
                  </td>

                  <td className={TD}>
                    <ConfidenceBadge
                      level={row.confidence}
                      estimated={row.basis === 'estimated'}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 ? (
        <p className="px-0.5 pt-2 text-[11px] text-ink-muted">
          已隐藏 {hiddenCount}{' '}
          所不可申请的学校。关掉「隐藏不可申请的学校」可以看到它们卡在哪一条。
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------

function EligibilityTag({ status }: { status: FeederRowView['eligibility']['status'] }) {
  if (status === 'ineligible') {
    return (
      <span className="inline-flex whitespace-nowrap rounded border border-rule bg-paper px-1.5 py-px text-[11px] leading-tight text-ink-muted">
        报不了
      </span>
    )
  }
  if (status === 'unknown') {
    return (
      <span
        className="inline-flex whitespace-nowrap rounded border border-dashed border-signal bg-signal-soft px-1.5 py-px text-[11px] leading-tight text-signal"
        title="这所学校的门槛信息还没收录齐，既不能判为可申请，也不能判为不可申请。以学校官方招生简章为准。"
      >
        门槛信息待补充
      </span>
    )
  }
  return (
    <span
      className="inline-flex whitespace-nowrap rounded border border-accent bg-accent-soft px-1.5 py-px text-[11px] leading-tight text-accent"
      title="按已收录的门槛信息，没有发现不符合的硬性条件。最终以学校官方招生简章为准。"
    >
      未发现限制
    </span>
  )
}

/** 空态是这个阶段的主要路径，不是边缘情况 —— 必须给具体的话，不能是「暂无数据」。 */
function EmptyBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-sm border border-dashed border-rule px-4 py-8 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      {lines.map((l) => (
        <p
          key={l}
          className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-ink-muted"
        >
          {l}
        </p>
      ))}
    </div>
  )
}

export default FeederTable
