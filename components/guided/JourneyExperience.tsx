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
      <nav className="sticky top-0 z-40 border-b border-ink/15 bg-paper/[0.94] px-4 py-3 backdrop-blur-sm sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="label hover:no-underline">
            <span className="sm:hidden">IVY MAP · 路线</span>
            <span className="hidden sm:inline">IVY MAP · 新手路线</span>
          </Link>
          <Link href="/universities" className="text-xs text-ink/60">
            <span className="sm:hidden">跳过 →</span>
            <span className="hidden sm:inline">跳过，直接看数据 →</span>
          </Link>
        </div>
      </nav>

      <header className="relative isolate mx-auto flex min-h-[78svh] max-w-6xl items-end px-4 pb-16 pt-20 sm:px-8 sm:pb-24">
        <div aria-hidden className="scaffold absolute -top-3 -left-8 -z-10 opacity-[0.07]">
          01—07
        </div>
        <div className="grid w-full items-end gap-10 lg:grid-cols-[1fr_0.55fr]">
          <div>
            <p className="label text-ink/40">留学是一系列相互影响的选择</p>
            <h1 className="mt-6 max-w-4xl text-[clamp(3.2rem,9vw,8.4rem)] leading-[0.86] tracking-[-0.055em]">
              看见你的
              <br />
              留学路
            </h1>
          </div>
          <div className="border-l border-ink pl-5">
            <p className="text-[17px] leading-relaxed sm:text-xl">
              从课程体系到 Offer，IVY Map 帮你将模糊想法变成清晰方向。
            </p>
            <p className="mt-5 text-xs leading-relaxed text-ink/45">
              本段仅作留学申请过程流程科普，你可以随时跳过，直接进入数据。
            </p>
          </div>
        </div>
      </header>

      <div ref={routeRef} className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <div
          aria-hidden
          className="absolute top-0 bottom-0 left-[30px] w-px bg-ink/12 md:left-1/2"
        />
        <motion.div
          aria-hidden
          className="absolute top-0 bottom-0 left-[30px] w-px origin-top bg-ink md:left-1/2"
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
                  className="absolute top-1/2 left-[22px] z-10 grid h-4 w-4 -translate-y-1/2 place-items-center border border-ink bg-paper md:left-1/2 md:-translate-x-[7px]"
                >
                  <span className="h-1 w-1 bg-ink" />
                </span>

                <motion.article
                  initial={reducedMotion ? false : { opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className={`border-t border-ink pt-5 md:max-w-[28rem] ${
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
                  <p className="label mt-8 border-l border-ink pl-3 text-ink/45">
                    {step.signal}
                  </p>
                  {step.signalNote && (
                    <p className="mt-3 text-xs leading-relaxed text-ink/50">
                      {step.signalNote}
                    </p>
                  )}

                  {step.id === 'curriculum' && (
                    <div className="mt-7 border-t border-ink/15">
                      {CURRICULA.filter((curriculum) => curriculum.id !== 'UNKNOWN').map(
                        (curriculum) => (
                          <div
                            key={curriculum.id}
                            className="grid gap-1 border-b border-ink/15 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4"
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
                    <Link
                      href="/guide/choose"
                      className="mt-8 inline-flex min-h-11 items-center border-b border-ink text-sm"
                    >
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
    <section className="relative isolate mt-20 overflow-hidden bg-ink px-4 py-20 text-paper sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="label text-paper/45">无数条路径，汇成一张地图</p>
          <h2 className="mt-6 text-[clamp(2.8rem,7vw,6.6rem)] leading-[0.9] tracking-[-0.05em]">
            每一段旅程
            <br />
            都值得被看见
          </h2>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-paper/65">
            IVY Map
            相信，方向来自无数人的探索。一个个选择、一段段经历，最终汇聚成可以参考的路径。我们整合公开数据与真实案例，让那些未被看见的路径重新浮现，让每一次重要选择，都拥有更多底气。
          </p>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-4">
            <Link
              href="/guide/choose"
              className="inline-flex min-h-12 items-center border-b border-paper text-base"
            >
              开始一步步择校 →
            </Link>
            <Link
              href="/universities"
              className="inline-flex min-h-12 items-center text-sm text-paper/60"
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
