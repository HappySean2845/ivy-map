import type { Metadata } from 'next'
import Link from 'next/link'

import { Nav } from '@/components/v2/Nav'
import { UniversityBrowser } from '@/components/v2/UniversityBrowser'
import { courseAttributionData } from '@/lib/v2/course-attribution'
import { profileById } from '@/lib/v2/profile'
import { PROFILE_TRAITS, PROFILE_TRAIT_DIRECTION, PROFILE_TRAIT_LABEL } from '@/types/profile'

export const metadata: Metadata = {
  title: '大学画像、课程路径与国内生源校',
  description:
    '浏览大学画像、官方录取率与四维画像指纹，再查看 AP、IB、A-Level 课程路径和对应的国内高中去向证据。',
}

export default function UniversitiesPage() {
  const linkedUniversityCount = new Set(
    courseAttributionData.observations.map((observation) => observation.universityId),
  ).size

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">
        <header className="soft-panel relative isolate mt-5 overflow-hidden px-5 py-10 sm:mt-7 sm:px-9 sm:py-14 lg:px-14 lg:py-16">
          <div
            aria-hidden="true"
            className="scaffold pointer-events-none absolute -right-10 -top-8 z-0 select-none opacity-[0.055] sm:-top-20"
          >
            IVY
          </div>

          <div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
            <div>
              <p className="eyebrow-chip bg-surface">IVY MAP · 大学画像</p>
              <h1 className="mt-7 max-w-4xl text-[clamp(2.7rem,6vw,5.8rem)] leading-[0.94] tracking-[-0.05em] text-forest-deep">
                先看想去的大学
                <br />
                再看通往它的路
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-ink/65 sm:text-lg">
                每张卡片先讲清大学本身：位置、知名领域、官方录取数据与四维画像。进入详情后，再沿着课程路径反推国内哪些高中有可查的去向记录。
              </p>
            </div>

            <aside className="rounded-[24px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] sm:p-6">
              <p className="label text-leaf">我们怎么表达数据</p>
              <p className="mt-3 text-sm leading-relaxed text-ink/62">
                已证实、方向性推断、来源未拆分会分开显示。没有拆到学部的记录只作为去向证据，不拿去计算分赛道人均命中率。
              </p>
              <Link href="/v2/glossary" className="secondary-action mt-5 min-h-10 text-xs">
                先看课程与考试术语 <span aria-hidden>→</span>
              </Link>
            </aside>
          </div>

          <dl className="relative z-10 mt-10 flex flex-wrap gap-2 text-xs tnum">
            <StatChip value={profileById.size} label="所大学画像" />
            <StatChip value={linkedUniversityCount} label="所大学已有高中数据" />
            <StatChip value={courseAttributionData.schools.length} label="所国内高中" />
            <StatChip value={courseAttributionData.observations.length} label="条逐年记录" />
          </dl>
        </header>

        <section className="mt-14 sm:mt-20">
          <div className="grid items-end gap-5 lg:grid-cols-[1fr_0.72fr]">
            <div>
              <p className="label text-leaf">全部大学</p>
              <h2 className="mt-3 text-3xl leading-tight text-forest-deep sm:text-[42px]">
                {profileById.size} 张大学卡片
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/55">
                画像指纹使用五档而不是百分制，只描述学校差异，不计算总分，也不暗示绝对好坏。
              </p>
            </div>
            <div className="rounded-[20px] bg-cream p-4 sm:p-5">
              <p className="label text-leaf">读图提示</p>
              <p className="mt-2 text-xs leading-relaxed text-ink/58">
                实心顶点来自官方数据，空心顶点为编辑评估，断轴表示暂无可比数据。
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-line bg-surface p-5 sm:p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PROFILE_TRAITS.map((trait) => (
                <div key={trait} className="rounded-2xl bg-mint px-4 py-3">
                  <dt className="text-sm font-semibold text-forest">
                    {PROFILE_TRAIT_LABEL[trait]}
                  </dt>
                  <dd className="mt-1 text-xs leading-relaxed text-ink/52">
                    {PROFILE_TRAIT_DIRECTION[trait]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-7">
            <UniversityBrowser />
          </div>
        </section>
      </main>
    </>
  )
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2">
      <dt className="text-lg font-semibold text-forest">{value}</dt>
      <dd className="text-ink/52">{label}</dd>
    </div>
  )
}
