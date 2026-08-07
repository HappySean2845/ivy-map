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
      <header className="soft-panel mt-5 px-5 py-9 sm:mt-7 sm:px-9 sm:py-12">
        <p className="eyebrow-chip bg-surface">01 / 术语</p>
        <h1 className="mt-6 max-w-3xl text-[36px] leading-tight tracking-tight text-forest-deep sm:text-[56px]">
          七个词，分成三层看
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/60 sm:text-base">
          先把课程、学业成绩与语言成绩放回各自的位置，后面的择校判断才不会混在一起。
        </p>
      </header>

      <div className="mt-8">
        <GlossaryCards />
      </div>

      {/* ── 读完了，回到大学目录 */}
      <section className="mt-14 sm:mt-20">
        <p className="label text-leaf">02 / 接下来</p>
        <Link
          href="/universities"
          className="group mt-5 flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-forest-deep p-6 text-paper hover:no-underline sm:p-8"
        >
          <div>
            <h2 className="text-2xl leading-tight">去看全部大学</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/65">
              从大学画像进入详情，再看课程路径和对应的国内高中去向证据。
            </p>
          </div>
          <span className="grid size-12 place-items-center rounded-full bg-sage text-xl text-forest-deep transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </section>
    </>
  )
}
