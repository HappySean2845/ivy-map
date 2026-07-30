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
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {/* ── 报告式章节头（design-system.md §3）。
             按报告写而不按 App 写，天然先交代自己在讲什么，
             等于白捡了一半的首屏自解释。 */}
      <header className="pt-8 sm:pt-12">
        <p className="font-serif text-xs tracking-widest text-ink-muted">
          IVY MAP · 生源校研究
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-2xl leading-snug sm:text-3xl">
          想去哪所大学，就该上哪所高中
        </h1>

        <hr className="mt-5 border-rule-strong" />

        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed">
          留学工具都在回答「这所大学好不好」。但一个初二孩子的家长今年能动的杠杆，是
          <strong>把孩子送进哪所高中</strong>。
          <br className="hidden sm:block" />
          所以这张地图是<strong>反着用</strong>
          的：先选目标大学，再反推国内哪些高中真的在往那里送人。
        </p>

        {/* ── 分母缺口。这是论点，不是免责声明，所以放在首屏显眼处、
               而不是塞进页脚。 */}
        <p className="mt-4 max-w-2xl border-l-2 border-signal pl-3 text-sm leading-relaxed text-ink-muted">
          {denominatorGapLine()}
        </p>

        <div className="mt-4">
          <OfferInflationNote />
        </div>

        <p className="mt-4 text-xs text-ink-muted tnum">
          当前收录 {s.universities} 所大学 · {s.schools} 所高中 · {s.admissions} 条录取记录 ·{' '}
          {s.sources} 个来源 ——{' '}
          <Link href="/about" className="text-accent">
            数据来源与方法论
          </Link>
        </p>
      </header>

      {/* useSearchParams 需要 Suspense 边界（Next 16）。
          兜底只占交互区那一块，上面的说明已经直出了。 */}
      <Suspense
        fallback={
          <p className="mt-10 text-sm text-ink-muted tnum">
            正在载入 {s.admissions} 条录取记录…
          </p>
        }
      >
        <HomeClient />
      </Suspense>
    </main>
  )
}
