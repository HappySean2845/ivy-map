// /v2/pick-highschool：先定梦校，再反推国内高中。
//
// 这一支的下游是现有榜单（app/page.tsx），一行代码都不用改 ——
// lib/urlState.ts 早就读 `u` 参数了。

import type { Metadata } from 'next'

import { DreamSchoolPicker } from '@/components/v2/DreamSchoolPicker'
import { dataStatus, denominatorGapLine } from '@/lib/data'

export const metadata: Metadata = {
  title: '选高中 · 从梦校反推国内生源校',
  description:
    '先定目标大学，出一张梦校画像，再反推国内哪些高中真的在往那里送人 —— 按人均命中率排序，不是按 offer 总数。',
}

export default function PickHighschoolPage() {
  const s = dataStatus()

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="label text-ink/40">A / 选高中</p>
        <hr className="mt-2 border-ink" />
        <h1 className="mt-5 max-w-3xl text-[28px] leading-tight tracking-tight sm:text-[44px]">
          想去哪所大学
          <br className="sm:hidden" />
          就该上哪所高中
        </h1>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-10">
          <p className="max-w-xl text-sm leading-relaxed">
            这张地图是<strong className="font-medium">反着用</strong>
            的：先选目标大学，再看国内哪些高中真的在往那里送人。榜单按
            <strong className="font-medium">人均命中率</strong>
            排 —— 一所每届 400 人送出 20 个 offer 的学校，和一所每届 80 人送出 12
            个的学校，后者的机会大得多。
          </p>
          <p className="border-l border-ink pl-4 text-sm leading-relaxed text-ink/60">
            {denominatorGapLine()}
          </p>
        </div>

        <p className="mt-5 text-xs text-ink/40 tnum">
          {s.schools} 所国内高中 · {s.admissions} 条排名录取 · {s.feederEvidence} 条去向证据 ·{' '}
          {s.sources} 个来源
        </p>
      </header>

      <div className="mt-8">
        <DreamSchoolPicker />
      </div>
    </>
  )
}
