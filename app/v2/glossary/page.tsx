// /v2/glossary：术语教学。
//
// 手写稿里这一步在分叉之前，所以页面底部要接着给分叉入口 ——
// 读完五个词的人下一个动作是选路，不该让他退回上一页找。

import type { Metadata } from 'next'
import Link from 'next/link'

import { GlossaryCards } from '@/components/v2/GlossaryCards'

export const metadata: Metadata = {
  title: 'AP / IB / A-Level / GPA / SAT / IELTS / TOEFL 到底差在哪',
  description:
    '分清三种课程体系、两种学业成绩和 IELTS、TOEFL 两种语言成绩。每条配一句家长最常搞错的。',
}

export default function GlossaryPage() {
  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="label text-ink/40">01 / 术语</p>
        <hr className="mt-2 border-ink" />
        <h1 className="mt-5 max-w-3xl text-[28px] leading-tight tracking-tight sm:text-[44px]">
          七个词，分成三层看
        </h1>
      </header>

      <div className="mt-8">
        <GlossaryCards />
      </div>

      {/* ── 读完了，回到大学目录 */}
      <section className="mt-14 sm:mt-20">
        <p className="label text-ink/40">02 / 接下来</p>
        <hr className="mt-2 border-ink" />
        <Link
          href="/"
          className="group mt-6 block border border-ink p-5 hover:no-underline sm:p-6"
        >
          <h2 className="text-xl leading-tight group-hover:underline">去看全部大学 →</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            从大学画像进入详情，再看课程路径和对应的国内高中去向证据。
          </p>
        </Link>
      </section>
    </>
  )
}
