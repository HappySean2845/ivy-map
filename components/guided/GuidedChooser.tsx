'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  CURRICULA,
  DESTINATIONS,
  INTERESTS,
  PRIORITIES,
  guideSearchParams,
  labelFor,
  type DestinationId,
  type GuideAnswers,
  type GuidedCurriculum,
  type InterestId,
  type PriorityId,
} from '@/lib/guided/preferences'

const QUESTIONS = [
  {
    number: '01',
    eyebrow: '目的地',
    title: '你愿意去哪里？',
    description: '可以多选。还没有方向就保持“都可以”，结果不会先按国家排除。',
  },
  {
    number: '02',
    eyebrow: '学术兴趣',
    title: '什么会让你愿意多学几年？',
    description: '最多选三个方向。它只匹配大学的知名领域，不等于专业排名。',
  },
  {
    number: '03',
    eyebrow: '课程路线',
    title: '你正在读，或者倾向哪条路线？',
    description: '这会优先寻找已经有对应 AP、IB 或 A-Level 高中去向证据的大学。',
  },
  {
    number: '04',
    eyebrow: '比较重点',
    title: '你最想先看清什么？',
    description: '最多选两项。软性画像会明确标为编辑评估，不会冒充官方指标。',
  },
] as const

export function GuidedChooser({ initialAnswers }: { initialAnswers: GuideAnswers }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(initialAnswers)
  const question = QUESTIONS[step]

  const updateAnswers = (next: GuideAnswers) => {
    setAnswers(next)
    const query = guideSearchParams(next).toString()
    window.history.replaceState(null, '', query ? `/guide/choose?${query}` : '/guide/choose')
  }

  const finish = () => {
    const query = guideSearchParams(answers).toString()
    router.push(query ? `/guide/results?${query}` : '/guide/results')
  }

  return (
    <main className="min-h-[calc(100svh-65px)] px-4 sm:px-8">
      <div className="mx-auto max-w-6xl py-5 sm:py-8">
        <header className="flex items-center justify-between gap-4 border-b border-ink pb-4">
          <Link href="/guide" className="label hover:no-underline">
            <span className="sm:hidden">IVY MAP · 择校</span>
            <span className="hidden sm:inline">IVY MAP · 一步步择校</span>
          </Link>
          <Link href="/universities" className="text-xs text-ink/55">
            全部大学 →
          </Link>
        </header>

        <div className="grid min-h-[calc(100svh-150px)] lg:grid-cols-[1fr_0.38fr]">
          <section className="flex flex-col justify-between py-10 lg:border-r lg:border-ink lg:pr-14 lg:py-16">
            <div>
              <div className="flex items-baseline justify-between gap-5">
                <p className="label text-ink/40">
                  {question.number} / 04 · {question.eyebrow}
                </p>
                <span className="text-xs text-ink/35 tnum">
                  {Math.round(((step + 1) / 4) * 100)}%
                </span>
              </div>

              <div className="mt-3 h-px bg-ink/15">
                <div
                  className="h-px bg-ink transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `scaleX(${(step + 1) / 4})`, transformOrigin: 'left' }}
                />
              </div>

              <h1 className="mt-10 max-w-3xl text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.94] tracking-[-0.045em]">
                {question.title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink/55 sm:text-base">
                {question.description}
              </p>

              <div className="mt-10 sm:mt-14">
                {step === 0 && (
                  <MultiChoice
                    emptyLabel="都可以"
                    options={DESTINATIONS}
                    selected={answers.destinations}
                    onChange={(destinations) => updateAnswers({ ...answers, destinations })}
                  />
                )}
                {step === 1 && (
                  <MultiChoice
                    emptyLabel="还没想好"
                    options={INTERESTS}
                    selected={answers.interests}
                    max={3}
                    onChange={(interests) => updateAnswers({ ...answers, interests })}
                  />
                )}
                {step === 2 && (
                  <SingleChoice
                    options={CURRICULA}
                    selected={answers.curriculum}
                    onChange={(curriculum) => updateAnswers({ ...answers, curriculum })}
                  />
                )}
                {step === 3 && (
                  <PriorityChoice
                    selected={answers.priorities}
                    onChange={(priorities) => updateAnswers({ ...answers, priorities })}
                  />
                )}
              </div>
            </div>

            <div className="mt-12 flex items-center justify-between border-t border-ink pt-5">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="min-h-11 text-sm text-ink/55"
                >
                  ← 上一步
                </button>
              ) : (
                <Link
                  href="/guide"
                  className="inline-flex min-h-11 items-center text-sm text-ink/55"
                >
                  ← 回到路线
                </Link>
              )}

              <button
                type="button"
                onClick={
                  step === QUESTIONS.length - 1
                    ? finish
                    : () => setStep((current) => current + 1)
                }
                className="min-h-11 border-b border-ink text-sm"
              >
                {step === QUESTIONS.length - 1 ? '查看我的比较结果 →' : '下一步 →'}
              </button>
            </div>
          </section>

          <aside className="border-t border-ink py-8 lg:border-t-0 lg:py-16 lg:pl-10">
            <p className="label text-ink/40">你的方向</p>
            <dl className="mt-6 space-y-6 text-sm">
              <AnswerSummary
                label="目的地"
                value={
                  answers.destinations.length
                    ? answers.destinations.map((id) => labelFor(DESTINATIONS, id)).join('、')
                    : '都可以'
                }
              />
              <AnswerSummary
                label="兴趣"
                value={
                  answers.interests.length
                    ? answers.interests.map((id) => labelFor(INTERESTS, id)).join('、')
                    : '还没想好'
                }
              />
              <AnswerSummary label="课程" value={labelFor(CURRICULA, answers.curriculum)} />
              <AnswerSummary
                label="先看"
                value={answers.priorities.map((id) => labelFor(PRIORITIES, id)).join('、')}
              />
            </dl>
            <p className="mt-10 border-l border-ink/25 pl-3 text-xs leading-relaxed text-ink/45">
              我们只用这些条件整理顺序并写出理由，不会根据四个答案计算个人录取概率。
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}

function MultiChoice<T extends DestinationId | InterestId>({
  emptyLabel,
  options,
  selected,
  max,
  onChange,
}: {
  emptyLabel: string
  options: readonly { id: T; label: string }[]
  selected: T[]
  max?: number
  onChange: (selected: T[]) => void
}) {
  const toggle = (id: T) => {
    if (selected.includes(id)) onChange(selected.filter((item) => item !== id))
    else if (max == null || selected.length < max) onChange([...selected, id])
  }

  return (
    <div className="grid border-t border-ink sm:grid-cols-2">
      <ChoiceButton
        label={emptyLabel}
        selected={selected.length === 0}
        onClick={() => onChange([])}
      />
      {options.map((option) => (
        <ChoiceButton
          key={option.id}
          label={option.label}
          selected={selected.includes(option.id)}
          disabled={!selected.includes(option.id) && max != null && selected.length >= max}
          onClick={() => toggle(option.id)}
        />
      ))}
    </div>
  )
}

function SingleChoice({
  options,
  selected,
  onChange,
}: {
  options: typeof CURRICULA
  selected: GuidedCurriculum
  onChange: (selected: GuidedCurriculum) => void
}) {
  return (
    <div className="grid border-t border-ink sm:grid-cols-2">
      {options.map((option) => (
        <ChoiceButton
          key={option.id}
          label={option.label}
          selected={selected === option.id}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  )
}

function PriorityChoice({
  selected,
  onChange,
}: {
  selected: PriorityId[]
  onChange: (selected: PriorityId[]) => void
}) {
  const toggle = (id: PriorityId) => {
    if (selected.includes(id)) {
      const next = selected.filter((item) => item !== id)
      onChange(next.length ? next : ['evidence'])
    } else if (selected.length < 2) {
      onChange([...selected, id])
    }
  }

  return (
    <div className="grid border-t border-ink sm:grid-cols-2">
      {PRIORITIES.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={selected.includes(option.id)}
          disabled={!selected.includes(option.id) && selected.length >= 2}
          onClick={() => toggle(option.id)}
          className={`min-h-28 border-r border-b border-ink p-4 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-30 ${
            selected.includes(option.id) ? 'bg-ink text-paper' : 'bg-paper hover:bg-ink/[0.04]'
          }`}
        >
          <span className="block text-base">{option.label}</span>
          <span
            className={`mt-2 block text-xs ${selected.includes(option.id) ? 'text-paper/60' : 'text-ink/45'}`}
          >
            {option.note}
          </span>
        </button>
      ))}
    </div>
  )
}

function ChoiceButton({
  label,
  selected,
  disabled = false,
  onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-20 items-center justify-between gap-4 border-r border-b border-ink px-4 py-5 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-30 ${
        selected ? 'bg-ink text-paper' : 'bg-paper hover:bg-ink/[0.04]'
      }`}
    >
      <span>{label}</span>
      <span aria-hidden className="text-lg">
        {selected ? '×' : '+'}
      </span>
    </button>
  )
}

function AnswerSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-ink/15 pt-3 first:border-t-0 first:pt-0">
      <dt className="label text-ink/35">{label}</dt>
      <dd className="mt-1.5 leading-relaxed">{value}</dd>
    </div>
  )
}

export default GuidedChooser
