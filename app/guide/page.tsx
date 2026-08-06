import type { Metadata } from 'next'

import { JourneyExperience } from '@/components/guided/JourneyExperience'

export const metadata: Metadata = {
  title: '留学申请的七个阶段',
  description: '从课程选择到收到 Offer，先看清一条完整路径，再开始用数据择校。',
}

export default function GuidePage() {
  return <JourneyExperience />
}
