// /v2/shortlist：右划收藏的那些学校。

import type { Metadata } from 'next'

import { ShortlistView } from '@/components/v2/ShortlistView'

export const metadata: Metadata = {
  title: '我的收藏',
  description: '刷卡时右划收藏的大学。只存在本机浏览器，没有账号也没有上传。',
}

export default function ShortlistPage() {
  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="label text-ink/40">收藏</p>
        <hr className="mt-2 border-ink" />
        <h1 className="mt-5 text-[28px] leading-tight tracking-tight sm:text-[40px]">
          右划留下来的
        </h1>
      </header>

      <ShortlistView />
    </>
  )
}
