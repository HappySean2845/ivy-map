// snapshot 卡片。刷卡、瀑布流、详情页顶部三处共用。
//
// 布局按手写稿：左上 logo、右边校名、中间简述与强项、右侧多边形评分、左下官网跳转。
//
// 校色只出现在两处 —— 顶部 3px 色带和 monogram 方块底（见 docs/design-system-v2.md）。
// 正文、边框、数字全部黑白。这不是保守：这张卡的主要用途是被截图发家长群，
// 微信压缩之后校色会失真，所有信息必须在纯黑白下依然完整。

import Link from 'next/link'

import { ScoreRadar } from '@/components/v2/ScoreRadar'
import { brandOf, readableInkOn } from '@/lib/v2/brand'
import { countryLabel, schoolYearLabel, type UniversityView } from '@/lib/v2/profile'
import { PROFILE_DIM_LABEL } from '@/types/profile'

export function UniversityCard({
  view,
  variant = 'deck',
  className = '',
}: {
  view: UniversityView
  /** deck 刷卡（信息最全）· grid 瀑布流（压缩到能扫的密度） */
  variant?: 'deck' | 'grid'
  className?: string
}) {
  const { university: u, profile: p, scores, trend } = view
  const brand = brandOf(p.brandColor)
  const latest = trend.at(-1)
  const compact = variant === 'grid'

  return (
    <article
      className={`flex h-full flex-col overflow-hidden border border-ink bg-paper ${className}`}
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
            className={compact ? 'h-9 w-9 shrink-0 object-contain' : 'h-11 w-11 shrink-0 object-contain'}
          />
        ) : (
          <span
            aria-hidden
            className={`grid shrink-0 place-items-center font-medium tracking-tight ${
              compact ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-[13px]'
            }`}
            style={{ background: brand, color: readableInkOn(p.brandColor) }}
          >
            {p.monogram}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className={compact ? 'truncate text-[17px] leading-tight' : 'text-xl leading-tight'}>
            {u.nameCn}
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink/50">{u.nameEn}</p>
          <p className="mt-1 text-xs text-ink/60 tnum">
            {countryLabel(u.country)} · {u.city}
            {p.foundedYear != null && ` · ${p.foundedYear} 年建校`}
          </p>
        </div>
      </header>

      {/* ── 风格简述。标注是编辑撰写，不和官方数据混为一谈 */}
      {p.vibe && (
        <div className="mt-3 shrink-0 border-t border-ink/15 px-4 pt-3 sm:px-5">
          {/* 刷卡卡片高度固定，简述再长也不能把下面的评分挤出去 */}
          <p className={`leading-relaxed ${compact ? 'line-clamp-3 text-[13px]' : 'line-clamp-4 text-sm'}`}>
            {p.vibe}
          </p>
          <p className="mt-1.5 text-[10px] text-ink/40">编辑撰写</p>
        </div>
      )}

      {/* ── 强项专业 + 雷达图。min-h-0 让这一块承担全部压缩，
             溢出的部分被 overflow-hidden 裁掉，而不是把 footer 顶出去 */}
      <div className="mt-3 flex min-h-0 flex-1 items-start gap-3 overflow-hidden border-t border-ink/15 px-4 pt-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="label text-ink/40">知名领域</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
            {p.strengths.map((s) => (
              <li key={s} className={compact ? 'text-[13px]' : 'text-sm'}>
                {s}
              </li>
            ))}
          </ul>

          {/* 录取率：只有一个学年的数据时就显示这个数，不画一条没有斜率的线 */}
          <div className="mt-3">
            <p className="label text-ink/40">官方录取率</p>
            {latest ? (
              <p className="mt-1 text-lg tracking-tight tnum">
                {(latest.rate * 100).toFixed(1)}%
                <span className="ml-1.5 text-[11px] text-ink/50">
                  {schoolYearLabel(latest.academicYearStart)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/40">尚未收录</p>
            )}
          </div>
        </div>

        <ScoreRadar
          scores={scores}
          brandColor={p.brandColor}
          size={compact ? 116 : 140}
          showLabels={!compact}
          className="shrink-0 text-ink"
        />
      </div>

      {/* 紧凑模式没有标签，用一行字说明四根轴是什么 */}
      {compact && (
        <p className="mt-2 px-4 text-[10px] leading-relaxed text-ink/40 sm:px-5">
          上起顺时针：
          {(['selectivity', 'affinity', 'safety', 'facilities'] as const)
            .map((d) => PROFILE_DIM_LABEL[d])
            .join(' · ')}
        </p>
      )}

      {/* ── 左下角官网跳转 + 详情。shrink-0：官网链接是手写稿明确要的，
             不能因为上面内容多就被挤掉 */}
      <footer className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-ink px-4 py-3 sm:px-5">
        {p.websiteUrl ? (
          <a
            href={p.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink/70"
            // 刷卡时点链接不该被判定成划卡
            onPointerDown={(e) => e.stopPropagation()}
          >
            官网 →
          </a>
        ) : (
          <span className="text-xs text-ink/40">官网待补</span>
        )}

        <Link
          href={`/v2/u/${u.id}`}
          className="text-xs text-ink/70"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {compact ? '看详情 →' : '看评分依据与趋势 →'}
        </Link>
      </footer>
    </article>
  )
}

export default UniversityCard
