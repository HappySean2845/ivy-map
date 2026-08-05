import type { Metadata } from 'next'

import { GuidedChooser } from '@/components/guided/GuidedChooser'
import { parseGuideAnswers } from '@/lib/guided/preferences'

export const metadata: Metadata = {
  title: '一步步缩小大学范围',
  description: '用目的地、兴趣、课程路线和关注点，得到一组可解释的大学比较结果。',
}

export default async function GuidedChoosePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const answers = parseGuideAnswers(await searchParams)
  return <GuidedChooser initialAnswers={answers} />
}
