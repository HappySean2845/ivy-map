'use client'

// 主站顶部导航。入口页负责分流；这里服务已经进入数据区的用户。

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SearchBox } from '@/components/v2/SearchBox'

const LINKS = [
  { href: '/universities', label: '大学' },
  { href: '/guide', label: '新手引导' },
  { href: '/v2/glossary', label: '术语' },
  { href: '/v2/shortlist', label: '收藏' },
]

export function Nav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/universities'
      ? pathname === '/universities' || pathname.startsWith('/v2/u/')
      : pathname === href || (href === '/guide' && pathname.startsWith('/guide/'))

  return (
    <nav className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto max-w-7xl rounded-[14px] border border-line bg-paper px-3 py-3 shadow-[var(--shadow-sm)] sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 hover:no-underline"
            aria-label="回到入口选择"
          >
            <span className="grid size-8 place-items-center rounded-full bg-forest font-display text-base font-semibold text-paper">
              I
            </span>
            <span className="label text-forest">IVY MAP</span>
          </Link>

          <div className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:pl-2">
            {LINKS.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold hover:no-underline ${
                    active
                      ? 'bg-forest text-paper'
                      : 'text-ink/55 hover:bg-cream hover:text-forest'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <SearchBox className="ml-auto w-[min(54vw,22rem)] sm:w-[19rem]" />
        </div>
      </div>
    </nav>
  )
}

export default Nav
