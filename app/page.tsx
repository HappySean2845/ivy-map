import type { Metadata } from 'next'
import Link from 'next/link'

import { courseAttributionData } from '@/lib/v2/course-attribution'
import { profileById } from '@/lib/v2/profile'

export const metadata: Metadata = {
  title: '从一张地图开始',
  description: '直接查看大学数据，或沿着一条完整的留学申请路径开始择校。',
}

export default function EntryPage() {
  const linkedUniversityCount = new Set(
    courseAttributionData.observations.map((observation) => observation.universityId),
  ).size

  return (
    <main className="relative isolate min-h-[calc(100svh-65px)] overflow-hidden px-4 sm:px-8">
      <div aria-hidden className="scaffold absolute -top-2 -right-10 -z-10 opacity-[0.07]">
        MAP
      </div>

      <div className="mx-auto flex min-h-[calc(100svh-65px)] max-w-6xl flex-col py-5 sm:py-8">
        <header className="flex items-center justify-between border-b border-ink pb-4">
          <span className="label">IVY MAP</span>
          <Link href="/v2/glossary" className="text-xs text-ink/55">
            术语 →
          </Link>
        </header>

        <section className="grid flex-1 items-stretch lg:grid-cols-[0.72fr_1fr_1fr]">
          <div className="flex flex-col justify-between border-b border-ink py-8 pr-5 lg:border-r lg:border-b-0 lg:py-12 lg:pr-10">
            <div>
              <p className="label text-ink/40">从哪里开始</p>
              <h1 className="mt-6 max-w-lg text-[clamp(2.5rem,5vw,5.3rem)] leading-[0.94] tracking-[-0.045em]">
                <span className="block whitespace-nowrap">你不需要</span>
                <span className="block whitespace-nowrap">先知道答案</span>
              </h1>
            </div>
            <p className="mt-10 max-w-sm text-sm leading-relaxed text-ink/55">
              两条入口，共用同一份大学、课程和国内高中去向数据。区别只是你想从数据开始，还是先把路线看明白。
            </p>
          </div>

          <EntryOption
            number="01"
            eyebrow="DATA FIRST"
            title="我懂一点留学"
            body="直接浏览全部大学画像、官方录取率、课程路径和对应的国内高中。"
            href="/universities"
            action="直接看数据"
          />

          <EntryOption
            number="02"
            eyebrow="GUIDED ROUTE"
            title="我完全不懂"
            body="先走完七个关键阶段，再用目的地、兴趣、课程路线和关注点缩小大学范围。"
            href="/guide"
            action="带我一步步择校"
            inverted
          />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink pt-4 text-[11px] text-ink/45">
          <span>每一段旅程，都值得拥有一张地图。</span>
          <span className="tnum">
            {profileById.size} 所大学 · {linkedUniversityCount} 所已有国内高中去向证据
          </span>
        </footer>
      </div>
    </main>
  )
}

function EntryOption({
  number,
  eyebrow,
  title,
  body,
  href,
  action,
  inverted = false,
}: {
  number: string
  eyebrow: string
  title: string
  body: string
  href: string
  action: string
  inverted?: boolean
}) {
  return (
    <Link
      href={href}
      style={{ color: inverted ? 'var(--paper)' : 'var(--ink)' }}
      className={`group relative flex min-h-[360px] flex-col justify-between border-b border-ink p-6 transition-colors duration-300 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-current lg:min-h-0 lg:border-r lg:border-b-0 lg:p-10 last:lg:border-r-0 ${
        inverted ? 'bg-ink hover:bg-ink/[0.88]' : 'bg-paper/80 hover:bg-ink/[0.045]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`label ${inverted ? 'text-paper/55' : 'text-ink/40'}`}>{eyebrow}</span>
        <span className="text-4xl leading-none tracking-[-0.06em] tnum">{number}</span>
      </div>

      <div className="my-12">
        <h2 className="text-[clamp(2rem,4vw,4.3rem)] leading-[0.98] tracking-[-0.04em]">
          {title}
        </h2>
        <p
          className={`mt-5 max-w-sm text-base leading-relaxed ${inverted ? 'text-paper/70' : 'text-ink/60'}`}
        >
          {body}
        </p>
      </div>

      <div className="flex min-h-11 items-center justify-between border-t border-current pt-4 text-sm">
        <span>{action}</span>
        <span
          aria-hidden
          className="text-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  )
}
