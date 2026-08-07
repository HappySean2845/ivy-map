'use client'

import Link from 'next/link'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

import { JOURNEY_STEPS } from '@/lib/guided/content'
import { CURRICULA } from '@/lib/guided/preferences'

export function JourneyExperience() {
  const routeRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: routeRef,
    offset: ['start 0.72', 'end 0.78'],
  })
  const progressOpacity = useTransform(scrollYProgress, [0, 0.06, 1], [0.25, 1, 1])

  return (
    <main className="overflow-hidden">
      <nav className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-xl border border-line bg-paper px-3 py-2.5 shadow-[var(--shadow-sm)] sm:px-4">
          <Link href="/" className="flex items-center gap-2.5 hover:no-underline">
            <span className="grid size-8 place-items-center rounded-full bg-forest font-display text-base font-semibold text-paper">
              I
            </span>
            <span className="label text-forest sm:hidden">IVY MAP · 路线</span>
            <span className="label hidden text-forest sm:inline">IVY MAP · 新手路线</span>
          </Link>
          <Link href="/universities" className="secondary-action min-h-9 px-4 text-xs">
            <span className="sm:hidden">跳过 →</span>
            <span className="hidden sm:inline">跳过，直接看数据 →</span>
          </Link>
        </div>
      </nav>

      <header className="soft-panel relative isolate mx-auto mt-5 flex min-h-[72svh] max-w-7xl items-end overflow-hidden px-5 pb-12 pt-20 sm:mt-7 sm:px-10 sm:pb-16 lg:px-14">
        <div aria-hidden className="scaffold absolute -top-3 -left-8 -z-10 opacity-[0.07]">
          01—07
        </div>
        <div className="grid w-full items-end gap-10 lg:grid-cols-[1fr_0.55fr]">
          <div>
            <p className="label text-ink/40">留学申请不是一次选择</p>
            <h1 className="mt-6 max-w-4xl text-[clamp(3.2rem,9vw,8.4rem)] leading-[0.86] tracking-[-0.055em]">
              它是一条
              <br />
              很长的路
            </h1>
          </div>
          <div className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
            <p className="text-[17px] leading-relaxed sm:text-xl">
              从课程体系到 Offer，七个阶段会把一个模糊的想法，慢慢变成可以行动的方向。
            </p>
            <p className="mt-5 text-xs leading-relaxed text-ink/45">
              这不是申请时间表，也不是结果承诺。你可以随时跳过，直接进入数据。
            </p>
          </div>
        </div>
      </header>

      <div ref={routeRef} className="relative mx-auto mt-10 max-w-6xl px-4 sm:px-8">
        <div
          aria-hidden
          className="absolute bottom-0 left-[30px] top-0 w-px bg-line md:left-1/2"
        />
        <motion.div
          aria-hidden
          className="absolute bottom-0 left-[30px] top-0 w-px origin-top bg-leaf md:left-1/2"
          style={{ scaleY: reducedMotion ? 1 : scrollYProgress, opacity: progressOpacity }}
        />

        <ol>
          {JOURNEY_STEPS.map((step, index) => {
            const onLeft = index % 2 === 0
            return (
              <li
                key={step.id}
                className="relative grid min-h-[52svh] items-center pl-14 md:grid-cols-2 md:pl-0"
              >
                <span
                  aria-hidden
                  className="absolute left-[20px] top-1/2 z-10 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-leaf bg-surface md:left-1/2 md:-translate-x-[9px]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-forest" />
                </span>

                <motion.article
                  initial={reducedMotion ? false : { opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className={`rounded-[14px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] md:max-w-[28rem] sm:p-6 ${
                    onLeft
                      ? 'md:mr-14 md:justify-self-end md:pr-2'
                      : 'md:col-start-2 md:ml-14 md:pl-2'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="label text-ink/45">{step.stage}</p>
                    <span className="text-3xl tracking-[-0.06em] text-ink/25 tnum">
                      {step.number}
                    </span>
                  </div>
                  <h2 className="mt-5 text-[clamp(2rem,4vw,3.8rem)] leading-[0.98] tracking-[-0.035em]">
                    {step.title}
                  </h2>
                  <p className="mt-5 text-base leading-relaxed text-ink/65">{step.body}</p>
                  <p className="label mt-8 rounded-r-xl border-l-2 border-leaf bg-cream py-2 pl-3 text-forest">
                    {step.signal}
                  </p>

                  {step.id === 'curriculum' && (
                    <div className="mt-7 border-t border-line">
                      {CURRICULA.filter((curriculum) => curriculum.id !== 'UNKNOWN').map(
                        (curriculum) => (
                          <div
                            key={curriculum.id}
                            className="grid gap-1 border-b border-line py-3 sm:grid-cols-[7rem_1fr] sm:gap-4"
                          >
                            <p className="text-sm">{curriculum.label.replace(' 路线', '')}</p>
                            <p className="text-xs leading-relaxed text-ink/50">
                              {curriculum.description}
                            </p>
                          </div>
                        ),
                      )}
                      <Link
                        href="/v2/glossary#ap"
                        className="mt-4 inline-flex min-h-10 items-center text-xs text-ink/55"
                      >
                        看完整术语解释 →
                      </Link>
                    </div>
                  )}

                  {step.id === 'selection' && (
                    <Link href="/guide/choose" className="primary-action mt-8 text-sm">
                      我已经想开始选校 →
                    </Link>
                  )}
                </motion.article>
              </li>
            )
          })}
        </ol>
      </div>

      <MapReveal reducedMotion={Boolean(reducedMotion)} />
    </main>
  )
}

function MapReveal({ reducedMotion }: { reducedMotion: boolean }) {
  const arcPaths = [
    'M18 76 C34 50 42 46 50 50',
    'M12 28 C30 34 38 42 50 50',
    'M50 50 C66 38 77 26 92 22',
    'M50 50 C70 52 82 68 94 78',
    'M25 92 C33 68 40 57 50 50',
  ]

  return (
    <section className="relative isolate mx-3 mt-20 overflow-hidden rounded-[18px] bg-forest-deep px-5 py-20 text-paper sm:mx-6 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="label text-sage">无数条路径，汇成一张地图</p>
          <h2 className="mt-6 text-[clamp(2.8rem,7vw,6.6rem)] leading-[0.9] tracking-[-0.05em]">
            每一段旅程
            <br />
            都值得被看见
          </h2>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-paper/65">
            IVY Map
            不替你做决定。它把前人走过的路线、公开的数据和仍然存在的空白，一起摆在你面前。
          </p>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-4">
            <Link
              href="/guide/choose"
              className="inline-flex min-h-12 items-center rounded-lg bg-paper px-5 text-base font-semibold text-forest-deep hover:no-underline"
            >
              开始一步步择校 →
            </Link>
            <Link
              href="/universities"
              className="inline-flex min-h-12 items-center rounded-lg border border-paper/25 px-5 text-sm text-paper/70 hover:no-underline"
            >
              直接看全部数据
            </Link>
          </div>
        </motion.div>

        <motion.svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="多条学生路径汇聚成地图"
          className="mx-auto aspect-square w-full max-w-[34rem] text-paper"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <circle
            cx="50"
            cy="50"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.28"
          />
          <ellipse
            cx="50"
            cy="50"
            rx="14"
            ry="30"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.22"
          />
          <path
            d="M20 50 H80 M24 38 H76 M24 62 H76"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.18"
          />
          {arcPaths.map((path, index) => (
            <motion.path
              key={path}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.75 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                duration: 0.7,
                delay: reducedMotion ? 0 : index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
          <circle cx="50" cy="50" r="2.2" fill="currentColor" />
        </motion.svg>
      </div>
    </section>
  )
}

export default JourneyExperience
