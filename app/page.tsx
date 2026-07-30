// 首页。
//
// 分工：**静态说明由服务端直出，交互部分才进 client 容器。**
// 一开始整页都塞在 HomeClient 里，结果 SSR 出来的 HTML 只有 Suspense 兜底 ——
// 搜索引擎什么都看不到，慢网络下用户先看到「正在载入」。而 US-1.0 要的恰恰是
// 「落地 5 秒内看懂这是什么」，那就必须在第一份 HTML 里。
//
// 所以：产品主张、分母缺口、offer 膨胀说明 → 服务端；
//       地图、筛选、滑杆、榜单 → HomeClient。

import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import HomeClient from './HomeClient'
import OfferInflationNote from '@/components/trust/OfferInflationNote'
import { dataStatus, denominatorGapLine, universityById } from '@/lib/data'
import { DEFAULT_FILTERS } from '@/lib/filters'

const defaultUniversity = DEFAULT_FILTERS.universityId
  ? universityById.get(DEFAULT_FILTERS.universityId)
  : undefined

export function generateMetadata(): Metadata {
  const name = defaultUniversity?.nameCn ?? '常春藤'
  return {
    title: `${name}的中国生源校 · 按人均命中率排序`,
    description:
      `想去${name}，国内该上哪所高中？反推近三届生源校榜单，` +
      `按人均命中率而不是 offer 数排序，并告诉你报不报得了。数据均可溯源。`,
  }
}

export default function Home() {
  const s = dataStatus()

  return (
    <>
      {/* ── 顶部导航。参考站的写法：白底、无边框、右对齐纯文字链接、→ 即 affordance */}
      <nav className="mx-auto flex max-w-6xl items-baseline justify-between px-4 pt-6 sm:px-8">
        <Link href="/" className="label hover:no-underline">
          IVY MAP
        </Link>
        <div className="label flex gap-5 text-ink/60">
          <Link href="/about">关于 →</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        {/* ── HERO。建筑式背景字 + 巨型标题（design-system.md §5）。
               背景字永远不承载可读信息，只做尺度和纵深，全站只用这一次。 */}
        <header className="relative isolate pt-10 sm:pt-16">
          <div
            aria-hidden="true"
            className="scaffold pointer-events-none absolute -top-8 -left-6 z-0 select-none sm:-top-20"
          >
            IVY
          </div>

          <div className="relative z-10">
            <p className="label text-ink/40">生源校研究 · FEEDER SCHOOL RESEARCH</p>

            <h1 className="mt-5 max-w-4xl text-[32px] leading-[1.05] tracking-tight sm:text-[56px]">
              想去哪所大学
              <br />
              就该上哪所高中
            </h1>

            <hr className="mt-8 border-ink" />

            <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-12">
              <p className="max-w-xl text-[17px] leading-relaxed sm:text-[18px]">
                留学工具都在回答「这所大学好不好」。但一个初二孩子的家长今年能动的杠杆，是
                <strong className="font-medium">把孩子送进哪所高中</strong>
                。所以这张地图是<strong className="font-medium">反着用</strong>
                的：先选目标大学，再反推国内哪些高中真的在往那里送人。
              </p>

              <div>
                {/* ── 分母缺口。这是论点，不是免责声明，所以放在首屏显眼处、
                     而不是塞进页脚。 */}
                <p className="border-l border-ink pl-4 text-sm leading-relaxed text-ink/60">
                  {denominatorGapLine()}
                </p>
                <div className="mt-5">
                  <OfferInflationNote />
                </div>
              </div>
            </div>

            <p className="mt-8 text-xs text-ink/40 tnum">
              收录 {s.universities} 所大学 · {s.schools} 所高中 · {s.admissions} 条录取记录 ·{' '}
              {s.sources} 个来源 ·{' '}
              <Link href="/about" className="text-ink/60">
                数据来源与方法论 →
              </Link>
            </p>
          </div>
        </header>

        {/* useSearchParams 需要 Suspense 边界（Next 16）。
            兜底只占交互区那一块，上面的说明已经直出了。 */}
        <Suspense
          fallback={
            <p className="mt-16 text-sm text-ink/40 tnum">
              正在载入 {s.admissions} 条录取记录…
            </p>
          }
        >
          <HomeClient />
        </Suspense>
      </main>
    </>
  )
}
