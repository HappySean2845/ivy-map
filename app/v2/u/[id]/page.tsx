// /v2/u/[id]：单所大学详情。搜索结果、瀑布流点开、分享链接都落在这里。
//
// 这一页是四维画像指纹**唯一能被追问的地方**：卡片上只能给一个多边形，
// 这里必须把每根轴的依据、性质（官方数据还是编辑评估）和来源摆出来。
// 不给这一页，那张雷达图就是个不能追问的黑箱评级 —— PRD §688 明确禁止。

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdmitRateTrend } from '@/components/v2/AdmitRateTrend'
import { AdmissionCountTrend } from '@/components/v2/AdmissionCountTrend'
import { ProfileFingerprint } from '@/components/v2/ProfileFingerprint'
import { UniversityPathways } from '@/components/v2/UniversityPathways'
import { UniversityRequirements } from '@/components/v2/UniversityRequirements'
import SourcePopover from '@/components/trust/SourcePopover'
import { brandOf, readableInkOn } from '@/lib/v2/brand'
import { countryLabel, profileById, traitProvenance, viewOf } from '@/lib/v2/profile'
import { requirementProfile } from '@/lib/v2/university-enrichment'
import {
  PROFILE_TRAITS,
  PROFILE_TRAIT_DIRECTION,
  PROFILE_TRAIT_LABEL,
  PROFILE_TRAIT_LEVEL_LABEL,
} from '@/types/profile'

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
    title: `${u.nameCn}画像 · 地理位置、知名领域与四维画像指纹`,
    description:
      p.vibe ??
      `${u.nameCn}（${u.nameEn}）的地理位置、知名领域、官方录取率与四维画像指纹，每项标注依据与来源。`,
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

  const { university: u, profile: p, fingerprint, rateSeries, countSeries } = view
  const brand = brandOf(p.brandColor)
  const provenance = traitProvenance(fingerprint)
  const requirements = requirementProfile(u.id)

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

      {/* ── 四维画像指纹。卡片给形状，这里给依据 */}
      <section className="mt-12">
        <p className="label text-ink/40">四维画像指纹</p>
        <hr className="mt-2 border-ink" />

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="shrink-0">
            <ProfileFingerprint
              fingerprint={fingerprint}
              brandColor={p.brandColor}
              size={252}
              labelMode="short"
              className="text-ink"
            />
            <p className="mt-2 max-w-[252px] text-[11px] leading-relaxed text-ink/40">
              轴旁数字为 1–5
              档；实心顶点来自可追溯数据，空心顶点是编辑评估，断轴表示暂无可比数据。四根轴都只表示“这种特征更多”，不计算总分。
            </p>
          </div>

          <dl className="flex-1">
            {PROFILE_TRAITS.map((trait) => {
              const rating = fingerprint[trait]
              const measured = rating.kind === 'measured'
              return (
                <div
                  key={trait}
                  className="border-t border-ink/15 py-4 first:border-t-0 first:pt-0"
                >
                  <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-base">{PROFILE_TRAIT_LABEL[trait]}</span>
                    <span className="text-2xl tracking-tight tnum">
                      {rating.level ?? '—'}
                      {rating.level != null && (
                        <span className="ml-0.5 text-xs text-ink/40">/5</span>
                      )}
                    </span>
                    {rating.level != null && (
                      <span className="text-xs text-ink/65">
                        {PROFILE_TRAIT_LEVEL_LABEL[trait][rating.level]}
                      </span>
                    )}
                    <span className="text-[11px] text-ink/50">
                      {PROFILE_TRAIT_DIRECTION[trait]}
                    </span>
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
                    {rating.basis}
                    {rating.sourceIds.length > 0 && (
                      <span className="ml-2 inline-block">
                        <SourcePopover sourceIds={rating.sourceIds}>
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
          四项中 {provenance.measured} 项来自可追溯数据、{provenance.editorial} 项是五档编辑评估
          {provenance.missing > 0 && `、${provenance.missing} 项暂无可比数据`}。
          录取开放度只描述学校或对应项目公布的整体比例，不是对个人录取概率的预测。
        </p>
      </section>

      {requirements && <UniversityRequirements profile={requirements} />}

      {/* ── 招生趋势：百分比和人数是两种事实，分别呈现。 */}
      <section className="mt-12">
        <div className="space-y-6">
          {rateSeries.length > 0 && (
            <AdmitRateTrend
              series={rateSeries}
              brandColor={p.brandColor}
              universityNameCn={u.nameCn}
            />
          )}
          {countSeries.length > 0 && (
            <AdmissionCountTrend series={countSeries} brandColor={p.brandColor} />
          )}
          {rateSeries.length === 0 && countSeries.length === 0 && (
            <AdmitRateTrend
              series={rateSeries}
              brandColor={p.brandColor}
              universityNameCn={u.nameCn}
            />
          )}
        </div>
      </section>

      <UniversityPathways universityId={u.id} universityNameCn={u.nameCn} />

      {/* ── 复核状态。跟 School.verified 同一套纪律：没核对过就说没核对过 */}
      {!p.reviewed && (
        <p className="mt-12 border-t border-ink/15 pt-4 text-xs leading-relaxed text-ink/40">
          这份画像的建校年份、知名领域、风格简述、校色与三个编辑档位尚未逐条人工复核。
          官方录取率或招生人数来自已复核来源，可点上方「来源」查看原文。
        </p>
      )}
    </>
  )
}
