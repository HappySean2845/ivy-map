export interface JourneyStep {
  id: string
  number: string
  stage: string
  title: string
  body: string
  signal: string
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'curriculum',
    number: '01',
    stage: '初三 · 第一次选择',
    title: '先选一条课程路线',
    body: '中考之后，AP、IB 和 A-Level 不只是三个缩写。它们会改变你未来三年的课程、考试和大学申请方向。',
    signal: 'AP · IB · A-Level',
  },
  {
    id: 'language',
    number: '02',
    stage: '高一 · 语言考试',
    title: '梦想第一次变成分数',
    body: 'TOEFL 或 IELTS 证明的是语言能力。总分、单项、有效期和豁免规则，都要按目标大学逐项核对。',
    signal: 'TOEFL · IELTS',
  },
  {
    id: 'profile',
    number: '03',
    stage: '高二 · 不断前进',
    title: '选择开始变多',
    body: 'SAT、竞赛、活动、专业探索接踵而来。重要的不是把清单填满，而是逐渐知道自己愿意长期投入什么。',
    signal: 'SAT · 活动 · 专业探索',
  },
  {
    id: 'selection',
    number: '04',
    stage: '高二下 · 最困难的一步',
    title: '开始选校',
    body: '成百上千所大学、不同专业和要求摆在面前。真正有用的问题是：像你这样的课程和兴趣，前人走过哪些路？',
    signal: '方向 · 证据 · 比较',
  },
  {
    id: 'application',
    number: '05',
    stage: '高三上 · 申请季',
    title: '把三年的努力整理成申请',
    body: '文书、推荐信、申请系统和一个又一个 Deadline，把零散经历组织成一份可以被理解的材料。',
    signal: '文书 · 推荐信 · Deadline',
  },
  {
    id: 'submit',
    number: '06',
    stage: '提交申请',
    title: '按下 Submit',
    body: '过去几年的准备，被浓缩成一次点击。路线没有在这里结束，只是暂时离开你的控制。',
    signal: 'Submit',
  },
  {
    id: 'offer',
    number: '07',
    stage: '等待结果',
    title: '直到 Offer 抵达',
    body: '期待和不安会同时存在。最后收到的不是一个排名答案，而是一条真实走完的个人路径。',
    signal: 'Offer',
  },
]
