// 「接回榜单」的那一段。详情页和「选高中」页共用。
//
// **为什么要抽出来**：这段判断出现过一次真实的 bug —— 详情页只分了「有数据 / 没数据」
// 两种，于是耶鲁（0 条分赛道录取 + 3 条去向证据）渲染成「已收录 0 所分赛道录取记录」，
// 还给了榜单按钮，点过去是一张空表。
//
// 覆盖度实际上有**三档**，措辞和按钮都不一样。同一个判断有两份实现，
// 迟早会分叉成两种说法。

import Link from 'next/link'

import { feederCoverage } from '@/lib/v2/profile'

export function FeederHandoff({
  universityId,
  nameCn,
}: {
  universityId: string
  nameCn: string
}) {
  const { rankedSchools, evidenceSchools } = feederCoverage(universityId)

  // 一档：有分赛道录取记录，密度排名能算，给主按钮
  if (rankedSchools > 0) {
    return (
      <>
        <h3 className="text-xl leading-tight">{nameCn}的国内生源校榜单已就绪</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60 tnum">
          已收录 {rankedSchools} 所高中的分赛道录取记录
          {evidenceSchools > 0 &&
            `，另有 ${evidenceSchools} 所只有去向证据（未拆分赛道，不进密度排名）`}
          。榜单按<strong className="font-medium">人均命中率</strong>排，不是按 offer 总数排。
        </p>
        <Link
          href={`/?u=${universityId}`}
          className="mt-4 inline-block border border-ink bg-ink px-4 py-2 text-sm text-paper hover:no-underline"
          data-tap
        >
          看谁在往这里送人 →
        </Link>
      </>
    )
  }

  // 二档：只有去向证据。能查到原文，但算不出人均命中率 —— 按钮要说清去看的是什么
  if (evidenceSchools > 0) {
    return (
      <>
        <h3 className="text-xl leading-tight">
          有 {evidenceSchools} 所高中的去向证据，但还进不了密度排名
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
          这些记录都能查到原文，但原始来源没有把 AP / IB / A-Level 拆开，
          所以算不出分赛道的人均命中率。榜单页会把它们单独列出来。
        </p>
        <Link
          href={`/?u=${universityId}`}
          className="mt-4 inline-block border border-ink px-4 py-2 text-sm hover:no-underline"
          data-tap
        >
          去看这些去向证据 →
        </Link>
      </>
    )
  }

  // 三档：什么都没有。**不给按钮** —— 让人点完才发现是空表，他会以为产品坏了
  return (
    <>
      <h3 className="text-xl leading-tight">还没有收录往{nameCn}的国内高中数据</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
        跳过去会是一张空表，所以这里不给按钮 ——
        <strong className="font-medium">数据没到就说没到</strong>，不用估算值把表格填满。
        <Link href="/v2/pick-highschool" className="ml-1 text-ink/80">
          看哪些大学已经有 →
        </Link>
      </p>
    </>
  )
}

export default FeederHandoff
