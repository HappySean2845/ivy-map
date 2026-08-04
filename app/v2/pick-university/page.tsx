// /v2/pick-university：刷卡浏览大学。
//
// 静态说明服务端直出，交互部分才进 client（和 app/page.tsx 同一套分工）。

import type { Metadata } from 'next'

import { UniversityBrowser } from '@/components/v2/UniversityBrowser'
import { profileById } from '@/lib/v2/profile'
import { PROFILE_DIMS, PROFILE_DIM_DIRECTION, PROFILE_DIM_LABEL } from '@/types/profile'

export const metadata: Metadata = {
  title: '刷大学 · 左划跳过，右划收藏',
  description:
    '一所一所地看：地理位置、知名领域、风格简述、四维评分与官方录取率。右上角可以直接搜。',
}

export default function PickUniversityPage() {
  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="label text-ink/40">B / 选大学</p>
        <hr className="mt-2 border-ink" />
        <h1 className="mt-5 max-w-3xl text-[28px] leading-tight tracking-tight sm:text-[44px]">
          先刷起来，判断是刷出来的
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/60">
          {profileById.size} 所大学，一张卡一所。左划跳过、右划收藏，也可以直接用键盘左右方向键。
          收藏只存在你这台设备的浏览器里，我们没有账号系统，也就拿不到你的名单。
        </p>

        {/* 四根轴的方向必须写在图外面：「面积越大越好」是错的暗示 ——
            录取难度那根轴顶到最外圈的意思是「你大概进不去」 */}
        <dl className="mt-5 grid gap-x-6 gap-y-2 border-y border-ink/15 py-3 text-xs sm:grid-cols-2">
          {PROFILE_DIMS.map((dim) => (
            <div key={dim} className="flex items-baseline gap-2">
              <dt className="shrink-0 text-ink/70">{PROFILE_DIM_LABEL[dim]}</dt>
              <dd className="text-ink/45">{PROFILE_DIM_DIRECTION[dim]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-ink/40">
          雷达图上<strong className="font-medium">实心顶点</strong>是官方数据算出来的，
          <strong className="font-medium">空心顶点</strong>是我们编辑的评估。
          点进任意一所可以看到每一项的依据。
        </p>
      </header>

      <div className="mt-8">
        <UniversityBrowser />
      </div>
    </>
  )
}
