import type { Metadata } from 'next'
import Link from 'next/link'

import { UniversityCard } from '@/components/v2/UniversityCard'
import { matchUniversities, type GuidedMatch } from '@/lib/guided/matcher'
import {
  CURRICULA,
  DESTINATIONS,
  INTERESTS,
  PRIORITIES,
  guideSearchParams,
  labelFor,
  parseGuideAnswers,
  type GuideAnswers,
} from '@/lib/guided/preferences'
import { profileById } from '@/lib/v2/profile'

export const metadata: Metadata = {
  title: '你的大学比较起点',
  description: '按你选择的目的地、兴趣、课程路线和关注点整理的可解释大学比较结果。',
}

export default async function GuidedResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const answers = parseGuideAnswers(await searchParams)
  const matches = matchUniversities(answers)
  const query = guideSearchParams(answers).toString()
  const first = matches.slice(0, 3)
  const compare = matches.slice(3, 6)

  return (
    <main className="px-3 pb-24 sm:px-6">
      <div className="mx-auto max-w-7xl py-3 sm:py-5">
        <header className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
          <Link href="/" className="label text-forest hover:no-underline">
            IVY MAP · 比较结果
          </Link>
          <Link href="/universities" className="secondary-action min-h-9 px-4 text-xs">
            查看全部大学 →
          </Link>
        </header>

        <section className="soft-panel relative isolate mt-4 overflow-hidden px-5 py-10 sm:px-9 sm:py-14 lg:px-12">
          <div aria-hidden className="scaffold absolute -top-6 -left-8 -z-10 opacity-[0.06]">
            LIST
          </div>
          <p className="eyebrow-chip bg-surface">这不是排名，是你的比较起点</p>
          <div className="mt-6 grid items-end gap-10 lg:grid-cols-[1fr_0.52fr]">
            <h1 className="max-w-4xl text-[clamp(3rem,8vw,7.2rem)] leading-[0.88] tracking-[-0.055em] text-forest-deep">
              先从这几所
              <br />
              开始看
            </h1>
            <div className="rounded-[14px] bg-surface p-5 sm:p-6">
              <AnswerLine answers={answers} />
              <Link
                href={query ? `/guide/choose?${query}` : '/guide/choose'}
                className="primary-action mt-6 text-sm"
              >
                修改我的选择 →
              </Link>
            </div>
          </div>
          <p className="mt-8 max-w-3xl rounded-lg bg-cream p-4 text-sm leading-relaxed text-ink/60">
            我们没有显示一个看似精确的“匹配分”。下面只列出为什么值得先看、哪些证据仍然缺失；点击卡片进入现有大学详情，再看课程路径和对应高中。
          </p>
        </section>

        {first.length > 0 ? (
          <>
            <MatchGroup label="01 / 优先了解" title="条件命中更完整" matches={first} />
            {compare.length > 0 && (
              <MatchGroup
                label="02 / 继续比较"
                title="有部分匹配，也有空白"
                matches={compare}
              />
            )}
          </>
        ) : (
          <section className="mt-20 rounded-[14px] border border-line bg-surface p-8">
            <h2 className="text-3xl">这组条件暂时没有结果</h2>
            <p className="mt-4 text-sm text-ink/55">放宽目的地后再试，或者直接浏览全部大学。</p>
            <div className="mt-8 flex gap-6">
              <Link href="/guide/choose" className="primary-action">
                重新选择
              </Link>
              <Link href="/universities" className="secondary-action">
                查看全部大学
              </Link>
            </div>
          </section>
        )}

        <section className="mt-20 rounded-lg bg-cream p-5 text-xs leading-relaxed text-ink/50">
          <p>
            当前结果只使用本站已收录的 {profileById.size}
            所大学。知名领域不是专业排名；中国学生环境、安全和设施为编辑评估；课程路线只表示已有国内高中去向证据，不代表大学录取偏好。
          </p>
        </section>
      </div>
    </main>
  )
}

function MatchGroup({
  label,
  title,
  matches,
}: {
  label: string
  title: string
  matches: GuidedMatch[]
}) {
  return (
    <section className="mt-20">
      <p className="label text-leaf">{label}</p>
      <h2 className="mt-3 text-2xl text-forest-deep sm:text-[32px]">{title}</h2>
      <ol className="mt-8 grid items-start gap-x-5 gap-y-12 lg:grid-cols-3">
        {matches.map((match, index) => (
          <li key={match.view.university.id}>
            <div className="mb-4 min-h-36 rounded-[12px] bg-cream p-4">
              <p className="label text-leaf tnum">为什么是第 {index + 1} 个比较对象</p>
              <ul className="mt-3 space-y-1.5 text-sm leading-relaxed">
                {match.reasons.map((reason) => (
                  <li key={reason}>— {reason}</li>
                ))}
              </ul>
              {match.cautions.length > 0 && (
                <p className="mt-3 text-xs leading-relaxed text-ink/40">
                  待留意：{match.cautions.join('；')}
                </p>
              )}
            </div>
            <UniversityCard view={match.view} variant="grid" />
          </li>
        ))}
      </ol>
    </section>
  )
}

function AnswerLine({ answers }: { answers: GuideAnswers }) {
  const items = [
    answers.destinations.length
      ? answers.destinations.map((id) => labelFor(DESTINATIONS, id)).join('、')
      : '目的地开放',
    answers.interests.length
      ? answers.interests.map((id) => labelFor(INTERESTS, id)).join('、')
      : '兴趣未定',
    labelFor(CURRICULA, answers.curriculum),
    answers.priorities.map((id) => labelFor(PRIORITIES, id)).join('、'),
  ]

  return (
    <ul className="space-y-2 border-t border-line pt-4 text-sm">
      {items.map((item, index) => (
        <li key={item} className="grid grid-cols-[1.5rem_1fr] gap-2">
          <span className="text-ink/30 tnum">{String(index + 1).padStart(2, '0')}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
