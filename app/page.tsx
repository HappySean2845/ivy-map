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
    <main className="relative isolate overflow-hidden px-3 pb-8 pt-3 sm:px-6 sm:pt-5">
      <div aria-hidden className="scaffold absolute -right-16 top-10 -z-10 opacity-[0.05]">
        MAP
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4 rounded-full border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)] sm:px-4">
          <Link
            href="/"
            className="flex items-center gap-3 hover:no-underline"
            aria-label="IVY Map 首页"
          >
            <span className="grid size-9 place-items-center rounded-full bg-forest font-display text-lg font-semibold text-paper">
              I
            </span>
            <span>
              <span className="label block text-forest">IVY MAP</span>
              <span className="hidden text-[10px] text-ink/45 sm:block">
                大学画像与择校路径
              </span>
            </span>
          </Link>
          <Link href="/v2/glossary" className="secondary-action min-h-9 px-4 text-xs">
            先看术语 <span aria-hidden>→</span>
          </Link>
        </header>

        <section className="soft-panel mt-3 overflow-hidden p-3 sm:mt-5 sm:p-5 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-5 lg:p-6">
          <div className="relative flex min-h-[440px] flex-col justify-between overflow-hidden rounded-[24px] px-5 py-8 sm:px-9 sm:py-10 lg:min-h-[650px] lg:px-12 lg:py-12">
            <div className="relative z-10">
              <p className="eyebrow-chip bg-surface">从哪里开始</p>
              <h1 className="mt-7 max-w-xl text-[clamp(3rem,6vw,5.8rem)] leading-[0.9] tracking-[-0.055em] text-forest-deep">
                <span className="block whitespace-nowrap">你不需要</span>
                <span className="block whitespace-nowrap">先知道答案</span>
              </h1>
              <p className="mt-7 max-w-md text-base leading-relaxed text-ink/62 sm:text-lg">
                先选一种舒服的开始方式。无论从大学数据还是申请路线出发，最后都会回到同一份可追溯的择校地图。
              </p>
            </div>

            <div className="relative z-10 mt-12">
              <AdmissionMapMark />
              <p className="mt-5 max-w-sm text-xs leading-relaxed text-ink/48">
                每一条公开去向、每一项官方口径，都是地图上的一个坐标。
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1 lg:grid-rows-2 lg:gap-4">
            <EntryOption
              number="01"
              eyebrow="DATA FIRST"
              title="我懂一点留学"
              body="直接浏览全部大学画像、官方录取率、课程路径和对应的国内高中。"
              href="/universities"
              action="直接看大学数据"
            />

            <EntryOption
              number="02"
              eyebrow="GUIDED ROUTE"
              title="我想有人带着看"
              body="先走过七个关键阶段，再用目的地、兴趣、课程路线和关注点缩小范围。"
              href="/guide"
              action="开始一步步择校"
              inverted
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-5 text-[11px] text-ink/48 sm:px-5">
          <span>沉稳，但不替你做决定。</span>
          <span className="tnum">
            {profileById.size} 所大学 · {linkedUniversityCount} 所已有国内高中去向证据
          </span>
        </div>
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
      className={`group relative flex min-h-[330px] flex-col justify-between overflow-hidden rounded-[24px] border p-6 transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:no-underline sm:p-7 lg:min-h-0 lg:p-9 ${
        inverted
          ? 'border-forest-deep bg-forest-deep text-paper hover:bg-forest'
          : 'border-line bg-surface text-ink hover:border-leaf'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`label ${inverted ? 'text-sage' : 'text-leaf'}`}>{eyebrow}</span>
        <span
          className={`grid size-11 place-items-center rounded-full text-sm tnum ${
            inverted ? 'bg-paper/10 text-paper' : 'bg-mint text-forest'
          }`}
        >
          {number}
        </span>
      </div>

      <div className="my-10">
        <h2 className="max-w-lg text-[clamp(2.1rem,4vw,4.2rem)] leading-[0.96] tracking-[-0.04em]">
          {title}
        </h2>
        <p
          className={`mt-5 max-w-md text-[15px] leading-relaxed sm:text-base ${
            inverted ? 'text-paper/70' : 'text-ink/60'
          }`}
        >
          {body}
        </p>
      </div>

      <div
        className={`flex min-h-12 items-center justify-between rounded-full px-4 text-sm font-semibold ${
          inverted ? 'bg-sage text-forest-deep' : 'bg-mint text-forest'
        }`}
      >
        <span>{action}</span>
        <span
          aria-hidden
          className="text-lg transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  )
}

function AdmissionMapMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 150"
      className="h-auto w-full max-w-[300px] text-forest"
    >
      <path
        d="M8 125 C60 125 68 42 128 75 S210 103 288 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 7"
        opacity="0.45"
      />
      <path
        d="M8 92 C64 92 78 118 132 90 S225 64 288 92"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.24"
      />
      {[
        { x: 18, y: 123 },
        { x: 93, y: 73 },
        { x: 151, y: 87 },
        { x: 224, y: 66 },
      ].map((point) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="currentColor"
        />
      ))}
      <g transform="translate(254 4) rotate(14)">
        <path
          d="M28 48 C4 45 -2 27 4 5 C27 8 42 23 28 48Z"
          fill="var(--sage)"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M8 12 C18 22 23 32 28 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  )
}
