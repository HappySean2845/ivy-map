// 术语教学。
//
// 排版按报刊来（全大写小标签 → hairline → 大字），不做折叠：
// 家长需要把这五条读完，折叠起来的东西没人展开。
//
// 每张卡最下面那段「最常搞错的」是这个页面存在的理由 —— 用反白块框住，
// 它是全页唯一被强调的东西。

import { Emphasis } from '@/components/v2/Emphasis'
import { GLOSSARY_INTRO, TERMS, TERM_KIND_LABEL, type TermKind } from '@/lib/v2/glossary'

const GROUPS: { kind: TermKind; heading: string; note: string }[] = [
  {
    kind: 'curriculum',
    heading: '三条课程路线',
    note: '高中可能单轨，也可能同时开设多条路线。真正要核对的是孩子所在的具体学部，而不是学校宣传册上出现过哪些课程名称。',
  },
  {
    kind: 'academic',
    heading: '学业成绩与标化',
    note: 'GPA 来自校内长期表现；SAT 是一次可重复参加的标准化考试。两者的来源、口径和招生政策都不同。',
  },
  {
    kind: 'language',
    heading: '两种语言成绩',
    note: 'IELTS 和 TOEFL 都测英语能力，不是课程体系。大学是否接受、要求哪种量表以及是否卡单项，要看当年官方要求。',
  },
]

export function GlossaryCards() {
  return (
    <div>
      <p className="max-w-3xl text-[17px] leading-relaxed sm:text-[18px]">
        <Emphasis text={GLOSSARY_INTRO} />
      </p>

      {GROUPS.map((group) => (
        <section key={group.kind} className="mt-12 sm:mt-16">
          <p className="label text-ink/40">{TERM_KIND_LABEL[group.kind]}</p>
          <hr className="mt-2 border-ink" />
          <h2 className="mt-4 text-2xl leading-tight sm:text-[32px]">{group.heading}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">{group.note}</p>

          <div className="mt-6 flex flex-col gap-6">
            {TERMS.filter((t) => t.kind === group.kind).map((term) => (
              <article key={term.id} id={term.id} className="border border-ink/15 p-5 sm:p-6">
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-2xl leading-none tracking-tight sm:text-[28px]">
                    {term.name}
                  </h3>
                  <span className="text-sm text-ink/60">{term.nameCn}</span>
                  <span className="text-xs text-ink/40">{term.fullName}</span>
                </header>

                <p className="mt-4 text-[15px] leading-relaxed sm:text-base">{term.oneLine}</p>

                <dl className="mt-5 grid gap-4 border-t border-ink/15 pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="label text-ink/40">谁在走这条路</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink/70">{term.who}</dd>
                  </div>
                  <div>
                    <dt className="label text-ink/40">怎么算分</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink/70">
                      <Emphasis text={term.howItWorks} />
                    </dd>
                  </div>
                </dl>

                {/* 反白块 = 全站的「当前选中 / 最重要」语言（design-system.md §1） */}
                <div className="mt-5 bg-ink p-4 text-paper sm:p-5">
                  <p className="label text-paper/60">家长最常搞错的</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    <Emphasis text={term.misconception} />
                  </p>
                </div>

                {term.sourceUrl && (
                  <a
                    href={term.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-xs text-ink/55"
                  >
                    {term.sourceLabel ?? '查看官方说明'} →
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default GlossaryCards
