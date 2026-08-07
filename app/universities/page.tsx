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
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <header className="relative isolate pt-10 sm:pt-16">
          <div
            aria-hidden="true"
            className="scaffold pointer-events-none absolute -top-8 -left-6 z-0 select-none sm:-top-20"
          >
            IVY
          </div>

          <div className="relative z-10">
            <p className="label text-ink/40">IVY MAP · 大学画像</p>
            <h1 className="mt-5 max-w-4xl text-[32px] leading-[1.05] tracking-tight sm:text-[56px]">
              先看想去的大学
              <br />
              再看谁在往那里送人
            </h1>

            <hr className="mt-8 border-ink" />

            <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-12">
              <p className="max-w-xl text-[17px] leading-relaxed sm:text-[18px]">
                每张卡片先讲清大学本身：位置、知名领域、官方录取率与四维画像指纹。
                点进详情，再沿着
                <strong className="font-medium">课程路径</strong>反推国内哪些高中有
                可查的去向记录，以及这些录取能不能归到 AP、IB 或 A-Level 学部。
              </p>
              <p className="border-l border-ink pl-4 text-sm leading-relaxed text-ink/60">
                已证实、方向性推断、来源未拆分会分开显示。来源没有拆到学部的记录只做去向证据，
                不拿去算分赛道人均命中率。
              </p>
            </div>

            <p className="mt-8 text-xs text-ink/40 tnum">
              {profileById.size} 所大学画像 · {linkedUniversityCount} 所大学已有国内高中数据 ·{' '}
              {courseAttributionData.schools.length} 所高中 ·{' '}
              {courseAttributionData.observations.length} 条逐年记录 ·{' '}
              <Link href="/v2/glossary" className="text-ink/60">
                先看课程与考试术语 →
              </Link>
            </p>
          </div>
        </header>

        <section className="mt-14 sm:mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label text-ink/40">全部大学</p>
              <h2 className="mt-3 text-2xl leading-tight sm:text-[32px]">
                {profileById.size} 张大学卡片，全部展开
              </h2>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-ink/45">
              画像指纹使用五档而不是百分制，只描述学校差异，不计算总分。
            </p>
          </div>
          <hr className="mt-4 border-ink" />

          <div className="border-b border-ink/15 py-3">
            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              {PROFILE_TRAITS.map((trait) => (
                <div key={trait} className="flex items-baseline gap-2">
                  <dt className="shrink-0 text-ink/70">{PROFILE_TRAIT_LABEL[trait]}</dt>
                  <dd className="text-ink/45">{PROFILE_TRAIT_DIRECTION[trait]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-ink/40">
              轴旁数字为 1–5
              档。实心顶点来自官方数据，空心顶点为编辑评估，断轴表示暂无可比数据；面积大小不代表学校好坏。
            </p>
          </div>

          <div className="mt-6">
            <UniversityBrowser />
          </div>
        </section>
      </main>
    </>
  )
}
