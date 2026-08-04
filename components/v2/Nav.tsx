'use client'

// v2 顶部导航。
//
// 手写稿把搜索放在右上角，所以它在这里是**常驻**的 —— 刷到一半想起「我想看看
// 某所学校」时，不用退出刷卡流程。
//
// 收藏计数必须走 client：它存在 localStorage 里，服务端渲染时读不到
// （见 lib/v2/shortlist.ts 的注释）。

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SearchBox } from '@/components/v2/SearchBox'
import { useShortlist } from '@/lib/v2/shortlist'

const LINKS = [
  { href: '/v2/glossary', label: '术语' },
  { href: '/v2/pick-highschool', label: '选高中' },
  { href: '/v2/pick-university', label: '选大学' },
]

export function Nav() {
  const pathname = usePathname()
  const { ids, ready } = useShortlist()

  return (
    <nav className="border-b border-ink/15">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/v2" className="label shrink-0 hover:no-underline">
            IVY MAP
          </Link>

          <div className="label flex flex-1 gap-4 text-ink/60">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={pathname === link.href ? 'text-ink' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <Link href="/v2/shortlist" className="label shrink-0 text-ink/60 tnum">
            收藏 {ready ? ids.length : '—'} →
          </Link>
        </div>

        {/* 搜索独占一行：390px 上和上面那排挤在一起会两边都不好用 */}
        <div className="mt-2.5 sm:mt-3 sm:max-w-md">
          <SearchBox />
        </div>
      </div>
    </nav>
  )
}

export default Nav
