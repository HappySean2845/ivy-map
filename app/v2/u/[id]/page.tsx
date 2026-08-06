// /v2/u/[id]：单所大学详情。搜索结果、瀑布流点开、分享链接都落在这里。
//
// 这一页是四维评分**唯一能被追问的地方**：卡片上只能给一个多边形，
// 这里必须把每根轴的依据、性质（官方数据还是编辑评估）和来源摆出来。
// 不给这一页，那张雷达图就是个不能追问的黑箱评级 —— PRD §688 明确禁止。

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdmitRateTrend } from '@/components/v2/AdmitRateTrend'
import { ScoreRadar } from '@/components/v2/ScoreRadar'
import { UniversityPathways } from '@/components/v2/UniversityPathways'
import SourcePopover from '@/components/trust/SourcePopover'
import { brandOf, readableInkOn } from '@/lib/v2/brand'
import { countryLabel, profileById, scoreProvenance, viewOf } from '@/lib/v2/profile'
import { PROFILE_DIMS, PROFILE_DIM_DIRECTION, PROFILE_DIM_LABEL } from '@/types/profile'

export function generateStaticParams() {
  return [...profileById.keys()].map((id) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const view = viewOf(id)
  if (!view) return { title: '未收录的大学' }
  const { university: u, profile: p } = view
  return {
    title: `${u.nameCn}画像 · 地理位置、知名领域与四维评分`,
    description:
      p.vibe ??
      `${u.nameCn}（${u.nameEn}）的地理位置、知名领域、官方录取率与四维评分，每项标注依据与来源。`,
  }
}

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const view = viewOf(id)
  if (!view) notFound()

  const { university: u, profile: p, scores, rateSeries } = view
  const brand = brandOf(p.brandColor)
  const provenance = scoreProvenance(scores)

  return (
    <>
      {/* ── 身份 */}
      <header className="pt-8 sm:pt-12">
        <div aria-hidden className="h-[3px] w-full" style={{ background: brand }} />

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {p.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- 本地 SVG 校徽
              <img src={p.logoPath} alt="" aria-hidden className="h-14 w-14 object-contain" />
            ) : (
              <span
                aria-hidden
                className="grid h-14 w-14 shrink-0 place-items-center text-base font-medium tracking-tight"
                style={{ background: brand, color: readableInkOn(p.brandColor) }}
              >
                {p.monogram}
              </span>
            )}
            <div>
              <h1 className="text-[26px] leading-tight tracking-tight sm:text-[40px]">
                {u.nameCn}
              </h1>
              <p className="mt-1 text-sm text-ink/60">{u.nameEn}</p>
              <p className="mt-1.5 text-sm text-ink/60 tnum">
                {countryLabel(u.country)} · {u.city}
                {p.foundedYear != null && ` · ${p.foundedYear} 年建校`}
              </p>
            </div>
          </div>

          {p.websiteUrl && (
            <a
              href={p.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink/70"
            >
              官网 →
            </a>
          )}
        </div>
      </header>

      {/* ── 风格简述 */}
      {p.vibe && (
        <section className="mt-10">
          <p className="label text-ink/40">风格简述</p>
          <hr className="mt-2 border-ink" />
          <p className="mt-4 max-w-3xl text-[17px] leading-relaxed sm:text-[18px]">{p.vibe}</p>
          <p className="mt-2 text-xs text-ink/40">
            由 IVY Map 编辑撰写，不是官方表述，也不是排名结论。
          </p>
        </section>
      )}

      {/* ── 知名领域 */}
      <section className="mt-12">
        <p className="label text-ink/40">知名领域</p>
        <hr className="mt-2 border-ink" />
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {p.strengths.map((strength) => (
            <li key={strength} className="text-lg">
              {strength}
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ink/40">
          这里列的是这所学校在公众认知里最有辨识度的方向，
          <strong className="font-medium">不是任何排名的名次</strong>
          。具体到某个专业的强弱，请查该校院系页与专业排名。
        </p>
      </section>

      {/* ── 四维评分。卡片给形状，这里给依据 */}
      <section className="mt-12">
        <p className="label text-ink/40">四维评分</p>
        <hr className="mt-2 border-ink" />

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="shrink-0">
            <ScoreRadar
              scores={scores}
              brandColor={p.brandColor}
              size={252}
              className="text-ink"
            />
            <p className="mt-2 max-w-[252px] text-[11px] leading-relaxed text-ink/40">
              实心顶点 = 官方数据算出；空心顶点 = 编辑评估；虚线轴 = 暂无数据。 这张图
              <strong className="font-medium">不能按面积大小读</strong>
              ，每根轴的方向见右侧。
            </p>
          </div>

          <dl className="flex-1">
            {PROFILE_DIMS.map((dim) => {
              const score = scores[dim]
              const measured = score.kind === 'measured'
              return (
                <div
                  key={dim}
                  className="border-t border-ink/15 py-4 first:border-t-0 first:pt-0"
                >
                  <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-base">{PROFILE_DIM_LABEL[dim]}</span>
                    <span className="text-2xl tracking-tight tnum">
                      {score.value ?? '—'}
                      {score.value != null && (
                        <span className="ml-0.5 text-xs text-ink/40">/100</span>
                      )}
                    </span>
                    <span className="text-[11px] text-ink/50">
                      {PROFILE_DIM_DIRECTION[dim]}
                    </span>
                    {/* 形状语言：实心方块 = 官方数据，空心 = 编辑评估 */}
                    <span
                      className={`ml-auto inline-flex items-center gap-1.5 text-[11px] ${measured ? 'text-ink/70' : 'text-ink/45'}`}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 border border-ink"
                        style={{ background: measured ? 'var(--ink)' : 'var(--paper)' }}
                      />
                      {measured ? '官方数据' : '编辑评估'}
                    </span>
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink/70">
                    {score.basis}
                    {score.sourceIds.length > 0 && (
                      <span className="ml-2 inline-block">
                        <SourcePopover sourceIds={score.sourceIds}>
                          <span className="text-xs text-ink/60">来源</span>
                        </SourcePopover>
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>

        <p className="mt-4 border-t border-ink/15 pt-3 text-xs leading-relaxed text-ink/50 tnum">
          四项中 {provenance.measured} 项由官方数据算出、{provenance.editorial} 项是编辑评估
          {provenance.missing > 0 && `、${provenance.missing} 项暂无数据`}。 编辑评估会在补齐
          Clery Act 校园安全数据、Common Data Set 国际生占比与住宿数据后逐项替换为可溯源口径。
        </p>
      </section>

      {/* ── 录取率趋势 */}
      <section className="mt-12">
        <AdmitRateTrend
          series={rateSeries}
          brandColor={p.brandColor}
          universityNameCn={u.nameCn}
        />
      </section>

      <UniversityPathways universityId={u.id} universityNameCn={u.nameCn} />

      {/* ── 复核状态。跟 School.verified 同一套纪律：没核对过就说没核对过 */}
      {!p.reviewed && (
        <p className="mt-12 border-t border-ink/15 pt-4 text-xs leading-relaxed text-ink/40">
          这份画像的建校年份、知名领域、风格简述与校色尚未逐条人工复核。
          官方录取率来自已复核的一手来源，可点上方「来源」查看原文。
        </p>
      )}
    </>
  )
}
