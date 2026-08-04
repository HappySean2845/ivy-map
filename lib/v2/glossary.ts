// 术语教学的文案。
//
// 这是漏斗的第二步，也是整个 v2 里唯一纯文案的部分。
//
// 写法上有一条自我要求：**每条术语必须有一句「家长最常搞错的」**。
// 只解释「AP 是美国大学先修课程」是百度百科干的事，家长看完还是不知道
// 该怎么用这个信息。真正有价值的是「没有 AP 文凭这回事」这种话 ——
// 它会直接改变一个人怎么看学校的宣传材料。

export type TermKind = 'curriculum' | 'score'

export interface Term {
  id: string
  /** 英文缩写，卡片上的大字 */
  name: string
  fullName: string
  nameCn: string
  kind: TermKind
  /** 一句话说清是什么 */
  oneLine: string
  /** 谁在用这条路 */
  who: string
  /** 怎么算分 / 怎么考 */
  howItWorks: string
  /** 家长最常搞错的一点。这一条是这个页面存在的理由 */
  misconception: string
}

export const TERM_KIND_LABEL: Record<TermKind, string> = {
  curriculum: '课程体系',
  score: '分数',
}

/**
 * 引导语：先给家长一个能挂东西的框架，再讲细节。
 * 五个词不是并列的 —— 前三个是互斥的三条路，后两个是路上都要交的两份分数。
 */
export const GLOSSARY_INTRO =
  '这五个词经常被摆在一起说，但它们不是一个层级的东西。AP、IB、A-Level 是三条**互斥的课程路线**，孩子进哪所高中基本就决定了走哪条；GPA 和 SAT 是**两份分数**，不管走哪条路都要交。先分清这两层，再看学校宣传就不会被绕进去。'

export const TERMS: Term[] = [
  {
    id: 'ap',
    name: 'AP',
    fullName: 'Advanced Placement',
    nameCn: '美国大学先修课程',
    kind: 'curriculum',
    oneLine: '美国高中生提前修的大学一年级课程，一门一考，5 分制。',
    who: '走美国路线的学生。国内多见于公办国际部的美高方向和美式国际化学校。',
    howItWorks:
      '完全按单科选修，一门课对应一场 5 月的考试，1–5 分，3 分算通过。理论上高分可以抵大学学分，实际上越顶尖的学校越不认。',
    misconception:
      'AP 不是一个「课程体系」，它是一堆互不相干的单科考试 —— **没有「AP 文凭」这回事**。学生可以只考 3 门，也可以考 10 门。所以「这是一所 AP 学校」只说明学校开了 AP 课，完全没说明学生实际考了几门、考成什么样。看学校要问的是具体科目和分数分布。',
  },
  {
    id: 'ib',
    name: 'IB',
    fullName: 'International Baccalaureate Diploma Programme',
    nameCn: '国际文凭大学预科课程',
    kind: 'curriculum',
    oneLine: '两年制的完整文凭课程，六个学科组加三项核心要求，满分 45。',
    who: '走全球路线的学生。英美加澳港都认，在外籍人员子女学校和民办国际化学校中最常见。',
    howItWorks:
      '六门课各 7 分共 42 分，再加上认识论（TOK）与拓展论文（EE）合计最多 3 分。要拿到文凭，TOK、四千字的 EE 和 CAS 活动三项缺一不可。',
    misconception:
      'IB 是「全都要」的体系：数学、母语、外语、科学、人文、艺术每组都得选一门，**不能只挑擅长的科目**。它的真正难点不在某一科有多深，而在于没有退路 —— 对均衡型的孩子是优势，对严重偏科的孩子是硬伤。判断一所 IB 学校，要看它的文凭通过率和平均分，而不只是看最高分。',
  },
  {
    id: 'alevel',
    name: 'A-Level',
    fullName: 'General Certificate of Education Advanced Level',
    nameCn: '英国高中课程',
    kind: 'curriculum',
    oneLine: '英国的高中课程，通常只选三到四门学到很深，按 A* 到 E 评级。',
    who: '走英国、香港、新加坡路线的学生。国内的剑桥国际学校和公办国际部的英联邦方向都走这条。',
    howItWorks:
      '分 AS 和 A2 两年，每科独立评级。英国大学发的是条件录取 —— 比如「A*AA」，意思是明年拿到这个成绩才算真录取。',
    misconception:
      '科目少不等于容易。牛剑的条件普遍在 A*A*A 这一档，笔试和面试还是另一道关。**它的风险是集中度 —— 只学三门，其中一门失手就没有替补科目去补。** 另外 A-Level 成绩在美国申请里作用有限：美国看的是 GPA、标化和活动，A-Level 只是课程难度的证明之一。',
  },
  {
    id: 'gpa',
    name: 'GPA',
    fullName: 'Grade Point Average',
    nameCn: '平均学分绩点',
    kind: 'score',
    oneLine: '在校三年成绩的加权平均，通常按 4.0 制换算。',
    who: '所有申请美国大学的人。它是美国招生里权重最高的单项。',
    howItWorks:
      '每门课的等级换成绩点再加权平均。分 weighted（加权，AP 和荣誉课额外加分，总分可以超过 4.0）和 unweighted（不加权，上限 4.0）两种算法，**每所高中的换算规则都不一样**。',
    misconception:
      'GPA 不能跨校直接比 —— A 校的 3.8 可能比 B 校的 4.2 更难拿。美国大学招生官读你的成绩单时，手里还有一份你学校的 school profile：这所高中历年送了多少人去哪里、课程难度如何、往届分数分布怎样。**换句话说，大学是带着对你高中的既有了解在读你的分数。** 这也正是「在哪所高中」这件事的分量所在。',
  },
  {
    id: 'sat',
    name: 'SAT',
    fullName: 'Scholastic Assessment Test',
    nameCn: '美国大学入学考试',
    kind: 'score',
    oneLine: '美国本科申请的标准化考试，满分 1600，分阅读文法与数学两部分。',
    who: '申请美国本科的人。部分学校目前是 test-optional（可选择不提交）。',
    howItWorks:
      '一年多次机会，可以反复考取最高分，部分学校接受拼分。2023 年起全面改为机考且题目自适应，考试时长比纸笔时代短。',
    misconception:
      '疫情后很多学校改成 test-optional，于是不少家长以为「不用考了」。但 **test-optional 不等于 test-blind** —— 不提交分数时，招生官只会把权重更多地压到 GPA 和课程难度上；而近两年一批顶尖学校已经在陆续恢复强制要求。另外，中国学生的数学部分在申请池里几乎没有区分度，真正拉开差距的是阅读文法。',
  },
]

export const TERM_BY_ID = new Map(TERMS.map((t) => [t.id, t]))
