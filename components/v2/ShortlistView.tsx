'use client'

// 收藏列表。
//
// 数据只在浏览器里（没有账号系统），所以这一页有两个必须说清的事：
// 1. 加载完之前不能显示空态（会让人以为收藏丢了）
// 2. 页面上要明说「换设备或清缓存就没了」—— 家长会把这个当名单用

import Link from 'next/link'

import { ShortlistButton } from '@/components/v2/ShortlistButton'
import { UniversityCard } from '@/components/v2/UniversityCard'
import { viewOf } from '@/lib/v2/profile'
import { useShortlist } from '@/lib/v2/shortlist'

export function ShortlistView() {
  const { ids, ready } = useShortlist()
  const views = ids.map((id) => viewOf(id)).filter((v): v is NonNullable<typeof v> => v != null)

  if (!ready) {
    // 静态占位，不做骨架屏闪烁（design-system.md §9）
    return <p className="mt-8 text-sm text-ink/40">正在读取本机收藏…</p>
  }

  if (views.length === 0) {
    return (
      <div className="mt-8 rounded-[14px] border border-line bg-surface p-6">
        <p className="text-sm leading-relaxed">
          还没有收藏。去刷卡时右划，或者在网格里点「收藏」。
        </p>
        <Link href="/universities" className="primary-action mt-4 text-sm">
          浏览大学 <span aria-hidden>→</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <ul className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {views.map((view) => (
          <li key={view.university.id} className="relative">
            <UniversityCard view={view} variant="grid" className="h-full" />
            <ShortlistButton
              universityId={view.university.id}
              className="absolute right-3 top-3 rounded-lg border border-line px-3 py-1.5 text-[11px] shadow-[var(--shadow-sm)]"
              labels={{ on: '移除', off: '收藏' }}
            />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-ink/40 tnum">
        {views.length} 所。收藏只存在这台设备的浏览器里 ——
        换设备、换浏览器或清缓存都会没有，需要长期保留的话请自己记一份。
        <Link href="/universities" className="ml-2 text-forest">
          继续浏览 →
        </Link>
      </p>
    </div>
  )
}

export default ShortlistView
