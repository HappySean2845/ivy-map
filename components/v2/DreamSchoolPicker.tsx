'use client'

// 「选高中」的第一步：先定梦校，出画像，再跳去榜单。
//
// 关键设计：**跳转按钮上必须先写清那边有多少数据。**
// 目前 56 条排名录取只覆盖牛津和剑桥，选了哈佛跳过去就是一张空表 ——
// 让人点完才发现是空的，他会以为产品坏了，而不是数据还没到。
//
// 榜单那边不用改一行代码：lib/urlState.ts 已经读 `u` 参数，
// 所以 /?u=cambridge 落地就是剑桥的生源校榜单。

import { useState } from 'react'

import { FeederHandoff } from '@/components/v2/FeederHandoff'
import { SearchBox } from '@/components/v2/SearchBox'
import { UniversityCard } from '@/components/v2/UniversityCard'
import { feederCoverage, universitiesWithFeeders, viewOf } from '@/lib/v2/profile'

export function DreamSchoolPicker() {
  const [picked, setPicked] = useState<string | null>(null)
  const view = picked ? viewOf(picked) : null
  const suggestions = universitiesWithFeeders().slice(0, 6)

  return (
    <div>
      <div className="border-y border-ink py-4">
        <label className="label block text-ink/40" htmlFor="dream-school-search">
          目标大学是？
        </label>
        <div className="mt-2.5 sm:max-w-md">
          <SearchBox
            onPick={setPicked}
            placeholder="输入校名，如 剑桥 / cambridge / MIT"
            className="[&_input]:w-full"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] text-ink/40">已有国内生源校数据的：</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
              {suggestions.map((s) => {
                const cov = feederCoverage(s.university.id)
                return (
                  <button
                    key={s.university.id}
                    type="button"
                    onClick={() => setPicked(s.university.id)}
                    className={`text-sm ${picked === s.university.id ? 'text-ink underline' : 'text-ink/70'}`}
                    data-tap
                  >
                    {s.university.nameCn}
                    <span className="ml-1 text-[11px] text-ink/40 tnum">
                      {cov.rankedSchools + cov.evidenceSchools}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {!view ? (
        <p className="mt-8 text-sm leading-relaxed text-ink/50">
          先选一所目标大学。选完这里会出它的画像，再往下就是国内哪些高中真的在往那里送人。
        </p>
      ) : (
        <div className="mt-8">
          <p className="label text-ink/40">梦校画像</p>
          <hr className="mt-2 border-ink" />

          <div className="mt-5 sm:max-w-xl">
            <UniversityCard view={view} variant="deck" />
          </div>

          {/* ── 跳去榜单。三档措辞与详情页共用同一份实现 */}
          <div className="mt-6 border border-ink p-5">
            <p className="label mb-2.5 text-ink/40">下一步</p>
            <FeederHandoff universityId={view.university.id} nameCn={view.university.nameCn} />
          </div>
        </div>
      )}
    </div>
  )
}

export default DreamSchoolPicker
