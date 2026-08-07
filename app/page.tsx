import type { Metadata } from 'next'
import Link from 'next/link'

import { courseAttributionData } from '@/lib/v2/course-attribution'
import { profileById } from '@/lib/v2/profile'

export const metadata: Metadata = {
  title: '从一张地图开始',
  description: '集中查看留学择校数据，或沿着新手流程建立概念、辅助选校。',
}

const PRODUCT_INTRO =
  'IVY Map 是一款留学择校辅助产品。它既做信息集中台，把录取率、安全性等重要择校数据集中呈现；也做新手向导，帮留学小白快速建立申请流程的概念、辅助选校。更特别的是，它还收集了特定国外名校在大陆的生源高中，帮助家长在选高中这一环节，更精准地倒推：究竟哪家高中能把孩子送进名校？'

export default function EntryPage() {
  const linkedUniversityCount = new Set(
    courseAttributionData.observations.map((observation) => observation.universityId),
  ).size

  return (
    <main className="entry-home relative isolate min-h-[calc(100svh-65px)] overflow-hidden px-4 sm:px-7 lg:h-full lg:min-h-0 lg:px-9">
      <div aria-hidden className="entry-watermark fixed inset-0 -z-10">
        <div className="entry-watermark-row entry-watermark-row-ivy">
          <span className="entry-watermark-outline">I</span>
          <span className="entry-watermark-solid">V</span>
          <span className="entry-watermark-outline">Y</span>
        </div>
        <div className="entry-watermark-row entry-watermark-row-map">
          <span className="entry-watermark-outline">M</span>
          <span className="entry-watermark-solid">A</span>
          <span className="entry-watermark-outline">P</span>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100svh-65px)] max-w-[1440px] py-4 sm:py-7 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.42fr)] lg:py-4">
        <aside className="flex min-h-[580px] flex-col border-y border-ink bg-paper/70 px-1 py-8 sm:px-7 sm:py-10 lg:h-full lg:min-h-0 lg:border-r lg:bg-transparent lg:py-7 lg:pl-0 lg:pr-10">
          <div>
            <p className="label text-ink/45">IVY MAP · 留学择校辅助</p>
            <h1 className="mt-8 text-[clamp(5rem,10vw,9.5rem)] leading-[0.72] tracking-[-0.075em] lg:mt-5 lg:text-[clamp(5rem,8vw,8rem)]">
              <span className="block">IVY</span>
              <span className="block">MAP</span>
            </h1>
            <p className="mt-8 max-w-xs text-xs tracking-[0.16em] text-ink/45 uppercase lg:mt-5">
              Make the route visible.
            </p>
          </div>

          <div className="mt-auto max-w-[31rem] pt-20 lg:pt-6">
            <p className="label text-ink/40">产品介绍</p>
            <p className="mt-4 text-[13px] leading-[1.9] text-ink/67 sm:text-sm lg:mt-3 lg:text-[13px] lg:leading-[1.68]">
              {PRODUCT_INTRO}
            </p>

            <div className="mt-9 flex items-center justify-between gap-5 border-t border-ink pt-4 text-[11px] text-ink/45 lg:mt-5 lg:pt-3">
              <span>每一段旅程，都值得拥有一张地图。</span>
              <span aria-hidden>↗</span>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col border-b border-ink lg:border-y">
          <header className="flex min-h-[190px] items-start justify-between gap-7 border-b border-ink bg-paper/88 px-6 py-8 sm:px-9 sm:py-10 lg:min-h-0 lg:px-9 lg:py-6 xl:px-10">
            <div>
              <p className="label text-ink/40">Choose your starting point</p>
              <h2 className="mt-6 text-[clamp(2.25rem,4.4vw,4.9rem)] leading-[0.94] tracking-[-0.045em] lg:mt-4 lg:text-[clamp(2rem,3.5vw,3.8rem)]">
                关于择校，
                <span className="block">先选起点。</span>
              </h2>
              <p className="mt-5 text-xs text-ink/45 lg:mt-3">同一份大学、课程和高中去向数据，两种进入方式。</p>
            </div>

            <Link
              href="/v2/glossary"
              className="group flex shrink-0 items-center gap-2 border border-ink px-3 py-2 text-xs transition-colors duration-300 hover:bg-ink hover:text-paper hover:no-underline"
            >
              术语
              <span
                aria-hidden
                className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </header>

          <div className="grid min-h-0 flex-1 md:grid-cols-2">
            <EntryOption
              number="01"
              eyebrow="DATA FIRST"
              title={['有思路，', '给我数据。']}
              body="直接浏览全部大学画像、官方录取率、安全性、课程路径和对应的国内生源高中。"
              href="/universities"
              action="直接看数据"
            />

            <EntryOption
              number="02"
              eyebrow="GUIDED ROUTE"
              title={['没思路，', '带我选校。']}
              body="先走完七个关键阶段，再用目的地、兴趣、课程路线和关注点缩小大学范围。"
              href="/guide"
              action="带我一步步择校"
              inverted
            />
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink bg-paper/88 px-6 py-4 text-[11px] text-ink/45 sm:px-9 lg:px-9 lg:py-3 xl:px-10">
            <span>两条入口，共用一份持续更新的数据。</span>
            <span className="tnum">
              {profileById.size} 所大学 · {linkedUniversityCount} 所已有国内高中去向证据
            </span>
          </footer>
        </section>
      </div>
    </main>
  )
}

function EntryOption({
  number,
  eyebrow,
  title,
  body,
  href,
  action,
  inverted = false,
}: {
  number: string
  eyebrow: string
  title: [string, string]
  body: string
  href: string
  action: string
  inverted?: boolean
}) {
  return (
    <Link
      href={href}
      style={{ color: inverted ? 'var(--paper)' : 'var(--ink)' }}
      className={`group relative flex min-h-[450px] flex-col justify-between border-b border-ink p-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-current md:min-h-[500px] md:border-r md:border-b-0 sm:p-9 lg:min-h-0 lg:p-8 xl:p-10 last:md:border-r-0 ${
        inverted
          ? 'bg-ink text-paper hover:bg-ink/[0.88]'
          : 'bg-paper/92 text-ink hover:bg-ink/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`label ${inverted ? 'text-paper/50' : 'text-ink/40'}`}>{eyebrow}</span>
        <span className="text-[clamp(2rem,3.5vw,3.5rem)] leading-none tracking-[-0.06em] tnum">
          {number}
        </span>
      </div>

      <div className="my-14 lg:my-6 xl:my-8">
        <h3 className="text-[clamp(2.6rem,4.4vw,5rem)] leading-[0.94] tracking-[-0.045em] lg:text-[clamp(2.25rem,3.2vw,3.6rem)]">
          <span className="block">{title[0]}</span>
          <span className="block">{title[1]}</span>
        </h3>
        <p
          className={`mt-8 max-w-sm text-sm leading-[1.8] lg:mt-5 ${inverted ? 'text-paper/65' : 'text-ink/58'}`}
        >
          {body}
        </p>
      </div>

      <div className="flex min-h-11 items-center justify-between border-t border-current pt-4 text-sm">
        <span>{action}</span>
        <span
          aria-hidden
          className="text-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  )
}
