// /v2 落地页：IVY Map 是什么 → 分叉。
//
// 全部服务端直出。这一屏的任务是让人在五秒内知道自己该走哪条路，
// 不该等 JS。

import type { Metadata } from 'next'
import Link from 'next/link'

import { dataStatus } from '@/lib/data'
import { profileById } from '@/lib/v2/profile'
import { TERMS } from '@/lib/v2/glossary'

export const metadata: Metadata = {
  title: 'IVY Map · 把去哪所大学和上哪所高中对上',
  description:
    '中国家庭的择校地图。已经有目标大学，就反推国内哪些高中真的在往那里送人；还没有目标，就一所一所地刷。数据均可溯源。',
}

export default function V2Home() {
  const s = dataStatus()

  return (
    <>
      <header className="relative isolate pt-10 sm:pt-16">
        <div
          aria-hidden="true"
          className="scaffold pointer-events-none absolute -top-8 -left-6 z-0 select-none sm:-top-20"
        >
          IVY
        </div>

        <div className="relative z-10">
          <p className="label text-ink/40">IVY MAP · 择校地图</p>

          <h1 className="mt-5 max-w-4xl text-[32px] leading-[1.05] tracking-tight sm:text-[56px]">
            把「去哪所大学」
            <br />
            和「上哪所高中」对上
          </h1>

          <hr className="mt-8 border-ink" />

          <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-12">
            <p className="max-w-xl text-[17px] leading-relaxed sm:text-[18px]">
              留学工具都在回答「这所大学好不好」。但一个初二孩子的家长今年真正能动的杠杆只有一个
              ——<strong className="font-medium">把孩子送进哪所高中</strong>
              。所以这里的两条路都从这个杠杆出发。
            </p>
            <p className="border-l border-ink pl-4 text-sm leading-relaxed text-ink/60">
              这不是排名网站。每个数字标了出处和口径，编辑写的判断也明确标成编辑写的 ——
              你可以不同意我们的看法，但不该被我们的看法冒充成数据。
            </p>
          </div>
        </div>
      </header>

      {/* ── 第一步：术语。手写稿里它在分叉之前，因为不懂这五个词，
             后面看学校宣传材料全是被绕的 */}
      <section className="mt-14 sm:mt-20">
        <p className="label text-ink/40">01 / 先弄懂五个词</p>
        <hr className="mt-2 border-ink" />
        <Link href="/v2/glossary" className="group mt-5 block hover:no-underline">
          <h2 className="text-2xl leading-tight group-hover:underline sm:text-[32px]">
            AP · IB · A-Level · GPA · SAT 到底差在哪 →
          </h2>
        </Link>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60">
          这五个词经常被摆在一起说，但它们不是一个层级的东西。
          {TERMS.length} 条各配一句「家长最常搞错的」，两分钟能读完。
        </p>
      </section>

      {/* ── 第二步：分叉 */}
      <section className="mt-14 sm:mt-20">
        <p className="label text-ink/40">02 / 你现在在哪一步</p>
        <hr className="mt-2 border-ink" />

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <ForkCard
            href="/v2/pick-highschool"
            index="A"
            title="我要选高中"
            lead="已经有目标大学了"
            body="先看一眼这所梦校的画像，然后反推国内哪些高中真的在往那里送人 —— 按人均命中率排，不是按 offer 总数排。"
            foot={`${s.schools} 所国内高中 · ${s.admissions} 条排名录取 · ${s.feederEvidence} 条去向证据`}
          />
          <ForkCard
            href="/v2/pick-university"
            index="B"
            title="我要选大学"
            lead="还没有目标，想先逛逛"
            body="一所一所地刷：左划跳过，右划收藏。每张卡上是地理位置、知名领域、风格简述和四维评分，右上角随时能搜。"
            foot={`${profileById.size} 所大学画像 · ${s.officialAdmissions} 组官方招生快照`}
          />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-ink/40 tnum">
          共收录 {s.universities} 所大学 · {s.sources} 个来源 ·{' '}
          <Link href="/about" className="text-ink/60">
            数据来源与方法论 →
          </Link>
          {' · '}
          <Link href="/" className="text-ink/60">
            旧版生源校榜单 →
          </Link>
        </p>
      </section>
    </>
  )
}

function ForkCard({
  href,
  index,
  title,
  lead,
  body,
  foot,
}: {
  href: string
  index: string
  title: string
  lead: string
  body: string
  foot: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between border border-ink p-5 hover:no-underline sm:p-6"
    >
      <div>
        <p className="label text-ink/40">{index}</p>
        <h3 className="mt-3 text-xl leading-tight group-hover:underline sm:text-2xl">
          {title} →
        </h3>
        <p className="mt-1.5 text-sm text-ink/60">{lead}</p>
        <p className="mt-4 text-sm leading-relaxed">{body}</p>
      </div>
      <p className="mt-6 border-t border-ink/15 pt-3 text-[11px] text-ink/40 tnum">{foot}</p>
    </Link>
  )
}
