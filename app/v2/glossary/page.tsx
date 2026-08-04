// /v2/glossary：术语教学。
//
// 手写稿里这一步在分叉之前，所以页面底部要接着给分叉入口 ——
// 读完五个词的人下一个动作是选路，不该让他退回上一页找。

import type { Metadata } from 'next'
import Link from 'next/link'

import { GlossaryCards } from '@/components/v2/GlossaryCards'

export const metadata: Metadata = {
  title: 'AP / IB / A-Level / GPA / SAT 到底差在哪',
  description:
    'AP、IB、A-Level 是三条互斥的课程路线，GPA 和 SAT 是两份分数。每条配一句家长最常搞错的。',
}

export default function GlossaryPage() {
  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="label text-ink/40">01 / 术语</p>
        <hr className="mt-2 border-ink" />
        <h1 className="mt-5 max-w-3xl text-[28px] leading-tight tracking-tight sm:text-[44px]">
          五个词，两分钟
        </h1>
      </header>

      <div className="mt-8">
        <GlossaryCards />
      </div>

      {/* ── 读完了，接着选路 */}
      <section className="mt-14 sm:mt-20">
        <p className="label text-ink/40">02 / 接下来</p>
        <hr className="mt-2 border-ink" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Link
            href="/v2/pick-highschool"
            className="group border border-ink p-5 hover:no-underline sm:p-6"
          >
            <h2 className="text-xl leading-tight group-hover:underline">我要选高中 →</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              已经有目标大学，想知道国内哪些高中在往那里送人。
            </p>
          </Link>
          <Link
            href="/v2/pick-university"
            className="group border border-ink p-5 hover:no-underline sm:p-6"
          >
            <h2 className="text-xl leading-tight group-hover:underline">我要选大学 →</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              还没有目标，一所一所刷着看。
            </p>
          </Link>
        </div>
      </section>
    </>
  )
}
