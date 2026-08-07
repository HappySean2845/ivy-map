// snapshot 卡片。大学目录与旧刷卡组件共用；当前产品只展示目录形态。
//
// 布局按手写稿：左上 logo、右边校名、中间简述与强项、右侧画像指纹、左下官网跳转。
// 学校品牌色只做识别，页面层级统一由 IVY Map 的瓶墨绿、暖白与石灰承担。

import Link from 'next/link'

import { ProfileFingerprint } from '@/components/v2/ProfileFingerprint'
import { ShortlistButton } from '@/components/v2/ShortlistButton'
import { brandOf, readableInkOn } from '@/lib/v2/brand'
import {
  admissionCountRateNote,
  admissionCountSeriesLabel,
  formatAdmissionCount,
  latestReviewedAdmissionCountPoint,
} from '@/lib/v2/admission-counts'
import {
  admissionRatePeriodLabel,
  admissionRateScopeNote,
  admissionRateSeriesLabel,
  formatAdmissionRate,
} from '@/lib/v2/admission-rates'
import { countryLabel, type UniversityView } from '@/lib/v2/profile'

export function UniversityCard({
  view,
  variant = 'deck',
  className = '',
}: {
  view: UniversityView
  /** deck 是旧刷卡组件的兼容形态；grid 是当前首页目录 */
  variant?: 'deck' | 'grid'
  className?: string
}) {
  const {
    university: u,
    profile: p,
    fingerprint,
    trend,
    primaryRateSeries,
    primaryCountSeries,
  } = view
  const brand = brandOf(p.brandColor)
  const latest = trend.at(-1)
  const latestCount = latestReviewedAdmissionCountPoint(primaryCountSeries)
  const compact = variant === 'grid'

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-leaf hover:shadow-[var(--shadow-card)] ${className}`}
    >
      {/* 校色带 —— 全卡唯一的大面积彩色，纯装饰 */}
      <div aria-hidden className="h-[3px] shrink-0" style={{ background: brand }} />

      {/* ── 身份。shrink-0：卡片是固定高度的，390px 上内容一多，
             不锁住 header 和 footer 就会被中间区挤压变形 */}
      <header className="flex shrink-0 items-start gap-3 px-4 pt-4 sm:px-5">
        {p.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- 本地 SVG 校徽，不需要 Image 的优化管线
          <img
            src={p.logoPath}
            alt=""
            aria-hidden
            className={
              compact
                ? 'h-10 w-10 shrink-0 rounded-lg border border-line bg-cream p-1.5 object-contain'
                : 'h-12 w-12 shrink-0 rounded-lg border border-line bg-cream p-1.5 object-contain'
            }
          />
        ) : (
          <span
            aria-hidden
            className={`grid shrink-0 place-items-center rounded-lg font-medium tracking-tight ${
              compact ? 'h-10 w-10 text-[11px]' : 'h-12 w-12 text-[13px]'
            }`}
            style={{ background: brand, color: readableInkOn(p.brandColor) }}
          >
            {p.monogram}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3
            className={compact ? 'truncate text-[17px] leading-tight' : 'text-xl leading-tight'}
          >
            {u.nameCn}
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink/50">{u.nameEn}</p>
          <p className="mt-1 text-xs text-ink/55 tnum">
            {countryLabel(u.country)} · {u.city}
            {p.foundedYear != null && ` · ${p.foundedYear} 年建校`}
          </p>
        </div>
      </header>

      {/* ── 风格简述。标注是编辑撰写，不和官方数据混为一谈 */}
      {p.vibe && (
        <div className="mx-4 mt-4 shrink-0 rounded-lg bg-cream px-3.5 py-3 sm:mx-5">
          {/* 刷卡卡片高度固定，简述再长也不能把下面的评分挤出去 */}
          <p
            className={`leading-relaxed ${compact ? 'line-clamp-3 text-[13px]' : 'line-clamp-4 text-sm'}`}
          >
            {p.vibe}
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-leaf">编辑印象</p>
        </div>
      )}

      {/* ── 强项专业 + 画像指纹。min-h-0 让这一块承担全部压缩，
             溢出的部分被 overflow-hidden 裁掉，而不是把 footer 顶出去 */}
      <div className="mt-4 flex min-h-0 flex-1 items-start gap-3 overflow-hidden px-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="label text-leaf">知名领域</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {p.strengths.map((s) => (
              <li
                key={s}
                className={`rounded-md bg-cream px-2.5 py-1 ${compact ? 'text-[12px]' : 'text-sm'}`}
              >
                {s}
              </li>
            ))}
          </ul>

          {/* 招生主指标：有率显示率；没有可靠分母时显示人数，绝不反推百分比。 */}
          <div className="mt-3">
            <p className="label text-leaf">
              {primaryRateSeries
                ? admissionRateSeriesLabel(primaryRateSeries)
                : primaryCountSeries
                  ? admissionCountSeriesLabel()
                  : '官方录取率'}
            </p>
            {latest ? (
              <>
                <p className="mt-1 text-xl font-semibold tracking-tight text-forest tnum">
                  {formatAdmissionRate(latest)}
                  <span className="ml-1.5 text-[11px] text-ink/50">
                    {admissionRatePeriodLabel(latest)}
                  </span>
                </p>
                {primaryRateSeries && (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-ink/45">
                    {admissionRateScopeNote(primaryRateSeries)}
                  </p>
                )}
              </>
            ) : latestCount && primaryCountSeries ? (
              <>
                <p className="mt-1 text-xl font-semibold tracking-tight text-forest tnum">
                  {formatAdmissionCount(latestCount)}
                  <span className="ml-1.5 text-[11px] text-ink/50">
                    {latestCount.academicYearStart} 年
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-ink/45">
                  {admissionCountRateNote(primaryCountSeries)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink/40">尚未收录</p>
            )}
          </div>
        </div>

        <div className="shrink-0 rounded-lg bg-paper p-1">
          <ProfileFingerprint
            fingerprint={fingerprint}
            brandColor={p.brandColor}
            size={compact ? 132 : 144}
            labelMode="short"
            className="text-forest"
          />
        </div>
      </div>

      {/* ── 左下角官网跳转 + 详情。shrink-0：官网链接是手写稿明确要的，
             不能因为上面内容多就被挤掉 */}
      <footer className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-3.5 sm:px-5">
        {p.websiteUrl ? (
          <a
            href={p.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink/55"
          >
            官网 →
          </a>
        ) : (
          <span className="text-xs text-ink/40">官网待补</span>
        )}

        <div className="flex items-center gap-2">
          <ShortlistButton
            universityId={u.id}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold"
            labels={{ on: '已收藏', off: '收藏' }}
          />
          <Link
            href={`/v2/u/${u.id}`}
            className="rounded-lg bg-forest px-3.5 py-2 text-xs font-semibold text-paper transition-colors hover:bg-forest-deep hover:no-underline"
          >
            {compact ? '看详情 →' : '看画像依据与趋势 →'}
          </Link>
        </div>
      </footer>
    </article>
  )
}

export default UniversityCard
