// 学校详情页。generateStaticParams 覆盖全部学校，保证整站静态。

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DeepCard } from '@/components/school/DeepCard'
import { dataset, schoolById, cityById } from '@/lib/data'
import { DEFAULT_FILTERS } from '@/lib/filters'

export function generateStaticParams() {
  return dataset.schools.map((s) => ({ id: s.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const school = schoolById.get(id)
  if (!school) return { title: '未收录的学校' }
  const city = cityById.get(school.cityId)?.name ?? ''
  // 每所学校独立 title（PRD US-8.5）—— 微信分享主要读 title
  return {
    title: `${school.nameCn} · 升学去向与入学门槛`,
    description: `${city}${school.nameCn}近三届的大学录取去向、毕业生规模、入学门槛与费用。数据均标注来源与置信等级。`,
  }
}

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const school = schoolById.get(id)
  if (!school) notFound()

  const city = cityById.get(school.cityId)?.name ?? ''

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <nav className="pt-5 text-sm">
        <Link href="/universities" className="secondary-action">
          ← 返回大学目录
        </Link>
      </nav>

      <header className="soft-panel mt-5 p-6 sm:p-8">
        <p className="label text-leaf">IVY MAP · 学校档案</p>
        <h1 className="mt-3 text-3xl leading-snug text-forest-deep sm:text-[42px]">
          {school.nameCn}
        </h1>
        <p className="mt-1.5 text-sm text-ink/60">
          {city}
          {school.district ? ` · ${school.district}` : ''}
        </p>
      </header>

      <div className="mt-6">
        <DeepCard schoolId={school.id} universityId={DEFAULT_FILTERS.universityId} />
      </div>
    </main>
  )
}
