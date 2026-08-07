import type { Metadata } from 'next'

import { ShortlistView } from '@/components/v2/ShortlistView'

export const metadata: Metadata = {
  title: '我的大学收藏',
  description: '查看保存在本机浏览器中的大学收藏。',
}

export default function ShortlistPage() {
  return (
    <>
      <header className="soft-panel mt-5 px-5 py-9 sm:mt-7 sm:px-9 sm:py-12">
        <p className="eyebrow-chip bg-surface">MY SHORTLIST</p>
        <h1 className="mt-6 text-[36px] leading-tight text-forest-deep sm:text-[56px]">
          我的大学收藏
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/60 sm:text-base">
          把想继续了解的学校先放在一起。收藏保存在当前浏览器，不会上传，也不会影响任何排序。
        </p>
      </header>
      <ShortlistView />
    </>
  )
}
