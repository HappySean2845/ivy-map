'use client'

// 主站顶部导航。大学目录是首页，术语是唯一的辅助页面。

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SearchBox } from '@/components/v2/SearchBox'

const LINKS = [
  { href: '/', label: '大学' },
  { href: '/v2/glossary', label: '术语' },
]

export function Nav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname.startsWith('/v2/u/') : pathname === href

  return (
    <nav className="border-b border-ink/15">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/" className="label shrink-0 hover:no-underline">
            IVY MAP
          </Link>

          <div className="label flex flex-1 gap-4 text-ink/60">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={isActive(link.href) ? 'text-ink' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
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
