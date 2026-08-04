'use client'

// 「选大学」的两种形态：刷卡与网格。
//
// 刷卡负责**发现**（不知道自己想要什么时，一张一张看最省脑力），
// 网格负责**找特定的**（配合右上角搜索）。手写稿写的是「小红书瀑布流 or date app」，
// 这里做成一个切换 —— 两者解决的是不同的问题，不该二选一。
//
// 数据不从 server props 传：JSON 本来就打进了 client bundle，
// 让这个组件自己调 deckOrder() 比把 32 个对象序列化过一遍便宜。

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { SwipeDeck } from '@/components/v2/SwipeDeck'
import { ShortlistButton } from '@/components/v2/ShortlistButton'
import { UniversityCard } from '@/components/v2/UniversityCard'
import { deckOrder } from '@/lib/v2/profile'

type Mode = 'deck' | 'grid'

export function UniversityBrowser() {
  const [mode, setMode] = useState<Mode>('deck')
  const views = useMemo(() => deckOrder(), [])

  return (
    <div>
      <div
        role="tablist"
        aria-label="浏览方式"
        className="flex border-y border-ink"
      >
        {(
          [
            { id: 'deck', label: '刷卡', hint: '左划跳过 · 右划收藏' },
            { id: 'grid', label: '全部铺开', hint: `${views.length} 所` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 px-4 py-3 text-left ${mode === tab.id ? 'bg-ink text-paper' : ''}`}
            data-tap
          >
            <span className="text-sm">{tab.label}</span>
            <span
              className={`ml-2 text-[11px] tnum ${mode === tab.id ? 'text-paper/60' : 'text-ink/40'}`}
            >
              {tab.hint}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {mode === 'deck' ? (
          <SwipeDeck
            views={views}
            onExhausted={
              <div className="mt-5 border-t border-ink/15 pt-4">
                <button
                  type="button"
                  onClick={() => setMode('grid')}
                  className="text-sm text-ink/70"
                >
                  切到「全部铺开」看跳过的 →
                </button>
              </div>
            }
          />
        ) : (
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {views.map((view) => (
              <li key={view.university.id} className="relative">
                <UniversityCard view={view} variant="grid" className="h-full" />
                {/* 网格里没有手势，收藏得有个明确的按钮 */}
                <ShortlistButton
                  universityId={view.university.id}
                  className="absolute top-[3px] right-0 border-b border-l border-ink px-2.5 py-1 text-[11px]"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {mode === 'grid' && (
        <p className="mt-6 text-xs text-ink/40">
          想找特定学校用右上角搜索。
          <Link href="/v2/shortlist" className="ml-2 text-ink/60">
            看我的收藏 →
          </Link>
        </p>
      )}
    </div>
  )
}

export default UniversityBrowser
