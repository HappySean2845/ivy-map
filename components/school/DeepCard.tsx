'use client'

// 学校深度卡片（PRD US-3.1）。
//
// 四段的顺序对应家长的决策顺序，**不得调换**：
//   1. 它送谁去了哪   —— 先看结果，值不值得研究
//   2. 你进得去吗     —— 再看资格，这一段为必填，缺数据也要显式说缺
//   3. 要花多少钱     —— 然后看代价
//   4. 下一步做什么   —— 最后才是动作，且每一项都要能回溯到第 2 段的字段
//
// 之所以是 client 组件：四段要能各自折叠，且移动端默认只展开第一段。
// 折叠状态先按移动端渲染（只开第一段），挂载后再按视口放开，避免水合不一致。

import { useState, useSyncExternalStore } from 'react'
import { BasisNote } from '@/components/trust/BasisNote'
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge'
import { SourcePopover } from '@/components/trust/SourcePopover'
import { SCHOOL_TYPE_LABEL, TRACK_LABEL } from '@/types'
import { CorrectionLink } from './CorrectionLink'
import {
  COST_EXCLUDED,
  DASH,
  actionItems,
  costView,
  fmtCny,
  fmtNum,
  fmtPct,
  fmtWan,
  gateIsEmpty,
  gateItems,
  schoolProfile,
  targetStat,
} from './schoolData'

const TOP_N = 10

// 视口宽度只用来决定「四段的默认展开状态」。
// 服务端快照固定为 false（= 按移动端渲染，只展开第一段），客户端再同步真实视口，
// 这样水合前后的 HTML 一致，桌面端挂载后自动展开其余三段。
const WIDE_QUERY = '(min-width: 768px)'

function subscribeWide(onChange: () => void): () => void {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

// ---------------------------------------------------------------------------
// 小件

/**
 * 可溯源的数值。有来源就包 SourcePopover（US-7.1：每个录取数值可点击展开出处），
 * 没来源就明确标「来源待补充」——不假装有出处，也不悄悄展示。
 */
function Val({
  sourceIds,
  children,
  className = '',
}: {
  sourceIds: string[]
  children: React.ReactNode
  className?: string
}) {
  if (sourceIds.length === 0) {
    return (
      <span
        className={`text-neutral-500 dark:text-neutral-400 ${className}`}
        title="这项数据尚未关联来源"
      >
        {children}
      </span>
    )
  }
  return (
    <SourcePopover sourceIds={sourceIds}>
      <span
        className={`cursor-pointer underline decoration-dotted decoration-neutral-400 underline-offset-4 ${className}`}
      >
        {children}
      </span>
    </SourcePopover>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] leading-4 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
      {children}
    </span>
  )
}

/** 缺数据的统一呈现。区分「暂未收录」和「该校未公布」是 PRD §9 的硬性要求。 */
function Missing({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-neutral-400 dark:text-neutral-500">{children}</span>
  )
}

function Section({
  index,
  title,
  lead,
  summary,
  open,
  onToggle,
  children,
}: {
  index: number
  title: string
  lead: string
  /** 折叠状态下也要能看出这一段有没有内容 */
  summary: string
  open: boolean
  onToggle(): void
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-neutral-200 dark:border-neutral-800">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-start gap-3 py-4 text-left"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {index}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{title}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              {open ? lead : summary}
            </span>
          </span>
          <span
            className={`mt-1 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>
      </h3>
      {open && <div className="pb-6">{children}</div>}
    </section>
  )
}

// ---------------------------------------------------------------------------

export function DeepCard({
  schoolId,
  universityId,
}: {
  schoolId: string
  universityId: string | null
}) {
  // 移动端默认只展开第一段，桌面端四段全开（US-3.1）。
  // 用户手动折叠过的段落记在 overrides 里，之后不再被视口变化覆盖。
  const isWide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  )
  const [overrides, setOverrides] = useState<(boolean | null)[]>([
    null,
    null,
    null,
    null,
  ])
  const open = [0, 1, 2, 3].map((i) => overrides[i] ?? (i === 0 ? true : isWide))
  const toggle = (i: number) =>
    setOverrides((prev) => prev.map((v, idx) => (idx === i ? !open[idx] : v)))

  const profile = schoolProfile(schoolId)

  // 学校不在收录范围内。这属于数据不一致，宁可说清楚也不渲染半张卡片。
  if (!profile) {
    return (
      <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <p className="font-medium">没有找到这所学校</p>
        <p className="mt-1.5 text-neutral-500">
          它可能还不在当前收录范围内。你可以通过下面的入口把它提交给我们。
        </p>
        <a
          href="https://example.com/ivy-map-correction"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-neutral-600 underline underline-offset-4 dark:text-neutral-400"
        >
          提交学校 →
        </a>
      </div>
    )
  }

  const { school } = profile
  const stat = targetStat(schoolId, universityId)
  const gates = gateItems(school)
  const gateEmpty = gateIsEmpty(school)
  const actions = actionItems(school)
  const cost = costView(school)
  const top = profile.destinations.slice(0, TOP_N)

  return (
    <article className="text-sm">
      {/* ---- 抬头 ---- */}
      <header className="pb-4">
        <h2 className="text-lg font-semibold tracking-tight">{school.nameCn}</h2>
        {school.nameEn && (
          <p className="mt-0.5 text-xs text-neutral-500">{school.nameEn}</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Tag>
            {profile.cityName}
            {school.district ? ` · ${school.district}` : ''}
          </Tag>
          <Tag>{SCHOOL_TYPE_LABEL[school.type]}</Tag>
          {school.tracks.map((t) => (
            <Tag key={t}>{TRACK_LABEL[t]}</Tag>
          ))}
          {!school.verified && <Tag>学校信息待人工核对</Tag>}
        </div>
      </header>

      {/* ---- 第一段：它送谁去了哪 ---- */}
      <Section
        index={1}
        title="它送谁去了哪"
        lead="近三年的去向大学、赛道分布、毕业生规模与三年趋势"
        summary={
          profile.hasAnyAdmission
            ? `近三年收录 ${profile.destinations.length} 所去向大学`
            : '暂未收录这所学校的录取记录'
        }
        open={open[0]}
        onToggle={() => toggle(0)}
      >
        {stat && (
          <div className="mb-5 rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">
              对 {stat.universityName}（加权口径，近三年）
            </div>
            {stat.volume == null ? (
              <p className="mt-2 text-neutral-500">
                暂未收录这所学校向 {stat.universityName} 输送学生的记录。
                <span className="text-neutral-400">
                  {' '}
                  这不等于「没有录取」，只表示我们还没找到可溯源的公开数据。
                </span>
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <div className="font-mono text-xl tabular-nums">
                    <Val sourceIds={stat.sourceIds}>{fmtNum(stat.volume)}</Val>
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    加权录取人数
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xl tabular-nums">
                    {stat.density == null ? (
                      <Missing>{DASH}</Missing>
                    ) : (
                      <Val sourceIds={stat.sourceIds}>{fmtPct(stat.density)}</Val>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    人均密度
                    {stat.denominatorMissing && (
                      <span className="ml-1 text-neutral-400">· 分母缺失</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge
                    level={stat.confidence}
                    estimated={stat.basis === 'estimated'}
                  />
                  <BasisNote basis={stat.basis} />
                </div>
              </div>
            )}
            {stat.denominatorMissing && stat.volume != null && (
              <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                该赛道的毕业生数（人均密度的分母）尚未收录，密度不做估算。
                <CorrectionLink school={school} field="graduates" />
              </p>
            )}
          </div>
        )}

        {/* Top 10 去向 */}
        {profile.hasAnyAdmission ? (
          <>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h4 className="text-xs font-medium text-neutral-500">
                {profile.destinations.length > TOP_N
                  ? `近三年去向大学 Top ${TOP_N}`
                  : `近三年去向大学（收录 ${profile.destinations.length} 所）`}
              </h4>
              <span className="text-[11px] text-neutral-400">
                人数为近三年合计，未做时间加权
              </span>
            </div>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="px-1 py-1.5 font-normal">大学</th>
                    <th className="px-1 py-1.5 text-right font-normal">近三年</th>
                    {profile.years.map((y) => (
                      <th key={y} className="px-1 py-1.5 text-right font-normal tabular-nums">
                        {y}
                      </th>
                    ))}
                    <th className="px-1 py-1.5 font-normal">口径</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((d) => (
                    <tr
                      key={d.universityId}
                      className={`border-t border-neutral-100 dark:border-neutral-900 ${
                        d.universityId === universityId
                          ? 'bg-neutral-50 dark:bg-neutral-900/50'
                          : ''
                      }`}
                    >
                      <td className="px-1 py-2">
                        <span className="font-medium">{d.nameCn}</span>
                        <span className="ml-1.5 text-[11px] text-neutral-400">
                          {d.tracks.map((t) => TRACK_LABEL[t]).join('/')}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right font-mono tabular-nums">
                        <Val sourceIds={d.sourceIds}>{fmtNum(d.admits)}</Val>
                      </td>
                      {profile.years.map((y) => {
                        const cell = d.byYear.find((b) => b.year === y)
                        return (
                          <td
                            key={y}
                            className="px-1 py-2 text-right font-mono tabular-nums text-neutral-500"
                          >
                            {cell?.admits == null ? (
                              <Missing>{DASH}</Missing>
                            ) : (
                              fmtNum(cell.admits)
                            )}
                          </td>
                        )
                      })}
                      <td className="px-1 py-2">
                        <span className="flex items-center gap-1.5">
                          <ConfidenceBadge
                            level={d.confidence}
                            estimated={d.basis === 'estimated'}
                          />
                          <BasisNote basis={d.basis} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 赛道分布 */}
            <h4 className="mt-6 mb-2 text-xs font-medium text-neutral-500">
              赛道分布（近三年收录到的录取人数）
            </h4>
            <ul className="flex flex-wrap gap-2">
              {profile.trackMix.map((t) => (
                <li
                  key={t.track}
                  className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs dark:border-neutral-800"
                >
                  {TRACK_LABEL[t.track]}
                  <span className="ml-1.5 font-mono tabular-nums">
                    {fmtNum(t.admits)} 人
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
            <p className="font-medium">暂未收录这所学校的录取记录</p>
            <p className="mt-1.5 text-neutral-500">
              我们只收录有公开出处的录取数据（学校官方发布、公开媒体报道、公开行业报告）。
              查不到出处的一律不入库，所以这里是空的 ——
              它表示「我们还没收到」，不表示这所学校没有录取。
            </p>
            <div className="mt-3">
              <CorrectionLink school={school} field="admissions" />
            </div>
          </div>
        )}

        {/* 毕业生规模与三年趋势 */}
        <h4 className="mt-6 mb-2 text-xs font-medium text-neutral-500">
          毕业生规模与三年趋势
        </h4>
        {profile.years.length === 0 ? (
          <Missing>全库还没有任何年份的录取数据，趋势无从谈起。</Missing>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[18rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="px-1 py-1.5 font-normal">届</th>
                    <th className="px-1 py-1.5 text-right font-normal">收录录取人数</th>
                    <th className="px-1 py-1.5 text-right font-normal">该届毕业生</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.byYear.map((y) => (
                    <tr
                      key={y.year}
                      className="border-t border-neutral-100 dark:border-neutral-900"
                    >
                      <td className="px-1 py-2 font-mono tabular-nums">{y.year}</td>
                      <td className="px-1 py-2 text-right font-mono tabular-nums">
                        {y.admits == null ? <Missing>{DASH}</Missing> : fmtNum(y.admits)}
                      </td>
                      <td className="px-1 py-2 text-right font-mono tabular-nums">
                        {y.graduates == null ? (
                          <Missing>{DASH}</Missing>
                        ) : (
                          <Val sourceIds={y.sourceIds}>
                            {fmtNum(y.graduates)}
                            {y.graduateTracks.length > 0 && (
                              <span className="ml-1 text-[11px] text-neutral-400">
                                {y.graduateTracks.map((t) => TRACK_LABEL[t]).join('/')}
                              </span>
                            )}
                          </Val>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {profile.byYear.every((y) => y.graduates == null) && (
              <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                毕业生规模（各赛道分别统计）尚未收录。它是人均密度的分母，缺了就只能显示
                「{DASH}」，我们不猜分母。
                <CorrectionLink school={school} field="graduates" />
              </p>
            )}
            {profile.byYear.filter((y) => y.admits != null).length < 2 && (
              <p className="mt-2 text-xs text-neutral-500">
                目前只收录到{' '}
                {profile.byYear.filter((y) => y.admits != null).length} 个年份的数据，
                还看不出趋势。
              </p>
            )}
          </>
        )}
      </Section>

      {/* ---- 第二段：你进得去吗（必填段）---- */}
      <Section
        index={2}
        title="你进得去吗"
        lead="国籍/身份、学籍户籍、开放年级、入学考试、报名窗口"
        summary={gateEmpty ? '门槛信息待补充' : '完整门槛详情'}
        open={open[1]}
        onToggle={() => toggle(1)}
      >
        {gateEmpty && (
          <div className="mb-4 rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
            <p className="font-medium">门槛信息待补充</p>
            <p className="mt-1.5 text-neutral-500">
              这所学校的招生资格要求我们还没有整理到可引用的出处。
              <strong className="font-medium text-neutral-700 dark:text-neutral-200">
                门槛信息缺失不等于「可以申请」
              </strong>
              —— 在补上之前，请以学校官方招生简章为准。
            </p>
            <div className="mt-3">
              <CorrectionLink school={school} field="requirement" />
            </div>
          </div>
        )}

        <dl className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {gates.map((g) => (
            <div
              key={g.key}
              className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 sm:grid-cols-[9rem_1fr]"
            >
              <dt className="text-xs text-neutral-500">{g.label}</dt>
              <dd className="min-w-0">
                {g.known ? (
                  <span>{g.value}</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <Missing>{g.value}</Missing>
                    <CorrectionLink school={school} field={g.key} />
                  </span>
                )}
                {g.hint && (
                  <span className="mt-0.5 block text-xs text-neutral-400">{g.hint}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {school.requirement.sourceId ? (
            <SourcePopover sourceIds={[school.requirement.sourceId]}>
              <span className="cursor-pointer underline decoration-dotted underline-offset-4">
                门槛数据的来源与更新日期
              </span>
            </SourcePopover>
          ) : (
            <Missing>这组门槛数据尚未关联来源，请以学校官方招生简章为准。</Missing>
          )}
          <CorrectionLink school={school} field="requirement" />
        </p>
      </Section>

      {/* ---- 第三段：要花多少钱 ---- */}
      <Section
        index={3}
        title="要花多少钱"
        lead="学费、住宿、三年总投入估算区间，以及明确未包含的项目"
        summary={
          cost.tuition == null ? '学费待补充' : `学费 ${fmtWan(cost.tuition)}/年 起算`
        }
        open={open[2]}
        onToggle={() => toggle(2)}
      >
        <dl className="divide-y divide-neutral-100 dark:divide-neutral-900">
          <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 sm:grid-cols-[9rem_1fr]">
            <dt className="text-xs text-neutral-500">学费</dt>
            <dd>
              {cost.tuition == null ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Missing>待补充</Missing>
                  <CorrectionLink school={school} field="tuition" />
                </span>
              ) : (
                <>
                  <span className="font-mono tabular-nums">
                    约 {fmtWan(cost.tuition)} / 学年
                  </span>
                  <span className="ml-2 text-xs text-neutral-400">
                    （{fmtCny(cost.tuition)}，学校公示口径）
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 sm:grid-cols-[9rem_1fr]">
            <dt className="text-xs text-neutral-500">住宿</dt>
            <dd>
              {cost.boarding == null ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Missing>待补充</Missing>
                  <CorrectionLink school={school} field="boarding" />
                </span>
              ) : (
                <>
                  <span>{cost.boarding ? '提供住宿' : '不提供住宿'}</span>
                  <span className="ml-2 text-xs text-neutral-400">
                    住宿费用未收录，不做估算
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 sm:grid-cols-[9rem_1fr]">
            <dt className="text-xs text-neutral-500">三年总投入</dt>
            <dd>
              {cost.threeYearLow == null ? (
                <Missing>学费未收录，无法给出区间</Missing>
              ) : (
                <>
                  <span className="font-mono tabular-nums">
                    {fmtWan(cost.threeYearLow)} 起
                  </span>
                  <span className="ml-2 text-xs text-neutral-400">上限待补充</span>
                </>
              )}
            </dd>
          </div>
        </dl>

        <details className="mt-3 text-xs text-neutral-500">
          <summary className="cursor-pointer py-1.5 select-none">估算口径</summary>
          <div className="pt-1 pb-2 leading-relaxed">
            下限 = 学校公示的当年学费 × 3，按学费不变计算，且不含住宿。
            上限取决于住宿费与逐年学费调整，这两项当前没有可引用的公示数据，
            因此不给上限 —— 宁可只给一端，也不编一个看起来完整的区间。
            全部金额按区间理解，不是精确报价。
          </div>
        </details>

        <div className="mt-4 rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-800">
          <h4 className="text-xs font-medium">以上金额未包含</h4>
          <ul className="mt-2 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2">
            {COST_EXCLUDED.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] text-neutral-400">
            这些项目各家差异极大且没有公示金额，因此只列名目、不估金额。
          </p>
        </div>

        <p className="mt-3 text-[11px] text-neutral-400">
          费用与录取结果在本站分开呈现，两者之间不做任何形式的换算。
        </p>
      </Section>

      {/* ---- 第四段：下一步做什么 ---- */}
      <Section
        index={4}
        title="下一步做什么"
        lead="每一项都来自第 2 段的门槛数据，不做自由发挥的建议"
        summary={actions.length ? `${actions.length} 项可执行动作` : '没有门槛数据，给不出动作'}
        open={open[3]}
        onToggle={() => toggle(3)}
      >
        {actions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
            <p className="font-medium">这里暂时没有可执行的下一步</p>
            <p className="mt-1.5 text-neutral-500">
              这一段的每一项都必须由第 2 段的门槛字段推出来。这所学校的门槛数据还没收录，
              所以我们不写「多参加活动」「提前准备面试」这类放之四海而皆准的建议 ——
              那种话对你的决策没有任何帮助。
            </p>
            <div className="mt-3">
              <CorrectionLink school={school} field="requirement" />
            </div>
          </div>
        ) : (
          <ol className="space-y-3">
            {actions.map((a, i) => (
              <li
                key={a.title}
                className="rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-800"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-neutral-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-1 text-neutral-500">{a.detail}</p>
                    <p className="mt-1.5 text-[11px] text-neutral-400">
                      依据：第 2 段 · {a.from}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
          以上动作只是把已收录的门槛信息翻译成时间顺序，不构成升学建议。
          具体报名与考试安排以学校官方公告为准。
        </p>
      </Section>
    </article>
  )
}

export default DeepCard
