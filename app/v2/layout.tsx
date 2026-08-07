// /v2 的外壳。
//
// 免责声明在根 layout 的 footer 里，这里不重复。

import type { Metadata } from 'next'
import { Nav } from '@/components/v2/Nav'

export const metadata: Metadata = {
  title: { default: 'IVY Map', template: '%s · IVY Map' },
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">{children}</main>
    </>
  )
}
