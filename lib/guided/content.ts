export interface JourneyStep {
  id: string
  number: string
  stage: string
  title: string
  body: string
  signal: string
  signalNote?: string
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'curriculum',
    number: '01',
    stage: '初三 · 第一次选择',
    title: '选择课程路线',
    body: '决定留学后，AP、IB 和 A-Level 走进你的生活，而它们将改变你未来三年的课程、考试和大学申请方向。',
    signal: 'AP · IB · A-Level',
  },
  {
    id: 'language',
    number: '02',
    stage: '高一 · 语言考试',
    title: '走向梦想的第一步',
    body: 'TOEFL 或 IELTS 作为语言考试，考察学生基础的英语能力。总分、单项、有效期和豁免规则，都要按目标大学逐项核对。',
    signal: 'TOEFL · IELTS',
    signalNote:
      'TOEFL 偏重学术场景中的综合英语能力；IELTS 分学术类等版本。申请时要核对目标大学接受哪种考试，以及总分、单项、有效期和豁免规则。',
  },
  {
    id: 'profile',
    number: '03',
    stage: '高二 · 不断前进',
    title: '方向开始分岔',
    body: 'SAT、竞赛、活动、专业探索一项项压过来。要不要在某件事上长期投入，正逐渐成为申请人之中的分水岭。',
    signal: 'SAT · 活动 · 专业探索',
    signalNote:
      'SAT 是美国本科申请中常见的标准化考试，主要考察阅读与文法、数学。大学可能要求提交、可选提交或不考虑成绩，需逐校核对当年政策。',
  },
  {
    id: 'selection',
    number: '04',
    stage: '高二下 · 最困难的一步',
    title: '开始选校',
    body: '成百上千所大学、不同专业和申请要求摆在面前。真正重要的问题是：与你拥有相似背景和兴趣的学生，曾探索过怎样的道路？',
    signal: '方向 · 证据 · 比较',
  },
  {
    id: 'application',
    number: '05',
    stage: '高三上 · 申请季',
    title: '将努力整理成申请',
    body: '文书、推荐信、申请系统和接踵而至的截止日期，推动着你把自己的经历编织进申请的字里行间。',
    signal: '文书 · 推荐信 · 截止日期',
  },
  {
    id: 'submit',
    number: '06',
    stage: '提交申请',
    title: '提交申请',
    body: '过去三年的积累与选择，被浓缩在提交申请的那一次点击中。一个阶段暂时结束，但新的等待与可能性正在展开。',
    signal: '提交',
  },
  {
    id: 'offer',
    number: '07',
    stage: '等待结果',
    title: '直到 Offer 抵达',
    body: '在漫长而寂静的等待中，最终结果逐渐显现。邮件送达的那一刻，你会看到怎样的未来？',
    signal: 'Offer',
  },
]
